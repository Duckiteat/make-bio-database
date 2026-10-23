#!/usr/bin/env node
// 형식 버전 10 → 12 변환: 값 층 분리 (2026-10-15). docs/design/format-v12.md
//   정의항 obs 와 규칙 kinetics 의 수치 → 최상위 values { V… } (대상·속성·맥락·분포·근거·출처 관찰·recorded_at),
//   규칙에는 법칙 모양(kinetic_law)만. 메모리에서는 정규화가 obs·kinetics 를 보기로 다시 붙이므로 읽는 코드의 결과는 그대로다.
//   (11 은 번호를 올리지 않은 안전장치 판이라 건너뛴다 — SCHEMA §8M)
// 무손실: 변환 뒤 보기(obs·kinetics)가 변환 전 정규형과 정준 JSON 으로 같아야 하고, 그 밖의 필드는 그대로여야 한다.
// 기원 체크포인트가 있으면 변환은 사건 사슬의 'migration' 사건으로 남는다(입법 서기). 재생은 transform 을 다시 돌려 같은 해시를 확인한다.
// 사용: node migrations/010-v10-to-v12-values.js [data/db.json]
'use strict';
const M = require('../model.js');

// 순수 변환: v10 db 객체 → v12 db 객체 (recorded_at 은 인자 — 재생 결정론)
function transform(raw, opt) {
  if (raw.version !== 10) throw new Error(`버전 ${raw.version} — 10 이 아니라 변환하지 않음`);
  const db = M.normalize(raw);
  for (const v of Object.values(db.values)) if (!v.recorded_at) v.recorded_at = opt.recorded_at;
  return M.normalize(JSON.parse(JSON.stringify(db)));
}

// 무손실 확인: 보기 = 변환 전 정규형, 값·법칙 밖의 필드는 그대로
function lossless(raw, db) {
  const before = M.normalize(Object.assign({}, raw, { version: 10 })), problems = [];
  for (const [sid, d] of Object.entries(raw.senses)) {
    const a = M.canonJ((d.obs || []).map(M.normObs)), b = M.canonJ(db.senses[sid].obs);
    if (a !== b) problems.push(`${sid} obs 보기가 다름`);
    for (const r of d.rule || []) if (r.kinetics && M.canonJ(M.normKinetics(r.kinetics)) !== M.canonJ(db.senses[sid].rule.find((x) => x.id === r.id).kinetics)) problems.push(`${sid}/rule/${r.id} kinetics 보기가 다름`);
  }
  const strip = (x) => { const o = JSON.parse(JSON.stringify(x)); delete o.values; delete o.version; delete o.meta.next.V; for (const d of Object.values(o.senses)) { delete d.obs; for (const r of d.rule || []) { delete r.kinetics; delete r.kinetic_law; } } return M.canonJ(o); };
  if (strip(before) !== strip(db)) problems.push('값·법칙 밖의 필드가 바뀜');
  return problems;
}

module.exports = { transform, lossless, FROM: 10, TO: 12 };

if (require.main === module) (async () => {
  const { readFileSync, existsSync } = require('fs'), path = require('path');
  const crypto = require('crypto'), sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
  const dbPath = path.resolve(process.argv[2] || 'data/db.json'), text = readFileSync(dbPath, 'utf8'), raw = JSON.parse(text);
  const CLERK = await import('../legislative/clerk.mjs'), ATT = require('../judicial/attestation.js'), J = require('../judicial/judicial.js');
  const log = CLERK.readLog(path.dirname(dbPath)), recorded_at = log ? log.genesis.at : new Date().toISOString();
  const db = transform(raw, { recorded_at }), lost = lossless(raw, db);
  for (const p of lost) console.error('무손실 아님:', p);
  if (lost.length) process.exit(1);
  const { errors } = J.validate(db) /* 검사는 사법부 (삼권 분립) */;
  for (const e of errors) console.error('오류', e.where, e.msg);
  if (errors.length) process.exit(1);
  const script = path.relative(path.resolve(__dirname, '..'), __filename), seal = ATT.sealVerdict({ ok: true, errors: [], warnings: [] }, db, { issuer: 'judicial/judicial.js#validate (형식 변환)' });
  const w = CLERK.commitMigration({ dbPath, db, seal, script, scriptText: readFileSync(__filename, 'utf8'), fromSha: sha(text), recorded_at });
  console.log(`변환 완료 (v12): 값 기록 ${Object.keys(db.values).length} · 법칙 모양 ${Object.values(db.senses).reduce((t, d) => t + d.rule.filter((r) => r.kinetic_law).length, 0)} · 보기 무손실${w.event ? ` · 사건 #${w.event.seq} (migration)` : ''}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
