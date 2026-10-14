import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuditEvent, AuditEventType } from '../domain/types';
import { dbOperations } from '../storage/db';
import { redactObject } from '../redaction/redactor';

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public logEvent(params: {
    eventType: AuditEventType;
    actorId?: string;
    actorRole?: string;
    correlationId?: string;
    resourceType?: string | null;
    resourceId?: string | null;
    action: string;
    outcome: 'success' | 'denied' | 'failed' | 'partial';
    reason?: string | null;
    changeReference?: string | null;
    policyVersion?: string | null;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
    const actorId = params.actorId || 'local-operator';
    const actorRole = params.actorRole || 'secops-admin';
    const correlationId = params.correlationId || uuidv4();
    const eventId = uuidv4();
    const occurredAt = new Date().toISOString();
    const sanitizedMeta = redactObject(params.metadata || {});

    const previousLink = dbOperations.getLatestAuditIntegrityLink();

    // Canonical payload for hash chaining
    const canonicalPayload = JSON.stringify({
      event_id: eventId,
      event_type: params.eventType,
      actor_id: actorId,
      actor_role: actorRole,
      occurred_at: occurredAt,
      correlation_id: correlationId,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      action: params.action,
      outcome: params.outcome,
      reason: params.reason || null,
      change_reference: params.changeReference || null,
      policy_version: params.policyVersion || null,
      metadata: sanitizedMeta,
      prev: previousLink
    });

    const integrityLink = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');

    const event: AuditEvent = {
      event_id: eventId,
      event_type: params.eventType,
      actor_id: actorId,
      actor_role: actorRole,
      occurred_at: occurredAt,
      correlation_id: correlationId,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      action: params.action,
      outcome: params.outcome,
      reason: params.reason || null,
      change_reference: params.changeReference || null,
      policy_version: params.policyVersion || null,
      metadata: sanitizedMeta,
      integrity_link: integrityLink
    };

    dbOperations.saveAuditEvent(event);
    return event;
  }

  public getEvents(limit = 200): AuditEvent[] {
    return dbOperations.getAuditEvents(limit);
  }

  /**
   * Verifies the cryptographic hash integrity of the audit log chain.
   */
  public verifyAuditIntegrity(): {
    isValid: boolean;
    totalEvents: number;
    tamperedEventIndex: number | null;
    message: string;
  } {
    const events = dbOperations.getAuditEvents(1000);
    // Sort chronological (oldest to newest)
    const chronological = [...events].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    if (chronological.length === 0) {
      return {
        isValid: true,
        totalEvents: 0,
        tamperedEventIndex: null,
        message: 'No events in audit log.'
      };
    }

    let expectedPrev = 'GENESIS_INTEGRITY_LINK_DGODTERM_0000000000';

    for (let i = 0; i < chronological.length; i++) {
      const ev = chronological[i];
      const payload = JSON.stringify({
        event_id: ev.event_id,
        event_type: ev.event_type,
        actor_id: ev.actor_id,
        actor_role: ev.actor_role,
        occurred_at: ev.occurred_at,
        correlation_id: ev.correlation_id,
        resource_type: ev.resource_type || null,
        resource_id: ev.resource_id || null,
        action: ev.action,
        outcome: ev.outcome,
        reason: ev.reason || null,
        change_reference: ev.change_reference || null,
        policy_version: ev.policy_version || null,
        metadata: ev.metadata,
        prev: expectedPrev
      });

      const calculatedHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
      if (calculatedHash !== ev.integrity_link) {
        return {
          isValid: false,
          totalEvents: chronological.length,
          tamperedEventIndex: i,
          message: `Integrity check failed at event ${ev.event_id} (${ev.occurred_at}). Hash mismatch detected!`
        };
      }
      expectedPrev = calculatedHash;
    }

    return {
      isValid: true,
      totalEvents: chronological.length,
      tamperedEventIndex: null,
      message: `Audit chain fully validated: all ${chronological.length} events verified with SHA-256 integrity.`
    };
  }
}
