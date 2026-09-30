// Serendipity Lab v2: an explicit, uncalibrated agent-based model.
export const MODEL_VERSION = '2.0.0';
export const names = ['Exploration', 'Attraction', 'Preparedness'];
export const pieces = ['Insight', 'Collaborator', 'Resources'];
export const domains = ['Technology', 'Business', 'Creative'];
export const presets = { balanced: [34, 33, 33], explorer: [100, 0, 0], magnet: [0, 100, 0], expert: [0, 0, 100] };
export const environments = {
  balanced: {count: 180, useful: .48, ambiguity: .9, pull: 1, label: 'Open landscape', note: 'Three opportunity clusters and a mix of domains.'},
  scarce: {count: 90, useful: .30, ambiguity: .9, pull: 1, label: 'Scarce opportunities', note: 'Half as many opportunities, with lower useful prevalence.'},
  ambiguous: {count: 180, useful: .48, ambiguity: 1.5, pull: 1, label: 'Hidden potential', note: 'Recognition is harder; the underlying opportunities are unchanged.'},
  connected: {count: 180, useful: .48, ambiguity: .9, pull: 1.7, label: 'Connected world', note: 'Visibility reaches further and nearby points move faster toward you.'}
};
export const defaults = Object.freeze({steps:360, moveGain:12, attractionGain:1, recognitionGain:1, clarity:.65, executionChance:.8, executionCost:12, learning:.12, goal:'structured', domain:0, layout:'clustered', mask:[1,1,1]});
export function random(seed) {let a=seed>>>0; return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function normalize(a) {const sum=a.reduce((s,v)=>s+v,0);if(!sum)return[34,33,33];const v=a.map(x=>Math.floor(x/sum*100));v[a.indexOf(Math.max(...a))]+=100-v.reduce((s,x)=>s+x,0);return v;}
export function config(input={}) {
  const c={...defaults,...input,mask:[...(input.mask??defaults.mask)]};
  const limits={steps:[120,720],moveGain:[0,24],attractionGain:[0,2],recognitionGain:[0,2],clarity:[0,1],executionChance:[0,1],executionCost:[0,40],learning:[0,.4],domain:[0,2]};
  for(const[k,[lo,hi]]of Object.entries(limits))if(!Number.isFinite(c[k])||c[k]<lo||c[k]>hi)throw Error(`Invalid ${k}`);
  if(!Number.isInteger(c.steps)||!Number.isInteger(c.executionCost)||!Number.isInteger(c.domain)||!['structured','count'].includes(c.goal)||!['clustered','uniform'].includes(c.layout)||c.mask.length!==3||c.mask.some(v=>v!==0&&v!==1))throw Error('Invalid model configuration');
  return c;
}
export function makeSeeds(base,n,stream=0) {
  // Separate contiguous seed blocks: paired within a group, disjoint across holdout/training.
  if(!Number.isInteger(base)||!Number.isInteger(n)||n<1||n>10000)throw Error('Invalid seeds');
  return Array.from({length:n},(_,i)=>(base+stream*1000003+i)>>>0);
}
export function createRun(seed,allocation,env='balanced',input={},trace=true) {
  if(!environments[env]||allocation.length!==3||allocation.some(v=>!Number.isFinite(v)||v<0)||Math.abs(allocation.reduce((a,b)=>a+b,0)-100)>1e-6)throw Error('Invalid strategy or environment');
  const c=config(input),r=random(seed),e=environments[env];
  const centers=[[225,170],[765,200],[525,480]];
  const points=Array.from({length:e.count},(_,id)=>{
    const ux=r(),uy=r(),cluster=Math.floor(r()*3),domain=Math.floor(r()*3),piece=Math.floor(r()*3);
    const x=c.layout==='uniform'?30+ux*940:clamp(centers[cluster][0]+(ux-.5)*360,30,970);
    const y=c.layout==='uniform'?30+uy*560:clamp(centers[cluster][1]+(uy-.5)*220,30,590);
    return {id,x,y,startX:x,startY:y,domain,piece,useful:r()<e.useful,threshold:r(),executionThreshold:r(),seen:false,recognized:false,status:'unseen',pulled:0};
  });
  const motion=random(seed^0x9e3779b9);
  return {seed,allocation:[...allocation],env,c,trace,t:0,x:500,y:310,angle:motion()*Math.PI*2,encountered:0,recognized:0,attempted:0,converted:0,failed:0,costSpent:0,learned:0,completed:[false,false,false],done:false,success:false,pending:null,queue:[],path:trace?[[500,310]]:[],events:[],points,turns:Array.from({length:c.steps+1},()=>motion())};
}
export function effects(s) {
  const [e,a,p]=s.allocation.map((v,i)=>v/100*s.c.mask[i]);
  return {e,a,p,reach:(30+a*190*s.c.attractionGain)*environments[s.env].pull,speed:1.2+e*s.c.moveGain,encounter:15+a*20*s.c.attractionGain};
}
function event(s,q,message){if(s.trace)s.events.push({step:s.t,id:q.id,message});}
function recognitionChance(s,q,p) {const domainFit=q.domain===s.c.domain?1:.55;return clamp(.12+(p**.65*s.c.recognitionGain+ s.learned*s.c.mask[2])*domainFit/environments[s.env].ambiguity,0,.98);}
function finishAttempt(s,q) {
  if(q.executionThreshold<s.c.executionChance){q.status='converted';s.converted++;s.completed[q.piece]=true;event(s,q,`${pieces[q.piece]} secured after ${s.c.executionCost} steps of execution.`);}
  else {q.status='failed';s.failed++;event(s,q,'Execution failed. Time was spent; the opportunity did not convert.');}
  s.success=s.c.goal==='structured'?s.completed.every(Boolean):s.converted>=5;
  if(s.success)s.done=true;
}
function startNext(s) {
  while(s.queue.length&&!s.pending&&!s.done){const q=s.points[s.queue.shift()];
    if(s.c.goal==='structured'&&s.completed[q.piece]){q.status='redundant';event(s,q,`${pieces[q.piece]} already secured; duplicate skipped.`);continue;}
    q.status='attempted';s.attempted++;q.attemptStep=s.t;event(s,q,`Acting on ${pieces[q.piece].toLowerCase()}; movement pauses for execution.`);
    if(s.c.executionCost===0)finishAttempt(s,q);else s.pending={id:q.id,remaining:s.c.executionCost};
  }
}
export function tick(s) {
  if(s.done)return s;
  s.t++;const {a,p,speed,reach,encounter}=effects(s),env=environments[s.env];
  if(s.pending){s.pending.remaining--;s.costSpent++;if(s.pending.remaining<=0){const q=s.points[s.pending.id];s.pending=null;finishAttempt(s,q);}}
  else {
    s.angle+=(s.turns[s.t]-.5)*.85;s.x+=Math.cos(s.angle)*speed;s.y+=Math.sin(s.angle)*speed;
    if(s.x<28||s.x>972){s.angle=Math.PI-s.angle;s.x=clamp(s.x,28,972);}if(s.y<28||s.y>592){s.angle=-s.angle;s.y=clamp(s.y,28,592);}
  }
  if(s.trace)s.path.push([s.x,s.y]);
  if(!s.done)for(const q of s.points){if(q.seen)continue;let dx=s.x-q.x,dy=s.y-q.y,d=Math.hypot(dx,dy);
    // Signal clarity filters by visible domain, never by hidden usefulness.
    const relevance=q.domain===s.c.domain?1:1-s.c.clarity;
    if(d<reach&&d>1){const pull=Math.min(d,a*1.6*s.c.attractionGain*env.pull*relevance);q.x+=dx/d*pull;q.y+=dy/d*pull;q.pulled+=pull;d-=pull;}
    if(d<encounter){q.seen=true;q.encounterStep=s.t;q.recognitionChance=recognitionChance(s,q,p);s.encountered++;
      q.route=q.pulled>8?'attracted':'crossed';
      if(q.useful&&q.threshold<q.recognitionChance){q.recognized=true;q.status='recognized';s.recognized++;s.queue.push(q.id);event(s,q,`${q.route==='attracted'?'Signal attracted':'Path crossed'} ${domains[q.domain].toLowerCase()} ${pieces[q.piece].toLowerCase()}; value recognized.`);}
      else{q.status='missed';event(s,q,'Encounter ended without recognizing a useful connection.');}
      s.learned=clamp(s.learned+s.c.learning/30,0,.3);
    }
  }
  startNext(s);if(s.t>=s.c.steps)s.done=true;return s;
}
export function simulate(seed,allocation,env='balanced',c={},trace=false){const s=createRun(seed,allocation,env,c,trace);while(!s.done)tick(s);return s;}
export function record(s){return{seed:s.seed,success:Number(s.success),steps:s.t,encountered:s.encountered,recognized:s.recognized,attempted:s.attempted,converted:s.converted,failed:s.failed,costSpent:s.costSpent,pieces:s.completed.filter(Boolean).length,pending:s.pending?1:0,fitness:(s.c.goal==='structured'?s.completed.filter(Boolean).length:Math.min(5,s.converted))+(s.success?1+(s.c.steps-s.t)/s.c.steps:0)};}
export function wilson(k,n,z=1.959963984540054){if(!n)return[0,1];const p=k/n,d=1+z*z/n,center=(p+z*z/(2*n))/d,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return[clamp(center-half,0,1),clamp(center+half,0,1)];}
export function summarize(rows){const n=rows.length;if(!n)throw Error('No runs to summarize');const successes=rows.filter(r=>r.success),times=successes.map(r=>r.steps).sort((a,b)=>a-b),m=Math.floor(times.length/2);const mean=k=>rows.reduce((s,r)=>s+r[k],0)/n;return{n,successes:successes.length,rate:100*successes.length/n,ci:wilson(successes.length,n).map(v=>100*v),encounters:mean('encountered'),recognized:mean('recognized'),converted:mean('converted'),pieces:mean('pieces'),cost:mean('costSpent'),fitness:mean('fitness'),median:times.length?(times.length%2?times[m]:(times[m-1]+times[m])/2):null};}
export function evaluate(allocation,env,seeds,c={}){return summarize(seeds.map(seed=>record(simulate(seed,allocation,env,c))));}
export function pairedContrast(groups,coefficients,seed=1,resamples=2000){
  const n=groups[0].length;
  if(groups.length!==coefficients.length||groups.some(g=>g.length!==n)||groups.some(g=>g.some((r,i)=>r.seed!==groups[0][i].seed)))throw Error('Contrasts require aligned world seeds');
  const values=groups[0].map((_,i)=>groups.reduce((s,g,j)=>s+g[i].success*coefficients[j],0)),mean=values.reduce((a,b)=>a+b,0)/n;
  const r=random(seed),samples=Array.from({length:resamples},()=>{let s=0;for(let i=0;i<n;i++)s+=values[Math.floor(r()*n)];return s/n;}).sort((a,b)=>a-b);
  return{difference:mean*100,ci:[samples[Math.floor(resamples*.025)]*100,samples[Math.floor(resamples*.975)]*100],n,resamples,degenerate:values.every(v=>v===values[0])};
}
