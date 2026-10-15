// 조정자 (Orchestrator) — 세 권력 사이의 배선. docs/design/tripartite-governance.md
//
//   [행정부 실행] → 원자료 → [사법부 판정] → 판결·보고서 → (쓰기가 필요하면) [입법 서기] — 서기 호출은 dbtool.mjs 가 한다.
// 이 파일은 아무것도 쓰지 않고 판정하지도 않는다: 행정부(core.js·engine/)를 부르고 그 결과를 사법부(judicial/)에 넘길 뿐이다.
// 사법부 모듈은 엔진을 직접 부르지 않으므로, 엔진 실행이 필요한 감사(audit-run·해상도 계획·비교 검토)는 여기서 원자료를 마련한다.
'use strict';
const C = require('./core.js');
const J = require('./judicial/judicial.js');
const L = require('./legislative/legislative.js');
const F = require('./engine/fate_engine.js');
const FA = require('./judicial/fate_audit.js');
const CMP = require('./judicial/compare.js');
const ID = require('./judicial/identity.js');
const ATT = require('./judicial/attestation.js');
const DRAFT = require('./legislative/augment_draft.js');
const IRB = require('./compiler/ir_builder.js');
const LOGA = require('./judicial/log_audit.js');
const OBSOP = require('./compiler/obs_operator.js');
const OC = require('./judicial/obs_compare.js');
const SA = require('./judicial/stoch_audit.js');

// ----- 사건 기반·속도 시뮬레이션 -----
const pools = (db, target) => { const s = C.simulate(db, target, { rounds: 0 }); return s.error ? undefined : { source: s.source }; };
function runRate(db, target, opt) {
  const raw = C.simulateRate(db, target, opt);
  if (raw.error) return raw;
  return Object.assign({}, raw, J.auditRate(db, target, raw));
}
const simulateText = (db, target, opt) => { const raw = C.simulate(db, target, opt); return raw.error ? raw.error : J.simulateText(db, target, opt, raw); };
const simulateRateText = (db, target, opt) => J.simulateRateText(db, target, C.simulateRate(db, target, opt));
const resolutionPlan = (db, target) => J.resolutionPlan(db, target, { pools: pools(db, target) });
const resolutionText = (db, target) => J.resolutionText(db, target, { pools: pools(db, target) });
const auditRun = (db, target, opt) => J.auditRun(db, target, { pools: pools(db, target), rate: C.simulateRate(db, target, opt) });

// ----- 세포 운명 -----
// 컴파일(IR) → 행정부 실행(IR 소비) → 사법부 판정(같은 IR 을 독립 검증)
function runFate(db, sid, opt) {
  opt = opt || {};
  const ir = opt.ir || IRB.buildFateIR(db, sid, opt.scenario || {}, opt.coupling);
  if (ir.error) return ir;
  // 행정부 백엔드: 기본 'rust'(engine/rust WASM, 1단계 완료 조건 통과) — 'js' 는 기준 구현(오라클)으로 대조할 때
  const raw = F.simulateFate(db, sid, Object.assign({ engine: 'rust' }, opt, { ir }));
  if (raw.error) return raw;
  return FA.judgeFate(db, raw, { scenario: opt.scenario || {}, ir });
}
const fateBrief = (db, sid, opt) => { const v = runFate(db, sid, opt); return v.error ? { text: '오류: ' + v.error, code: 1, result: v } : Object.assign(FA.fateText(v), { result: v }); };

// ----- 비교 검토: 변형마다 행정부 실행 (본 실행·수렴 기준·시간) → 사법부 판정 -----
const timed = (f) => { const t0 = process.hrtime.bigint(), r = f(); return { r, ms: Number(process.hrtime.bigint() - t0) / 1e6 }; };
// 수렴 기준 (수치 L2 의 기준): 같은 결합 적분기를 허용 오차를 기본의 1/1000 로 좁혀 — 시나리오의 다른 값은 그대로 (1.5단계, 예전 '명시 1%' 기준은 자기 오차 ~1e-3)
const refScenario = (sc) => ({ ...sc, integrator: { ...(sc.integrator || {}), rtol: 1e-9, atol: 1e-5 } });
function runVariant(db, state, sc, opt) {
  const A = F.assemble(C.normalize(db), state, sc);
  if (A.error) return { error: A.error };
  const main = timed(() => F.simulateFate(db, state, { scenario: sc }));
  if (main.r.error) return { error: main.r.error };
  const refSc = { ...sc, t_end: opt.refHours * 3600 };
  const dyn = F.simulateFate(db, state, { scenario: refSc, commitment: false });
  const ref = timed(() => F.simulateFate(db, state, { scenario: refScenario(refSc), commitment: false }));
  const mods = A.rules.reduce((t, r) => t + r.mods.length, 0);
  return { run: main.r, ms: main.ms, dyn, ref: ref.r, refMs: ref.ms,
    complexity: { rules: A.rules.length, modulations: mods, fast: A.rules.filter((r) => !r.slow).length, slow: A.rules.filter((r) => r.slow).length, bundles: A.bundles.length, units: A.rules.length + mods } };
}
function compare(dbA, dbB, state, scA, scB, opt) {
  opt = Object.assign({ refHours: 3, negligible: 1e-5 }, opt || {});
  return CMP.compare(dbA, dbB, runVariant(dbA, state, scA, opt), runVariant(dbB, state, scB, opt), opt);
}

// ----- 확률 앙상블 (4단계 ④·⑤): 궤적 i 는 (시나리오 seed, i) — 같은 입력이면 같은 궤적. 실행은 행정부(기본 Rust/WASM, 'js' 는 기준 구현), 판정은 사법부 -----
function runEnsemble(db, state, sc, n, opt) {
  opt = opt || {};
  if (!sc.stochastic) return { error: '앙상블에는 시나리오 stochastic { seed } 가 필요함' };
  const raws = [];
  for (let i = 0; i < n; i++) { const r = F.simulateFate(db, state, Object.assign({ engine: 'rust' }, opt, { scenario: sc, trajectory: (opt.first || 0) + i })); if (r.error) return r; raws.push(r); }
  return raws;
}
// 부피 Ω 배: 부피·시작량·완충 총량·신호·문턱을 Ω 배 — 농도·속도 상수는 그대로 (분자 수만 커져 상대 요동 ∝ 1/√Ω)
function scaleScenario(sc, omega) {
  const x = JSON.parse(JSON.stringify(sc)), mul = (o, f) => { for (const k of Object.keys(o || {})) o[k] = f(o[k]); };
  mul(x.volumes, (v) => ({ ...v, value: v.value * omega }));
  mul(x.amounts, (n) => n * omega);
  mul(x.buffered, (b) => ({ ...b, total: b.total * omega }));
  mul(x.signals, (list) => list.map((e) => ({ ...e, n: e.n * omega })));
  mul(x.thresholds, (t) => ({ low: t.low * omega, high: t.high * omega }));
  return x;
}
// 결정론 극한: Ω 마다 확률 앙상블과 결정론 실행 → 사법부 limitTrend
function ensembleLimit(db, state, sc, omegas, n, bundles, opt) {
  const rows = omegas.map((omega) => {
    const s = scaleScenario(sc, omega), { stochastic, ...det } = s;
    return { omega, raws: runEnsemble(db, state, s, n, Object.assign({ commitment: false }, opt)), det: F.simulateFate(db, state, Object.assign({ engine: 'rust', commitment: false }, opt, { scenario: det })) };
  });
  return SA.limitTrend(rows, bundles);
}

// ----- 관찰 판정 (4단계 ②): 행정부 실행 → 관찰 연산자(컴파일러)로 측정량 → 사법부 판정. 엔진은 관찰을 보지 않는다 -----
// 시나리오 A (필수)·B (선택 — 경쟁 가설). 시나리오에 stochastic 이 있으면 앙상블(opt.n 궤적, 기본 50) — 생물 변이(퍼짐)까지 판정
function observeFate(db, o, state, scA, scB, opt) {
  opt = opt || {};
  const runs = (sc) => {
    if (sc.stochastic) { const rs = runEnsemble(db, state, sc, opt.n || 50, { commitment: false }); if (rs.error) throw new Error(rs.error); return rs; }
    const r = F.simulateFate(db, state, Object.assign({ engine: 'rust', commitment: false }, opt, { scenario: sc })); if (r.error) throw new Error(r.error); return [r];
  };
  // 허용 차이 δ 는 시나리오 A 가 실행 전에 선언한 것만 쓴다 (equivalence: [{ observable: { kind, target }, delta, scale, evidence }])
  const eq = (scA.equivalence || []).find((e) => e.observable && o.observable && e.observable.kind === o.observable.kind && e.observable.target === o.observable.target);
  try { return OC.verdict(o, OBSOP.predict(o, runs(scA)), scB ? OBSOP.predict(o, runs(scB)) : null, Object.assign({}, opt, { equivalence: eq })); }
  catch (e) { return { error: e.message }; }
}

// ----- 자동 보강: 사법부 신원 판결 → 도장 발급 → 입법부 패치 초안 -----
function augmentBuild(db, opt) {
  opt = Object.assign({ date: new Date().toISOString().slice(0, 10) }, opt || {});
  const verdict = ID.verifyIdentity(db, opt), draft = DRAFT.draftPatch(db, verdict, opt);
  return Object.assign(draft, { stamps: ATT.issue(verdict.rows, opt.date), verdict });
}

// ----- 전체 검사 (증명 등록부 포함) -----
function validateWithRegistry(db, root, opt) {
  const reg = ATT.readRegistry(root), v = ATT.validStamps(C.normalize(db), reg, Object.assign({ root }, opt || {}));
  return Object.assign(J.validate(C.normalize(db), { attestations: v.keys }), { attestations: v });
}

// ----- 델타 기록 재생 (S1): 기원 스냅숏에서 사건의 패치를 입법부 순수 병합으로 차례로 적용 → 사건마다 sha256 → 사법부 판정 -----
// log = clerk.readLog(데이터 폴더) · currentText = 지금 db.json 텍스트. 쓰기 없음.
function replayLog(log, currentText) {
  const sha = (x) => require('crypto').createHash('sha256').update(x).digest('hex'), ser = (db) => JSON.stringify(db, null, 2) + '\n';
  const replay = { snapshot_sha256: sha(log.snapshotText), shas: [] };
  try {
    let db = C.normalize(JSON.parse(log.snapshotText));
    for (const ev of log.events) { for (const p of ev.patches) db = L.ingest(db, p).db; replay.shas.push(sha(ser(db))); }
  } catch (e) { replay.error = e.message; }
  return LOGA.replayVerdict(log.genesis, log.events, replay, sha(currentText));
}

module.exports = { replayLog, observeFate, runEnsemble, scaleScenario, ensembleLimit, runRate, simulateText, simulateRateText, resolutionPlan, resolutionText, auditRun, runFate, fateBrief, runVariant, refScenario, compare, augmentBuild, validateWithRegistry, pools };
