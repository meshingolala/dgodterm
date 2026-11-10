const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[DgodTerm Native Builder] Packaging Native Windows Software (.NET 8 + WebView2)...');

const rootDir = path.resolve(__dirname, '..');
const nativeProj = path.join(rootDir, 'src-native', 'DgodTerm.Windows', 'DgodTerm.Windows.csproj');
const outDir = path.join(rootDir, 'release', 'native');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Build Frontend & TypeScript Server
console.log('[DgodTerm Native Builder] Step 1: Building renderer and server assets...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Clean and Publish .NET 8 WPF Native Executable
console.log('[DgodTerm Native Builder] Step 2: Compiling .NET 8 native Windows WPF host...');
const nativeDir = path.dirname(nativeProj);
const nativeObj = path.join(nativeDir, 'obj');
const nativeBin = path.join(nativeDir, 'bin');
if (fs.existsSync(nativeObj)) fs.rmSync(nativeObj, { recursive: true, force: true });
if (fs.existsSync(nativeBin)) fs.rmSync(nativeBin, { recursive: true, force: true });

execSync(`dotnet publish "${nativeProj}" -c Release -o "${outDir}" -r win-x64 --no-self-contained`, {
  cwd: rootDir,
  stdio: 'inherit'
});

// 3. Copy dist/ into release/native/dist
console.log('[DgodTerm Native Builder] Step 3: Copying compiled assets into release/native/dist...');
const targetDist = path.join(outDir, 'dist');
if (fs.existsSync(targetDist)) {
  fs.rmSync(targetDist, { recursive: true, force: true });
}
fs.cpSync(path.join(rootDir, 'dist'), targetDist, { recursive: true });

// 4. Copy package.json
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(outDir, 'package.json'));

// 5. Copy production runtime dependencies into release/native/node_modules
console.log('[DgodTerm Native Builder] Step 4: Staging clean production runtime node_modules...');
const targetNodeModules = path.join(outDir, 'node_modules');
if (fs.existsSync(targetNodeModules)) {
  try {
    fs.rmSync(targetNodeModules, { recursive: true, force: true });
  } catch (e) {
    // If it's a junction, remove with rmdir
    execSync(`cmd /c rmdir "${targetNodeModules}"`, { stdio: 'ignore' });
  }
}
fs.mkdirSync(targetNodeModules, { recursive: true });

const prodDeps = [
  'asn1',
  'bcrypt-pbkdf',
  'node-addon-api',
  'node-pty',
  'safer-buffer',
  'sql.js',
  'ssh2',
  'tweetnacl',
  'uuid',
  'ws',
  'nan'
];
for (const dep of prodDeps) {
  const src = path.join(rootDir, 'node_modules', dep);
  const dst = path.join(targetNodeModules, dep);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dst, { recursive: true });
  }
}

// 6. Copy icon assets
const targetIcon = path.join(outDir, 'icon.ico');
const sourceIcon = path.join(rootDir, 'src-native', 'DgodTerm.Windows', 'icon.ico');
if (fs.existsSync(sourceIcon)) {
  fs.copyFileSync(sourceIcon, targetIcon);
}
const targetIconPng = path.join(outDir, 'icon.png');
const sourceIconPng = path.join(rootDir, 'src-native', 'DgodTerm.Windows', 'icon.png');
if (fs.existsSync(sourceIconPng)) {
  fs.copyFileSync(sourceIconPng, targetIconPng);
}

// 7. Bundle portable node.exe so DgodTerm runs self-contained on any Windows machine
const nodeCandidates = [
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Program Files (x86)\\nodejs\\node.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'node', 'node.exe')
];
let bundledNode = null;
for (const cand of nodeCandidates) {
  if (fs.existsSync(cand)) {
    bundledNode = cand;
    break;
  }
}
if (bundledNode) {
  const targetNode = path.join(outDir, 'node.exe');
  if (!fs.existsSync(targetNode)) {
    console.log(`[DgodTerm Native Builder] Step 5: Bundling portable node runtime from ${bundledNode}...`);
    fs.copyFileSync(bundledNode, targetNode);
  }
}

console.log('\n============================================================');
console.log('  SUCCESS: DgodTerm Native Windows Software Built!');
console.log('  Executable: ' + path.join(outDir, 'DgodTerm.exe'));
console.log('  Architecture: Windows x64 (.NET 8 WPF + Microsoft Edge WebView2)');
console.log('============================================================\n');
