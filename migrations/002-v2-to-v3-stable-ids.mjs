#!/usr/bin/env node
// 형식 버전 2 → 3 변환: 이름이 곧 ID 이던 것을 의미 없는 고정 번호로 바꾼다 (2026-10-08, 1회성 — 기록용 보관)
//
//   피정의항 "글리코겐 인산화효소"   → T000xxx  (names.ko = 옛 이름, names.en = 영문 별칭 중 하나)
//   정의항   "글리코겐 인산화효소#1" → D000xxx  (term = T…, n = 옛 뜻 번호)
//   단계     "step:9"                → S000009
//   번호는 옛 파일에 나온 순서대로 배정한다. 옛 ID → 새 번호 대응표는 migrations/002-id-map.json 에 남긴다.
//   (data/patches/ 의 옛 기록은 옛 ID 로 적혀 있으므로 이 대응표로 읽는다)
//
// 사용: node migrations/002-v2-to-v3-stable-ids.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v2 = JSON.parse(readFileSync(path, 'utf8'));
if (v2.version !== 2) { console.error(`버전 ${v2.version} — 2 가 아니라 변환하지 않음`); process.exit(1); }

const pad = (p, n) => p + String(n).padStart(6, '0');
// 영문 이름 후보: 라틴 문자만, 소문자 포함, 4자 이상 (PKA·AC 같은 약어는 별칭으로 둔다)
const isEnglish = (s) => /^[A-Za-z][A-Za-z0-9 ,'()-]*$/.test(s) && /[a-z]/.test(s) && s.length >= 4;

const map = { terms: {}, senses: {}, steps: {} };
const v3 = { format: 'definition-db', version: 3, meta: { next: { T: 1, D: 1, S: 1 } }, terms: {}, senses: {}, steps: {} };
for (const [label, t] of Object.entries(v2.terms)) {
  const tid = pad('T', v3.meta.next.T++);
  map.terms[label] = tid;
  const en = t.aliases.find(isEnglish);
  v3.terms[tid] = { names: en ? { ko: label, en } : { ko: label }, aliases: t.aliases.filter((a) => a !== en), ...(t.note ? { note: t.note } : {}) };
  for (const d of t.definientia) map.senses[d.id] = pad('D', v3.meta.next.D++);
}
const D = (id) => { if (!map.senses[id]) throw new Error('대응 없음: ' + id); return map.senses[id]; };
for (const [label, t] of Object.entries(v2.terms)) for (const d of t.definientia) {
  const { id, ...rest } = d;
  v3.senses[D(id)] = { term: map.terms[label], n: parseInt(id.split('#').pop(), 10), ...rest,
    links: d.links.map((l) => ({ ...l, to: D(l.to) })),
    states: d.states.map((s) => ({ ...s, bound: s.bound.map(D) })) };
}
const stepIds = Object.keys(v2.steps).sort((a, b) => parseInt(a.slice(5), 10) - parseInt(b.slice(5), 10));
for (const old of stepIds) {
  const { id, ...st } = v2.steps[old];
  const sid = pad('S', parseInt(old.slice(5), 10));
  map.steps[old] = sid;
  const P = (p) => ({ ...p, ref: D(p.ref) });
  v3.steps[sid] = { ...st, agents: st.agents.map(P), inputs: st.inputs.map(P), outputs: st.outputs.map(P), regulators: st.regulators.map(P), part_of: st.part_of.map(D) };
}
v3.meta.next.S = 1 + Math.max(0, ...stepIds.map((s) => parseInt(s.slice(5), 10)));

const db = DefDB.normalize(v3);
const r = DefDB.validate(db);
for (const e of r.errors) console.log(`오류  ${e.where}: ${e.msg}`);
for (const w of r.warnings) console.log(`경고  ${w.where}: ${w.msg}`);
if (r.errors.length) { console.error(`오류 ${r.errors.length} — 저장하지 않음`); process.exit(1); }
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
writeFileSync(join(dirname(new URL(import.meta.url).pathname), '002-id-map.json'), JSON.stringify(map, null, 2) + '\n');
console.log(`변환 완료: ${path} — 개념 ${Object.keys(db.terms).length}, 정의항 ${Object.keys(db.senses).length}, 단계 ${Object.keys(db.steps).length} (경고 ${r.warnings.length})`);
