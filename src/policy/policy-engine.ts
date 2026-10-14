import fs from 'fs';
import path from 'path';
import { ConnectionProfile, Policy } from '../domain/types';

export class PolicyEngine {
  private static instance: PolicyEngine;
  private currentPolicy: Policy;

  private constructor() {
    this.currentPolicy = this.loadDefaultPolicy();
  }

  public static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  private loadDefaultPolicy(): Policy {
    try {
      const policyPath = path.resolve(process.cwd(), 'policies', 'default-policy.json');
      if (fs.existsSync(policyPath)) {
        return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to read policy file, using built-in strict policy', e);
    }

    return {
      policy_id: 'default-fallback-strict',
      name: 'Default Strict Policy',
      description: 'Strict security defaults',
      scope: { environments: ['default'] },
      ssh: {
        host_key_mode: 'strict',
        allow_legacy_algorithms: false,
        agent_forwarding: 'disabled',
        x11_forwarding: 'disabled',
        supported_kex: ['curve25519-sha256', 'ecdh-sha2-nistp256'],
        supported_ciphers: ['chacha20-poly1305@openssh.com', 'aes256-gcm@openssh.com']
      },
      automation: {
        max_targets_without_approval: 25,
        production_requires_approval: false,
        require_change_reference: false,
        self_approval: true,
        default_serial: 2,
        failure_threshold: 2,
        max_run_minutes: 60
      },
      credentials: {
        persistent_passwords: false,
        require_short_lived_certificates: false
      },
      logging: {
        secrets: 'never',
        terminal_recording: 'disabled'
      }
    };
  }

  public getActivePolicy(): Policy {
    return this.currentPolicy;
  }

  public setPolicy(policy: Policy): void {
    this.currentPolicy = policy;
  }

  public validateConnection(profile: ConnectionProfile): {
    allowed: boolean;
    reason?: string;
  } {
    const policy = this.currentPolicy;

    // Agent forwarding check
    if (profile.ssh_options?.agent_forwarding && policy.ssh.agent_forwarding === 'disabled') {
      return {
        allowed: false,
        reason: 'Policy violation: SSH Agent Forwarding is strictly disabled by active governance policy.'
      };
    }

    // X11 forwarding check
    if (profile.ssh_options?.x11_forwarding && policy.ssh.x11_forwarding === 'disabled') {
      return {
        allowed: false,
        reason: 'Policy violation: X11 Forwarding is strictly disabled by active governance policy.'
      };
    }

    return { allowed: true };
  }

  public evaluateAutomation(params: {
    targetCount: number;
    environment: string;
    requesterId: string;
    changeReference?: string | null;
    approvals?: Array<{ actor: string; approved_at: string; rationale: string; scope: string }>;
  }): {
    decision: 'allow' | 'deny' | 'approval_required';
    reasons: string[];
  } {
    const policy = this.currentPolicy;
    const reasons: string[] = [];

    const isProduction =
      params.environment.toLowerCase() === 'production' ||
      params.environment.toLowerCase().includes('prod');

    // 1. Target count limit (only checked in production)
    if (isProduction && params.targetCount > policy.automation.max_targets_without_approval) {
      reasons.push(
        `Target count (${params.targetCount}) exceeds threshold without approval (${policy.automation.max_targets_without_approval})`
      );
    }

    // 2. Production approval requirement
    if (isProduction && policy.automation.production_requires_approval) {
      reasons.push('Production environment requires formal authorization');
    }

    // 3. Change reference requirement
    if (isProduction && policy.automation.require_change_reference && !params.changeReference?.trim()) {
      reasons.push('Change Reference (e.g. CR-Ticket) is mandatory for execution under current policy');
    }

    if (reasons.length === 0) {
      return { decision: 'allow', reasons: [] };
    }

    // Check if approvals satisfy the requirement
    const approvals = params.approvals || [];
    if (approvals.length > 0) {
      // Check separation of duties
      if (isProduction && !policy.automation.self_approval) {
        const hasIndependentApproval = approvals.some((a) => a.actor !== params.requesterId);
        if (!hasIndependentApproval) {
          return {
            decision: 'deny',
            reasons: [
              ...reasons,
              'Separation of duties violated: Requester cannot self-approve high-impact production runs.'
            ]
          };
        }
      }

      if (isProduction && policy.automation.require_change_reference && !params.changeReference?.trim()) {
        return {
          decision: 'deny',
          reasons: [...reasons, 'Missing mandatory Change Reference.']
        };
      }

      return { decision: 'allow', reasons: [] };
    }

    return { decision: 'approval_required', reasons };
  }
}
