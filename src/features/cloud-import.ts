import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { dbOperations } from '../storage/db';
import { ConnectionProfile } from '../domain/types';
import { AuditService } from '../audit/audit-service';

export interface CloudInstance {
  id: string;
  name: string;
  publicIp?: string;
  privateIp?: string;
  region: string;
  status: string;
  tags: string[];
  os?: string;
  provider: 'digitalocean' | 'hetzner' | 'linode' | 'aws';
}

function awsSigV4Headers(params: {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: string;
}): Record<string, string> {
  const { method, host, path: reqPath, region, service, accessKeyId, secretAccessKey, body } = params;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  const canonicalRequest = `${method}\n${reqPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  function hmac(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  const kDate = hmac('AWS4' + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Host: host,
    'x-amz-date': amzDate,
    Authorization: authHeader,
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
  };
}

export const cloudImportHandlers = {
  'cloud:discover': async (payload: {
    provider: 'digitalocean' | 'hetzner' | 'linode' | 'aws';
    token?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
  }): Promise<{ instances: CloudInstance[]; error?: string }> => {
    const { provider, token, accessKeyId, secretAccessKey, region = 'us-east-1' } = payload;
    const instances: CloudInstance[] = [];

    try {
      if (provider === 'digitalocean') {
        if (!token) throw new Error('DigitalOcean API token required');
        const resp = await fetch('https://api.digitalocean.com/v2/droplets?per_page=200', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`DigitalOcean API error: ${resp.status}`);
        const data: any = await resp.json();
        for (const d of data.droplets || []) {
          const pub = (d.networks?.v4 || []).find((n: any) => n.type === 'public')?.ip_address;
          const priv = (d.networks?.v4 || []).find((n: any) => n.type === 'private')?.ip_address;
          instances.push({
            id: String(d.id),
            name: d.name,
            publicIp: pub,
            privateIp: priv,
            region: d.region?.name || d.region?.slug || 'unknown',
            status: d.status,
            tags: d.tags || [],
            os: d.image?.distribution ? `${d.image.distribution} ${d.image.name}` : undefined,
            provider: 'digitalocean'
          });
        }
      } else if (provider === 'hetzner') {
        if (!token) throw new Error('Hetzner API token required');
        const resp = await fetch('https://api.hetzner.cloud/v1/servers?per_page=50', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`Hetzner API error: ${resp.status}`);
        const data: any = await resp.json();
        for (const s of data.servers || []) {
          instances.push({
            id: String(s.id),
            name: s.name,
            publicIp: s.public_net?.ipv4?.ip,
            region: s.datacenter?.location?.name || 'unknown',
            status: s.status,
            tags: Object.keys(s.labels || {}),
            os: s.image?.description,
            provider: 'hetzner'
          });
        }
      } else if (provider === 'linode') {
        if (!token) throw new Error('Linode API token required');
        const resp = await fetch('https://api.linode.com/v4/linode/instances', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`Linode API error: ${resp.status}`);
        const data: any = await resp.json();
        for (const l of data.data || []) {
          instances.push({
            id: String(l.id),
            name: l.label,
            publicIp: (l.ipv4 || [])[0],
            region: l.region,
            status: l.status,
            tags: l.tags || [],
            os: l.image,
            provider: 'linode'
          });
        }
      } else if (provider === 'aws') {
        if (!accessKeyId || !secretAccessKey) throw new Error('AWS Access Key ID and Secret Key required');
        const host = `ec2.${region}.amazonaws.com`;
        const body = 'Action=DescribeInstances&Version=2016-11-15';
        const headers = awsSigV4Headers({
          method: 'POST',
          host,
          path: '/',
          region,
          service: 'ec2',
          accessKeyId,
          secretAccessKey,
          body
        });

        const resp = await fetch(`https://${host}/`, { method: 'POST', headers, body });
        if (!resp.ok) throw new Error(`AWS EC2 error: ${resp.status} ${await resp.text()}`);
        const xml = await resp.text();

        // Extract instances from DescribeInstances XML response
        const instanceMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const block of instanceMatches) {
          if (!block.includes('<instanceId>')) continue;
          const id = block.match(/<instanceId>(.*?)<\/instanceId>/)?.[1] || '';
          const ip = block.match(/<ipAddress>(.*?)<\/ipAddress>/)?.[1];
          const privIp = block.match(/<privateIpAddress>(.*?)<\/privateIpAddress>/)?.[1];
          const nameTag = block.match(/<key>Name<\/key>\s*<value>(.*?)<\/value>/)?.[1];
          const state = block.match(/<name>(running|stopped|terminated|pending)<\/name>/)?.[1] || 'unknown';

          if (id) {
            instances.push({
              id,
              name: nameTag || id,
              publicIp: ip,
              privateIp: privIp,
              region,
              status: state,
              tags: nameTag ? [nameTag] : [],
              provider: 'aws'
            });
          }
        }
      }

      return { instances };
    } catch (err: any) {
      return { instances: [], error: err.message || 'Discovery failed' };
    }
  },

  'cloud:import': async (payload: {
    instances: CloudInstance[];
    username: string;
    port?: number;
    folderName?: string;
    useIp?: 'public' | 'private';
  }): Promise<{ imported: number; skipped: number }> => {
    const { instances, username, port = 22, folderName = 'Cloud Imports', useIp = 'public' } = payload;
    const existing = dbOperations.getProfiles();
    const existingHosts = new Set(existing.map((p) => `${p.hostname}:${p.port}`));

    // Find or create folder
    const folders = dbOperations.getFolders();
    let folder = folders.find((f) => f.name.toLowerCase() === folderName.toLowerCase());
    if (!folder) {
      folder = {
        id: `folder-cloud-${Date.now()}`,
        name: folderName,
        parent_id: null,
        created_at: new Date().toISOString()
      };
      dbOperations.saveFolder(folder);
    }

    let imported = 0;
    let skipped = 0;

    for (const inst of instances) {
      const targetHost = useIp === 'private' ? (inst.privateIp || inst.publicIp) : (inst.publicIp || inst.privateIp);
      if (!targetHost) {
        skipped++;
        continue;
      }

      if (existingHosts.has(`${targetHost}:${port}`)) {
        skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const newProfile: ConnectionProfile = {
        id: `prof-cloud-${uuidv4()}`,
        schema_version: 1,
        display_name: `${inst.name} (${inst.provider})`,
        hostname: targetHost,
        port,
        username: username || 'ubuntu',
        folder_id: folder.id,
        tags: [inst.provider, inst.region, ...inst.tags].filter(Boolean),
        jump_host_profile_id: null,
        auth_reference: null,
        host_trust_policy_id: null,
        ssh_options: {},
        is_favorite: false,
        last_connected_at: null,
        created_at: now,
        updated_at: now,
        created_by: 'cloud-importer'
      };

      dbOperations.saveProfile(newProfile);
      existingHosts.add(`${targetHost}:${port}`);
      imported++;
    }

    AuditService.getInstance().logEvent({
      eventType: 'profile_imported',
      action: 'cloud_instances_import',
      outcome: 'success',
      resourceType: 'connection_profiles',
      metadata: { imported, skipped, folderName }
    });

    return { imported, skipped };
  }
};
