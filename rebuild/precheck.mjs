#!/usr/bin/env node
// 빠른 사전 검사 (STG-11c · DEC-0047) — 2 분짜리 전체 시험 전에 몇 초 안에 구조 실수를 잡는다. 전체 시험을 대신하지 않고 앞에 선다.
//   node rebuild/precheck.mjs        구조 시험(rebuild · governance) · 깨진 참조(probe --check) · 생성 문서 --check · 계획 · 규칙 장부 검사
// 근거(영수증 측정 — docs/reports 의 작업 자동화 보고서 §2): 전체 시험 33 회 중 실패 8 회, 그중 약 6 회가 여기서 잡히는 구조 실수(규칙 번호 표기 · 변이 자리 · 장부 연결 · 생성 문서).
// 계약: 읽기·시험만 — 파일을 쓰지 않는다. 문지기(gate.mjs)와 별개 — finish · 커밋 문은 그대로다.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const STEPS = [
  ['node', ['rebuild/probe.mjs', '--check']],
  ['node', ['rebuild/probe.mjs', '--new']], // 새 파일의 연결 후보 — 제안만, 실패하지 않음
  ['node', ['rebuild/rules.mjs', 'check']],
  ['node', ['rebuild/plan.mjs', 'check']],
  ['node', ['rebuild/status.mjs', '--check']],
  ['node', ['dbtool.mjs', 'textbook', '--check']],
  ['node', ['--test', '--test-reporter=tap', 'tests/rebuild.test.mjs', 'tests/governance.test.mjs']],
];
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.BIODB_TEST_SCOPE; // 겹친 시험 실행이 바깥 문맥을 물려받지 않게

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let fail = 0;
  for (const [cmd, args] of STEPS) {
    const t0 = Date.now(), r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 64 << 20 });
    const ok = r.status === 0, line = `${cmd} ${args.join(' ')}`;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${line} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!ok) { fail++; const out = (String(r.stdout || '') + String(r.stderr || '')).split('\n').filter((l) => /^\s*error:|^not ok|^\s+[+-] |RULE-|오류|거부|최신|깨진|없음/.test(l) && !/^# Subtest|^\s*ok \d/.test(l)).slice(0, 15); console.log(out.map((l) => '  ' + l.trim()).join('\n')); }
  }
  console.log(fail ? `사전 검사 실패 ${fail} — 고친 뒤 다시 (전체 시험은 node rebuild/gate.mjs finish <모드>)` : '사전 검사 통과 — 이어서 node rebuild/gate.mjs finish <모드>');
  process.exit(fail ? 1 : 0);
}
