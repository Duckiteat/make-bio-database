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

// 통제 토큰 register: 이름 → vocab 테이블. gapTypes(8)·observables(6)·qualitativeExpectations(8).
// 이후 더할 것: faultChannels(judicial/fault.js — 모양 어댑터 필요)·obsUses·tiers 등.
const REGISTERS = { gapTypes: V.gapTypes, observables: V.observables, qualitativeExpectations: V.qualitativeExpectations };

// overlay(JSONL) 로드 — 한 줄 한 레코드. 권위는 정준 텍스트, 지금은 읽기 전용 커밋 파일(입법 구역·sha 봉인 배선은 다음 단계).
function loadOverlay() {
  const file = path.join(__dirname, 'data', 'dictionary.jsonl');
  const map = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('//')) continue;
    const o = JSON.parse(s);
    if (map.has(o.key)) throw new Error(`사전 중복 키: ${o.key}`);
    map.set(o.key, o);
  }
  return map;
}
const OVERLAY = loadOverlay();

// 병합 조회 — 미등록 토큰·overlay 누락은 error(추론으로 메우지 않음).
function entry(key) {
  const ov = OVERLAY.get(key);
  let reg = ov && ov.register, base = reg && REGISTERS[reg] && REGISTERS[reg][key];
  if (!base) for (const [r, t] of Object.entries(REGISTERS)) if (t[key]) { reg = r; base = t[key]; break; }
  if (!base) return { error: `사전 미등록 통제 토큰: '${key}'` };
  if (!ov) return { error: `사전 overlay 없음 (en 라벨·의미 미등록): '${key}'` };
  return {
    key, register: reg,
    label_en: ov.label_en, label_ko: base.label,
    meaning_en: ov.meaning_en, meaning_ko: base.note || null,
    xref: ov.xref || null, aliases: base.aliases || [], since: ov.since || null,
  };
}

function keys() { const out = []; for (const t of Object.values(REGISTERS)) out.push(...Object.keys(t)); return out; }

// 청중별 렌더 — both(병기)·en·ko. 결정론(같은 키 → 같은 문자열)이라 왕복 검증이 성립한다.
const AUD = {
  both: (e) => `${e.label_en} (${e.label_ko})`,
  en: (e) => e.label_en,
  ko: (e) => e.label_ko,
};
function renderToken(key, opt = {}) {
  const e = entry(key);
  if (e.error) throw new Error(e.error);
  const f = AUD[opt.audience || 'both'];
  if (!f) throw new Error(`audience 어휘 밖: '${opt.audience}' (both·en·ko)`);
  return f(e);
}

// 역색인: 렌더 문자열 → 키 (왕복 검증·사람 글에서 토큰 회수). 모든 키·청중에서 결정론으로 구축.
function reverseIndex() {
  const rev = new Map();
  for (const k of keys()) {
    const e = entry(k);
    if (e.error) continue;
    for (const a of Object.keys(AUD)) rev.set(AUD[a](e), k);
  }
  return rev;
}
const REV = reverseIndex();
function parseToken(str) {
  const k = REV.get(str);
  if (!k) throw new Error(`사전에 없는 렌더 문자열: '${str}'`);
  return k;
}

// 번역기 — R1 토큰은 조회(라벨 + 의미), R2 서술은 원문 통과(바이트 보존). 생성 없음.
//   record = { tokens: [key,...], narrative: "자유 서술" }
function translate(record, opt = {}) {
  const tokens = record.tokens || [];
  const lines = [];
  for (const k of tokens) {
    const e = entry(k);
    if (e.error) throw new Error(e.error);
    const meaning = (opt.audience === 'ko') ? (e.meaning_ko || e.meaning_en) : e.meaning_en;
    lines.push(`- ${renderToken(k, opt)} — ${meaning}`);
  }
  let out = lines.join('\n');
  if (record.narrative != null) out += (out ? '\n\n' : '') + record.narrative; // R2: 원문 그대로
  return out;
}

module.exports = { entry, keys, renderToken, parseToken, translate, registers: Object.keys(REGISTERS) };
