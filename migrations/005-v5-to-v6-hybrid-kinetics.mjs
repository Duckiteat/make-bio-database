#!/usr/bin/env node
// 형식 버전 5 → 6 변환: 규칙의 반응 속도(kinetics)와 부위의 구조 참조(structure) 필드, 한계 해결 경로 kinetics 가 생겼다 (2026-10-08, 1회성).
//   기존 데이터는 바뀌지 않는다(새 필드는 비어 있음). 버전 번호만 올린다.
// 사용: node migrations/005-v5-to-v6-hybrid-kinetics.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v5 = JSON.parse(readFileSync(path, 'utf8'));
if (v5.version !== 5) { console.error(`버전 ${v5.version} — 5 가 아니라 변환하지 않음`); process.exit(1); }
const db = DefDB.normalize({ ...v5, version: 6 });
const { errors } = DefDB.validate(db);
for (const e of errors) console.error('오류', e.where, e.msg);
if (errors.length) process.exit(1);
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log('변환 완료 (v6)');
