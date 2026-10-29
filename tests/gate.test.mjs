// 문지기 · 영수증 (재건 7 단계) — 훅이 실제로 막는다 · 영수증 = git 변경
//   ① 정책: 모드별 쓰기 경로 · 수집가 역할 · 영수증은 문지기만
//   ② 판단: 모드 열기 전 쓰기 · 모드 바꾸기 · 막는 명령 · 끝내기 전 시험 없이 커밋 · 시험 뒤 바뀐 파일 · 수집가 브랜치·push 범위
//   ③ 끝에서 끝: 저장소 밖 임시 git 저장소에서 진짜 훅 스크립트를 표준 입력으로 돌린다 (이 저장소는 건드리지 않는다)
//   ④ 영수증 사슬: 고치거나 지우면 쓰는 도구가 막힌다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as G from '../rebuild/gate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = G.loadPolicy();

test('① 정책: 모드별 쓰기 경로 · 수집가는 핸드오프만 · 영수증은 문지기만', () => {
  assert.ok(G.mayWrite(P, 'develop', null, 'engine/x.js') && !G.mayWrite(P, 'develop', null, 'data/db.json'), '디벨롭은 코드, 데이터는 아님');
  assert.ok(G.mayWrite(P, 'author', null, 'data/db.json') && !G.mayWrite(P, 'author', null, 'core.js'), '정보 작성은 데이터, 코드는 아님');
  assert.ok(!G.mayWrite(P, 'baseline', null, 'engine/x.js') && G.mayWrite(P, 'baseline', null, 'examples/scenarios/a.json'), '기초시험은 코드를 고치지 않음');
  assert.ok(G.mayWrite(P, 'author', 'collector', 'workspace/handoff/TASK-009.jsonl') && !G.mayWrite(P, 'author', 'collector', 'data/db.json'), '수집가는 핸드오프만 (RULE-0274·0275)');
  assert.ok(!G.mayWrite(P, 'inspect', null, 'data/db.json') && G.mayWrite(P, 'inspect', null, 'attestations/registry.json'), '점검은 db 를 쓰지 않고 도장만 (결정 ①)');
  for (const m of G.MODES) assert.ok(G.mayWrite(P, m, null, 'rebuild/status/00-summary.md') && G.mayWrite(P, m, null, 'workspace/transitions.jsonl'), `${m}: 관리 파일·전환 기록`);
  assert.ok(G.protectedPath(P, 'workspace/receipts/2026-10-29-abc.jsonl'));
  assert.ok(G.globRe('data/**').test('data/a/b.json') && !G.globRe('data/*').test('data/a/b.json'));
  for (const m of G.MODES) assert.ok(G.finishCmds(P, m, null).cmds.length >= 2, `${m}: 끝내기 전 시험 묶음`);
});

const stOf = (o) => ({ mode: null, role: null, finish: null, work: () => 'W1', branch: () => 'rebuilding-project', pushFiles: () => [], ...o });
const pre = (st, tool, x) => { const r = G.decidePre(P, stOf(st), { tool_name: tool, tool_input: x }, '/r'); if (r) assert.match(r.rule, /^RULE-\d{4}$/, '막을 때는 규칙 번호'); return r && `${r.rule} ${r.msg}`; };
test('② 판단: 모드 · 막는 명령 · 끝내기 전 시험 없이는 커밋·push 없음 · 수집가 브랜치', () => {
  assert.match(pre({}, 'Write', { file_path: '/r/core.js' }), /모드를 먼저 연다/);
  assert.equal(pre({}, 'Write', { file_path: '/tmp/patch.json' }), null, '저장소 밖은 다루지 않음');
  assert.equal(pre({}, 'Bash', { command: 'node rebuild/gate.mjs open develop' }), null);
  assert.match(pre({ mode: 'develop' }, 'Bash', { command: 'node rebuild/gate.mjs open author' }), /^RULE-0514 .*모드를 바꾸지 않는다/);
  assert.match(pre({}, 'Bash', { command: 'node rebuild/gate.mjs open hacker' }), /author \| baseline/);
  assert.match(pre({ mode: 'develop' }, 'Edit', { file_path: '/r/data/db.json' }), /develop 모드 에서는/);
  assert.match(pre({ mode: 'develop' }, 'Edit', { file_path: '/r/workspace/receipts/x.jsonl' }), /문지기만/);
  assert.match(pre({ mode: 'develop' }, 'Bash', { command: 'cd x && node dbtool.mjs merge p.json' }), /디벨롭은 기계/);
  assert.match(pre({ mode: 'baseline' }, 'Bash', { command: 'node dbtool.mjs augment apply p.json' }), /결과에 맞추려고/);
  assert.equal(pre({ mode: 'author' }, 'Bash', { command: 'node dbtool.mjs merge p.json' }), null, '정보 작성은 병합');
  assert.match(pre({ mode: 'develop' }, 'Bash', { command: 'node rebuild/gate.mjs finish author' }), /이 세션의 모드로만/);
  assert.match(pre({}, 'Bash', { command: 'git commit -m x' }), /모드를 열지 않은/);
  assert.match(pre({ mode: 'develop' }, 'Bash', { command: 'git add -A && git commit -m x' }), /통과하지 않았다/);
  assert.match(pre({ mode: 'develop', finish: { pass: false, work: 'W1' } }, 'Bash', { command: 'git push -u origin b' }), /통과하지 않았다/);
  assert.match(pre({ mode: 'develop', finish: { pass: true, work: 'W0' } }, 'Bash', { command: 'git commit -m x' }), /^RULE-0516 .*시험 뒤에 파일이 바뀌었다/);
  assert.equal(pre({ mode: 'develop', finish: { pass: true, work: 'W1' } }, 'Bash', { command: 'git commit -m x' }), null, '통과한 그 상태면 열림');
  const col = { mode: 'author', role: 'collector', finish: { pass: true, work: 'W1' } };
  assert.match(pre(col, 'Bash', { command: 'git push -u origin main' }), /^RULE-0299 .*collector/, '수집가는 main 에 못 씀');
  assert.match(pre({ ...col, branch: () => 'collector/task-9', pushFiles: () => ['core.js'] }, 'Bash', { command: 'git push -u origin collector/task-9' }), /push 는/);
  assert.equal(pre({ ...col, branch: () => 'collector/task-9', pushFiles: () => ['workspace/handoff/TASK-009.jsonl'] }, 'Bash', { command: 'git push -u origin collector/task-9' }), null, '결정 ②: 자기 브랜치 + 핸드오프만');
  assert.match(pre(col, 'Bash', { command: 'node dbtool.mjs augment apply p.json' }), /^RULE-0287 .*수집가는 후보만/);
  assert.match(pre({ role: 'collector' }, 'Bash', { command: 'node rebuild/gate.mjs open develop' }), /author 모드만/);
});

// ── 끝에서 끝: 임시 git 저장소
function repo() {
  const d = mkdtempSync(join(tmpdir(), 'gate-'));
  const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  mkdirSync(join(d, 'data')); mkdirSync(join(d, 'engine'));
  writeFileSync(join(d, 'core.js'), '1\n'); writeFileSync(join(d, 'data/db.json'), '{}\n'); writeFileSync(join(d, 'engine/e.js'), '1\n');
  g('add', '-A'); g('commit', '-qm', 'init');
  return d;
}
const SID = 'test-sess-0001';
const hook = (d, ev, input, env = {}) => spawnSync(process.execPath, [join(ROOT, 'rebuild/gate.mjs'), 'hook', ev], { cwd: d, input: JSON.stringify({ session_id: SID, ...input }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: d, BIODB_ROLE: '', ...env } });
const receipt = (d) => { const r = join(d, 'workspace/receipts'), f = readdirSync(r).find((x) => x.endsWith('.jsonl')); return readFileSync(join(r, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); };
// 도구 하나 = pre → (도구가 하는 일) → post
const tool = (d, name, x, act) => { const a = hook(d, 'pre', { tool_name: name, tool_input: x }); if (a.status !== 0) return a; if (act) act(); return hook(d, 'post', { tool_name: name, tool_input: x, tool_response: {} }); };
const finishFile = (d) => join(tmpdir(), `biodb-finish-${createHash('sha256').update(d).digest('hex').slice(0, 12)}.json`);
const scratchFile = (d) => join(tmpdir(), `biodb-gate-${createHash('sha256').update(d).digest('hex').slice(0, 12)}-${SID}.json`);

test('③ 끝에서 끝: 훅이 실제로 막고, 셸로 쓴 것도 잡고, 영수증 = git 변경', () => {
  const d = repo();
  try {
    assert.equal(hook(d, 'pre', { tool_name: 'Write', tool_input: { file_path: join(d, 'core.js') } }).status, 2, '모드 열기 전 쓰기는 막힘');
    assert.equal(tool(d, 'Bash', { command: 'node rebuild/gate.mjs open develop' }).status, 0);
    assert.equal(receipt(d).find((e) => e.t === 'open').mode, 'develop', '영수증에 열림');
    const sw = hook(d, 'pre', { tool_name: 'Bash', tool_input: { command: 'node rebuild/gate.mjs open author' } });
    assert.equal(sw.status, 2); assert.match(sw.stderr, /모드를 바꾸지 않는다/);
    assert.equal(hook(d, 'pre', { tool_name: 'Edit', tool_input: { file_path: join(d, 'data/db.json') } }).status, 2, '디벨롭에서 db 편집 막힘');
    assert.equal(tool(d, 'Edit', { file_path: join(d, 'engine/e.js') }, () => writeFileSync(join(d, 'engine/e.js'), '2\n')).status, 0, '디벨롭에서 엔진 편집');
    // 셸로 데이터를 몰래 쓰면 — 도구 뒤 대조가 잡는다
    const sneak = tool(d, 'Bash', { command: "python3 -c 'open(\"data/db.json\",\"w\")'" }, () => writeFileSync(join(d, 'data/db.json'), '{"x":1}\n'));
    assert.equal(sneak.status, 2); assert.match(sneak.stderr, /data\/db\.json/);
    writeFileSync(join(d, 'data/db.json'), '{}\n'); // 되돌림 (도구 밖 — 다음 호출이 '도구 밖 변경' 으로 남긴다)
    assert.equal(hook(d, 'pre', { tool_name: 'Bash', tool_input: { command: 'git commit -am x' } }).status, 2, '끝내기 전 시험 없이 커밋 막힘');
    // 끝내기 전 시험이 통과했다는 기록(gate finish 가 쓰는 것)을 놓고, finish 명령의 앞뒤 훅을 돌린다
    const pass = () => tool(d, 'Bash', { command: 'node rebuild/gate.mjs finish develop' }, () => writeFileSync(finishFile(d), JSON.stringify({ mode: 'develop', role: null, at_ms: Date.now() + 1, work: G.workHash(d), pass: true, results: [{ cmd: 'x', code: 0, ms: 1 }] })));
    assert.equal(pass().status, 0);
    assert.equal(tool(d, 'Bash', { command: 'git commit -qam work' }, () => execFileSync('git', ['commit', '-qam', 'work'], { cwd: d })).status, 0, '통과한 상태면 커밋 열림');
    tool(d, 'Edit', { file_path: join(d, 'engine/e.js') }, () => writeFileSync(join(d, 'engine/e.js'), '3\n'));
    const late = hook(d, 'pre', { tool_name: 'Bash', tool_input: { command: 'git commit -qam more' } });
    assert.equal(late.status, 2); assert.match(late.stderr, /시험 뒤에 파일이 바뀌었다/);
    // 응답 끝: 커밋 안 한 변경 + 시험 없음 → 한 번 알림, 두 번째는 조용히
    assert.equal(hook(d, 'stop', { stop_hook_active: false }).status, 2);
    assert.equal(hook(d, 'stop', { stop_hook_active: false }).status, 0, '같은 상태로는 한 번만');
    const md = readFileSync(join(d, 'workspace/receipts', readdirSync(join(d, 'workspace/receipts')).find((f) => f.endsWith('.md'))), 'utf8');
    assert.match(md, /\*\*영수증에 없는 변경 0\*\*/, '영수증 = git 변경');
    assert.match(md, /`engine\/e\.js` ← /); assert.match(md, /모드 밖 변경/); assert.match(md, /data\/db\.json/);
    const ev = receipt(d);
    assert.ok(ev.some((e) => e.t === 'outside'), '도구 밖 변경도 남음');
    assert.ok(ev.some((e) => e.t === 'finish' && e.pass), '끝내기 전 시험이 영수증에');
    assert.ok(ev.filter((e) => e.t === 'block').length >= 4, '막힌 것이 영수증에');
  } finally { rmSync(d, { recursive: true, force: true }); for (const f of [finishFile(d), scratchFile(d)]) rmSync(f, { force: true }); }
});

test('④ 영수증은 문지기만: 고치거나 지우면 쓰는 도구가 막힌다', () => {
  const d = repo();
  try {
    tool(d, 'Bash', { command: 'node rebuild/gate.mjs open develop' });
    tool(d, 'Bash', { command: 'ls' });
    const r = join(d, 'workspace/receipts'), f = join(r, readdirSync(r).find((x) => x.endsWith('.jsonl')));
    const lines = readFileSync(f, 'utf8').split('\n').filter(Boolean);
    writeFileSync(f, lines.map((l, i) => (i === 0 ? l.replace('"develop"', '"author"') : l)).join('\n') + '\n'); // 모드를 몰래 바꿈
    const a = hook(d, 'pre', { tool_name: 'Edit', tool_input: { file_path: join(d, 'engine/e.js') } });
    assert.equal(a.status, 2); assert.match(a.stderr, /\[RULE-0517\].*영수증이 고쳐졌다/);
    rmSync(f); // 통째로 지워도
    const b = hook(d, 'pre', { tool_name: 'Bash', tool_input: { command: 'node rebuild/gate.mjs open author' } });
    assert.equal(b.status, 2); assert.match(b.stderr, /지워지거나 고쳐짐/);
  } finally { rmSync(d, { recursive: true, force: true }); for (const f of [finishFile(d), scratchFile(d)]) rmSync(f, { force: true }); }
});
