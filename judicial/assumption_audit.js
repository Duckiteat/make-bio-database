// 사법부 — 가정 원장 감사 (build-plan 49 · 설계 docs/design/structure-realignment.md §3)
//
// data/assumptions.jsonl 은 추가만 하는 사슬이다: 사건 = { seq, at, id, slot, value, unit, origin, limitations, basis, range?, revises?, migrated?, prev } ·
//   root = sha256(prev + '\n' + 정준 JSON), 첫 prev = sha256('assumptions\n'). 고치기는 지우지 않고 revises(옛 번호)를 단 새 번호로 —
//   옛 번호는 그대로 남고, 그것을 가리키는 시나리오·등록은 옛 숫자를 계속 가리킨다(풀기가 revises 를 따라가지 않음).
// 이 파일은 판정만 한다(읽기·쓰기 없음): 사슬 무결성 · 새 기록 검사(서기가 쓰기 전) · 시나리오 번호 풀기.
'use strict';
const crypto = require('crypto');
const ATT = require('./attestation.js');
const V = require('../vocab.js');
const M = require('../model.js');
const AS = require('../compiler/assumptions.js');
const { limitationStatus } = require('./judicial.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const GENESIS = sha('assumptions\n');
const ID_RE = /^A\d{6}$/;
const PROPOSAL_FIELDS = ['slot', 'value', 'unit', 'origin', 'limitations', 'basis', 'range', 'revises', 'migrated'];
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const fmtSlot = (s) => (s ? `${s.kind} ${s.key} · ${s.param}${s.cell ? ` (${s.cell})` : ''}` : '?');

function verifyChain(events) {
  const errors = [], seen = new Set(); let prev = GENESIS;
  events.forEach((e, i) => {
    const { root, ...body } = e;
    if (e.seq !== i + 1) errors.push(`사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건`);
    if (e.prev !== prev) errors.push(`사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김`);
    if (root !== sha(body.prev + '\n' + ATT.canon(body))) errors.push(`사건 ${i + 1} (${e.id}): root 재계산 불일치 — 내용이 바뀜`);
    if (!ID_RE.test(String(e.id))) errors.push(`사건 ${i + 1}: 번호 '${e.id}' 가 A + 여섯 자리가 아님`);
    else if (e.id !== 'A' + String(e.seq).padStart(6, '0')) errors.push(`사건 ${i + 1}: 번호 ${e.id} 가 순번 ${e.seq} 과 맞지 않음 — 번호는 서기가 순번으로 붙인다`);
    else if (seen.has(e.id)) errors.push(`사건 ${i + 1}: 번호 ${e.id} 가 두 번 — 번호는 재사용하지 않는다`);
    seen.add(e.id); prev = root;
  });
  return { ok: !errors.length, errors, head: prev };
}

// 기록 하나 (사슬 안이든 새 것이든). before = 이 기록보다 앞선 기록들
function checkRecord(r, db, ix, before, opt = {}) {
  const errors = [], at = `${r.id || '새 기록'} [${fmtSlot(r.slot)}]`;
  const E = (m) => errors.push(`${at}: ${m}`);
  const s = r.slot;
  if (!s || typeof s !== 'object') return [`${at}: 자리(slot)가 없음`];
  if (!V.assumptionSlots[s.kind]) E(`자리 종류 '${s.kind}' — ${Object.keys(V.assumptionSlots).join(' | ')}`);
  else if (!AS.paramOk(s.kind, s.param)) E(`'${s.kind}' 에 없는 칸 '${s.param}'`);
  if (!nonEmpty(s.key)) E('자리 열쇠(key)가 없음');
  else if (s.kind === 'kinetics') { if (!ix.ruleOf(s.key)) E(`규칙 ${s.key} 이 db 에 없음`); }
  else if (s.kind === 'volumes') { if (!V.locations[s.key]) E(`위치 '${s.key}' 가 어휘에 없음`); }
  else { const base = String(s.key).split('|')[0]; if (!db.senses[base]) E(`묶음 ${s.key} 의 정의항 ${base} 이 db 에 없음`); }
  if (typeof r.value !== 'number' || !Number.isFinite(r.value)) E('값이 유한한 수가 아님');
  else if (r.value < 0 && !(s.kind === 'kinetics' && M.SIGNED_KIN.has(s.param))) E(`음수 값 ${r.value} — 부호가 있는 칸만`);
  if (V.assumptionSlots[s.kind] && s.kind !== 'volumes' && (r.unit ?? null) !== (AS.UNIT[s.kind](s.param) ?? null)) E(`단위 '${r.unit}' — 이 자리는 '${AS.UNIT[s.kind](s.param)}'`);
  if (s.kind === 'volumes' && !Object.values(V.unitFactors).some((t) => t[r.unit] != null)) E(`단위 '${r.unit}' 가 vocab.unitFactors 에 없음`);
  if (!['abstracted', 'assumed', 'unrecorded'].includes(r.origin)) E(`기원 '${r.origin}' — abstracted | assumed | unrecorded (실측값은 db 값 V…)`);
  if (r.origin === 'unrecorded' && !r.migrated) E('기원 기록 없음(unrecorded)은 새 기록에 쓸 수 없음 — 한계를 등록하고 assumed 로');
  const L = Array.isArray(r.limitations) ? r.limitations : [];
  if (r.origin === 'assumed') {
    if (!L.length) E('가상 값(assumed)은 그 공백을 다루는 한계(limitations)가 필요');
    for (const id of L) { const l = db.limitations[id]; if (!l) E(`한계 ${id} 이 없음`); else if (!opt.chain && limitationStatus(db, l).status.startsWith('resolved')) E(`한계 ${id} 는 이미 해결됨 — 열린 공백이 아님`); }
  }
  if (!nonEmpty(r.basis)) E('근거 문장(basis)이 없음 — 모르면 "기록 없음"');
  if (r.range != null) {
    const g = r.range;
    if (!g || typeof g.low !== 'number' || typeof g.high !== 'number' || !(g.low <= r.value && r.value <= g.high)) E('범위(range)는 low ≤ 값 ≤ high 인 두 수');
  }
  const key = AS.slotKey(s);
  if (r.revises != null) {
    const old = before.find((x) => x.id === r.revises);
    if (!old) E(`revises 대상 ${r.revises} 이 앞선 기록에 없음`);
    else { if (AS.slotKey(old.slot) !== key) E(`revises 대상 ${r.revises} 은 다른 자리 — 고치기는 같은 자리에서만`); if (old.value === r.value && old.unit === r.unit) E(`revises 인데 값이 ${r.revises} 와 같음`); }
  }
  if (before.some((x) => AS.slotKey(x.slot) === key && x.value === r.value && (x.unit ?? null) === (r.unit ?? null))) E(`같은 자리·같은 값의 기록이 이미 있음 — 그 번호를 쓴다`);
  for (const f of Object.keys(r)) if (!['seq', 'at', 'id', 'prev', 'root', ...PROPOSAL_FIELDS].includes(f)) E(`모르는 칸 '${f}'`);
  return errors;
}

// 새 기록 검사 — 서기가 쓰기 전에. 통과해야 봉인이 ok
function checkProposals(events, proposals, db) {
  if (!Array.isArray(proposals) || !proposals.length) return { ok: false, errors: ['새 기록이 없음'] };
  db = M.normalize(db); const ix = M.index(db), errors = [], before = [...events];
  for (const [i, p] of proposals.entries()) {
    if (!p || typeof p !== 'object') { errors.push(`기록 ${i + 1}: 객체가 아님`); continue; }
    if (p.id != null || p.seq != null) errors.push(`기록 ${i + 1}: 번호·순번은 서기가 붙인다 — id·seq 를 적지 않는다`);
    if (p.migrated) errors.push(`기록 ${i + 1}: migrated 는 변환(012)만`);
    errors.push(...checkRecord(p, db, ix, before));
    before.push(p);
  }
  return { ok: !errors.length, errors };
}

// 시나리오가 가리키는 번호 — 모두 풀리나 (scenarios = { 파일: 시나리오 })
function resolveAll(events, scenarios) {
  const errors = [], refs = new Map(), inline = {};
  for (const [file, sc] of Object.entries(scenarios || {})) {
    const r = AS.resolve(sc, events);
    if (r.error) { for (const l of r.error.split('\n')) errors.push(`${file}: ${l}`); continue; }
    for (const u of r.used) { if (!refs.has(u.id)) refs.set(u.id, []); refs.get(u.id).push(file); }
    const n = AS.slots(sc).filter((x) => !AS.isRef(x.value)).length;
    if (n) inline[file] = n;
  }
  return { errors, refs, inline };
}

// 전체 감사 — validate 가 부른다
function audit(events, db, scenarios) {
  const ch = verifyChain(events);
  db = M.normalize(db); const ix = M.index(db), errors = [...ch.errors];
  events.forEach((e, i) => errors.push(...checkRecord(e, db, ix, events.slice(0, i), { chain: true })));
  const rs = resolveAll(events, scenarios);
  errors.push(...rs.errors);
  const count = {}; for (const e of events) { const k = `${e.slot && e.slot.kind}/${e.origin}`; count[k] = (count[k] || 0) + 1; }
  return { ok: !errors.length, errors, head: ch.head, events: events.length, count, refs: rs.refs, inline: rs.inline };
}

// 거꾸로 색인 — 이 번호를 어느 시나리오가 쓰나. 번호로 가리킨 것(ref) + 인라인 숫자가 같은 자리·같은 값인 것(content, 등록된 인라인 시나리오)
function uses(events, scenarios, id) {
  const rec = events.find((e) => e.id === id);
  if (!rec) return { error: `가정 ${id} 이 원장에 없음` };
  const ref = [], content = [], key = AS.slotKey(rec.slot);
  for (const [file, sc] of Object.entries(scenarios || {})) for (const x of AS.slots(sc)) {
    if (AS.slotKey(x) !== key) continue;
    if (AS.isRef(x.value) && x.value.assume === id) ref.push(file);
    else if (x.value === rec.value) content.push(file);
  }
  const revisedBy = events.filter((e) => e.revises === id).map((e) => e.id);
  return { record: rec, ref: [...new Set(ref)].sort(), content: [...new Set(content)].sort(), revisedBy };
}

function auditText(a) {
  const o = [`가정 원장: ${a.ok ? '통과' : '실패'} — 기록 ${a.events} · 사슬 head ${String(a.head).slice(0, 12)}… · 번호로 가리킨 시나리오 자리 ${[...a.refs.values()].reduce((s, l) => s + l.length, 0)}`];
  const kinds = {}; for (const [k, n] of Object.entries(a.count)) { const [kind, origin] = k.split('/'); kinds[kind] = kinds[kind] || {}; kinds[kind][origin] = n; }
  for (const [kind, by] of Object.entries(kinds)) o.push(`  ${(V.assumptionSlots[kind] || {}).label || kind}: ${Object.entries(by).map(([g, n]) => `${(V.sceneOrigins[g] || {}).label || g} ${n}`).join(' · ')}`);
  const inl = Object.entries(a.inline);
  if (inl.length) o.push(`  인라인 숫자가 남은 시나리오 ${inl.length} (등록된 시나리오는 다시 쓰지 않음 · 탐색 실행은 허용): ${inl.map(([f, n]) => `${f} ${n}`).join(', ')}`);
  for (const e of a.errors) o.push(`  ✗ ${e}`);
  return o.join('\n');
}

module.exports = { GENESIS, verifyChain, checkRecord, checkProposals, resolveAll, audit, uses, auditText, PROPOSAL_FIELDS };
