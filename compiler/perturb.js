// 컴파일러 — 교란 연산자 (Perturbation Operator). build-plan 4 · docs/design/integral-field-engine.md §13.7
//
// 기준 시나리오 + 교란 선언 → 교란 시나리오. 순수 함수: 쓰기·판정·엔진 호출 없음. 엔진은 그대로 IR 만 먹는다.
// 교란은 시나리오의 선언 필드로만 바뀐다 — 그래서 "교란 외에는 같다" 를 사법부가 시나리오·IR 차이로 확인할 수 있다(build-plan 5).
//   knockout { target: D… }        그 분자의 모든 묶음 시작량 0 + 그 분자를 만드는 규칙(공급·단계) 제외 + 그 분자의 신호 0
//   block    { target: 규칙 ref }  그 규칙 제외 (항체·돌연변이) — 가역 단계면 정·역 모두
//   inhibit  { target: 규칙 ref, Ki_M, dose_M }  속도에 1/(1 + dose/Ki) 를 곱한다 (경쟁·비경쟁을 가리지 않는 단순 배율 — 한계)
//   clamp    { target: 묶음, conc_M }  농도 고정 = 완충 저장소(buffered) 를 무한에 가까운 총량으로
//   dose_series { of: { type: inhibit | clamp, target, … }, doses: [M, …] }  용량마다 교란 시나리오 하나
// 대상이 이 계(시작 상태에서 닿는 상태들의 규칙·묶음)에 없으면 오류 — 없는 것을 끈 실험은 대조군과 같아 아무것도 보이지 않는다.
'use strict';
const crypto = require('crypto');
const M = require('../model.js');
const IRB = require('./ir_builder.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const CLAMP_TOTAL = 1e300; // 완충 저장소가 비지 않을 만큼 — 고정의 근사(엔진은 남은 양이 한 구획분 이상이면 농도를 고정한다)
const clone = (x) => JSON.parse(JSON.stringify(x));

// 교란 하나 → { scenario, change } (change = 시나리오에 생긴 차이의 선언 — 사법부 대조용)
function applyOne(db, sid, sc, p) {
  const A = IRB.assemble(M.normalize(db), sid, sc);
  if (A.error) return { error: A.error };
  const out = clone(sc), change = { exclude_rules: [], amounts: {}, signals: {}, rule_scale: {}, buffered: {} };
  const refs = new Set(A.rules.map((R) => R.ref)), baseOf = (b) => b.split('|')[0];
  const exclude = (ref) => { if (!change.exclude_rules.includes(ref)) change.exclude_rules.push(ref); };
  if (!p || typeof p.type !== 'string') return { error: '교란에 type 이 없음' };
  if (p.type === 'knockout') {
    if (!/^D\d{6}$/.test(p.target || '')) return { error: `knockout 대상은 정의항 번호(D…) — '${p.target}'` };
    const mine = A.bundles.filter((b) => baseOf(b) === p.target);
    if (!mine.length) return { error: `knockout 대상 ${p.target} 이 이 계에 없음` };
    for (const b of mine) change.amounts[b] = 0;
    for (const R of A.rules) if (R.prods.some((q) => baseOf(q.b) === p.target)) exclude(R.ref);
    for (const b of Object.keys(sc.signals || {})) if (baseOf(b) === p.target) change.signals[b] = [{ t: 0, n: 0 }];
  } else if (p.type === 'block') {
    if (!refs.has(p.target)) return { error: `block 대상 규칙 ${p.target} 이 이 계에 없음` };
    exclude(p.target);
  } else if (p.type === 'inhibit') {
    if (!refs.has(p.target)) return { error: `inhibit 대상 규칙 ${p.target} 이 이 계에 없음` };
    if (!(p.Ki_M > 0) || !(p.dose_M >= 0)) return { error: 'inhibit 에는 Ki_M > 0, dose_M ≥ 0 (몰 농도) 필요' };
    const prev = (sc.rule_scale || {})[p.target];
    change.rule_scale[p.target] = (prev != null ? prev : 1) / (1 + p.dose_M / p.Ki_M);
  } else if (p.type === 'clamp') {
    if (!A.bundles.includes(p.target)) return { error: `clamp 대상 묶음 ${p.target} 이 이 계에 없음` };
    if (!(p.conc_M >= 0)) return { error: 'clamp 에는 conc_M ≥ 0 (몰 농도) 필요' };
    change.buffered[p.target] = { conc_M: p.conc_M, total: CLAMP_TOTAL };
  } else return { error: `알 수 없는 교란 '${p.type}' — knockout | block | inhibit | clamp | dose_series` };
  if (change.exclude_rules.length) out.exclude_rules = [...new Set([...(sc.exclude_rules || []), ...change.exclude_rules])].sort();
  for (const f of ['amounts', 'signals', 'rule_scale', 'buffered']) if (Object.keys(change[f]).length) out[f] = Object.assign({}, sc[f] || {}, change[f]);
  return { scenario: out, change };
}

// 교란 선언 하나(dose_series 면 여럿) → [{ scenario, record }]. record = { base_scenario_sha256, perturbation, change, hash }
function perturb(db, sid, sc, p) {
  const list = p && p.type === 'dose_series'
    ? (Array.isArray(p.doses) && p.doses.length && p.of && ['inhibit', 'clamp'].includes(p.of.type)
      ? p.doses.map((d) => Object.assign({}, p.of, p.of.type === 'inhibit' ? { dose_M: d } : { conc_M: d }))
      : null)
    : [p];
  if (!list) return { error: 'dose_series 에는 of { type: inhibit | clamp, … } 와 doses [M, …] 가 필요' };
  const base = sha(IRB.canon(sc)), out = [];
  for (const q of list) {
    const r = applyOne(db, sid, sc, q);
    if (r.error) return { error: r.error };
    const record = { base_scenario_sha256: base, perturbation: q, change: r.change };
    record.hash = sha(IRB.canon(record));
    out.push({ scenario: r.scenario, record });
  }
  return { variants: out };
}

// 교란 IR: 기준 IR 해시와 교란 기록을 IR 에 싣는다 (해시는 그 둘까지 포함해 다시 계산 — 교란 IR 해시 = f(기준, 교란))
function perturbedIR(db, sid, sc, p, params) {
  const base = IRB.buildFateIR(db, sid, sc, params);
  if (base.error) return base;
  const v = perturb(db, sid, sc, p);
  if (v.error) return v;
  return { base, variants: v.variants.map(({ scenario, record }) => {
    const ir = IRB.buildFateIR(db, sid, scenario, params);
    if (ir.error) return { error: ir.error, record };
    const { hash, ...rest } = ir, out = Object.assign(rest, { perturbation: Object.assign({ base_ir_hash: base.hash }, record) });
    out.hash = IRB.irHash(out);
    return { scenario, ir: out, record };
  }) };
}

module.exports = { perturb, perturbedIR, applyOne, CLAMP_TOTAL };
