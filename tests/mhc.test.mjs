// MHC I·II 기전 시험 — 기전 단계가 결합 적분 IR 로 낮춰지고, 사법부가 독립적으로 같은 법칙을 다시 세우는지.
//   ① 조립: 상태의 기전 프로그램(mechanisms)에 속한 단계가 모두 반응 규칙이 되고, 가역 결합은 정·역 두 채널
//   ② 법칙 충실도·기호 도함수: 사법부 verifyIR (속도·도함수 ≤ 1e-14, 유한차분 ≤ 1e-6)
//   ③ 무결성: 부분 구조 원장·저장소 재생 상대 ≤ 1e-14, 독립 질량 검증기가 단계 화학량을 db.steps 에서 다시 셈
//   ④ 맥락 선언: 원인·필수성·일반 상황이 실행과 맞는지 (틀린 선언은 FAIL)
//   ⑤ 사건 시각: 관찰 격자 Δ 를 30–300 s 로 바꿔도 도달·결정 시각이 0.01 s 안에서 같음
//   ⑥ JS = Rust: 궤적 상대 ≤ rtol, 끝 상태·도달 시각 같음
//   ⑦ 확률 실행: 같은 (seed, 궤적) 재현, 발화 수는 음이 아닌 정수
//   ⑧ 경계: 모든 저장소 0 에서 시작해도 음수가 생기지 않음
//   ⑨ 상수 등급 관문: 가상 상수는 hypothetical 선언 아래에서만 — 선언을 빼면 판정이 거부(궤적은 그대로)
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const C = require('../core.js');
const F = require('../engine/fate_engine.js');
const IRB = require('../compiler/ir_builder.js');
const DER = require('../judicial/derivative.js');
const FA = require('../judicial/fate_audit.js');
const SA = require('../judicial/stoch_audit.js');
const PR = require('../judicial/process_report.js');

const DB = JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url)));
const SRC = 'D000202', TARGET = 'D000203';
const PT = require('../compiler/perturb.js'), PA = require('../judicial/perturb_audit.js');
const raw = (file) => JSON.parse(fs.readFileSync(new URL(`../examples/scenarios/${file}`, import.meta.url)));
// 파생 시나리오(기준 + 교란 한 줄, build-plan 9)는 기준을 읽어 교란을 건 실제 입력으로
const scen = (name) => { const sc = raw(`${name}.json`); if (!PT.isDerived(sc)) return sc; const v = PT.derive(C.normalize(DB), SRC, sc, raw(sc.base)); assert.ok(!v.error, v.error); return v.scenario; };
const MAT = 'mhc-dc-maturation-lps-hypothetical';
const run = (sc, opt) => { const r = F.simulateFate(DB, SRC, Object.assign({ engine: 'rust', scenario: sc }, opt || {})); assert.ok(!r.error, r.error); return r; };
const judge = (r, sc, ir) => FA.judgeFate(DB, r, { scenario: sc, ir });

test('MHC ①: 기전 프로그램의 단계가 모두 반응 규칙이 되고 가역 결합은 정·역 두 채널', () => {
  const db = C.normalize(DB), A = IRB.assemble(db, SRC, {});
  const mechs = new Set(db.senses[SRC].mechanisms.map((m) => m.ref));
  const want = Object.keys(db.steps).filter((sid) => (db.steps[sid].part_of || []).some((p) => mechs.has(p)));
  assert.ok(want.length >= 18, `기전 단계 ${want.length}`);
  const got = new Set(A.rules.filter((R) => R.kind === 'step').map((R) => R.step));
  for (const sid of want) assert.ok(got.has(sid), `단계 ${sid} 가 계에 없음`);
  const ir = IRB.buildFateIR(db, SRC, scen(MAT));
  const bind = ir.rules.filter((R) => R.kind === 'step' && R.k && R.k.law === 'binding');
  assert.ok(bind.length >= 6, `가역 결합 채널 ${bind.length}`);
  for (const sid of new Set(bind.map((R) => R.step))) {
    const pair = bind.filter((R) => R.step === sid);
    assert.deepStrictEqual(pair.map((R) => R.dir).sort(), ['f', 'r']);
    assert.deepStrictEqual(pair[0].cons.map((q) => q.b).sort(), pair[1].prods.map((q) => q.b).sort());
  }
  // 속도 상수가 없으면 꺼지고 (법칙 0) 그 사실이 원자료의 공백으로 남는다
  const ir0 = IRB.buildFateIR(db, SRC, { ...scen(MAT), kinetics: {} });
  assert.ok(ir0.gaps.length >= 20, `상수 없는 규칙 ${ir0.gaps.length}`);
});

test('MHC ②: 사법부가 단계 법칙을 독립으로 다시 세움 — 속도·도함수 ≤ 1e-14, 유한차분 ≤ 1e-6', () => {
  const db = C.normalize(DB), sc = scen(MAT), ir = IRB.buildFateIR(db, SRC, sc);
  const v = DER.verifyIR(db, ir, sc);
  assert.deepStrictEqual(v.problems, []);
  assert.deepStrictEqual(v.missingDeps, []);
  assert.ok(v.rateWorst <= DER.TOL, `속도 ${v.rateWorst}`);
  assert.ok(v.derivWorst <= DER.TOL, `도함수 ${v.derivWorst}`);
  assert.ok(v.factorWorst <= DER.TOL, `배율 ${v.factorWorst}`);
  assert.ok(v.fdWorst <= DER.FD_TOL, `유한차분 ${v.fdWorst}`);
  assert.ok(v.ok);
});

test('MHC ③: 무결성 — 원장·재생 1e-14, 단계 화학량을 db.steps 에서 다시 셈, LPS 가 성숙의 원인', () => {
  const sc = scen(MAT), ir = IRB.buildFateIR(C.normalize(DB), SRC, sc), r = run(sc, { ir });
  const v = judge(r, sc, ir);
  assert.ok(!v.error, v.error);
  assert.deepStrictEqual(v.audit.filter((a) => a.code === 'AUDIT_MASS'), []);
  assert.ok(v.mass.worst <= v.mass.tolerance, `원장 ${v.mass.worst}`);
  assert.ok(v.mass.replayWorst <= v.mass.tolerance, `재생 ${v.mass.replayWorst}`);
  assert.strictEqual(v.final.state, TARGET);
  assert.ok(v.firstReach[TARGET] > 0);
  const rep = PR.processReport(v, { scenario: sc, ir, rerunHash: FA.trajectoryHash(run(sc, { ir })) });
  assert.ok(rep.pass, rep.checks.filter((c) => c.ok === false).map((c) => c.name).join(' / '));
  assert.deepStrictEqual(rep.disc, []);
});

test('MHC ⑨: 상수 등급 관문 — 가상 상수는 hypothetical 선언 아래에서만, 선언을 빼면 운명 판정이 거부한다', () => {
  const sc = scen(MAT), ir = IRB.buildFateIR(C.normalize(DB), SRC, sc), r = run(sc, { ir });
  const v = judge(r, sc, ir);
  assert.ok(v.grades && v.grades.n > 0, '쓰인 상수가 판정에 실려야 한다');
  assert.strictEqual(v.grades.min, 'parameter');
  assert.strictEqual(v.grades.byGrade.hypothetical, v.grades.n, '이 저장소의 속도 상수는 모두 가상 시나리오에서 온다');
  assert.ok(v.grades.ok && !v.audit.some((a) => /상수 등급/.test(a.msg)));
  // 선언을 빼면 같은 실행이 상수마다 Audit Error 를 받는다 (궤적은 그대로 — 판정만 달라진다)
  const bare = { ...sc, hypothetical: false };
  const vb = judge(r, bare, ir);
  assert.strictEqual(vb.grades.ok, false);
  assert.strictEqual(vb.grades.violations.length, v.grades.n);
  assert.ok(vb.audit.filter((a) => /상수 등급/.test(a.msg)).length > 0);
  assert.strictEqual(PR.processReport(vb, { scenario: bare, ir, rerunHash: FA.trajectoryHash(run(sc, { ir })) }).pass, false, '무결성 증명서가 FAIL 이어야 한다');
  // 문턱은 시나리오가 올릴 수 있다 (등급 이름 하나 — 모르는 이름이면 판정하지 않고 그 사실을 낸다)
  assert.match(judge(r, { ...sc, min_grade: '최고' }, ir).grades.error, /등급 문턱/);
});

test('MHC ④: 맥락 선언(원인·필수성·일반 상황)이 실행과 맞아야 한다 — 틀린 선언은 판정 실패', () => {
  const sc = scen(MAT), r = run(sc);
  assert.strictEqual(FA.contextVerdict(r, sc).role, 'cause');
  assert.ok(FA.contextVerdict(r, sc).consistent);
  assert.ok(FA.contextVerdict(r, sc).outcome);
  // 원인이라 했는데 시작 상태를 가리킴 / 일반 상황이라 했는데 신호가 켜짐 / 없는 상태
  for (const [cx, re] of [[{ role: 'cause', state: SRC }, /시작 상태가 아니라/], [{ role: 'baseline', state: SRC }, /신호가 켜짐|일반 상황이 아님/], [{ role: 'cause', state: 'D000165' }, /상태 집합에 없음/], [{ role: 'vibes', state: TARGET }, /cause \| requirement \| baseline/]]) {
    const v = FA.contextVerdict(r, { ...sc, context: cx });
    assert.ok(!v.consistent && re.test(v.problems.join(' ')), `${JSON.stringify(cx)} → ${v.problems.join(' ')}`);
  }
  // 필수성: 같은 신호에서 카텝신 S 를 끊으면 성숙에 이르지 못한다
  const req = scen('mhc-dc-cathepsin-null-hypothetical'), rr = run(req);
  const vr = FA.contextVerdict(rr, req);
  assert.strictEqual(vr.role, 'requirement');
  assert.ok(vr.consistent && vr.outcome, `필수성 선언 ${vr.problems.join(' ')}`);
  assert.strictEqual(rr.firstReach[TARGET], undefined);
  // 일반 상황: 신호 없이 표면 제시가 낮게 유지된다
  const bl = scen('mhc-dc-immature-baseline-hypothetical'), rb = run(bl), vb = FA.contextVerdict(rb, bl);
  assert.ok(vb.consistent && vb.outcome);
  assert.strictEqual(rb.final.state, SRC);
});

test('MHC ⑤: 사건 시각이 관찰 격자 Δ 에 묶이지 않음 (30–300 s 에서 0.01 s 안)', () => {
  const base = scen(MAT), ts = [];
  for (const dt of [300, 120, 60, 30]) { const r = run({ ...base, dt_slow: dt }); ts.push([r.firstReach[TARGET], (r.commitment.find((c) => c.driven) || {}).t]); }
  for (const q of [0, 1]) { const xs = ts.map((x) => x[q]); assert.ok(Math.max(...xs) - Math.min(...xs) < 0.01, `${q === 0 ? '도달' : '결정'} 시각 퍼짐 ${Math.max(...xs) - Math.min(...xs)}`); }
});

test('MHC ⑥: JS 기준 구현 = Rust 백엔드 (궤적 ≤ rtol, 끝 상태·도달 시각 같음)', () => {
  const sc = scen(MAT), a = F.simulateFate(DB, SRC, { scenario: sc, engine: 'js', commitment: false }), b = run(sc, { commitment: false });
  assert.ok(!a.error, a.error);
  let worst = 0;
  for (let j = 0; j < a.series.length; j++) for (let i = 0; i < a.keys.length; i++) worst = Math.max(worst, Math.abs(a.series[j][i] - b.series[j][i]) / Math.max(1, Math.abs(a.series[j][i])));
  assert.ok(worst <= a.coupling.rtol, `상대 최대차 ${worst}`);
  assert.strictEqual(a.final.state, b.final.state);
  assert.ok(Math.abs(a.firstReach[TARGET] - b.firstReach[TARGET]) < 0.01);
});

test('MHC ⑦: 확률 실행 — 같은 (seed, 궤적) 재현, 발화 수는 음이 아닌 정수', () => {
  const sc = scen('mhc-dc-maturation-stochastic-hypothetical'), ir = IRB.buildFateIR(C.normalize(DB), SRC, sc);
  const a = run(sc, { ir, trajectory: 3 }), b = run(sc, { ir, trajectory: 3 }), c = run(sc, { ir, trajectory: 4 });
  const rep = SA.reproducible(a, b);
  assert.ok(rep.ok, `재현 ${rep.a} ≠ ${rep.b}`);
  assert.notStrictEqual(FA.trajectoryHash(a), FA.trajectoryHash(c));
  const au = SA.auditTrajectory(DB, a, { scenario: sc, ir });
  assert.ok(!au.error, au.error);
  assert.deepStrictEqual(au.audit.filter((x) => x.code === 'AUDIT_STOCH'), []);
  assert.ok(a.stochastic.rules.some((x) => x.mode !== 'ode'), '확률로 다룬 규칙이 없음');
  const sum = SA.ensembleSummary([a, b, c]);
  assert.strictEqual(sum.n, 3);
});

test('MHC ⑧: 경계 — 모든 저장소가 0 에서 시작해도 음수가 생기지 않고 합성으로 채워진다', () => {
  const sc = scen('mhc-dc-empty-start-hypothetical'), ir = IRB.buildFateIR(C.normalize(DB), SRC, sc), r = run(sc, { ir });
  const v = judge(r, sc, ir);
  assert.deepStrictEqual(v.audit.filter((a) => a.code === 'AUDIT_MASS'), []);
  assert.ok(v.mass.replayWorst <= v.mass.tolerance);
  for (const [b, n] of Object.entries(r.final.N)) assert.ok(n > -1e-9, `${b} = ${n}`);
  // 펩타이드 원천이 없으니 표면 펩타이드–MHC II 는 만들어지지 않는다 (결과) — 합성·조립·수송까지는 0 에서 켜진다
  assert.strictEqual(r.final.N['D000201|plasma_membrane'], 0);
  assert.ok(r.final.N['D000200|endosome_membrane'] > 0, 'MHC II–불변 사슬 복합체가 엔도솜에 도달하지 못함');
});

test('MHC ⑩: null 시나리오 = 기준 + 교란 한 줄 (build-plan 9) — 교란 차이 검사 통과 · 필수성은 같은 대조군과 비교', () => {
  const D = C.normalize(DB), nulls = fs.readdirSync(new URL('../examples/scenarios/', import.meta.url)).filter((f) => /^mhc-.*-null-hypothetical\.json$/.test(f));
  assert.equal(nulls.length, 4);
  for (const f of nulls) {
    const sc = raw(f);
    assert.ok(PT.isDerived(sc), `${f} 가 복사본 시나리오 — 기준 + 교란 한 줄이어야 함`);
    assert.deepEqual(Object.keys(sc).filter((k) => !PT.DERIVED_KEYS.includes(k)), []);
    const base = raw(sc.base), p = PT.perturbedIR(D, SRC, base, sc.perturbation), v = p.variants[0];
    const audit = PA.verifyPerturbation({ baseScenario: base, baseIR: p.base, scenario: v.scenario, ir: v.ir, record: v.record });
    assert.ok(audit.ok, `${f}: ${audit.problems.join(' · ')}`);
  }
  // 카텝신 S·HLA-DM 필수성: 같은 대조군(성숙 신호 + 항원)은 성숙에 이르고, 끊은 쪽은 이르지 못한다
  const ctl = scen('mhc-dc-mature-antigen-hypothetical'), rc = run(ctl);
  assert.ok(rc.firstReach[TARGET] > 0, '대조군이 성숙에 이르지 않음 — 필수성 비교가 성립하지 않음');
  assert.ok(FA.contextVerdict(rc, ctl).consistent);
  for (const n of ['mhc-dc-cathepsin-null-hypothetical', 'mhc-dc-hladm-null-hypothetical']) assert.strictEqual(run(scen(n)).firstReach[TARGET], undefined, n);
  // 파생 형식의 거부: 교란 밖 필드 · 이중 파생 · dose_series
  const d = raw('mhc-dc-hladm-null-hypothetical.json'), b = raw(d.base);
  assert.match(PT.derive(D, SRC, { ...d, t_end: 10 }, b).error, /받지 않는 필드: t_end/);
  assert.match(PT.derive(D, SRC, d, { ...b, base: 'x.json' }).error, /기준은 한 단계만/);
  assert.match(PT.derive(D, SRC, { ...d, perturbation: { type: 'dose_series', of: { type: 'clamp', target: 'D000198|endosome_membrane' }, doses: [0] } }, b).error, /교란 하나/);
});

test('MHC ⑪: 접은 상수 cinv = 1/(N_A·V) (엔진 단계 0) — 사법부가 부피에서 따로 계산해 비트까지 대조, 꾸민 값은 거부', () => {
  const sc = scen(MAT), ir = IRB.buildFateIR(DB, SRC, sc);
  for (const s of ir.species) assert.strictEqual(s.cinv, s.V > 0 ? 1 / (C.NA * s.V) : 0);
  assert.deepEqual(DER.verifyIR(DB, ir, sc).problems, []);
  const bad = JSON.parse(JSON.stringify(ir)), i = bad.species.findIndex((s) => s.V > 0);
  bad.species[i].cinv *= 1 + 2 ** -52;
  assert.ok(DER.verifyIR(DB, bad, sc).problems.some((p) => /접은 상수 cinv/.test(p)), '한 ulp 어긋난 접은 상수를 잡아야 함');
});
