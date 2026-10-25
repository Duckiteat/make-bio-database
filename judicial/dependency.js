// 사법부 — 결론의 의존 기록과 재검증 판정 (build-plan 13 · 설계 dictionary-and-translation §10′ 연쇄 재검증)
//
// 보고서·결론이 기댄 것(값 V… · 관찰 O…)을 생성 때 지문으로 남기고, 나중 db 와 대조해 '재검증 필요' 를 표시한다.
//   - 하드 차단이 아니라 라벨이다(무효화 폭풍 방지) — 관문의 철회 차단(checkKineticsFrom)은 그대로 둔다.
//   - 무엇이 바뀌었나에 키잉: 값은 기록 번호가 아니라 **내용**(대상·속성·값·단위·맥락)으로 본다. 메모(R2) 오타로 기록이 대체돼도
//     내용이 같으면 재검증이 아니다. 관찰은 바뀌지 않는 기록이라(철회 표시만) 철회 여부만 본다.
// 판정만 한다 — 읽기·쓰기·엔진 없음. 의존을 고르는 쪽(보고서)이 무엇을 넘길지 정한다.
'use strict';
const crypto = require('crypto');
const M = require('../model.js');
const { canon } = require('./attestation.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const valueDigest = (v) => sha(canon({ subject: v.subject, property: v.property, value: v.value, unit: v.unit || null, context: v.context || {} })).slice(0, 16);

// 의존 지문: subjects(값을 찾을 대상 — 규칙 ref·정의항) 의 현재 값 + 관찰 번호
function dependencies(db, { subjects = [], observations = [] } = {}) {
  db = M.normalize(db);
  const live = M.currentValues(db), values = [];
  for (const s of [...new Set(subjects)].sort()) for (const [id, v] of live.get(s) || []) values.push({ id, subject: v.subject, property: v.property, digest: valueDigest(v) });
  const obs = [...new Set(observations)].sort().map((id) => ({ id, retracted: !!((db.observations || {})[id] || {}).retracted }));
  const out = { values, observations: obs };
  out.digest = sha(canon(out)).slice(0, 16);
  return out;
}

// 재검증: 기록된 의존을 지금 db 와 대조. status = same | same_content(기록만 대체) | changed | retracted | missing
function recheck(db, deps) {
  db = M.normalize(db);
  const live = M.currentValues(db), rows = [];
  for (const d of (deps && deps.values) || []) {
    const cur = (live.get(d.subject) || []).filter(([, v]) => v.property === d.property);
    const rec = (db.values || {})[d.id];
    let status;
    if (cur.some(([id]) => id === d.id)) status = 'same';
    else if (cur.some(([, v]) => valueDigest(v) === d.digest)) status = 'same_content';
    else if (!cur.length && rec && rec.retracted) status = 'retracted';
    else if (!cur.length) status = 'missing';
    else status = 'changed';
    rows.push({ kind: 'value', id: d.id, subject: d.subject, property: d.property, status, now: cur.map(([id]) => id) });
  }
  for (const o of (deps && deps.observations) || []) {
    const rec = (db.observations || {})[o.id];
    rows.push({ kind: 'observation', id: o.id, status: !rec ? 'missing' : rec.retracted ? 'retracted' : 'same', note: rec && rec.retracted ? rec.retracted.note || '' : '' });
  }
  const bad = rows.filter((r) => !['same', 'same_content'].includes(r.status));
  return { rows, revalidate: bad.length > 0, bad };
}
const STATUS_KO = { same: '같음', same_content: '같음(기록만 대체 — 내용 같음)', changed: '값이 바뀜', retracted: '근거 철회됨', missing: '없음' };
function recheckText(r, name) {
  if (!r.rows.length) return `${name || '보고서'}: 기록된 의존 없음`;
  if (!r.revalidate) return `${name || '보고서'}: 근거 그대로 — 의존 ${r.rows.length} 모두 같음`;
  return [`${name || '보고서'}: **재검증 필요** — 의존 ${r.rows.length} 중 ${r.bad.length} 바뀜`, ...r.bad.map((b) => `  ✗ ${b.kind === 'value' ? `값 ${b.id} (${b.subject} · ${b.property})` : `관찰 ${b.id}`}: ${STATUS_KO[b.status]}${b.now && b.now.length ? ` → 지금 ${b.now.join(', ')}` : ''}${b.note ? ` — ${b.note}` : ''}`)].join('\n');
}

// 보고서 마크다운에 싣는 기계 판독 블록 (R1) — 사람에겐 보이지 않는 주석
const DEPS_RE = /<!-- evidence-deps: (\{.*?\}) -->/s;
const depsBlock = (deps) => `<!-- evidence-deps: ${JSON.stringify(deps)} -->`;
const parseDepsBlock = (md) => { const m = DEPS_RE.exec(md || ''); return m ? JSON.parse(m[1]) : null; };

module.exports = { dependencies, recheck, recheckText, valueDigest, depsBlock, parseDepsBlock, STATUS_KO };
