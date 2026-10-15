// 사법부 — 교란 차이 검사 (Perturbation Audit). build-plan 5
//
// 교란 실험의 전제는 "교란 외에는 대조군과 같다" 다. 컴파일러(compiler/perturb.js)가 만든 교란 시나리오·IR 을
// 컴파일러 코드를 쓰지 않고 기준 시나리오·기준 IR 에서 **독립적으로 다시 세워** 대조한다.
//   ① 선언 재구성 — 교란 선언(knockout·block·inhibit·clamp)이 기준에서 만들어야 할 변경을 사법부가 직접 계산:
//      knockout = 기준 IR 에서 그 분자의 묶음 전부(시작량 0) · 그 분자를 만드는 규칙 전부(제외) · 그 분자의 신호(0)
//      block = 그 규칙 하나 · inhibit = 이전 배율 / (1 + dose/Ki) · clamp = 그 묶음 완충(농도, 비지 않는 총량)
//   ② 시나리오 차이 — 교란 시나리오 = 기준 시나리오 + ① 의 변경, 그 밖의 필드는 모두 같음
//   ③ IR 차이 — 묶음·상태·표지·신호·결합점 같음, 규칙 = 기준 규칙 − 제외 규칙(남은 규칙은 배율 말고 같음), 완충은 고정한 묶음만 다름,
//      기록의 기준 IR 해시 = 기준 IR 해시, 기록 해시·IR 해시가 내용과 맞음
// 판결만 낸다 — 쓰기·엔진 실행·컴파일 없음. 법칙 충실도(배율 포함)는 judicial/derivative.js verifyIR 이 따로 본다.
'use strict';
const crypto = require('crypto');
const ATT = require('./attestation.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const eq = (a, b) => ATT.canon(a) === ATT.canon(b);
const baseOf = (b) => b.split('|')[0];
const SCENARIO_FIELDS = ['exclude_rules', 'amounts', 'signals', 'rule_scale', 'buffered'];

// ① 선언 → 기대 변경 (기준 시나리오·기준 IR 만으로)
function expectedChange(baseSc, baseIR, p) {
  const ch = { exclude_rules: [], amounts: {}, signals: {}, rule_scale: {}, buffered: {} }, refs = new Set(baseIR.rules.map((R) => R.ref));
  if (!p || !p.type) return { error: '교란 선언이 없음' };
  if (p.type === 'knockout') {
    const mine = baseIR.keys.filter((b) => baseOf(b) === p.target);
    if (!mine.length) return { error: `knockout 대상 ${p.target} 이 기준 IR 에 없음` };
    for (const b of mine) ch.amounts[b] = 0;
    ch.exclude_rules = [...new Set(baseIR.rules.filter((R) => R.prods.some((q) => baseOf(q.b) === p.target)).map((R) => R.ref))];
    for (const b of Object.keys(baseSc.signals || {})) if (baseOf(b) === p.target) ch.signals[b] = [{ t: 0, n: 0 }];
  } else if (p.type === 'block') {
    if (!refs.has(p.target)) return { error: `block 대상 ${p.target} 이 기준 IR 에 없음` };
    ch.exclude_rules = [p.target];
  } else if (p.type === 'inhibit') {
    if (!refs.has(p.target) || !(p.Ki_M > 0) || !(p.dose_M >= 0)) return { error: 'inhibit 선언이 기준 IR·값 조건에 맞지 않음' };
    const prev = (baseSc.rule_scale || {})[p.target];
    ch.rule_scale[p.target] = (prev != null ? prev : 1) / (1 + p.dose_M / p.Ki_M);
  } else if (p.type === 'clamp') {
    if (!baseIR.keys.includes(p.target) || !(p.conc_M >= 0)) return { error: 'clamp 선언이 기준 IR·값 조건에 맞지 않음' };
    ch.buffered[p.target] = { conc_M: p.conc_M };
  } else return { error: `판정할 수 없는 교란 '${p.type}'` };
  return { change: ch };
}

function verifyPerturbation({ baseScenario, baseIR, scenario, ir, record }) {
  const problems = [], P = (m) => problems.push(m);
  if (!record || !record.perturbation) return { ok: false, problems: ['교란 기록이 없음'] };
  // 기록 자체
  const { hash: rh, ...rbody } = record;
  if (rh !== sha(ATT.canon(rbody))) P('교란 기록의 해시가 내용과 다름');
  if (record.base_scenario_sha256 !== sha(ATT.canon(baseScenario))) P('기록의 기준 시나리오 해시가 기준 시나리오와 다름 — 다른 대조군');
  // ① 재구성
  const ex = expectedChange(baseScenario, baseIR, record.perturbation);
  if (ex.error) return { ok: false, problems: [...problems, ex.error] };
  const want = ex.change;
  for (const f of SCENARIO_FIELDS) {
    const got = (record.change || {})[f], w = want[f];
    const same = f === 'exclude_rules' ? eq([...(got || [])].sort(), [...w].sort()) : f === 'buffered'
      ? eq(Object.keys(got || {}).sort(), Object.keys(w).sort()) && Object.entries(w).every(([b, v]) => got[b] && got[b].conc_M === v.conc_M && got[b].total > 0)
      : f === 'rule_scale' ? eq(Object.keys(got || {}).sort(), Object.keys(w).sort()) && Object.entries(w).every(([r, v]) => Math.abs(got[r] - v) <= 1e-15 * Math.abs(v))
      : eq(got || {}, w);
    if (!same) P(`선언한 교란이 만들어야 할 ${f} 와 기록의 변경이 다름`);
  }
  // ② 시나리오 차이: 기준 + 변경 = 교란 시나리오, 나머지 필드는 같음
  const keys = new Set([...Object.keys(baseScenario), ...Object.keys(scenario)]);
  for (const k of keys) {
    if (!SCENARIO_FIELDS.includes(k)) { if (!eq(baseScenario[k], scenario[k])) P(`시나리오 '${k}' 가 기준과 다름 — 선언 밖의 차이`); continue; }
    const ch = (record.change || {})[k], b = baseScenario[k], s = scenario[k];
    if (k === 'exclude_rules') { if (!eq([...new Set([...(b || []), ...((ch || []))])].sort(), [...(s || [])].sort())) P('exclude_rules = 기준 + 선언한 제외가 아님'); continue; }
    const expect = Object.keys(ch || {}).length ? Object.assign({}, b || {}, ch) : b;
    if (!eq(expect, s)) P(`시나리오 '${k}' 가 기준 + 선언한 변경과 다름`);
  }
  // ③ IR 차이
  if (ir) {
    for (const f of ['source', 'states', 'keys', 'markers', 'signals', 'coupling', 'format', 'version']) if (!eq(baseIR[f], ir[f])) P(`IR '${f}' 가 기준과 다름`);
    const excl = new Set([...(scenario.exclude_rules || [])]), scale = scenario.rule_scale || {};
    const wantRules = baseIR.rules.filter((R) => !excl.has(R.ref)); // 기준 IR 에는 기준의 제외가 이미 빠져 있다
    if (wantRules.length !== ir.rules.length) P(`IR 규칙 수 ${ir.rules.length} ≠ 기준 ${baseIR.rules.length} − 제외 = ${wantRules.length}`);
    else wantRules.forEach((R, j) => {
      const { scale: s0, ...r0 } = R, { scale: s1, ...r1 } = ir.rules[j];
      if (!eq(r0, r1)) P(`IR 규칙 ${R.ref} 가 배율 말고도 기준과 다름`);
      const ws = scale[R.ref] != null ? scale[R.ref] : undefined;
      if ((s1 == null ? undefined : s1) !== ws) P(`IR 규칙 ${R.ref} 의 배율 ${s1} ≠ 시나리오 ${ws}`);
    });
    baseIR.species.forEach((s, i) => {
      const t = ir.species[i] || {}, b = baseIR.keys[i], cl = (scenario.buffered || {})[b], bb = (baseScenario.buffered || {})[b];
      if (s.b !== t.b || s.V !== t.V) P(`IR 묶음 ${b} 의 부피가 기준과 다름`);
      const wantBuf = cl ? cl.conc_M : bb ? bb.conc_M : null;
      if ((t.buf == null ? null : t.buf) !== wantBuf) P(`IR 묶음 ${b} 의 완충 ${t.buf} ≠ 기대 ${wantBuf}`);
    });
    const pr = ir.perturbation;
    if (!pr) P('교란 IR 에 교란 기록이 없음');
    else {
      if (pr.base_ir_hash !== baseIR.hash) P('교란 IR 의 기준 IR 해시가 기준 IR 과 다름');
      const { base_ir_hash, ...rest } = pr;
      if (!eq(rest, record)) P('교란 IR 에 실린 기록이 교란 기록과 다름');
    }
    const { hash, ...irRest } = ir;
    if (hash !== sha(ATT.canon(irRest))) P('교란 IR 해시가 내용과 다름');
  }
  return { ok: !problems.length, problems, perturbation: record.perturbation, change: want };
}

function perturbationText(v) {
  const p = v.perturbation || {};
  return v.ok ? `교란 차이 검사: 통과 — ${p.type} ${p.target || (p.of && p.of.target) || ''} 외에는 대조군과 같음`
    : `교란 차이 검사: 위반 ${v.problems.length}\n` + v.problems.map((x) => '  ✗ ' + x).join('\n');
}

module.exports = { expectedChange, verifyPerturbation, perturbationText };
