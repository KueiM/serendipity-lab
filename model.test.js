import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,tick,simulate,record,normalize,config,effects,environments,wilson,pairedContrast,makeSeeds} from './dist/model.js';
import {runStudy,runEvolution,csv} from './dist/experiments.js';

test('seeded replays are identical; changing strategies leaves latent opportunities unchanged',()=>{
  assert.deepEqual(simulate(42,[34,33,33],'balanced',{},true),simulate(42,[34,33,33],'balanced',{},true));
  const a=createRun(42,[100,0,0]),b=createRun(42,[0,0,100]);assert.deepEqual(a.points,b.points);assert.deepEqual(a.turns,b.turns);
});
test('all scenarios and pure strategies terminate and respect outcome accounting',()=>{
  for(const env of Object.keys(environments))for(const a of [[100,0,0],[0,100,0],[0,0,100],[34,33,33]]){
    const s=simulate(42,a,env);assert.ok(s.done&&s.t<=s.c.steps);assert.ok(s.recognized<=s.encountered);assert.ok(s.converted+s.failed<=s.attempted);assert.ok(s.attempted<=s.recognized);assert.equal(s.success,s.completed.every(Boolean));assert.ok(s.x>=28&&s.x<=972);assert.ok(s.costSpent<=s.t);
  }
});
test('structured success requires all three distinct pieces',()=>{
  const s=createRun(42,[34,33,33],'balanced',{executionCost:0,executionChance:1});
  s.points=s.points.slice(0,3);s.points.forEach((q,i)=>Object.assign(q,{id:i,x:500,y:310,useful:true,threshold:0,executionThreshold:0,piece:0}));tick(s);
  assert.equal(s.converted,1);assert.equal(s.success,false);assert.deepEqual(s.completed,[true,false,false]);assert.equal(s.points.filter(q=>q.status==='redundant').length,2);
  const t=createRun(42,[34,33,33],'balanced',{executionCost:0,executionChance:1});t.points=t.points.slice(0,3);t.points.forEach((q,i)=>Object.assign(q,{id:i,x:500,y:310,useful:true,threshold:0,executionThreshold:0,piece:i}));tick(t);assert.equal(t.success,true);
});
test('execution cost pauses movement and zero execution probability cannot achieve goals',()=>{
  const s=createRun(42,[34,33,33],'balanced',{executionCost:3,executionChance:1});s.points=s.points.slice(0,1);Object.assign(s.points[0],{x:500,y:310,useful:true,threshold:0,executionThreshold:0});tick(s);const [x,y]=[s.x,s.y];assert.equal(s.attempted,1);for(let i=0;i<3;i++)tick(s);assert.equal(s.x,x);assert.equal(s.y,y);assert.equal(s.costSpent,3);assert.equal(s.converted,1);
  for(let seed=1;seed<=10;seed++){const t=simulate(seed,[34,33,33],'balanced',{executionChance:0});assert.equal(t.success,false);assert.equal(t.converted,0);}
});
test('hard time budget does not credit unfinished execution',()=>{
  const s=createRun(42,[34,33,33],'balanced',{steps:120,executionCost:40,executionChance:1});s.t=119;s.points=s.points.slice(0,1);Object.assign(s.points[0],{x:500,y:310,useful:true,threshold:0});tick(s);assert.equal(s.done,true);assert.equal(s.converted,0);assert.equal(s.pending.remaining,40);assert.equal(record(s).pending,1);
});
test('ablations preserve allocation and baseline capabilities, reach matches connected environment',()=>{
  const a=createRun(42,[34,33,33],'connected',{mask:[0,0,0]}),b=createRun(42,[34,33,33],'connected');assert.deepEqual(a.allocation,b.allocation);assert.equal(effects(a).speed,1.2);assert.equal(effects(a).encounter,15);assert.equal(effects(b).reach,(30+.33*190)*1.7);
});
test('normalization and configuration validation reject invalid inputs',()=>{
  for(let i=0;i<100;i++){const a=normalize([i,100-i,53]);assert.equal(a.reduce((x,y)=>x+y),100);assert.ok(a.every(v=>v>=0));}assert.deepEqual(normalize([0,0,0]),[34,33,33]);assert.throws(()=>config({executionChance:2}));assert.throws(()=>config({mask:[1,1]}));assert.throws(()=>createRun(42,[100,20,0]));
});
test('Wilson intervals match known boundary and central values',()=>{
  const zero=wilson(0,100),all=wilson(100,100),half=wilson(50,100);assert.ok(Math.abs(zero[1]-.0369935)<1e-6);assert.ok(Math.abs(all[0]-.9630065)<1e-6);assert.ok(Math.abs(half[0]-.4038315)<1e-6);assert.ok(Math.abs(half[1]-.5961685)<1e-6);
});
test('paired bootstrap aligns seeds, preserves sign and flags constant outcomes',()=>{
  const a=Array.from({length:100},(_,seed)=>({seed,success:seed<60?1:0})),b=a.map(r=>({...r,success:r.seed<30?1:0}));const p=pairedContrast([a,b],[1,-1],42);assert.equal(p.difference,30);assert.ok(p.ci[0]>0);assert.deepEqual(p,pairedContrast([a,b],[1,-1],42));assert.equal(pairedContrast([a,a],[1,-1]).degenerate,true);assert.throws(()=>pairedContrast([a,[...b].reverse()],[1,-1]));
});
test('seed blocks are reproducible, unique, and disjoint across selection and holdout',()=>{
  const a=makeSeeds(42,1000),b=makeSeeds(42,1000,1);assert.equal(new Set(a).size,1000);assert.ok(b.every(v=>!a.includes(v)));assert.deepEqual(a,makeSeeds(42,1000));
});
test('complete research suite exports 55 conditions and independent holdout with exact configuration',()=>{
  const spec={seed:42,n:10,a:[34,33,33],b:[100,0,0],env:'balanced',c:{steps:120}};const r=runStudy(spec);assert.equal(r.groups.length,55);assert.equal(r.groups.filter(g=>g.id.startsWith('grid-')).length,21);assert.equal(r.groups.filter(g=>g.id.startsWith('factor-')).length,8);assert.ok(r.groups.every(g=>g.rows.length===10));const selected=r.groups.find(g=>g.id==='holdout-best');assert.ok(selected.rows.every(x=>!r.groups[0].rows.some(y=>x.seed===y.seed)));assert.equal(csv(r).split('\n').length,551);assert.ok(csv(r).includes('configuration'));assert.equal(r.modelVersion,'2.0.0');
});
test('evolution is deterministic and partitions all evaluation stages',()=>{
 const spec={seed:42,n:10,a:[34,33,33],b:[100,0,0],env:'balanced',c:{steps:120}}, options={restarts:2,generations:4,population:8,anchors:2,rotating:3,monitor:4,selection:8};
 const r=runEvolution(spec,()=>{},options),repeat=runEvolution(spec,()=>{},options);
 assert.deepEqual({...r,createdAt:null},{...repeat,createdAt:null});
 const training=new Set(r.restarts.flatMap(x=>x.history.flatMap(h=>h.trainingSeeds)));
 for(const block of [r.monitorSeeds,r.selectionSeeds,r.testSeeds])assert.ok(block.every(x=>!training.has(x)));
 assert.ok(r.testSeeds.every(x=>!r.selectionSeeds.includes(x)&&!r.monitorSeeds.includes(x)));
 assert.ok(r.selectionSeeds.every(x=>!r.monitorSeeds.includes(x)));
 for(const run of r.restarts)for(const h of run.history)for(const x of h.population){assert.equal(x.allocation.reduce((a,b)=>a+b),100);assert.ok(x.allocation.every(v=>v>=0));}
 assert.deepEqual(r.champion,r.selectionCandidates[0].allocation);
});

import {bootstrapContrast,patternStatus,gridStability} from './dist/statistics.js';
test('pattern decisions require independent threshold-clearing evidence',()=>{
 const band=(lo,hi,degenerate=false)=>({adjustedCi:[lo,hi],degenerate});
 assert.equal(patternStatus(band(6,12),band(7,13)).code,'replicated');
 assert.equal(patternStatus(band(-12,-6),band(-13,-7)).code,'replicated');
 assert.equal(patternStatus(band(6,12),band(-13,-7)).code,'conflict');
 assert.equal(patternStatus(band(6,12),band(0,13)).code,'unconfirmed');
 assert.equal(patternStatus(band(0,12),band(7,13)).code,'unresolved');
 assert.equal(patternStatus(band(6,12,true),band(7,13)).code,'insufficient');
});
test('adjusted paired bootstrap widens intervals and rejects misaligned seeds',()=>{
 const a=Array.from({length:100},(_,seed)=>({seed,success:seed<60?1:0})),b=a.map(r=>({...r,success:r.seed<30?1:0}));
 const r=bootstrapContrast([a,b],[1,-1],42,{family:12});assert.equal(r.difference,30);assert.ok(r.adjustedCi[0]<=r.ci[0]&&r.adjustedCi[1]>=r.ci[1]);assert.throws(()=>bootstrapContrast([a,[...b].reverse()],[1,-1],42));
});
test('tied grid winners split credit and impossible goals never generate replicated patterns',()=>{
 const r=runStudy({seed:42,n:10,a:[34,33,33],b:[100,0,0],env:'balanced',c:{steps:120,executionChance:0}});
 assert.ok(r.patterns.every(p=>p.status.code==='insufficient'));assert.equal(r.stability.tieRate,100);
 assert.ok(r.stability.rows.every(x=>Math.abs(x.selectionShare-100/21)<1e-8));
 const discovery=new Set(r.groups[0].rows.map(x=>x.seed));assert.ok(r.groups.filter(x=>x.id.startsWith('replication-')).every(g=>g.rows.every(x=>!discovery.has(x.seed))));
});
