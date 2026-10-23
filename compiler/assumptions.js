// 컴파일러 — 가정 원장 풀기 (build-plan 49 · 설계 docs/design/structure-realignment.md §3)
//
// 시나리오의 가상 숫자는 가정 원장(data/assumptions.jsonl)의 번호 A… 로 가리킨다: 숫자 자리에 { "assume": "A000001" }.
// 이 모듈은 순수하다(파일·쓰기·판정·엔진 없음): 원장 사건 목록을 받아 번호를 숫자로 풀고, 무엇을 썼는지 돌려준다.
//
// 연결 규약 (고쳐 쓰지 않음):
//   · 번호는 늘 그 기록 하나를 가리킨다 — '최신 것 따라가기' 없음. revises 는 표시일 뿐 풀기가 따라가지 않는다.
//   · 기록의 자리(slot)와 놓인 자리가 다르면 거부 — 번호를 다른 칸에 옮겨 붙이지 못한다.
//   · 풀린 시나리오는 숫자만 담으므로 등록 해시(풀린 내용)가 번호의 내용까지 고정한다.
'use strict';
const M = require('../model.js');

// 자리 종류 → 숫자가 사는 곳·단위 (동작 표 — 라벨은 vocab.assumptionSlots)
const KIN = M.KIN_VALUE_FIELDS;
const COUNT = 'molecules';
const UNIT = {
  kinetics: () => null, // 법칙마다 SI 차원이 달라 단위 문자열을 두지 않는다 (규칙 kinetics 와 같은 규약)
  amounts: () => COUNT, reservoirs: () => COUNT, thresholds: () => COUNT, signals: () => COUNT,
  buffered: (param) => (param === 'conc_M' ? 'M' : COUNT),
  volumes: () => undefined, // 시나리오가 적은 단위를 그대로 (기록과 같아야 함)
};
const KINDS = Object.keys(UNIT);
const BUFFERED = ['conc_M', 'total'], BOUNDS = ['low', 'high'];
const paramOk = (kind, param) => {
  if (kind === 'kinetics') return KIN.includes(param);
  if (kind === 'thresholds') return BOUNDS.includes(param);
  if (kind === 'buffered') return BUFFERED.includes(param);
  if (kind === 'signals') return /^n@-?\d+(\.\d+)?(e[+-]?\d+)?$/.test(String(param));
  if (kind === 'volumes') return param === 'value';
  return param === 'n';
};

const isRef = (x) => !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 1 && typeof x.assume === 'string';
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

// 시나리오의 숫자 자리 전부 (숫자 또는 번호) — { kind, key, param, cell, unit, path, value }
function slots(sc) {
  const out = [], s = sc || {};
  const push = (kind, key, param, holder, field, extra) => {
    const v = holder[field];
    if (isNum(v) || isRef(v)) out.push({ kind, key, param, cell: null, unit: UNIT[kind](param), holder, field, value: v, ...(extra || {}) });
  };
  for (const [ref, k] of Object.entries(s.kinetics || {})) if (k && typeof k === 'object') for (const f of KIN) push('kinetics', ref, f, k, f);
  for (const kind of ['amounts', 'reservoirs']) for (const key of Object.keys(s[kind] || {})) push(kind, key, 'n', s[kind], key);
  for (const [key, t] of Object.entries(s.thresholds || {})) if (t && typeof t === 'object') for (const f of BOUNDS) push('thresholds', key, f, t, f);
  for (const [key, b] of Object.entries(s.buffered || {})) if (b && typeof b === 'object') for (const f of BUFFERED) push('buffered', key, f, b, f);
  for (const [key, list] of Object.entries(s.signals || {})) if (Array.isArray(list)) for (const p of list) if (p && typeof p === 'object') push('signals', key, `n@${p.t}`, p, 'n');
  // 부피는 세포마다 다른 가정이다 (같은 위치·같은 값이라도 세포가 다르면 다른 기록)
  for (const [key, v] of Object.entries(s.volumes || {})) if (v && typeof v === 'object') push('volumes', key, 'value', v, 'value', { cell: s.cell || null, unit: v.unit });
  return out;
}

const slotKey = (x) => `${x.kind}|${x.key}|${x.param}|${x.cell || ''}`;
const sameSlot = (rec, at) => rec.slot && rec.slot.kind === at.kind && rec.slot.key === at.key && String(rec.slot.param) === String(at.param) && (rec.slot.cell || null) === (at.cell || null);
const byId = (events) => new Map((events || []).map((e) => [e.id, e]));

// 번호 → 숫자. 번호가 없으면 같은 객체를 그대로 돌려준다 (등록된 인라인 시나리오는 비트 그대로)
function resolve(sc, events) {
  const probe = slots(sc);
  if (!probe.some((x) => isRef(x.value))) return { scenario: sc, used: [] };
  const copy = JSON.parse(JSON.stringify(sc)), ids = byId(events), used = [], errors = [];
  for (const at of slots(copy)) {
    if (!isRef(at.value)) continue;
    const id = at.value.assume, rec = ids.get(id), where = `${at.kind} ${at.key} · ${at.param}${at.cell ? ` (${at.cell})` : ''}`;
    if (!rec) { errors.push(`${where}: 가정 ${id} 이 원장에 없음`); continue; }
    if (!sameSlot(rec, at)) { errors.push(`${where}: 가정 ${id} 은 다른 자리(${slotKey(rec.slot)})의 기록 — 번호를 옮겨 붙일 수 없음`); continue; }
    if (at.kind !== 'kinetics' && (rec.unit ?? null) !== (at.unit ?? null)) { errors.push(`${where}: 단위가 다름 — 기록 ${rec.unit} · 시나리오 ${at.unit}`); continue; }
    at.holder[at.field] = rec.value;
    used.push({ id, kind: at.kind, key: at.key, param: at.param, cell: at.cell });
  }
  if (errors.length) return { error: errors.join('\n') };
  return { scenario: copy, used };
}

module.exports = { slots, resolve, isRef, paramOk, slotKey, sameSlot, byId, KINDS, UNIT };
