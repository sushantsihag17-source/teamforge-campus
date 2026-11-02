'use strict';
// Backend-only Supabase Data API adapter. NEVER serve the service-role/secret key to the browser.
const URL_BASE=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const ADMIN_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const PUBLIC_KEY=process.env.SUPABASE_ANON_KEY||'';
function ready(){if(!URL_BASE||!ADMIN_KEY||!PUBLIC_KEY)throw Object.assign(new Error('Configure SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the server environment.'),{status:503});}
function url(name,params=''){return `${URL_BASE}/rest/v1/${name}${params?'?'+params:''}`;}
function bad(status,message){return Object.assign(new Error(message),{status});}
async function fetchJson(target,opts={}){
  ready();
  let result;
  try{result=await fetch(target,{...opts,headers:{apikey:ADMIN_KEY,Authorization:`Bearer ${ADMIN_KEY}`,'Content-Type':'application/json',...(opts.headers||{})},signal:AbortSignal.timeout(12000)});}catch(e){throw bad(503,'Database temporarily unavailable.');}
  let payload=null;try{const raw=await result.text();payload=raw?JSON.parse(raw):null;}catch{throw bad(502,'Database returned an invalid response.');}
  if(!result.ok){if(process.env.NODE_ENV!=='production')console.error('Supabase database error:',payload);
    const m=payload?.code==='23505'?'That username, application, or invitation already exists.':payload?.message||'Database request failed.';
    throw bad(result.status===409?409:result.status>=500?502:400,m);
  }
  return payload;
}
async function auth(token){
  if(!token)throw bad(401,'Please sign in first.');ready();
  let response;
  try{response=await fetch(`${URL_BASE}/auth/v1/user`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});}catch{throw bad(503,'Authentication service unavailable.');}
  if(!response.ok)throw bad(401,'Session expired. Please sign in again.');
  const person=await response.json();
  if(!person.id)throw bad(401,'Invalid login session.');
  return person;
}
const all=(table,fields='*',extra='')=>fetchJson(url(table,`select=${encodeURIComponent(fields)}${extra?'&'+extra:''}`));
const insert=(table,record)=>fetchJson(url(table),{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(record)}).then(rows=>rows?.[0]);
const patch=(table,filter,values)=>fetchJson(url(table,filter),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(values)}).then(rows=>rows?.[0]);
const rpc=(name,params)=>fetchJson(url(`rpc/${name}`),{method:'POST',body:JSON.stringify(params)});
function uuid(){return crypto.randomUUID();}
function shapeProfile(p){return {id:p.id,name:p.name,handle:p.handle,program:p.program,year:p.year,bio:p.bio||'',skills:p.skills||[],interests:p.interests||[],availability:p.availability,color:p.color||'#14a3a1'};}
async function snapshot(){
  const [users,projs,members,apps,invites,acts]=await Promise.all([
    all('profiles'),all('projects'),all('project_members'),all('applications'),all('invites'),all('activity','*','order=at.desc&limit=60')]);
  const db={users:users.map(shapeProfile),projects:projs.map(p=>({id:p.id,ownerId:p.owner_id,title:p.title,tagline:p.tagline,description:p.description,category:p.category,skills:p.skills||[],capacity:p.capacity,members:members.filter(m=>m.project_id===p.id).map(m=>m.user_id),applications:apps.filter(a=>a.project_id===p.id).map(a=>({userId:a.user_id,message:a.message,status:a.status})),invites:invites.filter(i=>i.project_id===p.id).map(i=>({userId:i.user_id,status:i.status,createdAt:i.created_at})),color:p.color||'#19a09e',createdAt:p.created_at})),activity:acts.map(a=>({id:a.id,userId:a.user_id,kind:a.kind,text:a.text,at:a.at}))};
  return db;
}
function visible(db,currentId){return {...db,projects:db.projects.map(p=>({...p,applications:p.applications.filter(a=>p.ownerId===currentId||a.userId===currentId),invites:p.invites.filter(i=>p.ownerId===currentId||i.userId===currentId)})),activity:db.activity.filter(a=>a.userId===currentId)};}
async function log(userId,kind,text){try{await insert('activity',{user_id:userId,kind,text:text.slice(0,220)});}catch(e){console.error('Activity save failed:',e.message);}}
module.exports={ready,auth,all,insert,patch,rpc,snapshot,visible,log,bad,uuid,URL_BASE,PUBLIC_KEY};
