const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDir = path.join(process.env.LOCALAPPDATA, 'DgodTerm');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const pristineIco = path.resolve(__dirname, '..', 'release', 'native', 'icon.ico');
const userIco = path.join(targetDir, 'dgodterm-icon-v2.ico');
fs.copyFileSync(pristineIco, userIco);
fs.copyFileSync(pristineIco, path.join(targetDir, 'icon.ico'));
console.log(`Copied pristine icon to: ${userIco}`);

// PowerShell script to update .lnk files safely (PowerShell double-quoted strings do not escape backslashes)
const psScript = `
$sh = New-Object -ComObject WScript.Shell
$desktopLnk = "$([Environment]::GetFolderPath('Desktop'))\\DgodTerm.lnk"
if (Test-Path $desktopLnk) {
    $lnk = $sh.CreateShortcut($desktopLnk)
    $lnk.IconLocation = "${userIco},0"
    $lnk.Save()
    Write-Host "Updated Desktop shortcut icon."
}
$startLnk = "$([Environment]::GetFolderPath('StartMenu'))\\Programs\\DgodTerm\\DgodTerm.lnk"
if (Test-Path $startLnk) {
    $lnk2 = $sh.CreateShortcut($startLnk)
    $lnk2.IconLocation = "${userIco},0"
    $lnk2.Save()
    Write-Host "Updated Start Menu shortcut icon."
}
$startRootLnk = "$([Environment]::GetFolderPath('StartMenu'))\\Programs\\DgodTerm.lnk"
if (Test-Path $startRootLnk) {
    $lnk3 = $sh.CreateShortcut($startRootLnk)
    $lnk3.IconLocation = "${userIco},0"
    $lnk3.Save()
    Write-Host "Updated Root Start Menu shortcut icon."
}
`;

const psFile = path.join(__dirname, 'update-shortcuts.ps1');
fs.writeFileSync(psFile, psScript, 'utf8');
try {
  const out = execSync(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: 'utf8' });
  console.log(out);
} finally {
  if (fs.existsSync(psFile)) fs.unlinkSync(psFile);
}

// Refresh shell icon cache
try {
  execSync('powershell -Command "ie4uinit.exe -show"', { stdio: 'ignore' });
} catch {}
