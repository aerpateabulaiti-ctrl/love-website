const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = { console: {error(){}}, AbortController, setTimeout, clearTimeout, Date, document:{addEventListener(){},getElementById(){return null;}} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'), context);
const ids = rows => Array.from(rows, row => row.id);
(async()=>{
 context.currentData.photos = [
  {id:1,photoDate:'2026-05-20',uploadTime:'2026-09-23'},
  {id:2,photoDate:'2026-09-01',uploadTime:'2026-09-01'},
  {id:3,photoDate:null,uploadTime:'2026-10-01'},
  {id:4,photoDate:'2026-05-20',uploadTime:'2026-08-01'}
 ];
 assert.deepEqual(ids(context.sortedPhotos('desc')),[2,4,1,3]);
 assert.deepEqual(ids(context.sortedPhotos('asc')),[4,1,2,3]);
 assert.deepEqual(ids(context.currentData.photos),[1,2,3,4]);
 assert.equal(context.escapeHtml('"<&\''),'&quot;&lt;&amp;&#39;');
 assert.equal(context.thumbnailUrl(context.STORAGE_PUBLIC_URL+'example.jpg'),context.STORAGE_PUBLIC_URL+'thumbnails/v1/example.jpg.webp');
 assert.equal(context.thumbnailUrl('https://example.org/photo.jpg'),'https://example.org/photo.jpg');
 for(const mode of ['offline','http','invalid']){
  context.fetch = async()=>{if(mode==='offline')throw new Error('offline');return {ok:mode!=='http',status:503,json:async()=>({not:'rows'})};};
  assert.equal(await context.loadData(),false);
  assert.deepEqual(ids(context.currentData.photos),[1,2,3,4]);
  assert.equal(context.loadedTables.photos,false);
 }
 context.fetch=async()=>({ok:true,json:async()=>[]});
 assert.equal(await context.loadData(),true);
 assert.equal(context.currentData.photos.length,0);
 const photo={id:17,photoDate:'2026-01-01'};context.currentData.photos=[photo];
 context.showAlert=()=>{};context.renderGallery=()=>{};
 let action;context.showDialog=(title,fields,callback)=>{action=callback;};
 context.sbUpdate=async()=>false;
 await context.editPhotoDate(17);await action({date:'2026-09-01'});assert.equal(photo.photoDate,'2026-01-01');
 context.sbUpdate=async()=>true;
 await context.editPhotoDate(17);await action({date:'2026-09-01'});assert.equal(photo.photoDate,'2026-09-01');
 const map=JSON.parse(fs.readFileSync(path.join(root,'assets/china-map.json'),'utf8'));
 const names=map.features.map(f=>f.name).filter(Boolean);
 assert.equal(names.length,34);assert.equal(new Set(names).size,34);
 assert.deepEqual(names.slice().sort(),Array.from(context.PROVINCES,p=>p.name).sort());
 map.features.forEach(f=>{assert.ok(f.path||f.inset);if(f.name)assert.ok(f.label);});
 console.log('PASS: capture-date sorting, undated fallback, stable order, escaping, thumbnails, failed reads, recovery, failed/successful date edits, and 34 map regions');
})().catch(error=>{console.error(error);process.exitCode=1;});
