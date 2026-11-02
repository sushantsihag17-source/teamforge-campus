'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const seed={users:[
 {id:'u1',name:'Alex',skills:['JavaScript','DSA'],interests:['Hackathons'],availability:'High'},
 {id:'u2',name:'Blair',skills:['React','JavaScript'],interests:['Hackathons'],availability:'High'},
 {id:'u3',name:'Casey',skills:['Node.js','Python'],interests:['Startups'],availability:'High'},
 {id:'u4',name:'Dee',skills:['UI/UX','CSS'],interests:['Hackathons'],availability:'High'}
 ],projects:[]};
const {MaxHeap,pairScore,bestMatches,buildGraph,buildTeam}=require('../src/algorithms');
test('max heap pops highest priority first',()=>{const h=new MaxHeap();[3,12,5,9].forEach(score=>h.push({score}));assert.deepEqual([h.pop().score,h.pop().score,h.pop().score,h.pop().score],[12,9,5,3]);});
test('scores have reasons and fit 0–99',()=>{const x=pairScore(seed.users[0],seed.users[1],seed);assert.ok(x.score>=0&&x.score<=99);assert.ok(x.reasons.length>0);});
test('matching excludes self and is sorted',()=>{const result=bestMatches(seed,'u1');assert.ok(result.matches.every(x=>x.user.id!=='u1'));for(let i=1;i<result.matches.length;i++)assert.ok(result.matches[i-1].score>=result.matches[i].score);});
test('network includes nodes, weighted links and BFS traversal',()=>{const g=buildGraph(seed,'u1');assert.equal(g.nodes[0].id,'u1');assert.equal(g.bfs[0],'u1');assert.ok(g.edges.length>0);});
test('team builder covers slots with distinct students',()=>{const out=buildTeam(seed,'u1',['React','Node.js','UI/UX'],4);assert.equal(out.team.length,4);assert.equal(new Set(out.team.map(x=>x.user.id)).size,4);assert.equal(out.coverage,100);assert.ok(out.trace.some(x=>x.type==='ASSIGN'));});
test('unmatched slot is reported, no false skill coverage',()=>{const out=buildTeam(seed,'u1',['Quantum Chromodynamics'],3);assert.equal(out.coverage,0);assert.equal(out.assignments[0].userId,null);assert.ok(out.team.length>=2);});
test('augmenting path reassigns one student to maximize covered slots',()=>{
 const fixture={users:[
  {id:'L',name:'Leader',skills:[],interests:['Hackathons'],availability:'High'},
  {id:'A',name:'Alpha',skills:['React','Python'],interests:['Hackathons'],availability:'High'},
  {id:'B',name:'Beta',skills:['React'],interests:[],availability:'Medium'}],projects:[]};
 const result=buildTeam(fixture,'L',['React','Python'],3);
 assert.equal(result.coverage,100);
 assert.equal(result.assignments[0].userId,'B');
 assert.equal(result.assignments[1].userId,'A');
});
