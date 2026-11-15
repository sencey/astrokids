import { fromUrl, fromFile } from 'geotiff';
const u = process.argv[2];
const t = await (u.startsWith('http')?fromUrl(u):fromFile(u));
const im = await t.getImage();
console.log(im.getWidth(), im.getHeight(), im.getOrigin(), im.getResolution(), im.getSampleFormat?.(), im.getBitsPerSample(), await t.getImageCount());
console.log(im.getGDALNoData(), JSON.stringify(im.getGeoKeys()).slice(0,400), im.fileDirectory.GDAL_METADATA);
