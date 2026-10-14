const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${require('crypto').randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: 'DgodTerm',
      version: pkg.version || '1.0.0',
      description: 'Secure SSH and Ansible Automation Desktop Client'
    }
  },
  components: Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    type: 'library',
    name,
    version: version.replace(/[\^~]/, ''),
    purl: `pkg:npm/${name}@${version.replace(/[\^~]/, '')}`
  }))
};

const outPath = path.join(__dirname, '../sbom.json');
fs.writeFileSync(outPath, JSON.stringify(sbom, null, 2));
console.log(`[DgodTerm] Generated SBOM with ${sbom.components.length} components at ${outPath}`);
