import jpeg from 'jpeg-js'; import fs from 'fs';
const [inp, out] = process.argv.slice(2);
const s = jpeg.decode(fs.readFileSync(inp), { useTArray: true });
const W = s.width / 2, Hh = s.height / 2, d = Buffer.alloc(W * Hh * 4);
for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
  let t = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) t += s.data[((2 * y + a) * s.width + 2 * x + b) * 4 + c];
  d[(y * W + x) * 4 + c] = Math.round(t / 4);
}
fs.writeFileSync(out, jpeg.encode({ data: d, width: W, height: Hh }, 88).data);
