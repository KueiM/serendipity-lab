import {MODEL_VERSION, config, presets, names, environments, random, normalize, makeSeeds, simulate, record, summarize, pairedContrast, evaluate} from './model.js';
import {ANALYSIS_VERSION,bootstrapContrast,patternStatus,gridStability} from './statistics.js';
const named=(id,label,a,env,c,seeds)=>({id,label,allocation:[...a],env,c,rows:seeds.map(s=>record(simulate(s,a,env,c)))});
export function runStudy(spec,progress=()=>{}) {
  const c=config(spec.c),a=spec.a,b=spec.b,seeds=makeSeeds(spec.seed,spec.n,0),holdout=makeSeeds(spec.seed,spec.n,1),groups=[];
  const add=(id,label,alloc,env,conf,worlds=seeds)=>{const g=named(id,label,alloc,env,conf,worlds);g.summary=summarize(g.rows);groups.push(g);progress({done:groups.length,total:55,label});return g;};
  const strategyList=[['a','Strategy A',a],['b','Strategy B',b],['balanced','Balanced',presets.balanced],['explorer','Explorer',presets.explorer],['magnet','Magnet',presets.magnet],['expert','Expert',presets.expert]];
  for(const[id,label,alloc]of strategyList)add(id,label,alloc,spec.env,c);
  const factorial=[];
  for(let m=0;m<8;m++)factorial[m]=add(`factor-${m}`,m===7?'All mechanisms':`Mechanism mask ${m}`,a,spec.env,{...c,mask:[m&1?1:0,m&2?1:0,m&4?1:0]});
  const ablations=names.map((name,i)=>({name,...pairedContrast([factorial[7].rows,factorial[7^(1<<i)].rows],[1,-1],spec.seed+50+i)}));
  const interactions=[[0,1],[0,2],[1,2]].map(([i,j])=>({name:`${names[i]} × ${names[j]}`,...pairedContrast([factorial[7].rows,factorial[7^(1<<i)].rows,factorial[7^(1<<j)].rows,factorial[7^(1<<i)^(1<<j)].rows],[1,-1,-1,1],spec.seed+80+i*3+j)}));
  for(const env of Object.keys(environments))add(`environment-${env}`,environments[env].label,a,env,c);
  for(const key of ['moveGain','attractionGain','recognitionGain'])for(const multiplier of [.5,1.5])add(`sensitivity-${key}-${multiplier}`,`${key} × ${multiplier}`,a,spec.env,{...c,[key]:Math.min(key==='moveGain'?24:2,c[key]*multiplier)});
  const landscape=[];for(let e=0;e<=100;e+=20)for(let at=0;at<=100-e;at+=20){landscape.push(add(`grid-${e}-${at}`,`${e}/${at}/${100-e-at}`,[e,at,100-e-at],spec.env,c));}
  const best=[...landscape].sort((x,y)=>y.summary.rate-x.summary.rate||y.summary.fitness-x.summary.fitness)[0];
  const bestTest=add('holdout-best','Grid-selected allocation',best.allocation,spec.env,c,holdout),balancedTest=add('holdout-balanced','Balanced holdout',presets.balanced,spec.env,c,holdout);
  const contrast=pairedContrast([bestTest.rows,balancedTest.rows],[1,-1],spec.seed+333);
  const minEffect=spec.minEffect??5;
  if(!Number.isFinite(minEffect)||minEffect<0||minEffect>20)throw Error('Invalid practical-effect threshold');
  const replicationSeeds=makeSeeds(spec.seed,spec.n,2),replication=[];
  for(let m=0;m<8;m++)replication[m]=add(`replication-${m}`,`Replication mask ${m}`,a,spec.env,{...c,mask:[m&1?1:0,m&2?1:0,m&4?1:0]},replicationSeeds);
  progress({done:55,total:55,label:'Testing predeclared patterns and ranking stability'});
  const hypotheses=[...names.map((name,i)=>({id:`removal-${i}`,name:`${name} benefit`,masks:[7,7^(1<<i)],weights:[1,-1],type:'removal'})),...[[0,1],[0,2],[1,2]].map(([i,j])=>({id:`interaction-${i}-${j}`,name:`${names[i]} × ${names[j]}`,masks:[7,7^(1<<i),7^(1<<j),7^(1<<i)^(1<<j)],weights:[1,-1,-1,1],type:'interaction'}))];
  const patterns=hypotheses.map((h,i)=>{const discovery=bootstrapContrast(h.masks.map(m=>factorial[m].rows),h.weights,spec.seed+3000+i,{family:12});const repeat=bootstrapContrast(h.masks.map(m=>replication[m].rows),h.weights,spec.seed+4000+i,{family:12});return{...h,discovery,replication:repeat,status:patternStatus(discovery,repeat,minEffect)};});
  const stability=gridStability(landscape,spec.seed+5000);

  return {kind:'study',analysisVersion:ANALYSIS_VERSION,minEffect,patterns,stability,modelVersion:MODEL_VERSION,createdAt:new Date().toISOString(),spec:{...spec,c},seedProtocol:'uint32(base + stream * 1000003 + index); stream 0 discovery, 1 grid holdout, 2 pattern replication',groups,ablations,interactions,ab:pairedContrast([groups[0].rows,groups[1].rows],[1,-1],spec.seed+999),selection:{allocation:best.allocation,exploration:best.summary,validation:bestTest.summary,balanced:balancedTest.summary,contrast},inference:'Simulation only. Pattern decisions require matching directions beyond the practical threshold in discovery and replication. 10,000 paired bootstrap resamples; Bonferroni alpha=.05/12 across six hypotheses in two blocks (approximate family-wise coverage). Other intervals remain pointwise/exploratory. Grid selection shares are descriptive resampling stability, not posterior probabilities. Reusing the base seed reuses test blocks.'};
}
export const evolutionDefaults=Object.freeze({restarts:3,generations:20,population:24,anchors:8,rotating:16,monitor:24,selection:100});
export function sampleAllocation(rng){return normalize([0,0,0].map(()=>-Math.log(Math.max(Number.MIN_VALUE,rng()))));}
export function breedAllocation(a,b,rng,amplitude){
  const mix=.25+rng()*.5;
  return normalize(a.map((v,i)=>Math.max(0,v*mix+b[i]*(1-mix)+(rng()-.5)*amplitude)));
}
function populationSpread(pop){const mean=[0,1,2].map(j=>pop.reduce((s,a)=>s+a[j],0)/pop.length);return{mean,diversity:Math.sqrt(pop.reduce((s,a)=>s+a.reduce((v,x,j)=>v+(x-mean[j])**2,0),0)/(pop.length*3)),unique:new Set(pop.map(a=>a.join(','))).size};}
export function runEvolution(spec,progress=()=>{},options={}){
  const settings={...evolutionDefaults,...options};
  for(const k of Object.keys(evolutionDefaults))if(!Number.isInteger(settings[k])||settings[k]<1)throw Error('Invalid evolution settings');
  if(settings.population<8||settings.restarts>3||settings.generations>20||settings.anchors>100||settings.rotating>100||settings.selection>1000||settings.monitor>100)throw Error('Evolution budget out of range');
  const c=config(spec.c),restarts=[],pool=new Map(),groups=[],monitorSeeds=makeSeeds(spec.seed,settings.monitor,200);
  const remember=(allocation,restart,generation)=>{const key=allocation.join(',');if(!pool.has(key))pool.set(key,{allocation:[...allocation],origins:[]});pool.get(key).origins.push({restart,generation});};
  for(let restart=0;restart<settings.restarts;restart++){
    const rng=random(spec.seed+9001+restart*7001),anchorSeeds=makeSeeds(spec.seed,settings.anchors,100+restart*25);let pop=[...Object.values(presets).map(a=>[...a]),...Array.from({length:settings.population-4},()=>sampleAllocation(rng))];const history=[];
    for(let generation=0;generation<settings.generations;generation++){
      const trainingSeeds=[...anchorSeeds,...makeSeeds(spec.seed,settings.rotating,101+restart*25+generation)];
      const ranked=pop.map(a=>({a,s:evaluate(a,spec.env,trainingSeeds,c)})).sort((a,b)=>b.s.rate-a.s.rate||b.s.fitness-a.s.fitness||a.a.join(',').localeCompare(b.a.join(',')));
      const best=ranked[0].a,spread=populationSpread(pop),mutation=spread.diversity<10||spread.unique<pop.length*.6?35:18;
      // Monitoring is read-only: never used in breeding, checkpoint eligibility, or selection.
      const monitor=evaluate(best,spec.env,monitorSeeds,c);
      history.push({generation:generation+1,...spread,best:[...best],trainingRate:ranked[0].s.rate,trainingSeeds,monitorRate:monitor.rate,monitorFitness:monitor.fitness,mutation,population:ranked.map(x=>({allocation:x.a,rate:x.s.rate,fitness:x.s.fitness}))});
      if(generation===0||(generation+1)%4===0||generation===settings.generations-1)remember(best,restart,generation+1);
      progress({done:restart*settings.generations+generation+1,total:settings.restarts*settings.generations,label:`Restart ${restart+1}/${settings.restarts} · generation ${generation+1}/${settings.generations}`});
      if(generation<settings.generations-1){
        const distinct=ranked.filter((x,i,all)=>all.findIndex(y=>y.a.join(',')===x.a.join(','))===i),elites=distinct.slice(0,4).map(x=>[...x.a]);
        const tournament=()=>{let winner=ranked[Math.floor(rng()*ranked.length)];for(let k=0;k<2;k++){const contender=ranked[Math.floor(rng()*ranked.length)];if(contender.s.rate>winner.s.rate||(contender.s.rate===winner.s.rate&&contender.s.fitness>winner.s.fitness))winner=contender;}return winner.a;};
        pop=[...elites,...Array.from({length:settings.population-elites.length-3},()=>breedAllocation(tournament(),tournament(),rng,mutation)),...Array.from({length:3},()=>sampleAllocation(rng))];
      }
    }
    restarts.push({restart:restart+1,history,anchorSeeds});
  }
  const selectionSeeds=makeSeeds(spec.seed,settings.selection,201);
  const candidates=[...pool.values()].map((candidate,i)=>{const g=named(`candidate-${i}`,'Checkpoint candidate',candidate.allocation,spec.env,c,selectionSeeds);g.role='selection';g.summary=summarize(g.rows);groups.push(g);return{...candidate,id:g.id,summary:g.summary};}).sort((a,b)=>b.summary.rate-a.summary.rate||b.summary.fitness-a.summary.fitness||a.allocation.join(',').localeCompare(b.allocation.join(',')));
  const winner=candidates[0],source=winner.origins[0],champion=winner.allocation;
  // Winner and initial comparator are fixed before final-test worlds are evaluated.
  const initial=restarts[source.restart].history[0].best,testSeeds=makeSeeds(spec.seed,spec.n,202);
  const final=(id,label,a)=>{const g=named(id,label,a,spec.env,c,testSeeds);g.role='final-test';g.summary=summarize(g.rows);groups.push(g);return g;};
  progress({done:settings.restarts*settings.generations,total:settings.restarts*settings.generations,label:'Testing the selected candidate on untouched worlds'});
  const test=final('evolved-test','Selected champion',champion),balanced=final('balanced-test','Balanced reference',presets.balanced),initialTest=final('initial-test','Initial-generation reference',initial);
  const contrast=bootstrapContrast([test.rows,balanced.rows],[1,-1],spec.seed+700,{family:2}),improvement=bootstrapContrast([test.rows,initialTest.rows],[1,-1],spec.seed+701,{family:2});
  const restartWinners=restarts.map((run,i)=>{const best=candidates.find(candidate=>candidate.origins.some(o=>o.restart===i));return{restart:i+1,allocation:best.allocation,selectionRate:best.summary.rate};});
  return{kind:'evolution',analysisVersion:ANALYSIS_VERSION,modelVersion:MODEL_VERSION,createdAt:new Date().toISOString(),spec:{...spec,c},settings,seedProtocol:{training:'stream 100 + restart*25 anchors; stream 101 + restart*25 + generation rotating',monitor:200,selection:201,finalTest:202},monitorSeeds,selectionSeeds,testSeeds,selectionCandidates:candidates,selectedCheckpoint:{restart:source.restart+1,generation:source.generation},restarts,restartWinners,history:restarts[source.restart].history,champion,initial,validation:test.summary,baseline:balanced.summary,initialValidation:initialTest.summary,contrast,improvement,groups,inference:'Final test is not used for selection. Restart summaries use selection worlds and are not final-test estimates. Monitoring is diagnostic only. Two final comparisons use Bonferroni-adjusted bootstrap intervals; results remain approximate and conditional on this simulator.'};
}
export function csv(result){const keys=['seed','success','steps','encountered','recognized','attempted','converted','failed','costSpent','pieces','pending','fitness'];const header=['modelVersion','analysisVersion','role','group','environment','exploration','attraction','preparedness','configuration',...keys];const quote=v=>'"'+String(v).replaceAll('"','""')+'"';return[header,...result.groups.flatMap(g=>g.rows.map(r=>[result.modelVersion,result.analysisVersion??'2.0.0',g.role??(g.id.startsWith('replication-')?'replication':g.id.startsWith('holdout-')?'holdout':'discovery'),g.id,g.env,...g.allocation,JSON.stringify(g.c),...keys.map(k=>r[k])]))].map(row=>row.map(quote).join(',')).join('\n');}
