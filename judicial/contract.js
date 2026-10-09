// 사법부 — 원자료 계약 검사 (FFI Contract Check). docs/design/engine-port-roadmap.md 0단계
//
// 행정부(JS 엔진이든 Rust/WASM 엔진이든)가 낸 원자료가 schemas/ffi/*.schema.json 계약을 지키는지 판정한다.
//   ① JSON Schema 2020-12 의 부분 집합: type · enum · const · pattern · minimum/maximum(exclusive 포함) · required ·
//      properties · additionalProperties · items · prefixItems · minItems/maxItems · anyOf · $ref(#/$defs/…).
//      숫자 배열은 Array 와 Float64Array(타입 배열) 를 모두 'array' 로 본다 (WASM 메모리 뷰를 그대로 검사).
//   ② x-dimensions: 배열 길이의 상호 관계 (기록점 수·묶음 수·규칙 수·신호 수)와 묶음 참조 ∈ keys.
// 의존성 없는 순수 판정 — 엔진을 부르지 않고 쓰지 않는다.
'use strict';
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'schemas', 'ffi');
const cache = new Map();
const loadSchema = (name) => { if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8'))); return cache.get(name); };

const isArr = (v) => Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView));
const typeOf = (v) => (v === null ? 'null' : isArr(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v);
const typeOK = (v, t) => { const a = typeOf(v); return t === a || (t === 'number' && a === 'integer'); };

// 스키마 부분 집합 검사 — 위반 목록 [{ path, msg }]
function check(v, s, root, p, out) {
  if (s.$ref) { const m = s.$ref.match(/^#\/\$defs\/(.+)$/); if (!m || !root.$defs[m[1]]) { out.push({ path: p, msg: `알 수 없는 $ref ${s.$ref}` }); return; } return check(v, root.$defs[m[1]], root, p, out); }
  if (s.anyOf) { if (!s.anyOf.some((x) => { const o = []; check(v, x, root, p, o); return !o.length; })) out.push({ path: p, msg: 'anyOf 중 맞는 것이 없음' }); return; }
  if (s.type) { const ts = [].concat(s.type); if (!ts.some((t) => typeOK(v, t))) { out.push({ path: p, msg: `형 ${typeOf(v)} ≠ ${ts.join('|')}` }); return; } }
  if (s.enum && !s.enum.some((e) => e === v)) out.push({ path: p, msg: `값 ${JSON.stringify(v)} ∉ ${JSON.stringify(s.enum)}` });
  if ('const' in s && s.const !== v) out.push({ path: p, msg: `값 ≠ ${JSON.stringify(s.const)}` });
  if (typeof v === 'string' && s.pattern && !new RegExp(s.pattern).test(v)) out.push({ path: p, msg: `'${v}' 가 형식 ${s.pattern} 에 맞지 않음` });
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push({ path: p, msg: `유한하지 않은 수 ${v}` });
    if (s.minimum != null && v < s.minimum) out.push({ path: p, msg: `${v} < 최소 ${s.minimum}` });
    if (s.maximum != null && v > s.maximum) out.push({ path: p, msg: `${v} > 최대 ${s.maximum}` });
    if (s.exclusiveMinimum != null && !(v > s.exclusiveMinimum)) out.push({ path: p, msg: `${v} ≤ ${s.exclusiveMinimum}` });
  }
  if (isArr(v)) {
    if (s.minItems != null && v.length < s.minItems) out.push({ path: p, msg: `길이 ${v.length} < ${s.minItems}` });
    if (s.maxItems != null && v.length > s.maxItems) out.push({ path: p, msg: `길이 ${v.length} > ${s.maxItems}` });
    const pre = s.prefixItems || [];
    for (let i = 0; i < v.length && out.length < 50; i++) { const it = i < pre.length ? pre[i] : s.items; if (it) check(v[i], it, root, `${p}[${i}]`, out); }
  } else if (v && typeof v === 'object') {
    for (const k of s.required || []) if (!(k in v)) out.push({ path: p, msg: `필수 필드 '${k}' 없음` });
    for (const [k, x] of Object.entries(v)) {
      if (s.properties && k in s.properties) check(x, s.properties[k], root, `${p}.${k}`, out);
      else if (s.additionalProperties === false) out.push({ path: `${p}.${k}`, msg: '계약에 없는 필드 (판결 필드는 사법부만 만든다)' });
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') check(x, s.additionalProperties, root, `${p}.${k}`, out);
      if (out.length >= 50) return;
    }
  }
}

// x-dimensions (운명 원자료): 길이 관계와 묶음 참조
function dimensionsFate(r) {
  const out = [], E = (msg) => out.push({ path: 'x-dimensions', msg }), P = r.process || {}, nB = (r.keys || []).length, nR = (P.ruleInfo || []).length, nT = (r.series || []).length;
  const same = [['trajectory', r.trajectory], ['process.times', P.times], ['process.lo', P.lo], ['process.cumDD', P.cumDD], ['process.cum', P.cum], ['process.sig', P.sig], ['process.gateEvents', P.gateEvents]];
  for (const [n, a] of same) if (!a || a.length !== nT) E(`${n} 길이 ${a ? a.length : '없음'} ≠ series 길이 ${nT}`);
  const rowLen = (name, a, want) => { if (!a) return; for (let j = 0; j < a.length; j++) if (!a[j] || a[j].length !== want) { E(`${name}[${j}] 길이 ${a[j] ? a[j].length : '없음'} ≠ ${want}`); return; } };
  rowLen('series', r.series, nB); rowLen('process.lo', P.lo, nB); rowLen('process.cumDD', P.cumDD, 2 * nR); rowLen('process.cum', P.cum, nR); rowLen('process.sig', P.sig, (P.schedule || []).length);
  if (!P.N0 || P.N0.length !== nB) E(`process.N0 길이 ≠ keys 길이 ${nB}`);
  if ((r.rules || []).length !== nR) E(`rules 길이 ${(r.rules || []).length} ≠ ruleInfo 길이 ${nR}`);
  if ((P.signalIdx || []).length !== (P.schedule || []).length) E('signalIdx 길이 ≠ schedule 길이');
  (P.schedule || []).forEach((s, q) => { if ((r.keys || []).indexOf(s.bundle) !== (P.signalIdx || [])[q]) E(`signalIdx[${q}] 가 keys 의 ${s.bundle} 위치가 아님`); });
  const T = P.times || []; for (let j = 1; j < T.length; j++) if (!(T[j] > T[j - 1])) { E(`process.times 가 증가하지 않음 (${j})`); break; }
  if (T.length && T[T.length - 1] > r.t_end + r.dt + 1e-9) E('process.times 마지막 값 > t_end + dt');
  const K = new Set(r.keys || []), ref = (where, b) => { if (!K.has(b)) E(`${where} 의 묶음 ${b} ∉ keys`); };
  for (const b of [...(r.markers || []), ...(r.signals || [])]) ref('markers/signals', b);
  for (const b of Object.keys((r.final || {}).N || {})) ref('final.N', b);
  for (const b of Object.keys(r.reservoirs || {})) ref('reservoirs', b);
  for (const e of r.events || []) ref('events', e.bundle);
  for (const R of P.ruleInfo || []) { for (const [b] of [...(R.cons || []), ...(R.prods || [])]) ref(`ruleInfo ${R.ref}`, b); for (const m of R.mods || []) ref(`ruleInfo ${R.ref} mods`, m.bundle); }
  return out;
}

// 운명 원자료 계약 판정: { ok, violations }
function checkFateRaw(r) {
  const schema = loadSchema('fate-raw.schema.json'), out = [];
  check(r, schema, schema, '$', out);
  if (!out.length) out.push(...dimensionsFate(r));
  return { ok: !out.length, violations: out.slice(0, 50), schema: schema.$id };
}

module.exports = { checkFateRaw, check, loadSchema, dimensionsFate };
