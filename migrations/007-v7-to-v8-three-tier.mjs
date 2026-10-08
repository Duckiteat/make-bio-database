#!/usr/bin/env node
// 형식 버전 7 → 8 변환: 3 층 다중 규모 엔진 (2026-10-08, 1회성). docs/design/hybrid-multiscale-engine.md
//   새 필드: 정의항 tier(T1 연속 장 | T2 규칙 행위자 — 분자 종류 필수), 관찰 diffusion_coefficient·pH·ionic_strength·relative_permittivity,
//   속도 필드 k0·dG_act·dG0·env. 이 스크립트는 기존 분자 종류 정의항에 tier 를 정한다:
//     저분자·이온·고분자 물질 → T1, 단백질·복합체·핵산 → T2,
//     분자 부류 → 부위·전이/공급 규칙이 없고 대사물로만 쓰이는 것(변환 기질·산물, with, 공급, 재활용 단위)은 T1, 나머지(효소 부류 등)는 T2.
// 사용: node migrations/007-v7-to-v8-three-tier.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v7 = JSON.parse(readFileSync(path, 'utf8'));
if (v7.version !== 7) { console.error(`버전 ${v7.version} — 7 이 아니라 변환하지 않음`); process.exit(1); }
const metabolite = new Set();
for (const d of Object.values(v7.senses)) for (const r of d.rule || []) {
  const e = r.effect || {};
  for (const x of [...(e.consumes || []), ...(e.produces || []), ...(r.with ? [...(r.with.consumes || []), ...(r.with.produces || [])] : [])]) metabolite.add(x);
  for (const k of ['consumes', 'produces', 'recycle_to']) for (const q of r[k] || []) metabolite.add(typeof q === 'string' ? q : q.ref);
}
const assigned = { T1: [], T2: [] };
for (const [id, d] of Object.entries(v7.senses)) {
  const kind = d.kind, K = DefDB.VOCAB.kinds[kind];
  if (!K || !K.participant || d.tier) continue;
  let t = DefDB.defaultTier(d);
  if (!t) { // molecule_class
    const active = (d.rule || []).some((r) => r.type !== 'meaning') || Object.keys(d.site || {}).length;
    t = !active && metabolite.has(id) ? 'T1' : 'T2';
  }
  d.tier = t; assigned[t].push(id);
}
const db = DefDB.normalize({ ...v7, version: 8 });
const { errors } = DefDB.validate(db);
for (const e of errors) console.error('오류', e.where, e.msg);
if (errors.length) process.exit(1);
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`변환 완료 (v8): T1 ${assigned.T1.length}, T2 ${assigned.T2.length}`);
console.log('T1 분자 부류:', assigned.T1.filter((id) => v7.senses[id].kind === 'molecule_class').join(' '));
