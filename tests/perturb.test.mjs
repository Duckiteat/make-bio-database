// 교란 연산자 (build-plan 4) — compiler/perturb.js · ir_builder exclude_rules·rule_scale · judicial/derivative 재구성
//   ① knockout: 그 분자의 묶음 시작량 0 · 만드는 규칙 제외 · IR 묶음 번호는 기준과 같음 · 실행하면 끝까지 0
//   ② block · inhibit(배율 1/(1+dose/Ki), 사법부 법칙 재구성 ≤ 1e-14) · clamp(완충) · dose_series
//   ③ 교란 IR 해시 = f(기준 IR 해시, 교란 기록) · 없는 대상은 오류 · 엔진 코드는 바뀌지 않음(IR 만 먹음)
//   ④ 사법부 교란 차이 검사(build-plan 5): 기준에서 독립 재구성 — 선언 밖 차이·빠진 생성 규칙·꾸민 배율·다른 대조군을 잡는다
import SCN from '../scenarios.js'; // 시나리오 읽기 — 가정 번호를 원장으로 푼다
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const C = require('../core.js'), F = require('../engine/fate_engine.js'), IRB = require('../compiler/ir_builder.js'), PT = require('../compiler/perturb.js'), DER = require('../judicial/derivative.js'), PA = require('../judicial/perturb_audit.js');
const DB = C.normalize(JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url))));
const SRC = 'D000202';
const SC = SCN.read(new URL('../examples/scenarios/mhc-dc-maturation-lps-hypothetical.json', import.meta.url));
const A = IRB.assemble(DB, SRC, SC), base = IRB.buildFateIR(DB, SRC, SC);
const baseOf = (b) => b.split('|')[0];
// 시험 대상: 계 안에서 무언가가 만드는 분자 하나, 속도 상수가 있는 규칙 하나, 묶음 하나 (데이터에서 고름 — 이름을 박지 않음)
const PROD = A.rules.find((R) => R.k && R.prods.length && !A.signals.includes(R.prods[0].b));
const KO = baseOf(PROD.prods[0].b), RULE = A.rules.find((R) => R.k && R.kind === 'step') || PROD, BUNDLE = A.bundles.find((b) => !A.signals.includes(b));

test('① knockout: 시작량 0 · 생성 규칙 제외 · 묶음 번호 그대로 · 실행 내내 0', () => {
  const v = PT.perturb(DB, SRC, SC, { type: 'knockout', target: KO });
  assert.ok(!v.error, v.error); const { scenario, record } = v.variants[0];
  const mine = A.bundles.filter((b) => baseOf(b) === KO), producers = A.rules.filter((R) => R.prods.some((q) => baseOf(q.b) === KO)).map((R) => R.ref);
  for (const b of mine) assert.equal(scenario.amounts[b], 0);
  assert.deepEqual([...new Set(producers)].sort(), record.change.exclude_rules.slice().sort());
  const ir = IRB.buildFateIR(DB, SRC, scenario);
  assert.deepEqual(ir.keys, base.keys, '묶음 번호가 기준과 같음');
  assert.ok(!ir.rules.some((R) => producers.includes(R.ref)), '생성 규칙이 IR 에 없음');
  assert.ok(DER.verifyIR(DB, ir, scenario).problems.length === 0, '사법부 법칙 재구성 통과');
  const r = F.simulateFate(DB, SRC, { engine: 'rust', scenario, commitment: false });
  assert.ok(!r.error, r.error);
  for (const b of mine) assert.equal(r.final.N[b] || 0, 0, `${b} 가 다시 생김`);
});

test('② block · inhibit · clamp · dose_series', () => {
  const blk = PT.perturb(DB, SRC, SC, { type: 'block', target: RULE.ref }).variants[0];
  assert.ok(!IRB.buildFateIR(DB, SRC, blk.scenario).rules.some((R) => R.ref === RULE.ref));
  // inhibit: 속도 = 기준 × 1/(1 + dose/Ki), 사법부 재구성과 ≤ 1e-14
  const inh = PT.perturb(DB, SRC, SC, { type: 'inhibit', target: RULE.ref, Ki_M: 1e-6, dose_M: 3e-6 }).variants[0];
  assert.equal(inh.scenario.rule_scale[RULE.ref], 1 / (1 + 3));
  const ir = IRB.buildFateIR(DB, SRC, inh.scenario), j = ir.rules.findIndex((R) => R.ref === RULE.ref), j0 = base.rules.findIndex((R) => R.ref === RULE.ref);
  assert.equal(ir.rules[j].scale, 0.25);
  const ver = DER.verifyIR(DB, ir, inh.scenario); assert.equal(ver.problems.length, 0, ver.problems.join('; ')); assert.ok(ver.rateWorst <= 1e-14);
  const N = base.keys.map((_, i) => 1000 + 37 * i), sp = { cinv: base.species.map((s) => s.cinv), buf: base.species.map((s) => (s.buf == null ? Infinity : s.buf)) };
  const r1 = DER.runTape(ir.jac.rate[j], N, 1, sp), r0 = DER.runTape(base.jac.rate[j0], N, 1, sp);
  assert.ok(Math.abs(r1 - 0.25 * r0) <= 1e-14 * Math.abs(r0), `${r1} vs ${0.25 * r0}`);
  // 배율을 시나리오와 다르게 꾸민 IR 은 사법부가 잡는다
  assert.ok(DER.verifyIR(DB, ir, SC).problems.some((p) => /교란 배율/.test(p)));
  const cl = PT.perturb(DB, SRC, SC, { type: 'clamp', target: BUNDLE, conc_M: 1e-7 }).variants[0];
  assert.equal(IRB.buildFateIR(DB, SRC, cl.scenario).species[base.keys.indexOf(BUNDLE)].buf, 1e-7);
  const ds = PT.perturb(DB, SRC, SC, { type: 'dose_series', of: { type: 'inhibit', target: RULE.ref, Ki_M: 1e-6 }, doses: [0, 1e-6, 1e-5] });
  ds.variants.map((x) => x.scenario.rule_scale[RULE.ref]).forEach((s, i) => assert.ok(Math.abs(s - [1, 0.5, 1 / 11][i]) <= 1e-15, `용량 ${i}: ${s}`));
});

test('③ 교란 IR 해시 · 없는 대상 · 잘못된 선언', () => {
  const p = PT.perturbedIR(DB, SRC, SC, { type: 'block', target: RULE.ref });
  const v = p.variants[0];
  assert.equal(v.ir.perturbation.base_ir_hash, p.base.hash);
  assert.equal(v.ir.hash, IRB.irHash(v.ir), '해시는 교란 기록까지 포함');
  assert.notEqual(v.ir.hash, IRB.buildFateIR(DB, SRC, v.scenario).hash, '교란 기록이 해시에 들어감');
  assert.ok(DER.verifyIR(DB, v.ir, v.scenario).hashOK);
  const bad = (q, re) => assert.match(PT.perturb(DB, SRC, SC, q).error || '', re);
  bad({ type: 'knockout', target: 'D999999' }, /이 계에 없음/);
  bad({ type: 'knockout', target: 'TAP' }, /정의항 번호/);
  bad({ type: 'block', target: 'D000001/rule/none' }, /이 계에 없음/);
  bad({ type: 'inhibit', target: RULE.ref, Ki_M: 0, dose_M: 1 }, /Ki_M > 0/);
  bad({ type: 'clamp', target: 'D999999|cytosol', conc_M: 1 }, /이 계에 없음/);
  bad({ type: 'dose_series', of: { type: 'block', target: RULE.ref }, doses: [1] }, /dose_series/);
  bad({ type: 'heat' }, /알 수 없는 교란/);
});

test('④ 교란 차이 검사: 교란 외에는 대조군과 같다 — 사법부 독립 재구성', () => {
  const run = (q) => { const p = PT.perturbedIR(DB, SRC, SC, q); assert.ok(!p.error, p.error); const v = p.variants[0]; return { baseScenario: SC, baseIR: p.base, scenario: v.scenario, ir: v.ir, record: v.record }; };
  const cases = [{ type: 'knockout', target: KO }, { type: 'block', target: RULE.ref }, { type: 'inhibit', target: RULE.ref, Ki_M: 1e-6, dose_M: 2e-6 }, { type: 'clamp', target: BUNDLE, conc_M: 1e-7 }];
  for (const q of cases) { const v = PA.verifyPerturbation(run(q)); assert.ok(v.ok, `${q.type}: ${v.problems.join(' · ')}`); }
  const ko = run(cases[0]), bad = (mut, re) => { const x = JSON.parse(JSON.stringify(ko)); mut(x); const v = PA.verifyPerturbation(x); assert.ok(!v.ok && v.problems.some((m) => re.test(m)), `${re}: ${v.problems.join(' · ')}`); };
  // 선언 밖 차이: 교란 시나리오에서 다른 값도 몰래 바꿈
  bad((x) => { x.scenario.t_end = (x.scenario.t_end || 0) + 1; }, /선언 밖의 차이/);
  bad((x) => { const b = Object.keys(x.scenario.amounts).find((k) => !(k in x.record.change.amounts)); if (b) x.scenario.amounts[b] += 1; else x.scenario.amounts['D000001|cytosol'] = 5; }, /기준 \+ 선언한 변경과 다름/);
  // 생성 규칙 하나를 빼먹은 넉아웃 (기록·시나리오를 서로 맞게 꾸며도 사법부 재구성이 잡는다)
  if (ko.record.change.exclude_rules.length) bad((x) => { const r = x.record.change.exclude_rules.pop(); x.scenario.exclude_rules = x.scenario.exclude_rules.filter((y) => y !== r); }, /만들어야 할 exclude_rules/);
  // IR 이 시나리오와 다름: 제외한 규칙이 남음 · 다른 규칙의 상수가 바뀜
  bad((x) => { x.ir.rules.push(JSON.parse(JSON.stringify(x.baseIR.rules.find((R) => x.record.change.exclude_rules.includes(R.ref))))); }, /규칙 수/);
  bad((x) => { const R = x.ir.rules.find((r) => r.k && r.k.k != null); if (R) R.k.k *= 2; else x.ir.rules[0].loc = 'x'; }, /배율 말고도 기준과 다름|IR 해시가 내용과 다름/);
  // 다른 대조군 · 기록 변조
  bad((x) => { x.baseScenario = { ...x.baseScenario, name: '다른 대조군' }; }, /기준 시나리오 해시/);
  bad((x) => { x.record.perturbation.target = 'D000001'; }, /기록의 해시/);
});
