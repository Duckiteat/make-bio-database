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

module.exports = { runRate, simulateText, simulateRateText, resolutionPlan, resolutionText, auditRun, runFate, fateBrief, runVariant, refScenario, compare, augmentBuild, validateWithRegistry, pools };
