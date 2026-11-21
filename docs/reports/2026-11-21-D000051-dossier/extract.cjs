// usage (저장소 최상위에서): node docs/reports/2026-11-21-D000051-dossier/extract.cjs <out.json> — D000051 을 시나리오 4 가지로 simulateRate(60 s, Δt 1 ms) 해 궤적·누적 발화·정지·속도식을 뽑는다 (읽기만)
const R=process.cwd();
const C=require(R+'/core.js');const db=require(R+'/data/db.json');const SC=require(R+'/scenarios.js');
const name=d=>{const s=db.senses[d];if(!s)return d;const t=db.terms[s.term];return (t&&t.names.ko)||d};
const P='D000051';
const ids=C.simulateRate(db,P,{t_end:0.001,dt:1e-3}).ids;
const ruleOf=ref=>{const [own,,rn]=ref.split('/');return ((db.senses[own]||{}).rule||[]).find(x=>x.id===rn)};
const steps=ids.map(id=>{const s=db.steps[id];const r=ruleOf(s.rule)||{};return {id,rule:s.rule,label:r.label,action:r.action,text:r.text,effect:r.effect,with:r.with,kinetics:r.kinetics||null,evidence:r.evidence,regulators:s.regulators,agents:s.agents,inputs:s.inputs,outputs:s.outputs,context:r.context||null}});
const runs={};
const scen={none:null,'camp-competition':'examples/scenarios/camp-competition-hypothetical.json','gtp-exhaustion':'examples/scenarios/gtp-exhaustion-hypothetical.json','gtp-regeneration':'examples/scenarios/gtp-regeneration-hypothetical.json'};
for(const [k,f] of Object.entries(scen)){
  const L=f?SC.load(f):null;const sc=L?L.scenario:null;
  const r=C.simulateRate(db,P,{scenario:sc,t_end:60,dt:1e-3});
  const keys=Object.keys(r.series[0].N);
  const pick=[0,0.3,0.6,1.2,3,6,15,30,60];
  const traj={};for(const b of keys){traj[b]=pick.map(t=>{const x=r.series.find(s=>Math.abs(s.t-t)<1e-9);return x?x.N[b]:null})}
  runs[k]={file:f,scenarioRaw:f?require(R+'/'+f):null,resolved:sc?{volumes:sc.volumes,amounts:sc.amounts,reservoirs:sc.reservoirs,kinetics:sc.kinetics,cell:sc.cell}:null,
    pick,traj,start:r.series[0].N,final:r.final,cum:r.cum,firstFire:r.firstFire,firstReach:r.firstReach,events:r.events,stalls:r.stalls,negatives:r.negatives,stiff:r.stiff,kinUsed:r.kinUsed,kineticGaps:r.kineticGaps,reservoirs:r.reservoirs,ledger:r.ledger,stepCycles:r.stepCycles,peakRate:r.peakRate,zeroAt:r.zeroAt,approx:r.approx,supplies:r.supplies.map(s=>({ref:s.ref,V:s.V,active:s.active,kin:s.kin,consumes:s.consumes,produces:s.produces})),channels:r.channels,facts:r.facts,modulationGaps:r.modulationGaps};
}
const ents=new Set();for(const s of steps)for(const k of ['agents','inputs','outputs'])for(const p of s[k])ents.add(p.b.split('|')[0]);
const entInfo={};for(const d of ents){const s=db.senses[d];entInfo[d]={name:name(d),kind:s.kind,xrefs:s.xrefs,obs:s.obs,membrane:s.membrane,note:s.note,components:s.components}}
require('fs').writeFileSync(process.argv[2],JSON.stringify({steps,runs,entInfo,names:Object.fromEntries([...new Set(Object.values(runs).flatMap(r=>Object.keys(r.start)))].map(b=>[b,name(b.split('|')[0])]))},null,1));
