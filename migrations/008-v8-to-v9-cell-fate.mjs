#!/usr/bin/env node
// 형식 버전 8 → 9 변환: 세포 운명 층 (2026-10-08, 1회성). docs/design/cell-fate-engine.md
//   새 것: kind cell_state(signature · metabolome · transitions), 규칙 종류 modulation(대상 규칙의 힐 배율), 속도 법칙 hill(K · n · fmax | fmin),
//   외부 ID CL, 한계 종류 Regulatory_Gap. 기존 데이터에는 이 필드가 없으므로 버전만 올리고 검사한다.
// 사용: node migrations/008-v8-to-v9-cell-fate.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v8 = JSON.parse(readFileSync(path, 'utf8'));
if (v8.version !== 8) { console.error(`버전 ${v8.version} — 8 이 아니라 변환하지 않음`); process.exit(1); }
const db = DefDB.normalize({ ...v8, version: 9 });
const { errors } = DefDB.validate(db);
for (const e of errors) console.error('오류', e.where, e.msg);
if (errors.length) process.exit(1);
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`변환 완료 (v9): 정의항 ${Object.keys(db.senses).length}, 변경 필드 없음`);
