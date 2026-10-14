import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { HostTrustRecord } from '../domain/types';
import { dbOperations } from '../storage/db';
import { AuditService } from '../audit/audit-service';

export interface HostVerificationResult {
  status: 'trusted' | 'unknown' | 'mismatch';
  hostname: string;
  port: number;
  keyType: string;
  fingerprint: string;
  rawPublicKey: string;
  existingRecord?: HostTrustRecord;
}

export class TrustStore {
  private static instance: TrustStore;

  private constructor() {}

  public static getInstance(): TrustStore {
    if (!TrustStore.instance) {
      TrustStore.instance = new TrustStore();
    }
    return TrustStore.instance;
  }

  public computeFingerprint(rawKeyBuffer: Buffer): string {
    const hash = crypto.createHash('sha256').update(rawKeyBuffer).digest('base64');
    return `SHA256:${hash}`;
  }

  public verifyHostKey(
    hostname: string,
    port: number,
    keyType: string,
    rawKey: Buffer
  ): HostVerificationResult {
    const fingerprint = this.computeFingerprint(rawKey);
    const rawPublicKey = rawKey.toString('base64');
    const records = dbOperations.getHostTrustRecords();

    // Find record matching hostname and port
    const existing = records.find(
      (r) =>
        (r.hostname_pattern === hostname || r.hostname_pattern === '*') &&
        (r.port === port || r.port === 0)
    );

    if (!existing) {
      AuditService.getInstance().logEvent({
        eventType: 'host_trust_prompt',
        action: 'verify_host_key_prompt',
        outcome: 'partial',
        resourceType: 'host',
        resourceId: `${hostname}:${port}`,
        metadata: { hostname, port, keyType, fingerprint }
      });

      return {
        status: 'unknown',
        hostname,
        port,
        keyType,
        fingerprint,
        rawPublicKey
      };
    }

    if (existing.key_or_ca_fingerprint === fingerprint && existing.status === 'active') {
      return {
        status: 'trusted',
        hostname,
        port,
        keyType,
        fingerprint,
        rawPublicKey,
        existingRecord: existing
      };
    }

    // Fingerprint differs: MISMATCH / CHANGED KEY!
    AuditService.getInstance().logEvent({
      eventType: 'host_key_mismatch',
      action: 'host_key_mismatch_detected',
      outcome: 'denied',
      resourceType: 'host',
      resourceId: `${hostname}:${port}`,
      reason: 'Server presented key differs from trusted fingerprint on record',
      metadata: {
        hostname,
        port,
        previousFingerprint: existing.key_or_ca_fingerprint,
        presentedFingerprint: fingerprint
      }
    });

    return {
      status: 'mismatch',
      hostname,
      port,
      keyType,
      fingerprint,
      rawPublicKey,
      existingRecord: existing
    };
  }

  public acceptHostKey(params: {
    hostname: string;
    port: number;
    keyType: string;
    fingerprint: string;
    rawPublicKey: string;
    verifiedBy: string;
    reason?: string;
  }): HostTrustRecord {
    const record: HostTrustRecord = {
      id: uuidv4(),
      hostname_pattern: params.hostname,
      port: params.port,
      key_or_ca_fingerprint: params.fingerprint,
      key_type: params.keyType,
      raw_public_key: params.rawPublicKey,
      source: 'manually_verified',
      verified_by: params.verifiedBy || 'operator',
      verified_at: new Date().toISOString(),
      expires_at: null,
      status: 'active',
      reason: params.reason || 'Manually verified and accepted by operator'
    };

    dbOperations.saveHostTrustRecord(record);

    AuditService.getInstance().logEvent({
      eventType: 'host_trust_accepted',
      action: 'accept_unknown_host_key',
      outcome: 'success',
      resourceType: 'host',
      resourceId: `${params.hostname}:${params.port}`,
      metadata: {
        hostname: params.hostname,
        port: params.port,
        fingerprint: params.fingerprint,
        keyType: params.keyType
      }
    });

    return record;
  }

  public rotateHostKey(params: {
    recordId: string;
    newFingerprint: string;
    newKeyType: string;
    newRawKey: string;
    verifiedBy: string;
    changeReference: string;
    reason: string;
  }): void {
    const records = dbOperations.getHostTrustRecords();
    const existing = records.find((r) => r.id === params.recordId);
    if (!existing) throw new Error('Host trust record not found');

    const updated: HostTrustRecord = {
      ...existing,
      key_or_ca_fingerprint: params.newFingerprint,
      key_type: params.newKeyType,
      raw_public_key: params.newRawKey,
      verified_by: params.verifiedBy,
      verified_at: new Date().toISOString(),
      reason: `Rotated: ${params.reason} (Ticket: ${params.changeReference})`
    };

    dbOperations.saveHostTrustRecord(updated);

    AuditService.getInstance().logEvent({
      eventType: 'host_key_rotated',
      action: 'rotate_host_key',
      outcome: 'success',
      resourceType: 'host',
      resourceId: `${existing.hostname_pattern}:${existing.port}`,
      changeReference: params.changeReference,
      reason: params.reason,
      metadata: {
        previousFingerprint: existing.key_or_ca_fingerprint,
        newFingerprint: params.newFingerprint
      }
    });
  }

  public revokeHostKey(recordId: string, reason: string): void {
    const records = dbOperations.getHostTrustRecords();
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return;

    existing.status = 'revoked';
    existing.reason = `Revoked: ${reason}`;
    dbOperations.saveHostTrustRecord(existing);

    AuditService.getInstance().logEvent({
      eventType: 'host_trust_rejected',
      action: 'revoke_host_key',
      outcome: 'success',
      resourceType: 'host',
      resourceId: `${existing.hostname_pattern}:${existing.port}`,
      reason
    });
  }
}
