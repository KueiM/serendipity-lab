import {runStudy,runEvolution} from './experiments.js';
self.onmessage=({data})=>{try{const result=(data.kind==='study'?runStudy:runEvolution)(data.spec,p=>self.postMessage({type:'progress',...p}));self.postMessage({type:'result',result});}catch(error){self.postMessage({type:'error',message:error.message});}};
