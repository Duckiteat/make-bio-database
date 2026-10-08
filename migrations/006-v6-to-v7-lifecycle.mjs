#!/usr/bin/env node
// 형식 버전 6 → 7 변환: 생애 주기·대사물 저장소 (2026-10-08, 1회성).
//   새 필드: 규칙 종류 supply(대사물 공급)·degradation(분해), 정의항 moieties(부분 구조), 부위 ligands(특징별 리간드),
//   속도 법칙 zero_order, 속도 필드 half_life, 관찰 sequence_length. 기존 데이터는 바뀌지 않는다(새 필드는 비어 있음). 버전 번호만 올린다.
// 사용: node migrations/006-v6-to-v7-lifecycle.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v6 = JSON.parse(readFileSync(path, 'utf8'));
if (v6.version !== 6) { console.error(`버전 ${v6.version} — 6 이 아니라 변환하지 않음`); process.exit(1); }
const db = DefDB.normalize({ ...v6, version: 7 });
const { errors } = DefDB.validate(db);
for (const e of errors) console.error('오류', e.where, e.msg);
if (errors.length) process.exit(1);
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log('변환 완료 (v7)');
