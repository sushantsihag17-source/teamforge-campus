'use strict';

// All matching logic is transparent, deterministic, and runs without ML or external APIs.
// Map -> hash-table index, MaxHeap -> priority queue, Graph -> adjacency lists,
// augmenting-path DFS -> maximum-cardinality bipartite slot assignment.

class MaxHeap {
  constructor(compare = (a, b) => a.score - b.score) {
    this.items = [];
    this.compare = compare;
  }
  get size() { return this.items.length; }
  push(value) {
    const a = this.items; a.push(value);
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(a[i], a[p]) <= 0) break;
      [a[i], a[p]] = [a[p], a[i]]; i = p;
    }
  }
  pop() {
    if (!this.items.length) return null;
    const a = this.items; const first = a[0]; const tail = a.pop();
    if (a.length) {
      a[0] = tail; let i = 0;
      for (;;) {
        let best = i; const l = i * 2 + 1; const r = l + 1;
        if (l < a.length && this.compare(a[l], a[best]) > 0) best = l;
        if (r < a.length && this.compare(a[r], a[best]) > 0) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]]; i = best;
      }
    }
    return first;
  }
}

function indexes(data) {
  return {users: new Map(data.users.map(u => [u.id, u])),
    projects: new Map(data.projects.map(p => [p.id, p]))};
}
function intersection(a = [], b = []) {
  const bs = new Set(b.map(s => s.toLowerCase()));
  return a.filter(x => bs.has(x.toLowerCase()));
}
function availabilityWeight(a) { return ({High:1, Medium:0.67, Low:0.32})[a] || 0.3; }
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function pairScore(a, b, data) {
  if (a.id === b.id) return {score:100, reasons:['Your profile'], sharedSkills:[], complements:[], sharedInterests:[]};
  const sharedSkills = intersection(a.skills, b.skills);
  const complements = b.skills.filter(s => !a.skills.includes(s));
  const sharedInterests = intersection(a.interests, b.interests);
  const sharedProjects = data.projects.filter(p => p.members.includes(a.id) && p.members.includes(b.id)).length;
  const skillSimilarity = sharedSkills.length / Math.max(1, Math.min(a.skills.length, b.skills.length));
  const complementRatio = complements.length / Math.max(1, b.skills.length);
  const interestRatio = sharedInterests.length / Math.max(1, Math.min(a.interests.length, b.interests.length));
  // 30% shared interests + 20% skills in common + 30% complementary expertise
  // + 15% availability + 5% prior collaboration.
  const raw = 30 * interestRatio + 20 * skillSimilarity + 30 * complementRatio +
    15 * availabilityWeight(b.availability) + 5 * Math.min(1, sharedProjects);
  const score = clamp(Math.round(raw), 0, 99);
  const reasons = [];
  if (sharedInterests.length) reasons.push(`${sharedInterests.length} shared interest${sharedInterests.length > 1 ? 's' : ''}`);
  if (complements.length) reasons.push(`${complements.slice(0,2).join(' + ')} expertise`);
  if (sharedSkills.length) reasons.push(`${sharedSkills[0]} in common`);
  if (b.availability === 'High') reasons.push('Ready to collaborate');
  return {score, reasons:reasons.slice(0,3), sharedSkills, complements, sharedInterests};
}

function bestMatches(data, userId, options = {}) {
  const idx = indexes(data); const user = idx.users.get(userId);
  if (!user) throw new Error('Student not found');
  const heap = new MaxHeap((a,b) => a.score - b.score || b.user.name.localeCompare(a.user.name));
  const trace = [];
  for (const candidate of data.users) {
    if (candidate.id === userId) continue;
    if (options.skill && !candidate.skills.includes(options.skill)) continue;
    const match = pairScore(user, candidate, data);
    heap.push({user:candidate, ...match});
    trace.push({type:'SCORE',label:`${candidate.name}: ${match.score}%`,detail:match.reasons.join(' · ')});
  }
  const matches = [];
  while (heap.size && matches.length < (options.limit || 30)) {
    const hit = heap.pop(); matches.push(hit);
    trace.push({type:'HEAP_POP',label:`Recommend ${hit.user.name}`,detail:`Highest remaining score: ${hit.score}%`});
  }
  return {matches, trace:trace.slice(0,70), algorithm:'Max-heap (priority queue) + hash-indexed user lookup', complexity:'O(n log n) to rank n candidates'};
}

function projectScore(user, project, data) {
  const needed = project.skills.filter(s => !project.members.some(id => data.users.find(u => u.id === id)?.skills.includes(s)));
  const overlap = intersection(user.skills, project.skills);
  const fill = intersection(user.skills, needed);
  const interest = user.interests.some(i => project.category.toLowerCase().includes(i.toLowerCase())) ? 1 : 0;
  return clamp(Math.round(40 * overlap.length / Math.max(1,project.skills.length) +
    30 * fill.length / Math.max(1,needed.length) + 15 * interest + 15 * availabilityWeight(user.availability)), 0, 99);
}

function bestProjects(data, userId) {
  const user = indexes(data).users.get(userId);
  if (!user) throw new Error('Student not found');
  return data.projects.filter(p => !p.members.includes(userId) && p.members.length < p.capacity)
    .map(p => ({project:p, score:projectScore(user,p,data)}))
    .sort((a,b) => b.score-a.score || a.project.title.localeCompare(b.project.title));
}

function buildGraph(data, userId, limit=14) {
  const {users} = indexes(data); const root = users.get(userId);
  if (!root) throw new Error('Student not found');
  // Undirected weighted adjacency graph from shared skills/interests and collaborations.
  const adj = new Map(data.users.map(u => [u.id, new Map()]));
  for (let i=0;i<data.users.length;i++) {
    for (let j=i+1;j<data.users.length;j++) {
      const a=data.users[i], b=data.users[j];
      const commonSkills=intersection(a.skills,b.skills).length;
      const commonInterests=intersection(a.interests,b.interests).length;
      const team=data.projects.some(p=>p.members.includes(a.id)&&p.members.includes(b.id));
      const strength=commonSkills*2+commonInterests+(team?4:0);
      if (strength>0) {adj.get(a.id).set(b.id,strength);adj.get(b.id).set(a.id,strength);}
    }
  }
  const selected = [userId, ...bestMatches(data,userId,{limit:limit-1}).matches.map(m=>m.user.id)];
  const active = new Set(selected);
  const edges=[];
  for (const id of selected) for (const [to,strength] of adj.get(id)) {
    if (active.has(to)&&id<to) edges.push({source:id,target:to,strength});
  }
  // BFS reachability counts meaningful graph traversal, not only a rendered diagram.
  const visited=new Set([userId]),queue=[userId],walk=[];
  for(let i=0;i<queue.length;i++) {
    const at=queue[i];walk.push(at);
    for(const neighbor of adj.get(at).keys()) if(!visited.has(neighbor)) {
      visited.add(neighbor);queue.push(neighbor);
    }
  }
  return {nodes:selected.map(id=>({...users.get(id),score:pairScore(root,users.get(id),data).score})),
    edges,bfs:walk.slice(0,30),reach:visited.size,algorithm:'Weighted adjacency lists + BFS'};
}

function buildTeam(data, userId, skills, teamSize=4) {
  const {users}=indexes(data); const leader=users.get(userId);
  if (!leader) throw new Error('Student not found');
  const size=clamp(Math.floor(teamSize)||4,2,6);
  const requirements=skills.map(s=>String(s).trim()).filter(Boolean).slice(0,size-1);
  const slots=requirements.map((skill,i)=>({id:i,skill}));
  const candidates=data.users.filter(u=>u.id!==userId && u.availability!=='Low');
  const traces=[];
  // Edges are real skill matches; ranked by profile compatibility and availability.
  const edges=slots.map(slot=>candidates.filter(u=>u.skills.includes(slot.skill))
    .sort((a,b)=>pairScore(leader,b,data).score-pairScore(leader,a,data).score || a.name.localeCompare(b.name))
    .map(u=>u.id));
  const assigned=new Map(); // candidateId -> slot index
  function augment(slotIndex,seen) {
    const slot=slots[slotIndex];
    for(const candidateId of edges[slotIndex]) {
      if(seen.has(candidateId)) continue;
      seen.add(candidateId);
      const candidate=users.get(candidateId);
      traces.push({type:'EDGE',label:`${slot.skill} → ${candidate.name}`,detail:`Checking candidate for ${slot.skill} slot`});
      if(!assigned.has(candidateId) || augment(assigned.get(candidateId), seen)) {
        assigned.set(candidateId,slotIndex);
        traces.push({type:'ASSIGN',label:`Assigned ${candidate.name}`,detail:`Covers ${slot.skill}`});
        return true;
      }
    }
    traces.push({type:'UNFILLED',label:`No available match for ${slot.skill}`,detail:'Try another required skill'});
    return false;
  }
  for(let i=0;i<slots.length;i++) augment(i,new Set());
  const slotToUser=new Map([...assigned.entries()].map(([uid,i])=>[i,uid]));
  const team=[{user:leader,role:'Team lead',score:100}];
  for(const [i,uid] of slotToUser) team.push({user:users.get(uid),role:`${slots[i].skill} specialist`,score:pairScore(leader,users.get(uid),data).score,slot:i});
  // Fill remaining seats via actual max-heap prioritization.
  const selected=new Set(team.map(t=>t.user.id));
  const heap=new MaxHeap();
  for (const candidate of candidates) if(!selected.has(candidate.id)) {
    const p=pairScore(leader,candidate,data);
    heap.push({user:candidate,score:p.score});
  }
  while(team.length<size && heap.size) {
    const winner=heap.pop();team.push({...winner,role:'Collaborator'});
    traces.push({type:'HEAP_POP',label:`Added ${winner.user.name}`,detail:'Highest-ranked remaining collaborator'});
  }
  const assignments=slots.map((s,i)=>({...s,userId:slotToUser.get(i)||null}));
  return {team, assignments, coverage:slots.length ? Math.round(assignments.filter(a=>a.userId).length/slots.length*100):100,
    candidatesConsidered:candidates.length,edges:edges.reduce((n,e)=>n+e.length,0),trace:traces.slice(0,90),
    algorithm:'Bipartite maximum-cardinality matching (augmenting DFS) + max-heap seat filling',
    complexity:'O(V × E) for slot matching; O(n log n) for heap ranking',
    note:'Maximum number of skill slots filled; does not optimize total compatibility score.'};
}
module.exports={MaxHeap,indexes,pairScore,bestMatches,bestProjects,buildGraph,buildTeam,projectScore};
