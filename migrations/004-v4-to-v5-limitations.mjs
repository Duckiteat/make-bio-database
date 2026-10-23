#!/usr/bin/env node
// 형식 버전 4 → 5 변환: 한계 등록부(limitations, 번호 L…)를 추가한다 (2026-10-08, 1회성 — 기록용 보관).
//   데이터 내용은 바뀌지 않는다. 빈 limitations 와 meta.next.L 만 더한다. 한계는 이후 패치로 등록한다.
// 사용: node migrations/004-v4-to-v5-limitations.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v4 = JSON.parse(readFileSync(path, 'utf8'));
if (v4.version !== 4) { console.error(`버전 ${v4.version} — 4 가 아니라 변환하지 않음`); process.exit(1); }
const db = DefDB.normalize({ ...v4, version: 5, meta: { next: { ...v4.meta.next, L: 1 } }, limitations: {} });
const { errors, warnings } = createRequire(import.meta.url)('../judicial/judicial.js').validate(db) /* 검사는 사법부 (삼권 분립) */;
for (const e of errors) console.error('오류', e.where, e.msg);
if (errors.length) process.exit(1);
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`변환 완료 (v5): 정의항 ${Object.keys(db.senses).length}, 단계 ${Object.keys(db.steps).length}, 경고 ${warnings.length}`);
