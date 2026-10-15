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
  const p = (sc || {}).protocol, problems = [];
  if (!p) return { declared: false, ok: false, problems: ['규약(protocol) 없음 — 탐색 실행'] };
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  need(typeof p.question === 'string' && p.question.trim(), 'question 이 없음 — 무엇을 보이려는지');
  const m = p.matched_experiment || {};
  need(m.source && ['DOI', 'PMID'].includes(m.source.db) && m.source.id, 'matched_experiment.source 가 DOI·PMID 가 아님 — 흉내 내는 실제 실험의 출처');
  need(m.system && m.system.species && m.system.cell && m.system.condition, 'matched_experiment.system 에 species·cell·condition 이 다 있어야 함');
  need(Array.isArray(m.readout_times_s) && m.readout_times_s.length && m.readout_times_s.every((t) => t >= 0), 'matched_experiment.readout_times_s 가 없음 — 실제 실험의 측정 시점(s)');
  const c = p.controls || {};
  need(c.negative && typeof c.negative === 'object' && c.negative.description, 'controls.negative 가 없음 — 음성 대조(일어나지 않아야 할 조건)는 필수');
  need(Array.isArray(p.readouts) && p.readouts.length, 'readouts 가 없음');
  for (const [i, r] of (p.readouts || []).entries()) {
    need(r.observable && OBS_KINDS.includes(r.observable.kind) && r.observable.target, `readouts[${i}]: observable { kind: ${OBS_KINDS.join('|')}, target } 필요`);
    need(r.observable && r.observable.kind === 'event_time' ? true : r.time_s >= 0, `readouts[${i}]: time_s 필요(도달 시각이 아니면)`);
  }
  for (const [i, x] of (p.perturbations || []).entries()) need(x && typeof x.type === 'string' && x.target, `perturbations[${i}]: { type, target } 필요`);
  // ② 반복 수
  const stoch = !!sc.stochastic, r = p.replicates || {}, req = stoch ? requiredReplicates(r) : 1;
  if (stoch) {
    need(Number.isInteger(r.n) && r.n > 0, 'replicates.n 이 없음 — 확률 실행의 앙상블 크기');
    need(req != null, 'replicates 에 effect_size·sd(예상 효과 크기·예상 퍼짐)가 없어 검정력으로 n 을 정할 수 없음');
    if (req != null && Number.isInteger(r.n)) need(r.n >= req, `replicates.n ${r.n} < 검정력 요구 ${req} (Δ ${r.effect_size}, σ ${r.sd}, α ${r.alpha != null ? r.alpha : S.ALPHA}, 검정력 ${r.power != null ? r.power : S.POWER})`);
  } else need(r.n == null || r.n === 1, '결정론 실행인데 replicates.n ≠ 1');
  need(p.stopping && p.stopping.fixed_n === true, 'stopping.fixed_n: true 필요 — 결과를 보고 반복 수를 바꾸지 않는다');
  // ③ 검증 세트
  const used = usedAsEvidence(db), obs = db.observations || {};
  need(Array.isArray(p.validation) && p.validation.length, 'validation 이 없음 — 검증 관찰 번호 목록');
  for (const id of p.validation || []) {
    const o = obs[id];
    if (!o) { problems.push(`validation ${id}: 관찰 기록이 없음`); continue; }
    if (o.use !== 'validation') problems.push(`validation ${id}: 용도가 ${o.use} — 추정용 관찰로 검증하면 순환`);
    if (o.retracted) problems.push(`validation ${id}: 철회된 관찰`);
    if (used.has(id)) problems.push(`validation ${id}: 어떤 값의 근거(from)로 쓰이고 있음 — 추정·검증 분리 위반`);
  }
  if (p.equivalence) for (const [i, e] of p.equivalence.entries()) need(e.observable && e.delta > 0, `equivalence[${i}]: { observable, delta > 0, scale, evidence } 필요`);
  if (sc.equivalence) problems.push('equivalence 는 protocol 안에만 둔다 (최상위 equivalence 는 쓰지 않음)');
  return { declared: true, ok: !problems.length, problems, required_n: req, hash: scenarioHash(sc) };
}

// 사전 등록부 사슬: 사건 = { seq, at, scenario_sha256, name, question, prev } · root = sha256(prev + '\n' + 정준 JSON), 첫 prev = PREREG_GENESIS
function verifyPreregChain(entries) {
  const errors = []; let prev = PREREG_GENESIS;
  entries.forEach((e, i) => {
    const { root, ...body } = e;
    if (e.seq !== i + 1) errors.push(`등록 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 등록`);
    if (e.prev !== prev) errors.push(`등록 ${i + 1}: prev 가 직전 루트와 다름 — 사슬이 끊김`);
    if (root !== sha(body.prev + '\n' + ATT.canon(body))) errors.push(`등록 ${i + 1}: root 재계산 불일치 — 내용이 바뀜`);
    prev = root;
  });
  return { ok: !errors.length, errors, head: prev };
}

// 전체 판정: 구조 + 사전 등록(실행 시각 runAt 보다 앞선 등록) — ctx = { prereg: [등록 사건], runAt: ISO 시각 }
function protocolVerdict(db, sc, ctx) {
  ctx = ctx || {};
  const out = protocolStructure(db, sc);
  if (!out.declared) return out;
  const chain = verifyPreregChain(ctx.prereg || []);
  if (!chain.ok) out.problems.push(...chain.errors.map((e) => '사전 등록부: ' + e));
  const hit = (ctx.prereg || []).find((e) => e.scenario_sha256 === out.hash);
  if (!hit) out.problems.push('사전 등록되지 않은 시나리오 — 등록 뒤 고쳤거나 등록하지 않음 (node dbtool.mjs register <시나리오>)');
  else if (ctx.runAt && !(Date.parse(hit.at) < Date.parse(ctx.runAt))) out.problems.push(`등록 시각 ${hit.at} 이 실행 시각 ${ctx.runAt} 보다 앞서지 않음`);
  out.registered = hit ? { seq: hit.seq, at: hit.at } : null;
  out.ok = !out.problems.length;
  out.validation = ((sc.protocol || {}).validation || []).slice();
  return out;
}

function protocolText(v) {
  if (!v.declared) return '모의 실험 규약: 없음 — 탐색 실행 (검증 결론을 낼 수 없음)';
  return v.ok ? `모의 실험 규약: 통과 — 사전 등록 #${v.registered.seq} (${v.registered.at})${v.required_n > 1 ? `, 앙상블 n ≥ ${v.required_n}` : ''}`
    : `모의 실험 규약: 위반 ${v.problems.length}\n` + v.problems.map((x) => '  ✗ ' + x).join('\n');
}

module.exports = { scenarioHash, PREREG_GENESIS, requiredReplicates, usedAsEvidence, protocolStructure, verifyPreregChain, protocolVerdict, protocolText };
