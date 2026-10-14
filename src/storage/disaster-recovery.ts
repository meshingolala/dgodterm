import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { dbOperations } from '../storage/db';
import { AuditService } from '../audit/audit-service';

export interface DisasterRecoveryBundle {
  version: number;
  timestamp: string;
  iv: string;
  salt: string;
  tag: string;
  cipherText: string;
}

export class DisasterRecoveryService {
  private static instance: DisasterRecoveryService;

  private constructor() {}

  public static getInstance(): DisasterRecoveryService {
    if (!DisasterRecoveryService.instance) {
      DisasterRecoveryService.instance = new DisasterRecoveryService();
    }
    return DisasterRecoveryService.instance;
  }

  /**
   * Creates an AES-256-GCM encrypted snapshot containing profiles, folders, snippets, tunnels, and settings.
   */
  public exportEncryptedBackup(passphrase: string): string {
    if (!passphrase || passphrase.length < 6) {
      throw new Error('Master backup passphrase must be at least 6 characters long.');
    }

    const payload = {
      timestamp: new Date().toISOString(),
      version: 1,
      profiles: dbOperations.getProfiles(),
      folders: dbOperations.getFolders(),
      snippets: dbOperations.getSnippets(),
      tunnels: dbOperations.getTunnels(),
      auditChainVerification: AuditService.getInstance().verifyAuditIntegrity()
    };

    const json = JSON.stringify(payload);
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const bundle: DisasterRecoveryBundle = {
      version: 1,
      timestamp: new Date().toISOString(),
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      cipherText: encrypted.toString('hex')
    };

    AuditService.getInstance().logEvent({
      eventType: 'configuration_drift_checked',
      action: 'disaster_recovery_backup_created',
      outcome: 'success',
      metadata: { profilesCount: payload.profiles.length, foldersCount: payload.folders.length }
    });

    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Decrypts and restores an encrypted backup package.
   */
  public restoreEncryptedBackup(backupJson: string, passphrase: string): { restoredProfiles: number; restoredFolders: number; restoredSnippets: number } {
    const bundle: DisasterRecoveryBundle = JSON.parse(backupJson);
    if (!bundle.salt || !bundle.iv || !bundle.tag || !bundle.cipherText) {
      throw new Error('Invalid or corrupted DgodTerm backup file format.');
    }

    const salt = Buffer.from(bundle.salt, 'hex');
    const iv = Buffer.from(bundle.iv, 'hex');
    const tag = Buffer.from(bundle.tag, 'hex');
    const encrypted = Buffer.from(bundle.cipherText, 'hex');

    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted: string;
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (e) {
      throw new Error('Invalid passphrase or corrupted encrypted backup data.');
    }

    const data = JSON.parse(decrypted);

    let restoredFolders = 0;
    if (Array.isArray(data.folders)) {
      for (const f of data.folders) {
        dbOperations.saveFolder(f);
        restoredFolders++;
      }
    }

    let restoredProfiles = 0;
    if (Array.isArray(data.profiles)) {
      for (const p of data.profiles) {
        dbOperations.saveProfile(p);
        restoredProfiles++;
      }
    }

    let restoredSnippets = 0;
    if (Array.isArray(data.snippets)) {
      for (const s of data.snippets) {
        dbOperations.saveSnippet(s);
        restoredSnippets++;
      }
    }

    AuditService.getInstance().logEvent({
      eventType: 'profile_imported',
      action: 'disaster_recovery_backup_restored',
      outcome: 'success',
      metadata: { restoredProfiles, restoredFolders, restoredSnippets }
    });

    return { restoredProfiles, restoredFolders, restoredSnippets };
  }

  /**
   * Generates a comprehensive sanitized system diagnostic report for troubleshooting.
   */
  public generateDiagnosticsReport(): Record<string, any> {
    const profiles = dbOperations.getProfiles();
    const auditStatus = AuditService.getInstance().verifyAuditIntegrity();

    return {
      appName: 'DgodTerm Workstation',
      appVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      platform: {
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        node: process.version,
        electron: (process.versions as any).electron || 'N/A',
        v8: process.versions.v8,
        memoryUsage: process.memoryUsage()
      },
      workstationStats: {
        totalProfiles: profiles.length,
        foldersCount: dbOperations.getFolders().length,
        snippetsCount: dbOperations.getSnippets().length,
        tunnelsCount: dbOperations.getTunnels().length,
        activeSSHConnections: profiles.filter((p) => p.last_connected_at).length
      },
      cryptographicAuditStatus: auditStatus,
      securityControls: {
        strictHostVerification: true,
        secretRedactionEngine: 'ACTIVE',
        auditChainVerification: auditStatus.isValid ? 'VERIFIED' : 'TAMPERED_OR_EMPTY'
      }
    };
  }
}
