'use strict';
// 사전 — 기계 키 ↔ 사람말 (표현 층 1급화, build-plan 16A · 설계 docs/design/dictionary-and-translation.md)
//
// 읽기 전용: 조회·렌더만 한다 (쓰기·판정·엔진 호출 없음 — 행정/사법 권한 밖의 순수 표현 층).
// 핵심 규칙: **번역기는 조회(lookup)하지 추론(infer)하지 않는다.**
//   R1 통제어(열거 가능한 토큰) = 사전 테이블 조회 → 결정론·감사 가능.
//   R2 추론 서술(자유어) = 원문 통과(pass-through), 생성 금지.
// 통제 토큰의 ko 의미는 vocab.js(권위)에서, en 라벨·의미·xref 는 data/dictionary.jsonl(overlay)에서 병합한다.
// 사실을 두 곳에 복제하지 않는다: ko = vocab, en·xref·since = overlay, 각 한 소스.
const { readFileSync } = require('fs');
const path = require('path');
const V = require('./vocab.js');

// 통제 토큰 register: 이름 → vocab 테이블. 사전은 vocab 만 읽는다(사법·행정 모듈을 부르지 않음 — 어느 층이 써도 우회로가 아니다).
// 토큰 신원 = register + key. 키는 register 안에서만 유일하다(match 는 정성 판정과 추세 판정 모두에 있다) —
// 한 register 에만 있는 키는 그냥 'key' 로, 여럿에 있으면 'register/key' 로 부른다(모호하면 오류, 고르지 않는다).
const REGISTERS = {
  gapTypes: V.gapTypes, observables: V.observables, qualitativeExpectations: V.qualitativeExpectations,
  conservationClasses: V.conservationClasses, conservationReasons: V.conservationReasons,
  closureMethods: V.closureMethods, judgmentLevels: V.judgmentLevels, faultChannels: V.faultChannels,
  bundleRoles: V.bundleRoles, hierarchyUp: V.hierarchyUp, hierarchyDown: V.hierarchyDown, contextRoles: V.contextRoles,
  qualGraphVerdicts: V.qualGraphVerdicts, qualOutcomes: V.qualOutcomes, trendVerdicts: V.trendVerdicts,
  stiffnessFlags: V.stiffnessFlags, kineticParams: V.kineticParams,
  sourceScale: V.sourceScale, dataScale: V.dataScale, reliabilityGrades: V.reliabilityGrades,
};
const qid = (reg, key) => `${reg}/${key}`;

// overlay(JSONL) 로드 — 추가만 하는 사슬(한 줄 한 사건). 같은 토큰의 뒤 사건(revises)이 현재 값이다.
//   사슬 무결성·revises·덮임 판정은 사법부(judicial/dictionary_audit.js), 쓰기는 입법 서기(appendDictionary)만 — 여기서는 읽기만.
function loadOverlay() {
  const file = path.join(__dirname, 'data', 'dictionary.jsonl');
  const map = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('//')) continue;
    const o = JSON.parse(s);
    if (!REGISTERS[o.register]) throw new Error(`사전 overlay 의 register 어휘 밖: '${o.register}' (${o.key})`);
    map.set(qid(o.register, o.key), o); // 마지막 사건이 현재 값
  }
  return map;
}
const OVERLAY = loadOverlay();

// 토큰 → (register, key). 'register/key' 는 그대로, 맨 key 는 그 키를 가진 register 가 하나일 때만.
function resolve(token, reg) {
  let key = String(token);
  if (!reg && key.includes('/')) { const i = key.indexOf('/'); if (REGISTERS[key.slice(0, i)]) { reg = key.slice(0, i); key = key.slice(i + 1); } }
  if (reg) return REGISTERS[reg] && Object.prototype.hasOwnProperty.call(REGISTERS[reg], key) ? { reg, key } : { error: `사전 미등록 통제 토큰: '${qid(reg, key)}'` };
  const hits = Object.keys(REGISTERS).filter((r) => Object.prototype.hasOwnProperty.call(REGISTERS[r], key));
  if (!hits.length) return { error: `사전 미등록 통제 토큰: '${key}'` };
  if (hits.length > 1) return { error: `모호한 통제 토큰 '${key}' — register 를 지정한다 (${hits.map((r) => qid(r, key)).join(' · ')})` };
  return { reg: hits[0], key };
}

// 병합 조회 — 미등록·모호·overlay 누락은 error(추론으로 메우지 않음).
function entry(token, opt = {}) {
  const r = resolve(token, opt.register);
  if (r.error) return { error: r.error };
  const base = REGISTERS[r.reg][r.key], ov = OVERLAY.get(qid(r.reg, r.key));
  if (!ov) return { error: `사전 overlay 없음 (en 라벨·의미 미등록): '${qid(r.reg, r.key)}'` };
  return {
    key: r.key, register: r.reg, id: qid(r.reg, r.key),
    label_en: ov.label_en, label_ko: base.label,
    meaning_en: ov.meaning_en, meaning_ko: base.note || null,
    xref: ov.xref || null, aliases: base.aliases || [], since: ov.since || null,
  };
}

// 모든 토큰의 정준 신원 'register/key'
function keys() { const out = []; for (const [r, t] of Object.entries(REGISTERS)) for (const k of Object.keys(t)) out.push(qid(r, k)); return out; }

// 청중별 렌더 — both(병기)·en·ko. 결정론(같은 토큰 → 같은 문자열)이라 왕복 검증이 성립한다.
const AUD = {
  both: (e) => `${e.label_en} (${e.label_ko})`,
  en: (e) => e.label_en,
  ko: (e) => e.label_ko,
};
function renderToken(token, opt = {}) {
  const e = entry(token, opt);
  if (e.error) throw new Error(e.error);
  const f = AUD[opt.audience || 'both'];
  if (!f) throw new Error(`audience 어휘 밖: '${opt.audience}' (both·en·ko)`);
  return f(e);
}

// 역색인: 렌더 문자열 → 'register/key'. 같은 문자열이 두 토큰에서 나오면 그 문자열은 회수 불가(모호) — 고르지 않는다.
function reverseIndex() {
  const rev = new Map(), amb = new Set();
  for (const id of keys()) {
    const e = entry(id);
    if (e.error) continue;
    for (const a of Object.keys(AUD)) { const s = AUD[a](e); if (rev.has(s) && rev.get(s) !== id) amb.add(s); else rev.set(s, id); }
  }
  for (const s of amb) rev.delete(s);
  return { rev, amb };
}
const { rev: REV, amb: AMB } = reverseIndex();
function parseToken(str) {
  if (AMB.has(str)) throw new Error(`모호한 렌더 문자열: '${str}' — 두 토큰이 같은 라벨을 쓴다`);
  const k = REV.get(str);
  if (!k) throw new Error(`사전에 없는 렌더 문자열: '${str}'`);
  return k;
}

// 라벨러 — core.js 번역 함수에 주입하는 (표 이름, 키) → 문자열. 행정부는 사전을 부르지 않고 이것을 받기만 한다.
//   ko: vocab 라벨(기본 출력과 같음) · en·both: 사전 overlay 가 있는 토큰만 영어로, 없으면 한글 + '[en 미등록]' — 영어를 지어내지 않는다.
//   vocab 표에 없는 키는 키 그대로(기본 출력과 같음 — 미등록 토큰 거부는 관문의 몫).
function labeler(opt = {}) {
  const aud = opt.audience || 'ko';
  if (!AUD[aud]) throw new Error(`audience 어휘 밖: '${aud}' (both·en·ko)`);
  return (table, key) => {
    const base = V[table] && V[table][key];
    if (!base) return key;
    const ko = base.label || key;
    if (aud === 'ko') return ko;
    const ov = REGISTERS[table] && OVERLAY.get(qid(table, key));
    if (!ov) return `${ko} [en 미등록]`;
    return AUD[aud]({ label_en: ov.label_en, label_ko: ko });
  };
}

// 번역기 — R1 토큰은 조회(라벨 + 의미), R2 서술은 원문 통과(바이트 보존). 생성 없음.
//   record = { tokens: [key,...], narrative: "자유 서술" }
function translate(record, opt = {}) {
  const tokens = record.tokens || [];
  const lines = [];
  for (const k of tokens) {
    const e = entry(k, opt);
    if (e.error) throw new Error(e.error);
    const meaning = (opt.audience === 'ko') ? (e.meaning_ko || e.meaning_en) : e.meaning_en;
    lines.push(`- ${renderToken(k, opt)} — ${meaning}`);
  }
  let out = lines.join('\n');
  if (record.narrative != null) out += (out ? '\n\n' : '') + record.narrative; // R2: 원문 그대로
  return out;
}

module.exports = { entry, keys, renderToken, parseToken, translate, labeler, ambiguousRenders: () => [...AMB], registers: Object.keys(REGISTERS) };
