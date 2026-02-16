const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const pngPath = path.join(assetsDir, 'app-icon.png');
  const icoPath = path.join(assetsDir, 'app-icon.ico');
  if (!fs.existsSync(pngPath)) {
    throw new Error(`PNG icon not found at ${pngPath}`);
  }
  const processedPath = path.join(assetsDir, 'app-icon-processed.png');
  const img = sharp(pngPath);
  const meta = await img.metadata();
  const size = Math.max(meta.width || 0, meta.height || 0);
  await img
    .resize({
      width: size,
      height: size,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(processedPath);
  const buf = await pngToIco(processedPath);
  fs.writeFileSync(icoPath, buf);
  console.log('Converted PNG to ICO:', { pngPath, processedPath, icoPath });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
