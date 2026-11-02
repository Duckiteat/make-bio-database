// CHANGES 초안 시험 (STG-11e) — 범위 칸이 git 이 보는 바뀐 파일을 모두 덮는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as D from '../rebuild/changes-draft.mjs';

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cd-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  g('init', '-q');
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }
  g('add', '-A'); g('commit', '-qm', 'base');
  return { dir, g, put: (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); } };
}

test('범위 칸은 git 이 보는 바뀐 파일을 모두 덮는다 — 일반 · 새 파일 · 생성물 · 중심 문서', () => {
  const r = repo({ 'a/x.js': '1\n', 'rebuild/status/00.md': '1\n', 'docs/plan/p.md': '1\n', 'CLAUDE.md': '1\n', 'rebuild/rules/changes.jsonl': '', 'rebuild/rules/enforcement.jsonl': '', 'rebuild/state/plan-log.jsonl': '' });
  try {
    r.put('a/x.js', '2\n'); r.put('a/new.js', 'n\n'); r.put('rebuild/status/00.md', '2\n'); r.put('rebuild/status/01.md', 'n\n'); r.put('docs/plan/p.md', '2\n'); r.put('CLAUDE.md', '2\n');
    const files = D.changedFiles(r.dir), scope = D.scopeOf(files);
    assert.ok(files.length >= 6);
    for (const f of files) assert.ok(D.covers(scope, f), `${f} 가 범위 칸에 없음: ${scope}`);
    assert.match(scope, /`a\/x\.js`/); assert.match(scope, /`a\/new\.js`/);
    assert.match(scope, /rebuild\/status\/ \(생성 문서\) 2/, '생성물은 폴더로 묶고 개수를 적는다');
    assert.ok(!scope.includes('`rebuild/status/00.md`'), '생성물 파일 하나하나는 적지 않는다');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('덮지 못하는 파일은 covers 가 거짓 — 검사가 실제로 무는지', () => {
  assert.equal(D.covers('`a.js`', 'b.js'), false);
  assert.equal(D.covers('`a.js` · rebuild/status/ (생성 문서) 3', 'rebuild/status/x.md'), true);
  assert.equal(D.covers('`a.js`', 'rebuild/status/x.md'), false);
});

test('확인 칸: 새 변이 결과 · 장부 사건 · 계획 사건을 센다', () => {
  const r = repo({ 'rebuild/rules/changes.jsonl': '', 'rebuild/rules/enforcement.jsonl': '', 'rebuild/state/plan-log.jsonl': '' });
  try {
    appendFileSync(join(r.dir, 'rebuild/rules/enforcement.jsonl'), JSON.stringify({ rule: 'RULE-0001', result: 'caught' }) + '\n');
    appendFileSync(join(r.dir, 'rebuild/rules/changes.jsonl'), JSON.stringify({ seq: 1 }) + '\n' + JSON.stringify({ seq: 2 }) + '\n');
    appendFileSync(join(r.dir, 'rebuild/state/plan-log.jsonl'), JSON.stringify({ item: 'STG-1' }) + '\n');
    const c = D.checkOf(r.dir);
    assert.match(c, /변이 RULE-0001 caught/); assert.match(c, /규칙 장부 사건 2/); assert.match(c, /계획 사건 1 \(STG-1\)/);
    const { row } = D.draftRow(r.dir, '2026-01-01');
    assert.match(row, /^\| 2026-01-01 · \(제목을 손으로\) \|/); assert.equal(row.split('|').length, 7, '다섯 칸');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
