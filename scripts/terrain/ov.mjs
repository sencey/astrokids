import { fromUrl } from 'geotiff';
import { PNG } from 'pngjs';
import fs from 'fs';
const t = await fromUrl('https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF');
const im = await t.getImage();
console.log(im.getWidth(), im.getOrigin(), im.getResolution(), await t.getImageCount());
const [ox,oy]=im.getOrigin(); const [rx,ry]=im.getResolution();
const half=60000; // m
const x0=Math.round((-half-ox)/rx), x1=Math.round((half-ox)/rx);
const y0=Math.round((half-oy)/ry), y1=Math.round((-half-oy)/ry);
const W=x1-x0;
const r = await im.readRasters({window:[x0,y0,x1,y1], interleave:true});
const A = Float32Array.from(r);
let mn=1e9,mx=-1e9;for(const v of A){if(v<mn)mn=v;if(v>mx)mx=v;} console.log(W,mn,mx);
const png=new PNG({width:W,height:W});
const hs=(i,j)=>{ if(i<1||j<1||i>=W-1||j>=W-1) return 128; const dzdx=(A[j*W+i+1]-A[j*W+i-1])/(2*80), dzdy=(A[(j+1)*W+i]-A[(j-1)*W+i])/(2*80); // light from NW-ish
 const s=(0.7*dzdx+0.7*dzdy); return Math.max(0,Math.min(255,128 - 400*s)); };
for(let j=0;j<W;j++)for(let i=0;i<W;i++){const k=(j*W+i)*4; let v=hs(i,j); const e=(A[j*W+i]-mn)/(mx-mn); png.data[k]=v*0.7+e*80; png.data[k+1]=v*0.7+e*80; png.data[k+2]=v*0.7+e*80; png.data[k+3]=255;}
// mark grid every 10km, axes
const px=(m)=>Math.round((m+half)/80);
for(let m=-60000;m<=60000;m+=10000){const p=px(m); for(let q=0;q<W;q++){ for(const [a,b] of [[p,q],[q,W-1-p]]){ if(a<W&&b<W&&a>=0&&b>=0){const k=(b*W+a)*4; png.data[k]=255;png.data[k+1]=m==0?255:60;png.data[k+2]=60;}}}}
fs.writeFileSync(process.argv[2], PNG.sync.write(png));
