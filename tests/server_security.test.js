'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const server=require('../server');
test('public health is available; private routes reject anonymous users',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    let r=await fetch(`${base}/api/health`);assert.equal(r.status,200);assert.equal((await r.json()).ok,true);
    r=await fetch(`${base}/api/bootstrap`);assert.equal(r.status,401);
    r=await fetch(`${base}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,401);
    r=await fetch(`${base}/api/reset`,{method:'POST'});assert.equal(r.status,401);
    r=await fetch(`${base}/api/config`);assert.equal(r.status,503);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
