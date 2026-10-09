#!/usr/bin/env node
// 형식 버전 9 → 10 변환: 관찰 기록 (2026-10-09, 1회성). docs/design/observation-port.md · engine-port-roadmap.md §10
//   새 것: 최상위 observations { O… } (측정량·SI 값·불확도·반복 수·조건·보정·출처·용도), meta.next.O,
//   kinetics.from(실측 상수 = 관찰의 파생값)·kinetics.lumped, 한계 종류 Observation_Gap. 관찰 기록은 바뀌지 않는다(철회 표시만).
//   기존 데이터에는 관찰 기록·kinetics 가 없으므로(규칙 kinetics 0건) 빈 모음과 다음 번호만 더하고 검사한다.
//   무손실: 다른 모든 필드는 normalize 를 거쳐도 그대로여야 한다 — 바뀌면 변환하지 않는다.
// 사용: node migrations/009-v9-to-v10-observations.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DefDB = require('../core.js');
const path = process.argv[2] || 'data/db.json';
const v9 = JSON.parse(readFileSync(path, 'utf8'));
if (v9.version !== 9) { console.error(`버전 ${v9.version} — 9 가 아니라 변환하지 않음`); process.exit(1); }
const db = DefDB.normalize({ ...v9, version: 10 });
const { observations, ...rest } = db, { next, ...meta } = rest.meta, { O, ...nextOld } = next;
const same = JSON.stringify({ ...rest, version: 9, meta: { ...meta, next: nextOld } }) === JSON.stringify(v9);
if (!same) { console.error('무손실 아님 — 관찰 모음 밖의 필드가 바뀜'); process.exit(1); }
const { errors } = require('../judicial/judicial.js').validate(db) /* 검사는 사법부 (삼권 분립) */;
for (const e of errors) console.error('오류', e.where, e.msg);
if (errors.length) process.exit(1);
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`변환 완료 (v10): 관찰 기록 ${Object.keys(observations).length}, 다른 필드 변경 없음`);
