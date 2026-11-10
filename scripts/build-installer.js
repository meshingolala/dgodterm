const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('============================================================');
console.log('  DgodTerm v2.0.0 Windows Native Installer Builder');
console.log('============================================================\n');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const nativeDir = path.join(releaseDir, 'native');
const iconPath = path.join(rootDir, 'src-native', 'DgodTerm.Windows', 'icon.ico');
const setupOutFile = path.join(releaseDir, 'DgodTerm-Setup-2.0.0.exe');

// 1. Ensure Native binaries and assets are packaged
console.log('[1/4] Ensuring latest Native Windows v2.0.0 release is built...');
execSync('node scripts/package-native.js', { cwd: rootDir, stdio: 'inherit' });

// 2. Locate makensis.exe
console.log('[2/4] Locating NSIS compiler (makensis.exe)...');
const candidateNsisPaths = [
  'C:\\Users\\Administrator\\AppData\\Local\\electron-builder\\Cache\\nsis-3.0.4.1\\nsis-3.0.4.1-1mx3n\\Bin\\makensis.exe',
  'C:\\Program Files (x86)\\NSIS\\makensis.exe',
  'C:\\Program Files\\NSIS\\makensis.exe',
  path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis-3.0.4.1', 'nsis-3.0.4.1-1mx3n', 'Bin', 'makensis.exe')
];

let nsisExe = null;
for (const cand of candidateNsisPaths) {
  if (fs.existsSync(cand)) {
    nsisExe = cand;
    break;
  }
}

if (!nsisExe) {
  try {
    const whichOut = execSync('where makensis', { encoding: 'utf8' }).trim().split('\n')[0].trim();
    if (fs.existsSync(whichOut)) nsisExe = whichOut;
  } catch {}
}

if (!nsisExe) {
  console.error('ERROR: makensis.exe could not be found.');
  process.exit(1);
}
console.log(`  ✓ Found NSIS: ${nsisExe}`);

// 3. Generate NSIS Script
console.log('[3/4] Generating installer specification (installer.nsi)...');
const nsiScriptPath = path.join(releaseDir, 'installer.nsi');

const nsiContent = `; ============================================================
; DgodTerm v2.0.0 Windows Native Installer Script (NSIS Modern UI 2)
; ============================================================
Unicode True
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

; General Definitions
Name "DgodTerm"
OutFile "${setupOutFile.replace(/\\/g, '\\\\')}"
InstallDir "$PROGRAMFILES64\\DgodTerm"
InstallDirRegKey HKLM "Software\\DgodTerm" "InstallDir"
RequestExecutionLevel admin

; Branding and Icons
!define MUI_ICON "${iconPath.replace(/\\/g, '\\\\')}"
!define MUI_UNICON "${iconPath.replace(/\\/g, '\\\\')}"
!define MUI_ABORTWARNING

; Modern UI Wizard Pages
!define MUI_WELCOMEPAGE_TITLE "Welcome to DgodTerm v2.0 Setup"
!define MUI_WELCOMEPAGE_TEXT "DgodTerm is the enterprise-grade Windows native terminal and fleet automation workstation.\\r\\n\\r\\nVersion: 2.0.0 (Windows 11 Fluent + Mica Architecture)\\r\\n\\r\\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\\DgodTerm.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch DgodTerm v2.0 now"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Version Information Resource
VIProductVersion "2.0.0.0"
VIAddVersionKey "ProductName" "DgodTerm"
VIAddVersionKey "CompanyName" "DgodTerm Team"
VIAddVersionKey "FileDescription" "DgodTerm Native Terminal & Automation Client"
VIAddVersionKey "FileVersion" "2.0.0.0"
VIAddVersionKey "ProductVersion" "2.0.0.0"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 DgodTerm Team"

; Installer Section
Section "MainSection" SEC01
    SectionIn RO
    
    ; Terminate previous running instance of DgodTerm and background services if open
    DetailPrint "Checking for running instances of DgodTerm and background services..."
    nsExec::Exec 'cmd /c taskkill /F /T /IM DgodTerm.exe'
    nsExec::Exec 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq ''node.exe'' -and ($$_.ExecutablePath -like ''*DgodTerm*'' -or $$_.CommandLine -like ''*web-server*'') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"'
    nsExec::Exec 'cmd /c taskkill /F /IM node.exe'
    Sleep 1000

    ; Set destination
    SetOutPath "$INSTDIR"

    ; Copy all Native Host Files & Dependencies
    DetailPrint "Installing native Windows binaries and runtime dependencies..."
    File /r "${nativeDir.replace(/\\/g, '\\\\')}\\*.*"

    ; Store installation folder in registry
    WriteRegStr HKLM "Software\\DgodTerm" "InstallDir" "$INSTDIR"

    ; Create Uninstaller
    WriteUninstaller "$INSTDIR\\Uninstall.exe"

    ; Create Start Menu Shortcuts
    CreateDirectory "$SMPROGRAMS\\DgodTerm"
    CreateShortcut "$SMPROGRAMS\\DgodTerm\\DgodTerm.lnk" "$INSTDIR\\DgodTerm.exe" "" "$INSTDIR\\icon.ico" 0
    CreateShortcut "$SMPROGRAMS\\DgodTerm\\Uninstall DgodTerm.lnk" "$INSTDIR\\Uninstall.exe" "" "$INSTDIR\\icon.ico" 0

    ; Create Desktop Shortcut
    CreateShortcut "$DESKTOP\\DgodTerm.lnk" "$INSTDIR\\DgodTerm.exe" "" "$INSTDIR\\icon.ico" 0

    ; Refresh Windows Shell Icon Cache
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'

    ; Register in Windows Add/Remove Programs
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "DisplayName" "DgodTerm — Secure Terminal & Fleet Automation"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "DisplayVersion" "2.0.0"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "Publisher" "DgodTerm Team"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "DisplayIcon" "$INSTDIR\\DgodTerm.exe,0"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "QuietUninstallString" '"$INSTDIR\\Uninstall.exe" /S'
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "NoModify" 1
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "NoRepair" 1
    
    \${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm" "EstimatedSize" "$0"
SectionEnd

; Uninstaller Section
Section "Uninstall"
    ; Terminate running instance if open
    nsExec::Exec 'cmd /c taskkill /F /T /IM DgodTerm.exe'
    nsExec::Exec 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq ''node.exe'' -and ($$_.ExecutablePath -like ''*DgodTerm*'' -or $$_.CommandLine -like ''*web-server*'') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"'
    nsExec::Exec 'cmd /c taskkill /F /IM node.exe'
    Sleep 1000

    ; Remove Shortcuts
    Delete "$DESKTOP\\DgodTerm.lnk"
    Delete "$SMPROGRAMS\\DgodTerm\\DgodTerm.lnk"
    Delete "$SMPROGRAMS\\DgodTerm\\Uninstall DgodTerm.lnk"
    RMDir "$SMPROGRAMS\\DgodTerm"

    ; Remove Registry entries
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DgodTerm"
    DeleteRegKey HKLM "Software\\DgodTerm"

    ; Remove Installed Files
    RMDir /r "$INSTDIR\\dist"
    RMDir /r "$INSTDIR\\node_modules"
    RMDir /r "$INSTDIR\\runtimes"
    Delete "$INSTDIR\\*.*"
    RMDir "$INSTDIR"

    SetAutoClose true
SectionEnd
`;

fs.writeFileSync(nsiScriptPath, nsiContent, 'utf8');
console.log(`  ✓ Written ${nsiScriptPath}`);

// 4. Compile with makensis.exe
console.log('[4/4] Compiling Windows Native Installer with NSIS...');
try {
  execSync(`"${nsisExe}" /V2 "${nsiScriptPath}"`, { cwd: releaseDir, stdio: 'inherit' });
  
  if (fs.existsSync(setupOutFile)) {
    const stats = fs.statSync(setupOutFile);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('\n============================================================');
    console.log('  SUCCESS: DgodTerm v2.0.0 Windows Installer Generated!');
    console.log(`  File: ${setupOutFile}`);
    console.log(`  Size: ${sizeMb} MB`);
    console.log('  Architecture: Windows x64 Native Setup');
    console.log('============================================================\n');
  } else {
    console.error('Error: Installer file was not generated.');
    process.exit(1);
  }
} catch (err) {
  console.error('Compilation failed:', err.message);
  process.exit(1);
}
