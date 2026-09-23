// Set JSDOM_PATH to an installed jsdom package, or install jsdom locally for development.
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH || 'jsdom');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]+src="app.js[^>]*><\/script>/,'');
const dom=new JSDOM(html,{url:'https://preview.example/',runScripts:'dangerously',virtualConsole:vc});const w=dom.window;
w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
let imageSlots=0;w.IntersectionObserver=class{constructor(fn){this.fn=fn;}observe(target){if(imageSlots++<6)this.fn([{target,isIntersecting:true}]);}unobserve(){}disconnect(){}};
const records={photos:Array.from({length:40},(_,i)=>({id:i+1,url:'https://okpcwsianqkouitdwhvx.supabase.co/storage/v1/object/public/photos/test-'+i+'.jpg',description:'测试照片 '+i,photo_date:i===39?null:'2026-'+(i%2?'05':'09')+'-'+String(i%25+1).padStart(2,'0'),upload_time:'2026-09-23T00:00:00Z'})),bucket_list:[{id:1,text:'一起旅行',completed:true}],timeline:[{id:1,title:'相遇',description:'测试记录',date:'2026-05-20',time:'12:00'}],visited_provinces:[{id:1,name:'新疆',date:'2026-05-20'}]};
let failReads=false,failWrites=false,writes=0;
w.fetch=async(url,opts={})=>{if(url==='assets/china-map.json')return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'assets/china-map.json'),'utf8'))};
 const u=new URL(url,'https://preview.example');const table=u.pathname.split('/').pop();const rows=records[table];const method=opts.method||'GET';
 if((method==='GET'&&failReads)||(method!=='GET'&&failWrites))return {ok:false,status:503,text:async()=> 'simulated unavailable'};
 const match=row=>[...u.searchParams].filter(([k])=>!['select','order'].includes(k)).every(([k,v])=>String(row[k])===v.replace(/^eq\./,''));
 let result=rows;
 if(method!=='GET')writes++;
 if(method==='PATCH'){rows.filter(match).forEach(row=>Object.assign(row,JSON.parse(opts.body)));result=rows.filter(match);}
 if(method==='POST'){const row={...JSON.parse(opts.body),id:99};rows.push(row);result=[row];}
 return {ok:true,json:async()=>structuredClone(result),text:async()=>''};};
w.AbortController=AbortController;w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));const click=id=>w.document.getElementById(id).click();
(async()=>{
 await w.initApp();
 assert.equal(writes,0,'startup never writes sample records');
 assert.equal(w.document.querySelectorAll('.photo-card').length,40);
 assert.equal(w.document.querySelectorAll('.photo-image[src]').length,0,'home does not download album images');
 w.document.querySelector('[data-tab="gallery"]').click();
 assert.equal(w.document.querySelectorAll('.photo-image[src]').length,6,'only near-viewport previews requested');
 assert.ok(w.document.querySelector('.photo-image').src.includes('/thumbnails/v1/'));
 const first=w.document.querySelector('.photo-image');first.dispatchEvent(new w.Event('error'));assert.equal(first.src,new URL(first.dataset.original,'https://preview.example/').href,'missing thumbnail falls back to original');
 const sort=w.document.getElementById('photo-sort');sort.value='asc';sort.dispatchEvent(new w.Event('change'));
 let dates=Array.from(w.document.querySelectorAll('.photo-date-item'),el=>el.textContent);assert.ok(dates[0].startsWith('2026 . 05'));assert.equal(dates.at(-1),'＋ 补充拍摄日期');
 w.document.querySelector('.photo-open').click();assert.equal(w.document.getElementById('photo-viewer').open,true);const oldSrc=w.document.getElementById('viewer-image').src;click('viewer-next');assert.notEqual(w.document.getElementById('viewer-image').src,oldSrc);click('viewer-close');assert.equal(w.document.body.style.overflow,'');
 const editedId=Number(w.document.querySelector('.photo-card').dataset.photoId);w.document.querySelector('.photo-date-item').click();w.document.getElementById('df-date').value='2027-01-01';click('dialog-ok');await tick();assert.equal(w.currentData.photos.find(p=>p.id===editedId).photoDate,'2027-01-01');
 w.document.querySelector('[data-tab="map"]').click();await tick();assert.equal(w.document.querySelectorAll('.map-location').length,34);assert.equal(w.document.querySelector('[data-province="新疆"]').getAttribute('aria-pressed'),'true');
 w.document.querySelector('[data-province="浙江"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(w.document.getElementById('dialog-title').textContent,'点亮「浙江」');w.document.getElementById('df-date').value='2026-09-23';click('dialog-ok');await tick();assert.equal(w.document.querySelector('[data-province="浙江"]').getAttribute('aria-pressed'),'true');
 click('map-zoom-in');assert.ok(w.document.getElementById('map-layer').getAttribute('transform').includes('scale(1.5)'));click('map-reset');assert.ok(w.document.getElementById('map-layer').getAttribute('transform').includes('scale(1)'));
 failWrites=true;await w.editPhotoDate(editedId);w.document.getElementById('df-date').value='2028-01-01';click('dialog-ok');await tick();assert.equal(w.currentData.photos.find(p=>p.id===editedId).photoDate,'2027-01-01');assert.match(w.document.getElementById('confirm-msg').textContent,/未保存/);
 failReads=true;await w.refreshData();assert.equal(w.currentData.photos.length,40);assert.match(w.document.getElementById('data-status-message').textContent,/读取失败/);assert.equal(w.document.getElementById('data-retry').disabled,false);
 failReads=false;await w.refreshData();assert.equal(w.document.getElementById('data-status').classList.contains('hidden'),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: 40-photo rendering, lazy thumbnails, original fallback, month/date sorting, viewer navigation, date editing, keyboard map selection/persistence, zoom/reset, save failures, offline recovery; production data untouched');
 w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
