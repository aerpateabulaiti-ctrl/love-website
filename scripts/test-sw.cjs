const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const handlers={};const entries=new Map();let requests=0;let status=200;let networkDown=false;
const cache={match:async req=>entries.get(req.url)?.clone(),put:async(req,res)=>entries.set(req.url,res),keys:async()=>Array.from(entries.keys(),url=>new Request(url)),delete:async req=>entries.delete(req.url)};
const ctx={URL,Request,Response,self:{location:{origin:'https://preview.example'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},fetch:async()=>{requests++;if(networkDown)throw new Error('offline');return new Response('image',{status});}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),ctx);
function run(url){let answer;handlers.fetch({request:new Request(url),respondWith:p=>answer=p});return answer;}
(async()=>{
 const base='https://okpcwsianqkouitdwhvx.supabase.co/storage/v1/object/public/photos/thumbnails/v1/';
 assert.equal((await run(base+'a.webp')).status,200);networkDown=true;assert.equal((await run(base+'a.webp')).status,200);assert.equal(requests,1);
 networkDown=false;status=404;await run(base+'missing.webp');await run(base+'missing.webp');assert.equal(requests,3);assert.equal(entries.size,1);
 status=200;await run('https://preview.example/media/photos/thumbnails/v1/local.webp');assert.equal(entries.size,2);
 assert.equal(run('https://okpcwsianqkouitdwhvx.supabase.co/rest/v1/photos'),undefined);
 assert.equal(run('https://okpcwsianqkouitdwhvx.supabase.co/storage/v1/object/public/photos/original.jpg'),undefined);
 assert.equal(run('https://unrelated.example/storage/v1/object/public/photos/thumbnails/v1/a.webp'),undefined);
 status=200;for(let i=0;i<165;i++)await run(base+i+'.webp');assert.equal(entries.size,160);
 console.log('PASS: repeat previews skip network, cached offline access, failures not cached, API/original/external bypass, bounded cache');
})().catch(e=>{console.error(e);process.exitCode=1;});
