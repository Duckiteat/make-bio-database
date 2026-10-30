// 바뀐 것만 시험 (tests/affected.mjs · 추적기 tests/trace.mjs · 스냅숏 tests/snapshot.mjs)
//   ① 고르기 · 닿음 · 추적 구멍 · 새 지도 (순수 — 합성 기록)
//   ② 작은 임시 저장소에서 끝까지: 처음 모두 → 그대로면 0 → 읽은 파일을 고치면 그 시험만 → 목록을 읽은 폴더에 새 파일이면 그 시험만
//      → 아무도 읽지 않은 파일이면 0 → git 역사를 읽는 시험은 HEAD 가 바뀌면 → 지도에서 연결 하나를 빼면 전체가 추적 구멍으로 잡음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as A from './affected.mjs';

const E = (files, dirs = [], o = {}) => ({ tree: 'T0', head: 'H0', files, dirs, git: false, ...o });

test('① 고르기: 읽은 파일 · 목록을 읽은 폴더 · 추적 기계가 바뀌면 돌리고, 아니면 건너뜀 — 지도에 없으면 돌림', () => {
  assert.ok(A.covers(E(['a/x.js']), 'a/x.js'));
  assert.ok(A.covers(E([], ['fx']), 'fx/new.json'), '목록을 읽은 폴더의 새 파일');
  assert.ok(!A.covers(E([], ['fx']), 'fx/sub/new.json'), '재귀가 아니면 하위 폴더는 아님');
  assert.ok(A.covers(E([], ['fx/**']), 'fx/sub/new.json'), '재귀 목록');
  assert.ok(A.covers(E([], ['.']), 'top.md') && !A.covers(E([], ['.']), 'a/b.md'), '최상위 목록');
  assert.ok(A.covers(E([], ['**']), 'any/where.md'), '저장소 전체 (git ls-files 등)');
  const map = { version: 1, tests: { 'tests/a.test.mjs': E(['tests/a.test.mjs', 'lib/x.js']), 'tests/b.test.mjs': E(['tests/b.test.mjs'], ['fx']), 'tests/g.test.mjs': E(['tests/g.test.mjs'], [], { git: true }) } };
  const pick = (changed, head = 'H0', tests = Object.keys(map.tests)) => Object.fromEntries(A.choose({ tests, map, diff: () => changed, head }).map((c) => [c.test, c.run]));
  assert.deepEqual(pick([]), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': false, 'tests/g.test.mjs': false });
  assert.deepEqual(pick(['lib/x.js']), { 'tests/a.test.mjs': true, 'tests/b.test.mjs': false, 'tests/g.test.mjs': false });
  assert.deepEqual(pick(['fx/n.json', 'doc.md']), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': true, 'tests/g.test.mjs': false });
  assert.deepEqual(pick(['tests/g.test.mjs']), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': false, 'tests/g.test.mjs': true }, '시험 파일 자신');
  assert.deepEqual(pick([], 'H1'), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': false, 'tests/g.test.mjs': true }, 'git 역사를 읽는 시험은 HEAD 가 바뀌면');
  for (const h of A.HARNESS) assert.ok(Object.values(pick([h])).every(Boolean), `추적 기계(${h})가 바뀌면 모두`);
  assert.deepEqual(pick([], 'H0', ['tests/new.test.mjs']), { 'tests/new.test.mjs': true }, '지도에 없는 시험');
  assert.deepEqual(A.choose({ tests: ['tests/a.test.mjs'], map: null, diff: () => [], head: 'H0' }).map((c) => c.run), [true], '지도가 없으면 모두');
});

test('① 추적 구멍 · 새 지도: 건너뛸 수 있었던 시험이 새로 읽은 것은 구멍, 돌린 시험은 구멍이 아님 · 추적이 빈 시험은 항목을 지움', () => {
  const map = { version: 1, tests: { 'tests/a.test.mjs': E(['tests/a.test.mjs', 'lib/x.js']), 'tests/b.test.mjs': E(['tests/b.test.mjs']) } };
  const fresh = { 'tests/a.test.mjs': { files: ['tests/a.test.mjs', 'lib/x.js', 'lib/y.js'], dirs: [], git: false }, 'tests/b.test.mjs': { files: ['tests/b.test.mjs', 'lib/z.js'], dirs: ['fx'], git: true } };
  const chosen = [{ test: 'tests/a.test.mjs', run: false }, { test: 'tests/b.test.mjs', run: true }];
  assert.deepEqual(A.holes(chosen, map, fresh), [{ test: 'tests/a.test.mjs', files: ['lib/y.js'], dirs: [], git: false }]);
  assert.deepEqual(A.holes([{ test: 'tests/b.test.mjs', run: false }], map, fresh), [{ test: 'tests/b.test.mjs', files: ['lib/z.js'], dirs: ['fx'], git: true }]);
  const next = A.nextMap(map, { tests: ['tests/a.test.mjs', 'tests/b.test.mjs', 'tests/c.test.mjs'], ran: ['tests/b.test.mjs', 'tests/c.test.mjs'], fresh, tree: 'T1', head: 'H1' });
  assert.deepEqual(Object.keys(next.tests), ['tests/a.test.mjs', 'tests/b.test.mjs'], 'c 는 추적이 비어 항목 없음 (다음에 다시 돔)');
  assert.equal(next.tests['tests/a.test.mjs'].tree, 'T0', '돌리지 않은 시험은 옛 항목 그대로');
  assert.deepEqual(next.tests['tests/b.test.mjs'], { tree: 'T1', head: 'H1', ...fresh['tests/b.test.mjs'] });
  assert.ok(!('tests/gone.test.mjs' in A.nextMap({ version: 1, tests: { 'tests/gone.test.mjs': E([]) } }, { tests: [], ran: [], fresh: {}, tree: 'T', head: 'H' }).tests), '사라진 시험은 뺌');
});

test('② 임시 저장소에서 끝까지 — 커밋 검사는 바뀐 것에 닿는 시험만, 빠진 연결은 전체 검사가 잡음', () => {
  const R = realpathSync(mkdtempSync(join(tmpdir(), 'affected-'))), AFF = fileURLToPath(new URL('./affected.mjs', import.meta.url));
  const w = (f, s) => { mkdirSync(join(R, f, '..'), { recursive: true }); writeFileSync(join(R, f), s); };
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const env = { ...process.env }; delete env.BIODB_TEST_SCOPE; // 범위는 인자로만 (바깥 finish --full 의 범위가 새지 않게)
  const run = (...a) => { const r = spawnSync(process.execPath, [AFF, ...a], { cwd: R, env, encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
  const listed = () => Object.fromEntries(run('--list').out.split('\n').filter(Boolean).map((l) => [l.split(' — ')[0].trim().split(/\s+/).pop(), l.startsWith('돌림')]));
  try {
    w('lib/x.txt', 'x\n'); w('fx/one.json', '1\n'); w('doc.md', 'doc\n');
    w('tests/a.test.mjs', "import { test } from 'node:test'; import { readFileSync } from 'node:fs'; test('a', () => readFileSync(new URL('../lib/x.txt', import.meta.url)));\n");
    w('tests/b.test.mjs', "import { test } from 'node:test'; import { readdirSync } from 'node:fs'; test('b', () => readdirSync(new URL('../fx', import.meta.url)));\n");
    w('tests/g.test.mjs', "import { test } from 'node:test'; import { execFileSync } from 'node:child_process'; test('g', () => execFileSync('git', ['log', '-1'], { cwd: new URL('..', import.meta.url) }));\n");
    g('init', '-q'); g('add', '-A'); g('commit', '-qm', 'base');
    let r = run(); assert.equal(r.code, 0, r.out); assert.match(r.out, /닿는 시험 3\/3 \(지도 없음/);
    r = run(); assert.equal(r.code, 0, r.out); assert.match(r.out, /닿는 시험 0\/3/);
    appendFileSync(join(R, 'lib/x.txt'), 'y\n');
    assert.deepEqual(listed(), { 'tests/a.test.mjs': true, 'tests/b.test.mjs': false, 'tests/g.test.mjs': false }, '읽은 파일을 고침');
    r = run(); assert.equal(r.code, 0, r.out); assert.match(r.out, /닿는 시험 1\/3/);
    w('fx/two.json', '2\n');
    assert.deepEqual(listed(), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': true, 'tests/g.test.mjs': false }, '목록을 읽은 폴더에 새 파일');
    run(); appendFileSync(join(R, 'doc.md'), 'more\n');
    assert.deepEqual(listed(), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': false, 'tests/g.test.mjs': false }, '아무도 읽지 않은 파일');
    g('add', '-A'); g('commit', '-qm', 'next');
    assert.deepEqual(listed(), { 'tests/a.test.mjs': false, 'tests/b.test.mjs': false, 'tests/g.test.mjs': true }, 'git 역사를 읽는 시험은 HEAD 가 바뀌면');
    run();
    // 지도에서 연결 하나(a → lib/x.txt)를 빼면 커밋 검사는 a 를 건너뛰지만, 전체 검사가 추적 구멍으로 잡는다
    const M = JSON.parse(readFileSync(A.mapFile(R), 'utf8'));
    M.tests['tests/a.test.mjs'].files = M.tests['tests/a.test.mjs'].files.filter((f) => f !== 'lib/x.txt');
    writeFileSync(A.mapFile(R), JSON.stringify(M));
    appendFileSync(join(R, 'lib/x.txt'), 'z\n');
    assert.equal(listed()['tests/a.test.mjs'], false, '빠진 연결이면 커밋 검사는 놓친다 — 그래서 push 는 전체');
    r = run('--full'); assert.equal(r.code, 1, r.out); assert.match(r.out, /추적 구멍 1[\s\S]*tests\/a\.test\.mjs: lib\/x\.txt/);
    assert.equal(run('--full').code, 0, '구멍을 알린 뒤 지도는 새 추적으로 — 다시 돌리면 통과');
    assert.equal(g('status', '--porcelain'), ' M lib/x.txt\n', '시험 도구는 저장소에 쓰지 않음 (색인도 그대로)');
  } finally { rmSync(R, { recursive: true, force: true }); rmSync(A.mapFile(R), { force: true }); }
});
