const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pngToIco = require('png-to-ico');

function makePng(file) {
  const size = 256;
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const r = 20 + Math.floor(60 * (x / size));
      const g = 40 + Math.floor(160 * (y / size));
      const b = 180 + Math.floor(60 * ((x + y) / (2 * size)));
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return new Promise((resolve, reject) => {
    png
      .pack()
      .pipe(fs.createWriteStream(file))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const pngPath = path.join(assetsDir, 'app-icon.png');
  const icoPath = path.join(assetsDir, 'app-icon.ico');
  await makePng(pngPath);
  const buf = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, buf);
  console.log('Generated placeholder icons:', { pngPath, icoPath });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
