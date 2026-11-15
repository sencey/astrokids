import { fromFile } from 'geotiff';
for (const f of process.argv.slice(2)) {
const im = await (await fromFile(f)).getImage();
console.log(f, im.fileDirectory.GDAL_METADATA);
const [x0,y0]=im.getOrigin();
const w=im.getWidth();
const r = await im.readRasters({window:[2400,2400,2700,2700]});
const a=r[0]; const h={}; let mn=1e9,mx=-1e9; for(const v of a){mn=Math.min(mn,v);mx=Math.max(mx,v);} console.log('min/max',mn,mx, 'uniq', new Set(a).size);
}
