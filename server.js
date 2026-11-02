'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {URL}=require('node:url');
const dbService=require('./src/supabase');
const algo=require('./src/algorithms');
const PUBLIC=path.join(__dirname,'public');
const PORT=Number(process.env.PORT)||3000;
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,code,body){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function fail(status,message){throw dbService.bad(status,message);}
function requiredString(x,name,max=120){if(typeof x!=='string'||!x.trim()||x.length>max)fail(400,`${name} must be 1–${max} characters`);return x.trim();}
function arr(x,name,max=8){if(!Array.isArray(x)||x.length>max||x.some(y=>typeof y!=='string'||!y.trim()||y.length>40))fail(400,`Invalid ${name}`);return [...new Set(x.map(v=>v.trim()))];}
function getUser(db,id){const u=db.users.find(u=>u.id===id);if(!u)fail(404,'Student not found');return u;}
function getProject(db,id){const p=db.projects.find(p=>p.id===id);if(!p)fail(404,'Project not found');return p;}
async function body(req){let input='';for await(const chunk of req){input+=chunk;if(input.length>30000)fail(413,'Payload too large');}try{return JSON.parse(input||'{}');}catch{fail(400,'Invalid JSON');}}
function projectStats(db){return {students:db.users.length,projects:db.projects.length,openSpots:db.projects.reduce((n,p)=>n+Math.max(0,p.capacity-p.members.length),0),collaborations:db.projects.reduce((n,p)=>n+p.members.length,0)};}
async function api(req,res,url){
  const m=req.method,route=url.pathname;
  if(m==='GET'&&route==='/api/health')return send(res,200,{ok:true,service:'TeamForge'});
  if(m==='GET'&&route==='/api/config'){dbService.ready();return send(res,200,{url:dbService.URL_BASE,anonKey:dbService.PUBLIC_KEY});}
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
  const person=await dbService.auth(token);
  const identity=person.id;
  if(m==='POST'&&route==='/api/users'){
    const existing=await dbService.all('profiles','id',`id=eq.${encodeURIComponent(identity)}`);
    if(existing.length)fail(409,'You already have a student profile.');
    const b=await body(req),name=requiredString(b.name,'Name',55),handle=requiredString(b.handle,'Username',30).toLowerCase().replace(/^@/,'');
    if(!/^[a-z0-9._-]{3,30}$/.test(handle))fail(400,'Username must contain 3–30 letters, digits, dots, dashes, or underscores');
    const skills=arr(b.skills,'skills',6),interests=arr(b.interests,'interests',4);
    if(!skills.length||!interests.length)fail(400,'Choose at least one skill and interest');
    const row=await dbService.insert('profiles',{id:identity,name,handle,program:requiredString(b.program,'Program',65),year:[1,2,3,4].includes(Number(b.year))?Number(b.year):2,bio:String(b.bio||'').slice(0,220),skills,interests,availability:['High','Medium','Low'].includes(b.availability)?b.availability:'High'});
    await dbService.log(identity,'joined','joined the TeamForge community');
    return send(res,201,{user:{id:row.id,...row}});
  }
  const db=await dbService.snapshot();
  // Authentication identifies the account; clients cannot impersonate another student.
  const current=db.users.find(u=>u.id===identity);
  if(!current&&!(m==='GET'&&route==='/api/bootstrap'))fail(403,'Complete your student profile first.');
  if(m==='GET'&&route==='/api/bootstrap')return send(res,200,{...dbService.visible(db,identity),me:identity,stats:projectStats(db)});
  if(m==='GET'&&route==='/api/matches')return send(res,200,algo.bestMatches(db,identity,{skill:url.searchParams.get('skill')||'',limit:50}));
  if(m==='GET'&&route==='/api/projects/recommended')return send(res,200,algo.bestProjects(db,identity).map(({project,score})=>({project:{...project,applications:[],invites:[]},score})));
  if(m==='POST'&&route==='/api/team/generate'){
    const b=await body(req),skills=arr(b.skills,'skills',5);
    if(!Number.isInteger(b.teamSize)||b.teamSize<2||b.teamSize>6)fail(400,'Team size must be 2–6');
    if(skills.length>b.teamSize-1)fail(400,'Choose no more required skills than available team slots');
    const result=algo.buildTeam(db,identity,skills,b.teamSize);const {trace,algorithm,complexity,...safe}=result;
    return send(res,200,safe);
  }
  if(m==='PATCH'&&route==='/api/profile'){
    const b=await body(req),values={};
    if(b.bio!==undefined)values.bio=String(b.bio).slice(0,220);
    if(b.availability!==undefined){if(!['High','Medium','Low'].includes(b.availability))fail(400,'Invalid availability');values.availability=b.availability;}
    if(b.skills!==undefined)values.skills=arr(b.skills,'skills',6);
    if(b.interests!==undefined)values.interests=arr(b.interests,'interests',4);
    const changed=await dbService.patch('profiles',`id=eq.${encodeURIComponent(identity)}`,values);
    return send(res,200,{user:changed});
  }
  if(m==='POST'&&route==='/api/projects'){
    const b=await body(req),skills=arr(b.skills,'skills',5),capacity=Number(b.capacity);
    if(!skills.length)fail(400,'Choose at least one desired skill');
    if(!Number.isInteger(capacity)||capacity<2||capacity>8)fail(400,'Team capacity must be 2–8');
    const title=requiredString(b.title,'Project name',65);
    const project=await dbService.rpc('create_teamforge_project',{p_owner:identity,p_title:title,p_tagline:requiredString(b.tagline,'Tagline',110),p_description:requiredString(b.description,'Description',700),p_category:requiredString(b.category,'Category',40),p_skills:skills,p_capacity:capacity});
    await dbService.log(identity,'project',`launched ${title}`);
    return send(res,201,{project:{id:project}});
  }
  const apply=route.match(/^\/api\/projects\/([0-9a-f-]{36})\/apply$/i);
  if(m==='POST'&&apply){const b=await body(req),p=getProject(db,apply[1]);
    if(p.ownerId===identity||p.members.includes(identity))fail(409,'Already on this project');
    if(p.members.length>=p.capacity)fail(409,'Team is full');
    if(p.applications.some(a=>a.userId===identity&&a.status==='pending'))fail(409,'Application already pending');
    await dbService.insert('applications',{project_id:p.id,user_id:identity,message:String(b.message||'I would love to collaborate on this project.').slice(0,250),status:'pending'});
    await dbService.log(identity,'application',`applied to ${p.title}`);return send(res,200,{ok:true});
  }
  const decide=route.match(/^\/api\/projects\/([0-9a-f-]{36})\/decision$/i);
  if(m==='POST'&&decide){const b=await body(req),p=getProject(db,decide[1]);
    if(p.ownerId!==identity)fail(403,'Only the project owner can review applications');
    if(!['accept','decline'].includes(b.decision))fail(400,'Invalid decision');
    getUser(db,b.userId);
    await dbService.rpc('decide_teamforge_application',{p_project:p.id,p_owner:identity,p_student:b.userId,p_decision:b.decision});
    await dbService.log(identity,'decision',`${b.decision==='accept'?'accepted':'declined'} an application for ${p.title}`);return send(res,200,{ok:true});
  }
  const invite=route.match(/^\/api\/projects\/([0-9a-f-]{36})\/invite$/i);
  if(m==='POST'&&invite){const b=await body(req),p=getProject(db,invite[1]);
    if(p.ownerId!==identity)fail(403,'Only the project owner can invite students');
    const candidate=getUser(db,b.candidateId);
    if(p.members.includes(candidate.id))fail(409,'Already a team member');
    if(p.members.length>=p.capacity)fail(409,'Team is full');
    await dbService.insert('invites',{project_id:p.id,user_id:candidate.id,status:'pending'});
    await dbService.log(identity,'invite',`invited ${candidate.name} to ${p.title}`);return send(res,200,{ok:true});
  }
  const invitation=route.match(/^\/api\/projects\/([0-9a-f-]{36})\/invitation-decision$/i);
  if(m==='POST'&&invitation){const b=await body(req),p=getProject(db,invitation[1]);
    if(!['accept','decline'].includes(b.decision))fail(400,'Invalid decision');
    await dbService.rpc('decide_teamforge_invitation',{p_project:p.id,p_student:identity,p_decision:b.decision});
    await dbService.log(identity,'invite',`${b.decision==='accept'?'joined':'declined an invitation to'} ${p.title}`);return send(res,200,{ok:true});
  }
  fail(404,'API route not found');
}
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(u.pathname.startsWith('/api/'))return await api(req,res,u);
    if(req.method!=='GET')fail(405,'Method not allowed');
    let pathname=decodeURIComponent(u.pathname);if(pathname==='/')pathname='/index.html';
    const target=path.resolve(PUBLIC,'.'+pathname);
    if(!target.startsWith(PUBLIC+path.sep))fail(403,'Forbidden');
    fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'",'Referrer-Policy':'strict-origin-when-cross-origin'});res.end(data);});
  }catch(e){send(res,e.status||500,{error:e.status?e.message:'Internal server error'});if(!e.status)console.error(e);}
});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`TeamForge live-ready server on :${PORT}`));
module.exports=server;
