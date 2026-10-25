#!/usr/bin/env node
// 사전 overlay → 추가만 하는 사슬 (2026-10-23, build-plan 16A). 형식 변경: 한 줄 한 레코드 → 한 줄 한 사건 { seq, at, …항목, prev, root }.
//   root = sha256(prev + '\n' + 정준 JSON), 첫 prev = sha256('dictionary\n'). at 은 항목의 since 자정(UTC) — 재실행 결정론.
//   이미 사슬이면 하지 않는다. 무손실: 변환 뒤 (register, key) 마다 label_en·meaning_en·xref·since 가 변환 전과 같아야 한다.
// 사용: node migrations/011-dictionary-chain.mjs [data/dictionary.jsonl]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const ATT = require('../judicial/attestation.js');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const file = process.argv[2] || new URL('../data/dictionary.jsonl', import.meta.url).pathname;
const rows = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).map((l) => JSON.parse(l));
if (rows.length && rows.every((r) => r.root && r.prev)) { console.log('이미 사슬 — 변환하지 않음'); process.exit(0); }
let prev = sha('dictionary\n');
const out = rows.map((r, i) => {
  const body = { seq: i + 1, at: `${r.since}T00:00:00.000Z`, register: r.register, key: r.key, label_en: r.label_en, meaning_en: r.meaning_en, xref: r.xref ?? null, since: r.since, prev };
  const ev = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) }; prev = ev.root; return ev;
});
const same = (a, b) => a.register === b.register && a.key === b.key && a.label_en === b.label_en && a.meaning_en === b.meaning_en && (a.xref ?? null) === (b.xref ?? null) && a.since === b.since;
if (out.length !== rows.length || out.some((e, i) => !same(e, rows[i]))) throw new Error('무손실 확인 실패');
writeFileSync(file, out.map((e) => JSON.stringify(e)).join('\n') + '\n');
console.log(`사전 사슬 변환: ${out.length} 사건 · head ${prev.slice(0, 12)}…`);
