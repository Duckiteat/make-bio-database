// 텔로미어 소모·복제 노화 시험 — "분열 한계(헤이플릭)" 가 기존 형식 위에서 계산되는지.
//   모형: 분열 = 0차 공급 규칙(진행량 1 = 분열 1 회, 반복 단위 ΔL 소모) · 임계 길이 아래에서 손상 반응 힐 → p53 → p21 → 분열 정지(배율 → 0).
//   ① 표현: 새 규칙 종류 없이 supply·degradation·modulation·cell_state 만으로 계가 조립되고, 진행량이 곧 분열 횟수
//   ② 분열 한계 정확도: 되먹임을 끈 소모 법칙만의 임계 통과 시각 = (L₀ − L_crit)/ΔL × T_div (상대 ≤ 1e-9)
//   ③ 문턱의 Δt 무관성: 관찰 격자 Δ 를 4 배 바꿔도 같은 시각 (근 찾기 — 격자에 묶이지 않는다)
//   ④ 궤적 선형성: 임계까지 L(t) = L₀ − (ΔL/T_div)·t (상대 ≤ 1e-12)
//   ⑤ 전체 모형: 되먹임을 켜도 임계 통과 시각이 산술값과 같고(≤ 1e-9), 그 뒤 분열이 멈추며(속도 ≤ 2 %) 비가역(신호 철회 시험)
//   ⑥ 급격한 문턱: 손상 반응 힐 n = 96 (거의 계단)에서도 결과가 같고 음수 거부가 없으며 사법부의 법칙 충실도가 통과한다 (L-안정 Rodas3)
//      (n ≳ 100 은 힐 도함수의 (1 + (s/K)^n)² 가 배정도에서 넘쳐 사법부 검증이 FAIL 한다 — 보고된 수치 결함, 이 시험은 그 아래에서만 돈다)
//   ⑦ JS = Rust: 궤적 상대 ≤ 1e-12, 끝 상태·도달 시각 같음
//   ⑧ 필수성: 성장 인자를 끊거나 텔로머레이스로 순 소모를 0 으로 만들면 노화에 이르지 못한다
//   ⑨ 상수 등급 관문: 이 실행의 상수는 모두 가상 — hypothetical 선언을 빼면 판정이 거부한다
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const C = require('../core.js');
const F = require('../engine/fate_engine.js');
const IRB = require('../compiler/ir_builder.js');
const FA = require('../judicial/fate_audit.js');
const DER = require('../judicial/derivative.js');
const PR = require('../judicial/process_report.js');

const DB = JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url)));
const SRC = 'D000210', SEN = 'D000211';
const TEL = 'D000204|nucleoplasm', ATTR = 'D000205/rule/division_attrition';
const L0 = 1800, LCRIT = 600, DL = 16, TDIV = 86400;      // 시나리오의 설계 수치 (가상)
const EXP_N = (L0 - LCRIT) / DL, EXP_T = EXP_N * TDIV;     // 산술 분열 한계 75 회 · 6 480 000 s
const scen = (n) => JSON.parse(fs.readFileSync(new URL(`../examples/scenarios/telomere-${n}-hypothetical.json`, import.meta.url)));
const run = (sc, opt) => { const r = F.simulateFate(DB, SRC, Object.assign({ engine: 'rust', scenario: sc }, opt || {})); assert.ok(!r.error, r.error); return r; };
const telOf = (r) => r.keys.indexOf(TEL);
const cumOf = (r) => { const j = r.process.ruleInfo.findIndex((x) => x.ref === ATTR); return r.process.cum.map((c) => c[j]); };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

test('텔로미어 ①: 새 규칙 종류 없이 계가 조립되고 공급 규칙의 진행량이 곧 분열 횟수', () => {
  const db = C.normalize(DB), sc = scen('hayflick'), A = IRB.assemble(db, SRC, sc);
  for (const R of A.rules) assert.ok(['supply', 'degradation', 'step'].includes(R.kind), `규칙 종류 ${R.kind}`);
  const attr = A.rules.find((R) => R.ref === ATTR);
  assert.ok(attr && attr.kind === 'supply', '분열은 공급 규칙 하나');
  assert.strictEqual(attr.k.law, 'zero_order', '0차 — 분열 간격의 역수');
  assert.deepStrictEqual(attr.cons.map((q) => [q.b, q.n]), [[TEL, DL]], '진행량 1 당 반복 단위 ΔL 소모');
  assert.strictEqual(attr.mods.length, 2, '성장 인자(활성)·p21(억제) 두 조절');
  // 반복 단위는 표지이기도 하다 (상태의 서명)
  assert.ok(A.markers.has(TEL) && A.markers.has('D000208|nucleoplasm'));
  // 소모된 단위의 뉴클레오타이드가 산물로 — 부분 구조 수지를 닫는다 (단위당 양쪽 가닥 12 개)
  assert.deepStrictEqual(attr.prods.map((q) => q.n), [DL * 12]);
  // 진행량 ↔ 길이: 분열 횟수 = (L₀ − L)/ΔL
  const r = run(sc), i = telOf(r), cum = cumOf(r);
  r.series.forEach((N, k) => assert.ok(rel(cum[k], (L0 - N[i]) / DL) < 1e-12 || cum[k] < 1e-9, `k=${k}`));
});

test('텔로미어 ②③④: 되먹임을 끈 소모 법칙 — 임계 통과 시각 = 산술 분열 한계, Δt 와 무관, 궤적은 선형', () => {
  const sc = scen('law-isolation');
  const times = [43200, 21600, 10800].map((dt) => run({ ...sc, dt_slow: dt }).firstReach[SEN]);
  for (const t of times) assert.ok(rel(t, EXP_T) < 1e-9, `임계 통과 ${t} ≠ ${EXP_T}`);
  for (const t of times) assert.ok(rel(t, times[0]) < 1e-9, `Δt 에 따라 달라짐 ${times}`);
  const r = run(sc), i = telOf(r), ts = r.process.times, cum = cumOf(r);
  let worst = 0;
  r.series.forEach((N, k) => { if (ts[k] > EXP_T) return; worst = Math.max(worst, Math.abs(N[i] - (L0 - (DL / TDIV) * ts[k])) / L0); });
  assert.ok(worst < 1e-12, `선형 감쇠에서 벗어남 ${worst}`);
  const kX = ts.findIndex((t) => t >= EXP_T);
  assert.ok(rel(cum[kX], EXP_N) < 1e-9, `임계 시각의 분열 횟수 ${cum[kX]} ≠ ${EXP_N}`);
});

test('텔로미어 ⑤: 전체 모형 — 임계 통과는 산술값 그대로, 그 뒤 분열이 멈추고 되돌아오지 않는다', () => {
  const sc = scen('hayflick'), r = run(sc);
  assert.strictEqual(r.final.state, SEN, '노화 상태로 끝나야 한다');
  // 임계 통과 시각만 떼어 보기: p21 표지 문턱을 치우면 도달 판정이 텔로미어 하나로 정해진다
  const only = { ...sc, thresholds: { ...sc.thresholds, 'D000208|nucleoplasm': { low: 1e-3, high: 1 } } };
  const tX = run(only).firstReach[SEN];
  assert.ok(rel(tX, EXP_T) < 1e-9, `되먹임이 통과 시각을 ${rel(tX, EXP_T)} 만큼 미뤘다`);
  assert.ok(tX >= EXP_T, '되먹임은 통과를 앞당길 수 없다');
  // 정지: 끝 구간의 분열 속도가 증식 구간의 2 % 아래
  const cum = cumOf(r), n = cum.length, d = (k) => cum[k] - cum[k - 1];
  assert.ok(d(n - 1) < 0.02 * d(10), `정지하지 않음 ${d(n - 1)} vs ${d(10)}`);
  // 노화 도달은 p21 이 쌓이는 지연만큼 늦고, 비가역이다 (신호 철회 시험을 통과한 시각이 있다)
  assert.ok(r.firstReach[SEN] > tX, '노화 도달은 임계 통과보다 늦다 (p53 → p21 지연)');
  assert.strictEqual(r.commitment[0].criterion, 'withdrawal');
  assert.ok(r.commitment[0].t > 0 && r.commitment[0].monotone, '철회 시험이 한 번 통과한 뒤로는 계속 통과해야 한다');
  // 사법부: 원장·맥락 선언·무결성
  const ir = IRB.buildFateIR(C.normalize(DB), SRC, sc), v = FA.judgeFate(DB, r, { scenario: sc, ir });
  assert.ok(!v.audit.some((a) => a.code === 'AUDIT_MASS'), '질량 감사');
  const cx = FA.contextVerdict(r, sc);
  assert.ok(cx.consistent && cx.outcome && cx.role === 'cause');
});

test('텔로미어 ⑥: 급격한 문턱 (손상 반응 힐 n = 96) 에서도 결합 Rodas3 가 음수 거부 없이 넘고 법칙 충실도가 통과한다', () => {
  const a = run(scen('hayflick')), b = run(scen('sharp-threshold'));
  assert.strictEqual(b.final.state, SEN);
  assert.strictEqual(b.integrator.rejectedNeg, 0, '양수성 위반으로 거부된 단계가 없어야 한다');
  assert.ok(b.integrator.rejected <= 0.05 * b.integrator.steps, `거부 비율 ${b.integrator.rejected}/${b.integrator.steps}`);
  assert.ok(b.integrator.hMinHits === 0, '최소 단계가 강제된 적 없음');
  // 결과는 같은 쪽: 임계 통과(= 분열 한계)는 문턱의 급격함과 무관, 정지 뒤 길이는 n 이 클수록 임계에 가깝다
  const i = telOf(a), La = a.series[a.series.length - 1][i], Lb = b.series[b.series.length - 1][i];
  assert.ok(La > LCRIT * 0.9 && Lb > LCRIT * 0.9 && Lb < La, `끝 길이 n=32 ${La} · n=96 ${Lb}`);
  // 사법부: 같은 법칙을 이중수로 다시 세워 테이프와 맞는지 (급격한 문턱에서도)
  const ir = IRB.buildFateIR(C.normalize(DB), SRC, scen('sharp-threshold')), v = DER.verifyIR(DB, ir, scen('sharp-threshold'));
  assert.deepStrictEqual(v.problems, []);
  assert.ok(v.rateWorst < 1e-14 && v.derivWorst < 1e-14 && v.factorWorst < 1e-14, `충실도 ${v.rateWorst} ${v.derivWorst} ${v.factorWorst}`);
});

test('텔로미어 ⑦: JS 기준 구현 = Rust/WASM (궤적·끝 상태·도달 시각)', () => {
  for (const name of ['hayflick', 'law-isolation', 'sharp-threshold']) {
    const sc = scen(name), a = run(sc, { engine: 'js' }), b = run(sc, { engine: 'rust' }), i = telOf(a);
    let worst = 0;
    a.series.forEach((N, k) => { worst = Math.max(worst, Math.abs(N[i] - b.series[k][i]) / Math.max(1, Math.abs(N[i]))); });
    assert.ok(worst < 1e-12, `${name} 궤적 차이 ${worst}`);
    assert.strictEqual(a.final.state, b.final.state, name);
    assert.ok(rel(a.firstReach[SEN], b.firstReach[SEN]) < 1e-12, `${name} 도달 시각`);
  }
});

test('텔로미어 ⑧: 필수성 — 성장 인자를 끊거나 순 소모를 0 으로 만들면 분열 한계에 이르지 못한다', () => {
  for (const name of ['mitogen-withheld', 'telomerase']) {
    const sc = scen(name), r = run(sc);
    assert.strictEqual(r.final.state, SRC, `${name}: 증식 상태에 머물러야 한다`);
    assert.strictEqual(r.firstReach[SEN], undefined, `${name}: 노화에 도달하면 안 된다`);
    const cx = FA.contextVerdict(r, sc);
    assert.ok(cx.consistent && cx.outcome, `${name}: 맥락 선언(${cx.role})이 실행과 맞아야 한다 — ${cx.problems}`);
  }
  // 텔로머레이스를 켠 쪽은 분열을 계속한다 (소모와 연장이 상쇄 — 멈춘 것이 아니다)
  const t = run(scen('telomerase')), cum = cumOf(t), i = telOf(t);
  assert.ok(cum[cum.length - 1] > 90, `분열이 이어져야 한다 ${cum[cum.length - 1]}`);
  assert.ok(Math.abs(t.series[t.series.length - 1][i] - L0) < 1e-6, '길이는 그대로여야 한다');
  // 성장 인자를 끊은 쪽은 분열이 1/100 (힐 활성 배율의 기준선이 1 이어서 0 이 아니다 — 한계 L000091)
  const q = run(scen('mitogen-withheld')), qc = cumOf(q);
  assert.ok(rel(qc[qc.length - 1], cumOf(run(scen('hayflick')))[10] / 10 * (q.process.times.length - 1) / 100) < 2, `정지 근사 ${qc[qc.length - 1]}`);
});

test('텔로미어 ⑨: 상수 등급 관문 — 가상 상수는 hypothetical 선언 아래에서만', () => {
  const sc = scen('hayflick'), ir = IRB.buildFateIR(C.normalize(DB), SRC, sc), r = run(sc, { ir });
  const v = FA.judgeFate(DB, r, { scenario: sc, ir });
  assert.ok(v.grades.ok && v.grades.n >= 9, `상수 ${v.grades.n}`);
  assert.strictEqual(v.grades.byGrade.hypothetical, v.grades.n, '모든 상수가 가상 시나리오에서 온다');
  const vb = FA.judgeFate(DB, r, { scenario: { ...sc, hypothetical: false }, ir });
  assert.strictEqual(vb.grades.ok, false);
  assert.strictEqual(PR.processReport(vb, { scenario: { ...sc, hypothetical: false }, ir, rerunHash: FA.trajectoryHash(run(sc, { ir })) }).pass, false);
});
