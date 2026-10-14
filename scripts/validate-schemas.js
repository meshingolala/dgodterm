const fs = require('fs');
const path = require('path');

const schemasDir = path.join(__dirname, '../schemas');
const schemaFiles = fs.readdirSync(schemasDir).filter((f) => f.endsWith('.schema.json'));

console.log(`[DgodTerm Schema Validator] Validating ${schemaFiles.length} JSON schemas:`);
schemaFiles.forEach((file) => {
  const content = fs.readFileSync(path.join(schemasDir, file), 'utf8');
  try {
    const json = JSON.parse(content);
    console.log(`  ✓ ${file} (Title: ${json.title}, Schema: ${json.$schema})`);
  } catch (e) {
    console.error(`  ✗ ${file} syntax error:`, e.message);
    process.exit(1);
  }
});

console.log('[DgodTerm Schema Validator] All schemas successfully validated.');
