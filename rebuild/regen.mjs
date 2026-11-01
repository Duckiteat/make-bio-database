#!/usr/bin/env node
// 생성 문서를 한 번에 다시 쓴다 (STG-11b · DEC-0047) — 교과서 부록 → 관리 문서 · 계획 문서 · 중심 문서, 그리고 둘 다 --check 로 고정점 확인.
//   node rebuild/regen.mjs
// 권한: 교과서 부록 쓰기(dbtool textbook --write)는 설정의 확인(ask) 명령이다. 이 스크립트는 설정 allow 에 없으므로 부를 때 확인을 받는다 —
//   감싸서 확인을 건너뛰지 않는다(RULE-0461 · tests/probe.test.mjs ⑥).
// 계약: 생성기를 부르기만 — 생성 규칙은 각 생성기(dbtool.mjs textbookAppendix · rebuild/status.mjs)에 있다.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const WRITERS = [['dbtool.mjs', 'textbook', '--write'], ['rebuild/status.mjs', '--write']];
export const CHECKS = [['dbtool.mjs', 'textbook', '--check'], ['rebuild/status.mjs', '--check']];
const run = (a) => spawnSync('node', a, { cwd: ROOT, encoding: 'utf8' });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const a of WRITERS) { const r = run(a); if (r.status !== 0) { console.error(`FAIL node ${a.join(' ')}\n${r.stdout}${r.stderr}`); process.exit(1); } console.log(`씀   node ${a.join(' ')}`); }
  let bad = 0;
  for (const a of CHECKS) { const r = run(a); console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} node ${a.join(' ')}`); if (r.status !== 0) bad++; }
  process.exit(bad ? 1 : 0);
}
