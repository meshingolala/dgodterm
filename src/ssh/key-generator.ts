import crypto from 'crypto';
import { GeneratedSSHKeyPair } from '../domain/types';
import { AuditService } from '../audit/audit-service';

export interface GenerateKeyOptions {
  type: 'ed25519' | 'rsa';
  bits?: number;
  comment?: string;
  passphrase?: string;
}

export class SSHKeyGenerator {
  public static generateKeyPair(options: GenerateKeyOptions): GeneratedSSHKeyPair {
    const keyType = options.type || 'ed25519';
    const comment = (options.comment || `operator@dgodterm-${new Date().toISOString().slice(0, 10)}`).trim();

    let publicKeyStr = '';
    let privateKeyStr = '';
    let fingerprintStr = '';

    if (keyType === 'ed25519') {
      const privateEncoding: any = {
        type: 'pkcs8',
        format: 'pem'
      };
      if (options.passphrase && options.passphrase.trim().length > 0) {
        (privateEncoding as any).cipher = 'aes-256-cbc';
        (privateEncoding as any).passphrase = options.passphrase.trim();
      }

      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: privateEncoding
      });

      // Extract raw 32-byte Ed25519 public key
      const rawPub = (publicKey as Buffer).subarray(publicKey.length - 32);
      const typeStr = 'ssh-ed25519';
      const typeBuf = Buffer.from(typeStr, 'utf8');
      const totalLen = 4 + typeBuf.length + 4 + rawPub.length;
      const wireBuf = Buffer.alloc(totalLen);

      let offset = 0;
      wireBuf.writeUInt32BE(typeBuf.length, offset);
      offset += 4;
      typeBuf.copy(wireBuf, offset);
      offset += typeBuf.length;
      wireBuf.writeUInt32BE(rawPub.length, offset);
      offset += 4;
      rawPub.copy(wireBuf, offset);

      const b64 = wireBuf.toString('base64');
      publicKeyStr = `${typeStr} ${b64} ${comment}`;
      privateKeyStr = privateKey as string;
      fingerprintStr = `SHA256:${crypto.createHash('sha256').update(wireBuf).digest('base64')}`;
    } else {
      // RSA (defaults to 4096-bit for high security)
      const bits = options.bits === 2048 ? 2048 : 4096;
      const privateEncoding: any = {
        type: 'pkcs1',
        format: 'pem'
      };
      if (options.passphrase && options.passphrase.trim().length > 0) {
        (privateEncoding as any).cipher = 'aes-256-cbc';
        (privateEncoding as any).passphrase = options.passphrase.trim();
      }

      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: bits,
        publicKeyEncoding: { type: 'pkcs1', format: 'der' },
        privateKeyEncoding: privateEncoding
      });

      const keyObj = crypto.createPublicKey({ key: publicKey as Buffer, format: 'der', type: 'pkcs1' });
      const jwk = keyObj.export({ format: 'jwk' });

      let eBuf = Buffer.from(jwk.e || 'AQAB', 'base64url');
      if (eBuf[0] & 0x80) eBuf = Buffer.concat([Buffer.from([0]), eBuf]);

      let nBuf = Buffer.from(jwk.n || '', 'base64url');
      if (nBuf[0] & 0x80) nBuf = Buffer.concat([Buffer.from([0]), nBuf]);

      const typeStr = 'ssh-rsa';
      const typeBuf = Buffer.from(typeStr, 'utf8');
      const totalLen = 4 + typeBuf.length + 4 + eBuf.length + 4 + nBuf.length;
      const wireBuf = Buffer.alloc(totalLen);

      let offset = 0;
      wireBuf.writeUInt32BE(typeBuf.length, offset);
      offset += 4;
      typeBuf.copy(wireBuf, offset);
      offset += typeBuf.length;

      wireBuf.writeUInt32BE(eBuf.length, offset);
      offset += 4;
      eBuf.copy(wireBuf, offset);
      offset += eBuf.length;

      wireBuf.writeUInt32BE(nBuf.length, offset);
      offset += 4;
      nBuf.copy(wireBuf, offset);

      const b64 = wireBuf.toString('base64');
      publicKeyStr = `${typeStr} ${b64} ${comment}`;
      privateKeyStr = privateKey as string;
      fingerprintStr = `SHA256:${crypto.createHash('sha256').update(wireBuf).digest('base64')}`;
    }

    AuditService.getInstance().logEvent({
      eventType: 'ssh_key_generated',
      action: 'generate_keypair',
      outcome: 'success',
      resourceType: 'credential',
      metadata: {
        keyType,
        fingerprint: fingerprintStr,
        hasPassphrase: Boolean(options.passphrase && options.passphrase.trim().length > 0)
      }
    });

    return {
      type: keyType,
      publicKey: publicKeyStr,
      privateKey: privateKeyStr,
      fingerprint: fingerprintStr,
      comment
    };
  }
}
