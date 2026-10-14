# DgodTerm Operations Guide

## 1. Host Key Rotation Workflow
When a remote host replaces its host key (e.g., during OS upgrades or scheduled key rotation):
1. The operator attempts connection; DgodTerm detects the fingerprint discrepancy.
2. DgodTerm blocks connection and flags a "Host Key Mismatch Alert".
3. The operator verifies the new fingerprint out-of-band with infrastructure team.
4. The operator enters an authorized Rotation Reason and Change Ticket ID.
5. DgodTerm records a `host_key_rotated` audit event into the tamper-evident log and updates the record.

## 2. Emergency Credential Revocation
If a private key or SSH certificate is suspected to be compromised:
1. Navigate to Settings -> Credentials.
2. Invalidate the Credential Reference.
3. If an enterprise identity provider is configured, trigger revocation broadcast.

## 3. Support Bundle Generation
1. Go to Settings -> Support & Diagnostics.
2. Click "Generate Support Diagnostic Bundle".
3. Review the scrubbed system diagnostics in the modal (the redaction engine automatically strips private keys, passwords, and tokens).
4. Click "Export Bundle" to save the `.json` file for technical support.
