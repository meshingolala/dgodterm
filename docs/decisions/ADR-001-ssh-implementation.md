# ADR-001: SSH Protocol Implementation Strategy

## Status
Accepted

## Context
DgodTerm requires a modern, secure SSH-2 implementation supporting interactive terminal sessions (PTY), SFTP file management, strict host key verification callbacks, OpenSSH agent integration, and modern cryptographic suites (Ed25519, Curve25519, AES-GCM).

## Decision
We utilize a dual-mode SSH client architecture:
1. **Primary Protocol Engine**: We integrate a pure JavaScript/TypeScript SSH-2 protocol engine (`ssh2`), verified against OpenSSH RFC specifications, utilizing Node.js's native `crypto` module (backed by OpenSSL/BoringSSL). This provides fine-grained event hooks for host key fingerprint inspection prior to channel authentication, seamless PTY allocation and bidirectional binary streaming, and in-process SFTP subsystem control.
2. **System OpenSSH Interop**: For environments requiring platform-specific hardware tokens (FIDO2/U2F security keys) or system Kerberos/GSSAPI tickets, DgodTerm supports delegating directly to the platform's verified OpenSSH client (`ssh.exe` on Windows, `/usr/bin/ssh` on Unix).

## Consequences
- No custom cryptographic primitives are authored.
- All host identity verification is intercepted and verified against the local Host Trust Store before any credential exchange takes place.
- Full cross-platform compatibility across Windows, macOS, and Linux without external compilation toolchains.
