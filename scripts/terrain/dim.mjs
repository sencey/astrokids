import jpeg from 'jpeg-js'; import fs from 'fs';
for (const f of process.argv.slice(2)) { const d = jpeg.decode(fs.readFileSync(f), {maxMemoryUsageInMB:2000}); console.log(f, d.width, d.height); }
