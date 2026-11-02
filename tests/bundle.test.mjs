// 승인 묶음 보기·확인 시험 (STG-12) — 패치에서 바뀐 뒤 내용을 얻고, 승인 화면 · 지문 · 확인을 낸다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as B from '../rebuild/bundle.mjs';

// 임시 저장소에서 파일을 바꾸고 git diff 로 패치를 얻는다 — 지금 내용(before)은 첫 커밋의 것
function make(files, edit) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-t-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  try {
    g('init', '-q');
    for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }
    g('add', '-A'); g('commit', '-qm', 'base');
    for (const [p, t] of Object.entries(edit)) writeFileSync(join(dir, p), t);
    return { patch: g('diff'), before: (p) => (p in files ? files[p] : null) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const cfg = (allow, ask = []) => JSON.stringify({ permissions: { allow, ask, deny: ['Edit(data/db.json)'] } }, null, 2) + '\n';

test('패치에서 경로와 바뀐 뒤 내용을 얻는다 · 새 파일은 before 가 빈 글', () => {
  const t = make({ 'a/x.js': 'one\n' }, { 'a/x.js': 'one\ntwo\n' });
  assert.deepEqual(B.pathsOf(t.patch), ['a/x.js']);
  const [c] = B.changesOf(t.patch, '/nonexistent', t.before);
  assert.equal(c.before, 'one\n'); assert.equal(c.after, 'one\ntwo\n'); assert.equal(c.role, null);
});

test('승인 화면: 첫 줄이 지문, 좁히는 설정 변경은 사람 승인에 나온다', () => {
  const t = make({ '.claude/settings.json': cfg(['Read']) }, { '.claude/settings.json': cfg(['Read'], ['Edit(guard/gate.mjs)']) });
  const out = B.show(t.patch, '/nonexistent', t.before);
  assert.match(out.split('\n')[0], /^지문 [0-9a-f]{64}$/);
  assert.match(out, /## 사람 승인 필요/); assert.doesNotMatch(out, /## 거부/);
  assert.match(out, /^\s+\+ .*Edit\(guard\/gate\.mjs\)/m);
});

test('확인: 지문이 같으면 통과 · 다르면 거부 · 권한을 넓히는 묶음은 지문이 같아도 거부', () => {
  const t = make({ '.claude/settings.json': cfg(['Read']) }, { '.claude/settings.json': cfg(['Read'], ['Edit(guard/gate.mjs)']) });
  const id = B.show(t.patch, '/nonexistent', t.before).split('\n')[0].slice(3);
  assert.equal(B.verify(t.patch, id, '/nonexistent', t.before).ok, true);
  assert.match(B.verify(t.patch, id.replace(/.$/, id.endsWith('0') ? '1' : '0'), '/nonexistent', t.before).why, /지문이 다름/);
  const w = make({ '.claude/settings.json': cfg(['Read']) }, { '.claude/settings.json': cfg(['Read', 'Bash(curl:*)']) });
  const wid = B.show(w.patch, '/nonexistent', w.before).split('\n')[0].slice(3);
  const r = B.verify(w.patch, wid, '/nonexistent', w.before);
  assert.equal(r.ok, false); assert.match(r.why, /거부 1/);
});

test('한 글자라도 다른 패치는 다른 지문', () => {
  const a = make({ 'a.txt': 'x\n' }, { 'a.txt': 'x\ny\n' }), b = make({ 'a.txt': 'x\n' }, { 'a.txt': 'x\nz\n' });
  const id = (t) => B.show(t.patch, '/nonexistent', t.before).split('\n')[0];
  assert.notEqual(id(a), id(b));
});
