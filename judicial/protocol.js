// 사법부 — 모의 실험 규약 판정 (Protocol Verdict). docs/design/integral-field-engine.md §13.7 · build-plan 3
//
// 검증은 "실제 실험과 같은 실험을 모델에서 했을 때 같은 결과가 나오나" 다. 그래서 검증에 쓰는 실행은 시나리오의
// protocol 블록으로 실험 계획을 선언하고, 그 시나리오 전체를 **실행 전에** 사전 등록부(data/preregistrations.jsonl)에 남긴다.
//   ① 규약 완결성 — question · matched_experiment(출처 DOI·PMID, 종·세포·조건, 측정 시점) · controls.negative(필수) · readouts · validation · stopping
//   ② 반복 수 — 확률 실행이면 n ≥ ⌈(z₁₋α/₂ + z_power)² · σ² / Δ²⌉ (선언된 효과 크기 Δ·예상 sd σ), 결정론이면 n = 1
//   ③ 검증 세트 — 관찰이 있고, use = validation, 철회 아님, 어떤 속도 상수·정의항 값의 근거(from)로도 쓰이지 않음(추정·검증 분리)
//   ④ 사전 등록 — 시나리오의 정준 해시가 등록부 사슬에 있고, 등록 시각이 실행 시각보다 앞섬. 등록 뒤 고치면 해시가 달라져 미등록
// 규약이 없는 실행은 '탐색 실행' — 판정은 하되 검증 결론(일치)은 낼 수 없다. 쓰기·엔진 실행 없음.
'use strict';
const crypto = require('crypto');
const ATT = require('./attestation.js');
const S = require('./stats.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const scenarioHash = (sc) => sha(ATT.canon(sc));
const PREREG_GENESIS = sha('preregistration\n');
const OBS_KINDS = ['amount', 'concentration', 'fraction', 'event_time'];

// ② 검정력으로 필요한 앙상블 크기 (양측 z 검정)
function requiredReplicates(r) {
  const alpha = r.alpha != null ? r.alpha : S.ALPHA, power = r.power != null ? r.power : S.POWER;
  if (!(r.effect_size > 0) || !(r.sd > 0)) return null;
  const z = S.normInv(1 - alpha / 2) + S.normInv(power);
  return Math.ceil((z * z * r.sd * r.sd) / (r.effect_size * r.effect_size));
}

// 어떤 값의 근거로 쓰인 관찰 번호 — 규칙 kinetics.from [{ param, obs }] · 정의항 obs.from (model.js 정규형)
function usedAsEvidence(db) {
  const used = new Set();
  for (const d of Object.values(db.senses || {})) {
    for (const r of d.rule || []) for (const f of (r.kinetics && r.kinetics.from) || []) if (f && f.obs) used.add(f.obs);
    for (const o of d.obs || []) if (o.from) used.add(o.from);
  }
  return used;
}

// ① + ② + ③ — 등록과 무관한 구조 판정 (등록 전에 서기가 봉인을 받을 때 쓴다)
function protocolStructure(db, sc) {
  const p = (sc || {}).protocol, problems = [], rules = [], prob = (rule, m) => { problems.push(m); rules.push(rule); }; // rules[i] = problems[i] 를 집행하는 규칙 번호
  if (!p) return { declared: false, ok: false, problems: ['규약(protocol) 없음 — 탐색 실행'], rules: ['RULE-0182'] };
  const need = (cond, msg, rule = 'RULE-0244') => { if (!cond) prob(rule, msg); }; // 규약 칸 (RULE-0244)
  need(typeof p.question === 'string' && p.question.trim(), 'question 이 없음 — 무엇을 보이려는지');
  const m = p.matched_experiment || {};
  need(m.source && ['DOI', 'PMID'].includes(m.source.db) && m.source.id, 'matched_experiment.source 가 DOI·PMID 가 아님 — 흉내 내는 실제 실험의 출처');
  need(m.system && m.system.species && m.system.cell && m.system.condition, 'matched_experiment.system 에 species·cell·condition 이 다 있어야 함');
  need(Array.isArray(m.readout_times_s) && m.readout_times_s.length && m.readout_times_s.every((t) => t >= 0), 'matched_experiment.readout_times_s 가 없음 — 실제 실험의 측정 시점(s)');
  const c = p.controls || {};
  need(c.negative && typeof c.negative === 'object' && c.negative.description, 'controls.negative 가 없음 — 음성 대조(일어나지 않아야 할 조건)는 필수', 'RULE-0180');
  need(Array.isArray(p.readouts) && p.readouts.length, 'readouts 가 없음');
  for (const [i, r] of (p.readouts || []).entries()) {
    need(r.observable && OBS_KINDS.includes(r.observable.kind) && r.observable.target, `readouts[${i}]: observable { kind: ${OBS_KINDS.join('|')}, target } 필요`);
    need(r.observable && r.observable.kind === 'event_time' ? true : r.time_s >= 0, `readouts[${i}]: time_s 필요(도달 시각이 아니면)`);
  }
  for (const [i, x] of (p.perturbations || []).entries()) need(x && typeof x.type === 'string' && x.target, `perturbations[${i}]: { type, target } 필요`);
  // ② 반복 수
  const stoch = !!sc.stochastic, r = p.replicates || {}, req = stoch ? requiredReplicates(r) : 1;
  if (stoch) {
    need(Number.isInteger(r.n) && r.n > 0, 'replicates.n 이 없음 — 확률 실행의 앙상블 크기', 'RULE-0180');
    need(req != null, 'replicates 에 effect_size·sd(예상 효과 크기·예상 퍼짐)가 없어 검정력으로 n 을 정할 수 없음', 'RULE-0180');
    if (req != null && Number.isInteger(r.n)) need(r.n >= req, `replicates.n ${r.n} < 검정력 요구 ${req} (Δ ${r.effect_size}, σ ${r.sd}, α ${r.alpha != null ? r.alpha : S.ALPHA}, 검정력 ${r.power != null ? r.power : S.POWER})`, 'RULE-0180');
  } else need(r.n == null || r.n === 1, '결정론 실행인데 replicates.n ≠ 1', 'RULE-0180');
  need(p.stopping && p.stopping.fixed_n === true, 'stopping.fixed_n: true 필요 — 결과를 보고 반복 수를 바꾸지 않는다', 'RULE-0180');
  // ③ 검증 세트
  const used = usedAsEvidence(db), obs = db.observations || {};
  need(Array.isArray(p.validation) && p.validation.length, 'validation 이 없음 — 검증 관찰 번호 목록', 'RULE-0180');
  for (const id of p.validation || []) {
    const o = obs[id];
    if (!o) { prob('RULE-0120', `validation ${id}: 관찰 기록이 없음`); continue; }
    if (o.use !== 'validation') prob('RULE-0120', `validation ${id}: 용도가 ${o.use} — 추정용 관찰로 검증하면 순환`);
    if (o.retracted) prob('RULE-0120', `validation ${id}: 철회된 관찰`);
    if (used.has(id)) prob('RULE-0120', `validation ${id}: 어떤 값의 근거(from)로 쓰이고 있음 — 추정·검증 분리 위반`);
  }
  if (p.equivalence) for (const [i, e] of p.equivalence.entries()) need(e.observable && e.delta > 0, `equivalence[${i}]: { observable, delta > 0, scale, evidence } 필요`);
  if (sc.equivalence) prob('RULE-0180', 'equivalence 는 protocol 안에만 둔다 (최상위 equivalence 는 쓰지 않음)');
  return { declared: true, ok: !problems.length, problems, rules, required_n: req, hash: scenarioHash(sc) };
}

// 사전 등록부 사슬: 사건 = { seq, at, scenario_sha256, name, question, prev } · root = sha256(prev + '\n' + 정준 JSON), 첫 prev = PREREG_GENESIS
function verifyPreregChain(entries) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }; let prev = PREREG_GENESIS;
  entries.forEach((e, i) => {
    const { root, ...body } = e;
    if (e.seq !== i + 1) err('RULE-0506', `등록 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 등록`);
    if (e.prev !== prev) err('RULE-0506', `등록 ${i + 1}: prev 가 직전 루트와 다름 — 사슬이 끊김`);
    if (root !== sha(body.prev + '\n' + ATT.canon(body))) err('RULE-0506', `등록 ${i + 1}: root 재계산 불일치 — 내용이 바뀜`);
    prev = root;
  });
  return { ok: !errors.length, errors, rules, head: prev };
}

// 전체 판정: 구조 + 사전 등록(실행 시각 runAt 보다 앞선 등록) — ctx = { prereg: [등록 사건], runAt: ISO 시각 }
function protocolVerdict(db, sc, ctx) {
  ctx = ctx || {};
  const out = protocolStructure(db, sc);
  if (!out.declared) return out;
  const chain = verifyPreregChain(ctx.prereg || []);
  const prob = (rule, m) => { out.problems.push(m); out.rules.push(rule); };
  if (!chain.ok) chain.errors.forEach((e, i) => prob(chain.rules[i], '사전 등록부: ' + e));
  const hit = (ctx.prereg || []).find((e) => e.scenario_sha256 === out.hash);
  if (!hit) prob('RULE-0179', '사전 등록되지 않은 시나리오 — 등록 뒤 고쳤거나 등록하지 않음 (node dbtool.mjs register <시나리오>)');
  else if (ctx.runAt && !(Date.parse(hit.at) < Date.parse(ctx.runAt))) prob('RULE-0179', `등록 시각 ${hit.at} 이 실행 시각 ${ctx.runAt} 보다 앞서지 않음`);
  out.registered = hit ? { seq: hit.seq, at: hit.at } : null;
  out.ok = !out.problems.length;
  out.validation = ((sc.protocol || {}).validation || []).slice();
  return out;
}

// V8 맥락 이전 (build-plan 25): 추정/측정 맥락(규약 matched_experiment.system) 과 예측/판정 맥락(시뮬레이션이 돈 맥락)을
//   여섯 맥락 열쇠(format v12 §5)로 비교한다. 둘 다 아는 열쇠가 다르면 '맥락 이전' — 조건 A 로 추정하고 B 를 예측한 것.
//   판정을 막지 않는다(가상 상수 주석과 같은 급의 공개 전제). 한쪽만 아는 열쇠는 '비교 못 함'(전제가 덜 선언됨)으로 따로 센다.
const CTX_KEYS = ['species', 'cell', 'location', 'condition', 'temperature_K', 'pH'];
const canonCtxVal = (k, v) => {
  if (v == null || v === '') return null;
  if (k === 'cell') return String(v).trim().toLowerCase().replace(/\s+/g, '_'); // 토큰/산문 모두 정규화 — 같은 토큰이면 이전 아님
  if (k === 'condition') return JSON.stringify(Array.isArray(v) ? [...v].map(String).sort() : String(v));
  return String(v);
};
function contextTransfer(estimated, predicted) {
  estimated = estimated || {}; predicted = predicted || {};
  const differ = [], incomparable = [], same = [];
  for (const k of CTX_KEYS) {
    const a = estimated[k] == null || estimated[k] === '' ? null : estimated[k];
    const b = predicted[k] == null || predicted[k] === '' ? null : predicted[k];
    if (a == null || b == null) { if (a != null || b != null) incomparable.push({ key: k, estimated: a, predicted: b }); continue; }
    (canonCtxVal(k, a) === canonCtxVal(k, b) ? same : differ).push({ key: k, estimated: a, predicted: b });
  }
  return { transfer: differ.length > 0, differ, incomparable, same };
}
function contextTransferText(ct) {
  if (!ct) return '';
  if (ct.transfer) {
    const lines = ['맥락 이전 (V8): 추정한 맥락과 판정한 맥락이 다름 — 조건 A 로 추정, B 를 예측 (판정을 막지 않는 공개 전제)'];
    for (const d of ct.differ) lines.push(`  ✗ ${d.key}: 추정 '${d.estimated}' → 판정 '${d.predicted}'`);
    for (const d of ct.incomparable) lines.push(`  · ${d.key}: 비교 못 함 (추정 ${d.estimated == null ? '미선언' : d.estimated} · 판정 ${d.predicted == null ? '미선언' : d.predicted})`);
    return lines.join('\n');
  }
  if (ct.incomparable.length && !ct.same.length) return '맥락 이전 (V8): 비교할 공통 맥락 열쇠가 없음 — ' + ct.incomparable.map((d) => d.key).join('·') + ' 한쪽만 선언';
  return '맥락 이전 (V8): 없음 — 추정과 판정의 맥락이 같음' + (ct.incomparable.length ? ' (단, ' + ct.incomparable.map((d) => d.key).join('·') + ' 는 한쪽만 선언)' : '');
}

function protocolText(v) {
  if (!v.declared) return '모의 실험 규약: 없음 — 탐색 실행 (검증 결론을 낼 수 없음)';
  return v.ok ? `모의 실험 규약: 통과 — 사전 등록 #${v.registered.seq} (${v.registered.at})${v.required_n > 1 ? `, 앙상블 n ≥ ${v.required_n}` : ''}`
    : `모의 실험 규약: 위반 ${v.problems.length}\n` + v.problems.map((x) => '  ✗ ' + x).join('\n');
}

module.exports = { scenarioHash, PREREG_GENESIS, requiredReplicates, usedAsEvidence, protocolStructure, verifyPreregChain, protocolVerdict, protocolText, contextTransfer, contextTransferText, CTX_KEYS };
