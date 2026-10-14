# ADR-003: Local-First and Enterprise Boundaries

## Status
Accepted

## Context
DgodTerm serves individual operations engineers running locally while enabling seamless integration into enterprise fleet governance (separation of duties, centralized audit aggregation, policy enforcement).

## Decision
1. In standalone local mode, persistence is local-first using SQLite and OS Credential Broker. Policies and trust stores are managed locally with tamper-evident audit chaining.
2. In enterprise mode, DgodTerm supports connecting to an enterprise policy and audit service. Policy decisions for high-impact production environments enforce independent peer sign-off (separation of duties) and record immutable change request identifiers.

## Consequences
- Operations remain autonomous during network isolation.
- Enterprise governance can be enforced progressively without re-architecting the desktop client.
