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
const PROTO = require('./judicial/protocol.js');
const V = require('./vocab.js');
const OBSOP = require('./compiler/obs_operator.js');
const STF = require('./judicial/stiffness.js');
const OC = require('./judicial/obs_compare.js');
const SA = require('./judicial/stoch_audit.js');
const M = require('./model.js');
const COUPLING = require('./engine/coupling.js');

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
// 수렴 기준 (수치 L2 의 기준): 같은 결합 적분기를 그 시나리오의 허용 오차 × ref_tol_factor(등록부, 기본 1/1000)로 좁혀 — 시나리오의 다른 값은 그대로
//   (1.5단계, 예전 '명시 1%' 기준은 자기 오차 ~1e-3). 배율은 곱으로: 1e-6 × 1e-3 = 1e-9 가 비트까지 같다 (나눗셈은 한 ulp 어긋남)
const refScenario = (sc) => { const cp = COUPLING.resolve(sc); return { ...sc, integrator: { ...(sc.integrator || {}), rtol: cp.rtol * cp.ref_tol_factor, atol: cp.atol * cp.ref_tol_factor } }; };
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

// 수렴 스윕 (build-plan 45): 허용 오차 tols(내림차순)마다 결정론 실행 + 더 조인 기준해 → 사법부가 수렴 판정(비수렴은 NUMERICAL).
//   단일 refScenario 비교를 여러 단계로 넓힌다. 기준해는 가장 조인 tol 의 1/100.
function convergenceSweep(db, state, sc, tols, bundles, opt) {
  opt = opt || {};
  const { stochastic, ...det } = sc;
  const run = (rtol, atol) => F.simulateFate(db, state, { engine: 'js', commitment: false, scenario: { ...det, integrator: { ...(det.integrator || {}), rtol, atol } } });
  const ref = run(Math.min(...tols) / 100, 1e-6);
  const runs = tols.map((tol) => ({ tol, det: run(tol, 1e-2) }));
  return SA.convergenceTrend(runs, ref, bundles, opt.bound || 1e-6);
}

// 모델 축약 (build-plan 47): 관찰 해상도 아래로 무관한 규칙 drop 을 제거(exclude_rules)하고 전체 대 축약을 TOST(상대 L2 ≤ delta)로 검증.
//   선언 밖 변화 거부: 축약 실행의 활성 규칙 = 전체 − drop, 그 밖 동일. 전후 강성 프로파일(46)로 축약이 조건을 낫게 하는지 본다.
//   진짜 QSSA(대수 제약으로 ODE 를 접어 강성 제거)는 DAE 엔진이 필요 — 적분장 작업. 여기서는 엔진이 표현 가능한 '관찰 무관 규칙 제거' 만.
function reductionCheck(db, state, sc, drop, bundles, opt) {
  opt = opt || {};
  const { stochastic, ...det } = sc;
  const reducedSc = { ...det, exclude_rules: [...(det.exclude_rules || []), ...drop] };
  const full = F.simulateFate(db, state, { engine: 'js', commitment: false, scenario: det });
  const reduced = F.simulateFate(db, state, { engine: 'js', commitment: false, scenario: reducedSc });
  if (full.error || reduced.error) return { error: full.error || reduced.error };
  const bund = bundles && bundles.length ? bundles : full.keys;
  const fa = new Set(full.rules.filter((x) => x.active).map((x) => x.ref)), ra = new Set(reduced.rules.filter((x) => x.active).map((x) => x.ref));
  const removed = [...fa].filter((r) => !ra.has(r)).sort(), added = [...ra].filter((r) => !fa.has(r));
  const declaredOnly = !added.length && removed.every((r) => drop.includes(r)) && drop.every((r) => !ra.has(r));
  const v = SA.reductionVerdict(full, reduced, bund, opt.delta != null ? opt.delta : 1e-2);
  return Object.assign(v, { drop, declaredOnly, removed, added, full: STF.stiffnessProfile(full), reduced: STF.stiffnessProfile(reduced) });
}

// ----- 관찰 판정 (4단계 ②): 행정부 실행 → 관찰 연산자(컴파일러)로 측정량 → 사법부 판정. 엔진은 관찰을 보지 않는다 -----
// 시나리오 A (필수)·B (선택 — 경쟁 가설). 시나리오에 stochastic 이 있으면 앙상블(opt.n 궤적, 기본 50) — 생물 변이(퍼짐)까지 판정
// V8 맥락 이전 — 정량 판정 (build-plan 59): 측정 맥락 = 관찰 자신의 조건(condition, 없으면 규약 matched_experiment.system),
//   판정 맥락 = 시나리오(species·cell) → 없으면 판정 세포 상태의 세포 · 기준 종. 판정을 막지 않는 공개 전제(정성 경로와 같은 급).
//   비교는 종·세포 두 열쇠만 — 시뮬레이션이 위치·온도·pH 를 하나로 선언하지 않아 나머지는 늘 '비교 못 함' 이 된다.
function quantContext(db, o, state, sc) {
  const sense = db.senses[state] || {}, cond = o.condition || {}, sys = ((sc.protocol || {}).matched_experiment || {}).system || {};
  const stateCell = (sense.desc || []).map((d) => d.context && d.context.cell).find(Boolean);
  const measured = { species: cond.species || sys.species || null, cell: cond.cell || sys.cell || null };
  const judged = { species: sc.species || sense.reference_species || V.defaultReferenceSpecies, cell: sc.cell || stateCell || null };
  return PROTO.contextTransfer(measured, judged);
}

function observeFate(db, o, state, scA, scB, opt) {
  const out = observeFateRaw(db, o, state, scA, scB, opt);
  return out && !out.error ? Object.assign(out, { context_transfer: quantContext(db, o, state, scA) }) : out;
}
function observeFateRaw(db, o, state, scA, scB, opt) {
  opt = opt || {};
  if (o.kind === 'qualitative') return { error: '정성 관찰은 observeQualitative 로 (build-plan 8)' };
  const runs = (sc) => {
    if (sc.stochastic) { const rs = runEnsemble(db, state, sc, opt.n || 50, { commitment: false }); if (rs.error) throw new Error(rs.error); return rs; }
    const r = F.simulateFate(db, state, Object.assign({ engine: 'rust', commitment: false }, opt, { scenario: sc })); if (r.error) throw new Error(r.error); return [r];
  };
  // 허용 차이 δ 는 사전 등록된 규약이 선언한 것만 쓴다 (protocol.equivalence: [{ observable: { kind, target }, delta, scale, evidence }])
  // 규약 판정(사법부)은 실행 전에 — 등록 시각이 지금보다 앞서야 한다. 확률 실행의 앙상블 크기는 규약의 n 그대로(중단 규칙)
  const pv = PROTO.protocolVerdict(db, scA, { prereg: opt.prereg || [], runAt: new Date().toISOString() });
  const p = scA.protocol || {}, eq = (p.equivalence || []).find((e) => e.observable && o.observable && e.observable.kind === o.observable.kind && e.observable.target === o.observable.target);
  if (pv.declared && scA.stochastic && p.replicates && p.replicates.n) opt = Object.assign({}, opt, { n: p.replicates.n });
  if (o.observable.kind === 'dose_slope') { // 용량 반응 기울기: 시작량 계열(컴파일러 set_amount) → 교란 차이 검사(사법부) → 실행(행정부) → 기울기(관찰 연산자) → 판정
    if (scB) return { error: 'dose_slope 는 가설 하나(scA)로만 — 가설 비교는 시나리오마다 따로' };
    const PT = require('./compiler/perturb.js'), PA = require('./judicial/perturb_audit.js'), d = o.observable.dose;
    const v = PT.perturbedIR(db, state, scA, { type: 'dose_series', of: { type: 'set_amount', target: d.target }, doses: d.values });
    if (v.error) return { error: v.error };
    const series = [];
    for (const x of v.variants) {
      if (!x.ir) return { error: x.error };
      const a = PA.verifyPerturbation({ baseScenario: scA, baseIR: v.base, scenario: x.scenario, ir: x.ir, record: x.record });
      if (!a.ok) return { error: `용량 ${x.record.perturbation.n}: 교란 차이 검사 실패 — ${(a.problems || []).join('; ')}` };
      try { for (const raw of runs(x.scenario)) series.push({ dose: x.record.perturbation.n, raw }); } catch (e) { return { error: e.message }; }
    }
    const slope = OBSOP.doseSlope(o, series);
    const out = OC.verdict(o, [slope], null, Object.assign({}, opt, { equivalence: eq, protocol: pv, observationId: opt.observationId }));
    out.dose_series = series.map((s) => ({ dose: s.dose, progress: OBSOP.progress(s.raw, o.observable.target) }));
    return out;
  }
  try { return OC.verdict(o, OBSOP.predict(o, runs(scA)), scB ? OBSOP.predict(o, runs(scB)) : null, Object.assign({}, opt, { equivalence: eq, protocol: pv, observationId: opt.observationId })); }
  catch (e) { return { error: e.message }; }
}

// ----- 정성 모의 판정 (build-plan 8): 교란 시나리오(컴파일러) + 교란 차이 검사(사법부) → 대조군·교란군 실행(행정부) → 측정량(관찰 연산자) → 사법부 판정 -----
// 결정론이면 같은 시나리오를 허용 오차 1/1000(refScenario)로 한 번 더 돌려 그 차를 수치 오차로 — 분해능 = 수치 오차 + 측정량의 양자(분자 1 개)
function observeQualitative(db, o, state, sc, opt) {
  opt = opt || {};
  const PT = require('./compiler/perturb.js'), PA = require('./judicial/perturb_audit.js'), QC = require('./judicial/qual_compare.js');
  const rd = o.readout, ex = o.expect, isOrder = ex && typeof ex === 'object';
  let psc = null, audit = null;
  if (o.perturbation) {
    const v = PT.perturbedIR(db, state, sc, o.perturbation);
    if (v.error) return { error: v.error };
    const { scenario, record, ir } = v.variants[0];
    if (!ir) return { error: v.variants[0].error };
    audit = PA.verifyPerturbation({ baseScenario: sc, baseIR: v.base, scenario, ir, record });
    psc = scenario;
  }
  const pv = PROTO.protocolVerdict(db, sc, { prereg: opt.prereg || [], runAt: new Date().toISOString() }), p = sc.protocol || {};
  const n = pv.declared && sc.stochastic && p.replicates && p.replicates.n ? p.replicates.n : opt.n || 50;
  const run = (x) => {
    if (x.stochastic) { const rs = runEnsemble(db, state, x, n, { commitment: false }); if (rs.error) throw new Error(rs.error); return rs; }
    const r = F.simulateFate(db, state, { engine: 'rust', commitment: false, scenario: x }); if (r.error) throw new Error(r.error); return [r];
  };
  const quantumOf = (raw, t) => (rd.kind === 'amount' ? 1 : rd.kind === 'concentration' ? 1 / (M.NA * raw.volumes[String(t).split('|').pop()]) : 0);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const mono = ex === 'monotone_increase' || ex === 'monotone_decrease', stateKind = rd.kind === 'fraction' || rd.kind === 'event_time';
  // 대상 하나의 측정량: 값(실행마다) · 단조 기대면 시계열(실행 평균) — 경험적 우연 확률의 후보에도 같은 함수를 쓴다
  const measure = (raws, t) => {
    const also = t === rd.target && Array.isArray(rd.also) ? rd.also : []; // 못 가르는 형태 합산은 주장 대상에만 (후보 풀은 각각 하나)
    const ob = { kind: rd.kind, target: t, also };
    const out = { values: OBSOP.predict({ observable: ob, condition: o.condition }, raws) };
    if (mono) { const tEnd = o.condition.time_s, T = [0, ...raws[0].process.times.filter((x) => tEnd == null || x <= tEnd)]; out.series = { t: T, v: T.map((x) => mean(raws.map((raw) => OBSOP.predict({ observable: ob, condition: { time_s: x } }, [raw])[0]))) }; }
    return out;
  };
  // 대상 하나의 첫 도달 시각(실행마다): 세포 상태는 도달, 묶음은 양자(분자 1 개) 이상이 된 첫 기록점
  const eventsOf = (raws, t) => raws.map((raw) => {
    if (stateKind) return raw.firstReach[t] != null ? raw.firstReach[t] : Infinity;
    const q = quantumOf(raw, t), T = [0, ...raw.process.times];
    const hit = T.find((x) => OBSOP.predict({ observable: { kind: rd.kind, target: t }, condition: { time_s: x } }, [raw])[0] >= q);
    return hit != null ? hit : Infinity;
  });
  const gap = (a, b) => (a && b ? Math.max(0, ...a.map((x, i) => (Number.isFinite(x) && Number.isFinite(b[i]) ? Math.abs(x - b[i]) : 0))) : 0);
  try {
    const cRaws = run(sc), pRaws = psc ? run(psc) : null, det = !sc.stochastic;
    const cRef = det ? run(refScenario(sc)) : null, pRef = det && psc ? run(refScenario(psc)) : null;
    // 대상 하나의 판정 입력 — 결정론이면 분해능 = 양자 + 수치 오차(기준 허용 오차 실행과의 차)
    const inputFor = (t) => {
      const quantum = quantumOf(cRaws[0], t), control = measure(cRaws, t), perturbed = pRaws ? measure(pRaws, t) : null;
      let numerical = null;
      if (det) {
        const c0 = measure(cRef, t), p0 = pRef ? measure(pRef, t) : null;
        numerical = gap(control.values, c0.values) + gap(perturbed && perturbed.values, p0 && p0.values) + gap(control.series && control.series.v, c0.series && c0.series.v) + gap(perturbed && perturbed.series && perturbed.series.v, p0 && p0.series && p0.series.v);
      }
      return { target: t, control, perturbed, quantum, numerical, resolution: Math.max(quantum + (numerical || 0), rd.instrument_resolution || 0) };
    };
    // 후보: 같은 종류의 읽을 거리 전부(주장의 대상 제외) — 묶음 또는 세포 상태
    const claimTargets = new Set(isOrder ? ex.order : [rd.target]);
    const cands = (stateKind ? IRB.buildFateIR(db, state, sc).states : cRaws[0].keys).filter((t) => !claimTargets.has(t) && Number.isFinite(quantumOf(cRaws[0], t)));
    let r, pool, main;
    if (isOrder) {
      const evs = (raws) => raws.map((_, k) => ex.order.map((t) => eventsOf([raws[k]], t)[0]));
      let numerical = null;
      if (det) numerical = gap(evs(cRaws)[0], evs(cRef)[0]) + (pRaws ? gap(evs(pRaws)[0], evs(pRef)[0]) : 0);
      const quantum = 0, resolution = Math.max(numerical || 0, rd.instrument_resolution || 0); // 순서의 분해능은 시각의 수치 오차 — 분자 양자는 시각에 쓰지 않는다 (장치 해상도가 선언되면 그 바닥)
      main = { quantum, numerical, resolution };
      r = QC.judgeQualitative({ o, control: { events: evs(cRaws) }, perturbed: pRaws ? { events: evs(pRaws) } : null, resolution, quantum, perturbationAudit: audit, protocol: pv, observationId: opt.observationId, acceptance: opt.acceptance });
      const arm = pRaws || cRaws;
      pool = cands.map((t) => ({ target: t, events: eventsOf(arm, t), resolution }));
    } else {
      main = inputFor(rd.target);
      const eq = (p.equivalence || []).find((e) => e.observable && e.observable.kind === rd.kind && e.observable.target === rd.target);
      r = QC.judgeQualitative({ o, control: main.control, perturbed: main.perturbed, resolution: main.resolution, quantum: main.quantum, perturbationAudit: audit, protocol: pv, observationId: opt.observationId, equivalence: eq, acceptance: opt.acceptance });
      pool = cands.map(inputFor);
    }
    const emp = QC.empiricalChance(o, pool), uniform = r.chance;
    if (emp.chance != null) Object.assign(r, { chance: emp.chance, chance_source: 'empirical', chance_pool: emp.n, chance_uniform: uniform });
    else Object.assign(r, { chance_source: 'uniform', chance_pool: 0 });
    // V8 맥락 이전 (build-plan 25): 추정 맥락(규약 matched_experiment.system) 대 판정 맥락(시나리오 cell·판정 세포 상태)
    const sys = (p.matched_experiment || {}).system;
    let contextTransfer = null;
    if (sys) {
      const stateCell = ((db.senses[state] || {}).desc || []).map((d) => d.context && d.context.cell).find(Boolean);
      contextTransfer = PROTO.contextTransfer({ species: sys.species, cell: sys.cell }, { species: sc.species || null, cell: sc.cell || stateCell || null });
    }
    return Object.assign(r, { id: opt.observationId || null, experiment: o.experiment || null, source: (o.provenance || {}).source || null, numerical_error: main.numerical, quantum: main.quantum, runs: cRaws.length, perturbation_audit: audit, protocol: pv, context_transfer: contextTransfer });
  } catch (e) { return { error: e.message }; }
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
    let db = JSON.parse(log.snapshotText); // 원문 그대로 — 첫 사건이 형식 변환이면 그 스크립트가 옛 판을 받는다 (병합은 ingest 가 정규화)
    replay.scriptShas = {};
    log.events.forEach((ev, i) => {
      if (ev.kind === 'migration') { // 형식 변환: 기록된 스크립트의 순수 transform 을 같은 recorded_at 으로 다시 돌린다
        const file = require('path').join(__dirname, ev.script);
        replay.scriptShas[i] = sha(require('fs').readFileSync(file, 'utf8'));
        db = require(file).transform(JSON.parse(ser(db)), { recorded_at: ev.recorded_at });
      } else for (const p of ev.patches) db = L.ingest(db, p).db;
      replay.shas.push(sha(ser(db)));
    });
  } catch (e) { replay.error = e.message; }
  return LOGA.replayVerdict(log.genesis, log.events, replay, sha(currentText));
}

module.exports = { replayLog, observeFate, observeQualitative, runEnsemble, scaleScenario, ensembleLimit, convergenceSweep, reductionCheck, runRate, simulateText, simulateRateText, resolutionPlan, resolutionText, auditRun, runFate, fateBrief, runVariant, refScenario, compare, augmentBuild, validateWithRegistry, pools };
