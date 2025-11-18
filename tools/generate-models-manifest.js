const fs = require('fs');
const path = require('path');

// Change this to the public folder path relative to repo root
const modelsFolderRelative = 'public/3D MODEL(step1)';
const outFilename = 'models.json';

function generate() {
  const folder = path.resolve(__dirname, '..', modelsFolderRelative);
  if (!fs.existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  const files = fs.readdirSync(folder)
    .filter(f => f.toLowerCase().endsWith('.ifc'))
    .sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

  const outPath = path.join(folder, outFilename);
  fs.writeFileSync(outPath, JSON.stringify(files, null, 2));
  console.log(`Wrote ${files.length} entries to ${outPath}`);
}

generate();
