const path = require('path');

async function runTestSuite() {
  console.log('====================================================');
  console.log('       DgodTerm Automated Security & Core Tests     ');
  console.log('====================================================');

  // 1. Redaction Engine Test
  const { redactString, redactObject } = require('../dist/redaction/redactor');
  console.log('\n[1] Testing Secret Redaction Engine...');
  const secretSample = 'Connecting with password="SuperSecretPassword123" and privkey="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"';
  const scrubbed = redactString(secretSample);
  if (scrubbed.includes('SuperSecretPassword123') || scrubbed.includes('BEGIN RSA PRIVATE KEY')) {
    console.error('FAIL: Redaction engine leaked secrets!');
    process.exit(1);
  }
  console.log('  ✓ Private key and password successfully scrubbed:');
  console.log('    -> Result:', scrubbed);

  // 2. Storage & Migrations Test
  console.log('\n[2] Testing Storage & Database Initialisation...');
  const { initializeDatabase, dbOperations } = require('../dist/storage/db');
  await initializeDatabase();
  const profiles = dbOperations.getProfiles();
  console.log(`  ✓ Loaded ${profiles.length} profiles from database.`);
  if (profiles.length === 0) {
    console.error('FAIL: Expected initial seeded profiles.');
    process.exit(1);
  }
  console.log(`  ✓ Sample profile: "${profiles[0].display_name}" (${profiles[0].username}@${profiles[0].hostname}:${profiles[0].port})`);

  // 3. Cryptographic Audit Log & SHA-256 Hash Chaining
  console.log('\n[3] Testing Audit Event Model & SHA-256 Chained Integrity...');
  const { AuditService } = require('../dist/audit/audit-service');
  const audit = AuditService.getInstance();

  audit.logEvent({
    eventType: 'session_connect',
    action: 'test_connect',
    outcome: 'success',
    resourceType: 'host',
    resourceId: 'test-node-01:22',
    metadata: { testKey: 'testVal' }
  });

  audit.logEvent({
    eventType: 'automation_started',
    action: 'test_ansible_launch',
    outcome: 'success',
    resourceType: 'automation_run',
    resourceId: 'run-999',
    metadata: { playbook: 'site.yml' }
  });

  const integrityResult = audit.verifyAuditIntegrity();
  console.log('  ✓ Audit chain validation:', integrityResult);
  if (!integrityResult.isValid) {
    console.error('FAIL: Audit log hash chain verification failed!');
    process.exit(1);
  }

  // 4. Policy Engine Evaluation
  console.log('\n[4] Testing Governance Policy Engine & Separation of Duties...');
  const { PolicyEngine } = require('../dist/policy/policy-engine');
  const policy = PolicyEngine.getInstance();
  policy.setPolicy({
    ...policy.getActivePolicy(),
    automation: {
      ...policy.getActivePolicy().automation,
      production_requires_approval: true,
      require_change_reference: true,
      self_approval: false
    }
  });

  // Test production run without peer approval
  const evalWithoutApproval = policy.evaluateAutomation({
    targetCount: 8,
    environment: 'production',
    requesterId: 'operator-alice',
    changeReference: null,
    approvals: []
  });
  console.log('  ✓ Production execution evaluation (without approval):', evalWithoutApproval.decision);
  if (evalWithoutApproval.decision !== 'approval_required') {
    console.error('FAIL: Policy should mandate approval for production!');
    process.exit(1);
  }

  // Test self-approval (Separation of duties violation)
  const evalSelfApproval = policy.evaluateAutomation({
    targetCount: 8,
    environment: 'production',
    requesterId: 'operator-alice',
    changeReference: 'CR-10492',
    approvals: [{ actor: 'operator-alice', approved_at: new Date().toISOString(), rationale: 'Self sign-off', scope: 'all' }]
  });
  console.log('  ✓ Self-approval test (Separation of duties check):', evalSelfApproval.decision);
  if (evalSelfApproval.decision !== 'deny') {
    console.error('FAIL: Policy should deny self-approval in production!');
    process.exit(1);
  }

  // Test legitimate peer approval
  const evalPeerApproval = policy.evaluateAutomation({
    targetCount: 8,
    environment: 'production',
    requesterId: 'operator-alice',
    changeReference: 'CR-10492',
    approvals: [{ actor: 'lead-bob', approved_at: new Date().toISOString(), rationale: 'Independent sign-off', scope: 'all' }]
  });
  console.log('  ✓ Independent peer approval test:', evalPeerApproval.decision);
  if (evalPeerApproval.decision !== 'allow') {
    console.error('FAIL: Policy should allow with independent peer approval!');
    process.exit(1);
  }

  // 5. Remote OS & Linux Flavour Detection Engine
  console.log('\n[5] Testing Remote OS & Linux Flavour Detection Engine...');
  const { parseOsReleaseOutput } = require('../dist/ssh/os-detector');

  const oracleRelease = `NAME="Oracle Linux Server"
VERSION="9.4"
ID="ol"
ID_LIKE="fedora"
PRETTY_NAME="Oracle Linux Server 9.4"`;
  const oracleResult = parseOsReleaseOutput(oracleRelease);
  console.log('  ✓ Oracle Linux detected:', oracleResult);
  if (!oracleResult || oracleResult.flavor !== 'oracle') {
    console.error('FAIL: Expected Oracle Linux detection!');
    process.exit(1);
  }

  const ubuntuRelease = `NAME="Ubuntu"
VERSION="24.04 LTS (Noble Numbat)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 24.04 LTS"`;
  const ubuntuResult = parseOsReleaseOutput(ubuntuRelease);
  console.log('  ✓ Ubuntu detected:', ubuntuResult);
  if (!ubuntuResult || ubuntuResult.flavor !== 'ubuntu') {
    console.error('FAIL: Expected Ubuntu detection!');
    process.exit(1);
  }

  const debianRelease = `PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
NAME="Debian GNU/Linux"
VERSION_ID="12"
VERSION="12 (bookworm)"
ID=debian`;
  const debianResult = parseOsReleaseOutput(debianRelease);
  console.log('  ✓ Debian detected:', debianResult);
  if (!debianResult || debianResult.flavor !== 'debian') {
    console.error('FAIL: Expected Debian detection!');
    process.exit(1);
  }

  const rhelRelease = `NAME="Red Hat Enterprise Linux"
VERSION="9.3 (Plow)"
ID="rhel"
ID_LIKE="fedora"`;
  const rhelResult = parseOsReleaseOutput(rhelRelease);
  console.log('  ✓ RHEL detected:', rhelResult);
  if (!rhelResult || rhelResult.flavor !== 'rhel') {
    console.error('FAIL: Expected RHEL detection!');
    process.exit(1);
  }

  // Test profile database update with detected flavor
  dbOperations.updateProfileOsFlavor(profiles[0].id, oracleResult.flavor, oracleResult.name);
  const updatedProfiles = dbOperations.getProfiles();
  const refreshed = updatedProfiles.find(p => p.id === profiles[0].id);
  console.log(`  ✓ Profile "${refreshed.display_name}" updated with os_flavor: "${refreshed.os_flavor}", os_name: "${refreshed.os_name}"`);
  if (refreshed.os_flavor !== 'oracle') {
    console.error('FAIL: Database did not persist detected os_flavor!');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('     ALL SECURITY & CORE SPEC TESTS PASSED!        ');
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
