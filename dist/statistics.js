import {random} from './model.js';
export const ANALYSIS_VERSION='3.0.0';
export function quantile(sorted,p){const at=(sorted.length-1)*p,lo=Math.floor(at);return sorted[lo]+(sorted[Math.ceil(at)]-sorted[lo])*(at-lo);}
// World IDs stay aligned in every resample; no independent resampling of treatments.
export function bootstrapContrast(groups,coefficients,seed,{family=1,resamples=10000}={}){
  const n=groups[0]?.length;
  if(!n||groups.length!==coefficients.length||groups.some(g=>g.length!==n||g.some((r,i)=>r.seed!==groups[0][i].seed||![0,1].includes(r.success)))||!Number.isInteger(family)||family<1||resamples<1000)throw Error('Invalid paired contrast');
  const values=groups[0].map((_,i)=>groups.reduce((sum,g,j)=>sum+coefficients[j]*g[i].success,0));
  const difference=100*values.reduce((a,b)=>a+b,0)/n,degenerate=values.every(x=>x===values[0]),rng=random(seed);
  const samples=new Float64Array(resamples);
  for(let b=0;b<resamples;b++){let sum=0;for(let i=0;i<n;i++)sum+=values[Math.floor(rng()*n)];samples[b]=sum/n*100;}samples.sort();
  return {difference,ci:[quantile(samples,.025),quantile(samples,.975)],adjustedCi:[quantile(samples,.025/family),quantile(samples,1-.025/family)],confidence:1-.05/family,family,resamples,n,degenerate,method:'paired-percentile-bootstrap / Bonferroni alpha allocation'};
}
export function patternStatus(discovery,replication,minEffect=5){
  if(discovery.degenerate||replication.degenerate)return{code:'insufficient',label:'Insufficient variation',reason:'A block has constant paired effects. Resampling cannot establish uncertainty beyond the observed worlds.'};
  const direction=x=>x.adjustedCi[0]>minEffect?1:x.adjustedCi[1]<-minEffect?-1:0;
  const d=direction(discovery),r=direction(replication);
  if(d&&r&&d===r)return{code:'replicated',label:'Replicated in this model',reason:`Both independent blocks clear ${minEffect} percentage points in the same direction after adjustment.`};
  if(d&&r&&d!==r)return{code:'conflict',label:'Direction conflict',reason:'Adjusted intervals support opposite effects. Do not summarize this as a stable pattern.'};
  if(d)return{code:'unconfirmed',label:'Not confirmed',reason:'The discovery effect cleared the threshold; replication did not. This is not evidence of no effect.'};
  return{code:'unresolved',label:'Unresolved',reason:'Both blocks must clear the preselected threshold. More worlds or a different model may change the result.'};
}
export function gridStability(groups,seed,resamples=1000){
  const n=groups[0]?.rows.length;if(!n||groups.some(g=>g.rows.length!==n||g.rows.some((r,i)=>r.seed!==groups[0].rows[i].seed)))throw Error('Grid stability requires paired worlds');
  const rng=random(seed),weights=groups.map(()=>0);let tied=0;
  for(let b=0;b<resamples;b++){
    const counts=new Int32Array(n);for(let i=0;i<n;i++)counts[Math.floor(rng()*n)]++;
    const scores=groups.map(g=>g.rows.reduce((s,r,i)=>s+counts[i]*r.success,0)),best=Math.max(...scores),winners=scores.map((v,i)=>v===best?i:-1).filter(i=>i>=0);
    if(winners.length>1)tied++;for(const i of winners)weights[i]+=1/winners.length;
  }
  return {resamples,tieRate:tied/resamples*100,rows:groups.map((g,i)=>({id:g.id,allocation:g.allocation,selectionShare:weights[i]/resamples*100})).sort((a,b)=>b.selectionShare-a.selectionShare)};
}
