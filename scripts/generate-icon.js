const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function createTerminalIcon(size = 64) {
  const png = new PNG({ width: size, height: size });
  
  // Background: Rounded dark slate #0b132b -> (11, 19, 43)
  // Border: Cyan #00f2fe -> (0, 242, 254)
  // Prompt '>': (0, 242, 254)
  // Cursor '_': (56, 189, 248)

  const radius = size * 0.18;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Rounded rect check
      let inBounds = true;
      const cornerX = x < radius ? radius - x : (x >= size - radius ? x - (size - radius - 1) : 0);
      const cornerY = y < radius ? radius - y : (y >= size - radius ? y - (size - radius - 1) : 0);
      if (cornerX > 0 && cornerY > 0) {
        if (cornerX * cornerX + cornerY * cornerY > radius * radius) {
          inBounds = false;
        }
      }

      if (!inBounds) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Default dark navy background
      let r = 10, g = 15, b = 26, a = 255;

      // Border check (1px or 2px outline)
      const borderThickness = Math.max(1, Math.round(size * 0.04));
      const isBorder = (
        x < borderThickness || x >= size - borderThickness ||
        y < borderThickness || y >= size - borderThickness ||
        (cornerX > 0 && cornerY > 0 && Math.sqrt(cornerX * cornerX + cornerY * cornerY) > radius - borderThickness)
      );

      if (isBorder) {
        r = 14; g = 165; b = 233; a = 255; // Sky blue
      } else {
        // Draw terminal symbol '>'
        // Left point at (size*0.22, size*0.35)
        // Apex at (size*0.48, size*0.50)
        // Bottom point at (size*0.22, size*0.65)
        const relX = x / size;
        const relY = y / size;

        // Chevron > line check
        const lineTop = relY - (0.32 + (relX - 0.22) * 0.70);
        const lineBot = relY - (0.68 - (relX - 0.22) * 0.70);

        const onTopSlope = relX >= 0.22 && relX <= 0.46 && Math.abs(lineTop) < 0.055;
        const onBotSlope = relX >= 0.22 && relX <= 0.46 && Math.abs(lineBot) < 0.055;

        // Underscore cursor '_'
        const onCursor = relX >= 0.54 && relX <= 0.76 && relY >= 0.62 && relY <= 0.70;

        if (onTopSlope || onBotSlope) {
          r = 0; g = 242; b = 254; // Bright neon cyan
        } else if (onCursor) {
          r = 56; g = 189; b = 248; // Cyan cursor
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return png;
}

const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const iconPng = createTerminalIcon(256);
const iconPath = path.join(buildDir, 'icon.png');
const distIconPath = path.join(distDir, 'icon.png');

iconPng.pack().pipe(fs.createWriteStream(iconPath)).on('finish', () => {
  fs.copyFileSync(iconPath, distIconPath);
  console.log(`Generated icon (256x256) at ${iconPath} and ${distIconPath}`);
});
