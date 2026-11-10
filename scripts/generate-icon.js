const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const iconPath = path.join(buildDir, 'icon.png');
const distIconPath = path.join(distDir, 'icon.png');
const masterIconPath = path.join(buildDir, 'icon-master.png');

if (fs.existsSync(iconPath)) {
  fs.copyFileSync(iconPath, distIconPath);
  console.log(`[DgodTerm Icon] Deployed Concept A squircle icon to ${distIconPath}`);
} else if (fs.existsSync(masterIconPath)) {
  fs.copyFileSync(masterIconPath, iconPath);
  fs.copyFileSync(masterIconPath, distIconPath);
  console.log(`[DgodTerm Icon] Deployed master Concept A squircle icon to ${iconPath} and ${distIconPath}`);
}
