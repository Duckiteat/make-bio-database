// 사법부 — 측정법 장부 (측정법 계획 ASY-00 · 설계 DEC-0041 "하나하나 어떻게 만들었는지 남긴다")
//
// data/assays.jsonl 은 추가만 하는 사슬이다: 사건 = { seq, at, key, label, rung, principle, produces, measurement_noise, composed_of, separation,
//   traceability, made: { how, sources, alternatives, by }, revises?, why?, prev } · root = sha256(prev + '\n' + 정준 JSON).
//   고치기는 지우지 않고 revises(그 측정법의 현재 root) + why 를 단 새 사건으로 — 마지막 사건이 현재 값, 앞 사건들이 바뀐 내력.
// 이 파일은 판정만 한다(읽기·쓰기 없음): 사슬 무결성 · 새 항목 검사(서기가 쓰기 전) · 현재 측정법의 참조.
// 측정법의 잡음은 측정 잡음(measurement_noise)뿐 — 화학(생물) 잡음은 계의 몫(엔진 SSA · τ-도약)이고, 측정 잡음은 엔진이 뽑지 않는다(RULE-0523 · DEC-0045).
'use strict';
const crypto = require('crypto');
const ATT = require('./attestation.js');
const V = require('../vocab.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const GENESIS = sha('assays\n');
const PROPOSAL_FIELDS = ['key', 'label', 'rung', 'principle', 'produces', 'measurement_noise', 'composed_of', 'separation', 'traceability', 'made', 'revises', 'why'];
// 사다리의 단 (측정법 계획 assay) — 단마다 값을 내는가. 계량·분리는 값을 내지 않는다(판독의 바탕·앞 단계 속성), 계산은 측정이 아니다
const RUNGS = {
  metrology:   { stage: 'ASY-08', label: '계량 기초 — 단위 · 교정 · 기준물질 · 불확도', values: false },
  readout:     { stage: 'ASY-01', label: '기초 판독 — 물리량을 직접 재는 원리', values: true },
  separation:  { stage: 'ASY-02', label: '기초 분리 — 판독의 앞 단계 속성 (혼자서는 값을 내지 않음)', values: false },
  combined:    { stage: 'ASY-03', label: '분리 + 판독 — 앞 단계 측정법의 조합', values: true, needs: ['readout', 'combined'] },
  interaction: { stage: 'ASY-04', label: '상호작용 — 결합 상수', values: true },
  cellular:    { stage: 'ASY-05', label: '세포 수준', values: true },
  computation: { stage: 'ASY-07', label: '계산 갈래 — 측정이 아님 (양자 계산 포함, DEC-0044)', values: true },
};
const SOURCE_DB = ['DOI', 'PMID', 'ISBN', 'URL'];
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const KEY = /^[a-z][a-z0-9_]{2,40}$/;

function verifyChain(events) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }; let prev = GENESIS;
  events.forEach((e, i) => {
    const { root, ...body } = e;
    if (e.seq !== i + 1) err('RULE-0506', `사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건`);
    if (e.prev !== prev) err('RULE-0506', `사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김`);
    if (root !== sha(body.prev + '\n' + ATT.canon(body))) err('RULE-0506', `사건 ${i + 1} (${e.key}): root 재계산 불일치 — 내용이 바뀜`);
    prev = root;
  });
  return { ok: !errors.length, errors, rules, head: prev };
}

// 측정법마다 현재 사건 (revises 사슬의 끝)
function current(events) {
  const cur = new Map(), errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); };
  for (const e of events) {
    const had = cur.get(e.key);
    if (had && e.revises !== had.root) err('RULE-0506', `${e.key} 사건 ${e.seq}: 이미 있는 측정법인데 revises 가 현재 root 가 아님`);
    if (!had && e.revises) err('RULE-0506', `${e.key} 사건 ${e.seq}: 없는 측정법을 revises`);
    cur.set(e.key, e);
  }
  return { cur, errors, rules };
}

// 항목 하나의 모양 — 새 항목 검사와 현재 측정법 재검사가 같이 쓴다. look(key) = 그 시점에 있는 측정법
function shape(p, at, look, err) {
  const R = 'RULE-0522';
  if (!KEY.test(p.key || '')) err(R, `${at}: key 는 소문자·숫자·밑줄 3–41 자 (예: uv_vis_absorbance)`);
  if (!nonEmpty(p.label)) err(R, `${at}: label(이름)이 없음`);
  const rung = RUNGS[p.rung];
  if (!rung) { err(R, `${at}: rung 은 사다리의 단 — ${Object.keys(RUNGS).join(' · ')}`); return; }
  if (!nonEmpty(p.principle)) err(R, `${at}: principle(무엇을 어떤 원리로 재나)이 없음`);
  const produces = Array.isArray(p.produces) ? p.produces : null, noise = Array.isArray(p.measurement_noise) ? p.measurement_noise : null;
  if (!produces) err(R, `${at}: produces 는 관찰 종류 목록 (값을 내지 않으면 [])`);
  else {
    for (const k of produces) if (!V.observables[k]) err(R, `${at}: produces 의 '${k}' 는 관찰 종류가 아님 — ${Object.keys(V.observables).join(' · ')}`);
    if (rung.values && !produces.length) err(R, `${at}: ${p.rung} 단은 값을 낸다 — produces 가 비었음`);
    if (!rung.values && produces.length) err(R, `${at}: ${p.rung} 단은 혼자서 값을 내지 않는다 (${rung.label}) — produces 는 []`);
  }
  if (!noise) err(R, `${at}: measurement_noise 는 측정 잡음 모형 목록 (값을 내지 않으면 []) — 화학(생물) 잡음은 계의 몫이라 측정법에 두지 않는다`);
  else {
    for (const m of noise) if (!V.noiseModels[m]) err(R, `${at}: measurement_noise 의 '${m}' 는 잡음 모형이 아님 — ${Object.keys(V.noiseModels).join(' · ')}`);
    if (produces && produces.length && !noise.length) err(R, `${at}: 값을 내는 측정법은 측정 잡음 모형이 하나 이상`);
  }
  const parts = Array.isArray(p.composed_of) ? p.composed_of : null;
  if (!parts) err(R, `${at}: composed_of 는 앞 단계 측정법 목록 (없으면 [])`);
  else {
    for (const k of parts) { if (k === p.key) err(R, `${at}: 자기 자신을 조합`); else if (!look(k)) err(R, `${at}: composed_of 의 '${k}' 는 장부에 없는 측정법`); }
    if (rung.needs && !parts.some((k) => look(k) && rung.needs.includes(look(k).rung))) err(R, `${at}: ${p.rung} 단은 판독(${rung.needs.join(' · ')})을 하나 이상 조합해야 함`);
  }
  if (p.separation != null) {
    if (!Array.isArray(p.separation)) err(R, `${at}: separation 은 분리 측정법 목록`);
    else for (const k of p.separation) { const s = look(k); if (!s) err(R, `${at}: separation 의 '${k}' 는 장부에 없는 측정법`); else if (s.rung !== 'separation') err(R, `${at}: separation 의 '${k}' 는 분리 단이 아님 (${s.rung})`); }
  }
  if (p.traceability != null && !nonEmpty(p.traceability)) err(R, `${at}: traceability 는 비지 않은 글 또는 없음`);
  const m = p.made;
  if (!m || typeof m !== 'object') { err(R, `${at}: made(어떻게 만들었나)가 없음 — { how, sources, alternatives, by }`); return; }
  if (!nonEmpty(m.how)) err(R, `${at}: made.how(무엇을 보고 어떻게 정했나)가 없음`);
  if (!nonEmpty(m.by)) err(R, `${at}: made.by(누가)가 없음`);
  if (!Array.isArray(m.sources) || !m.sources.length) err(R, `${at}: made.sources(근거 출처)가 하나 이상 — ${SOURCE_DB.join(' · ')}`);
  else for (const s of m.sources) if (!s || !SOURCE_DB.includes(s.db) || !nonEmpty(s.id)) err(R, `${at}: made.sources 의 { db: ${SOURCE_DB.join('|')}, id } 모양이 아님`);
  if (!Array.isArray(m.alternatives)) err(R, `${at}: made.alternatives(버린 대안과 이유)는 목록 — 없으면 []`);
  else for (const a of m.alternatives) if (!a || !nonEmpty(a.what) || !nonEmpty(a.why_not)) err(R, `${at}: made.alternatives 는 { what, why_not }`);
}

// 새 항목 검사 — 서기가 쓰기 전에. 통과해야 봉인이 ok
function checkProposals(events, proposals) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }, { cur } = current(events), next = new Map(cur);
  if (!Array.isArray(proposals) || !proposals.length) return { ok: false, errors: ['새 항목이 없음'], rules: ['RULE-0522'] };
  const mine = new Set();
  for (const [i, p] of proposals.entries()) {
    const at = `항목 ${i + 1}${p && p.key ? ` (${p.key})` : ''}`;
    if (!p || typeof p !== 'object') { err('RULE-0522', `${at}: 객체가 아님`); continue; }
    if ('noise' in p) err('RULE-0523', `${at}: noise 칸은 받지 않음 — 측정법에는 측정 잡음만(measurement_noise), 화학·생물 잡음은 계(엔진)의 몫`);
    const extra = Object.keys(p).filter((k) => !PROPOSAL_FIELDS.includes(k));
    if (extra.length) err('RULE-0522', `${at}: 받지 않는 칸 ${extra.join(', ')} (사슬 칸 seq·at·prev·root 는 서기가 붙인다)`);
    shape(p, at, (k) => next.get(k), err);
    const had = next.get(p.key);
    if (mine.has(p.key)) err('RULE-0522', `${at}: 같은 묶음에 같은 측정법이 둘`);
    mine.add(p.key);
    if (had && p.revises !== had.root) err('RULE-0522', `${at}: 이미 있는 측정법 — 고치려면 revises 에 현재 root (${String(had.root).slice(0, 12)}…)`);
    if (!had && p.revises != null) err('RULE-0522', `${at}: 없는 측정법을 revises`);
    if (had && !nonEmpty(p.why)) err('RULE-0522', `${at}: 고칠 때는 why(왜 바꾸나)가 필요 — 바뀐 내력이 사슬에 남는다`);
    next.set(p.key, { ...p, root: 'pending:' + i });
  }
  return { ok: !errors.length, errors, rules };
}

// 전체 판정 — 사슬 · revises · 현재 측정법마다 모양과 참조
function audit(events) {
  const chain = verifyChain(events), cr = current(events), errors = [...chain.errors, ...cr.errors], rules = [...chain.rules, ...cr.rules];
  for (const [k, e] of cr.cur) shape(e, k, (x) => cr.cur.get(x), (rule, m) => { errors.push(m); rules.push(rule); });
  return { ok: !errors.length, errors, rules, events: events.length, assays: cr.cur.size, head: chain.head, current: cr.cur };
}
function auditText(a) {
  const by = {}; for (const e of a.current.values()) (by[e.rung] = by[e.rung] || []).push(e.key);
  return [`# 측정법 장부 (data/assays.jsonl) — 사건 ${a.events} · 측정법 ${a.assays} · head ${String(a.head).slice(0, 12)}…`, '',
    ...Object.entries(RUNGS).map(([r, x]) => `- ${x.stage} ${r} (${x.label}): ${(by[r] || []).join(' · ') || '없음'}`), '',
    a.ok ? '판정: 통과' : `판정: 오류 ${a.errors.length}\n${a.errors.map((e) => '  ✗ ' + e).join('\n')}`, ''].join('\n');
}

module.exports = { GENESIS, PROPOSAL_FIELDS, RUNGS, verifyChain, current, checkProposals, audit, auditText };
