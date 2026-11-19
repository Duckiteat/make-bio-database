// 숨은 시작량 목록 (DEC-0063 ① 준비) — 읽기만. 실행: node workspace/implicit-starts.js (요약) · --json > workspace/implicit-starts.json (목록)
//   속도 엔진 시나리오: 시작 상태(series[0])에서 시나리오가 주지 않은 묶음과 그 값 · 출처(pool = 대사물 풀, default = 세포 기본값 · amount 기본)
//   운명 엔진 시나리오: IR 묶음 중 시나리오가 주지 않아 0 에서 시작하는 수 · 사전 등록 여부
const R=require('path').resolve(__dirname,'..')+'/';const C=require(R+'core.js'),IRB=require(R+'compiler/ir_builder.js'),S=require(R+'scenarios.js'),fs=require('fs');const db=C.normalize(require(R+'data/db.json'));
const sub=require(R+'examples/scenarios/subjects.json').subjects; const out={rate:{},fate:{}};
const P=require(R+'judicial/protocol.js'); const prereg=fs.readFileSync(R+'data/preregistrations.jsonl','utf8').trim().split('\n').map(JSON.parse);
for (const [f,t] of Object.entries(sub)) {
  const sc=S.read(R+'examples/scenarios/'+f), kind=db.senses[t].kind, reg=prereg.some(e=>e.scenario_sha256===P.scenarioHash(sc));
  const given=new Set([...Object.keys(sc.amounts||{}),...Object.keys(sc.reservoirs||{}),...Object.keys(sc.buffered||{}),...Object.keys(sc.signals||{})]);
  if (kind==='cell_state') { const ir=IRB.buildFateIR(db,t,sc); if(ir.error) continue; const miss=ir.keys.filter(b=>!given.has(b)); out.fate[f]={target:t,registered:reg,bundles:ir.keys.length,implicitZero:miss.length}; }
  else { const r=C.simulateRate(db,t,{scenario:sc,t_end:0.002,dt:1e-3}); if(r.error){out.rate[f]={error:r.error};continue;} const N0=r.series[0].N; const imp=Object.entries(N0).filter(([b])=>!given.has(b)).map(([b,v])=>[b,v,r.reservoirs&&r.reservoirs[b]?'pool':'default']); out.rate[f]={target:t,registered:reg,bundles:Object.keys(N0).length,implicit:imp}; }
}
if (process.argv[2] === '--json') { console.log(JSON.stringify(out,null,1)); process.exit(0); } // 파일은 쓰지 않는다 — 쓰기는 서기만(RULE-0010 계열), 저장은 셸 리디렉션으로
for (const [f,v] of Object.entries(out.rate)) console.log('rate',f,v.target,'reg',v.registered,'implicit',v.implicit?.length,'/',v.bundles, v.implicit&&[...new Set(v.implicit.map(x=>x[1]))].slice(0,6).join(','));
const fz=Object.values(out.fate); console.log('fate scenarios',fz.length,'implicitZero total',fz.reduce((a,v)=>a+v.implicitZero,0),'registered',fz.filter(v=>v.registered).length);
