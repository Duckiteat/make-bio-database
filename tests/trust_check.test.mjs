// 독립 판정 시험 (DEC-0088 Q2 · DEC-0089) — 임시 git 저장소에서 공격 재검토 N9 · N10 을 다시 만들고, main 의 사본(이 저장소)이 판정하는지 본다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as T from '../rebuild/trust-check.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const stamp = (v, by = 'human') => ({ subject: { sense: v, field: 'accept', ns: 'evidence', value: v }, claim: 'accept', verdict: 'approved', by, reason: 'r', issuer: { module: 'judicial/acceptance.js' }, issued_at: '2026-01-01', digest: 'd' + v });
const reg = (...s) => JSON.stringify({ stamps: s }, null, 1) + '\n';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'tc-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  const put = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); };
  const commit = (m) => { g('add', '-A'); g('commit', '-qm', m); return g('rev-parse', 'HEAD').trim(); };
  g('init', '-q', '-b', 'main'); put('attestations/registry.json', reg(stamp('O1'), stamp('O2'))); put('engine/x.js', '0\n'); put('model.js', '0\n');
  return { dir, g, put, commit, base: commit('base') };
}
const run = (r, head = 'HEAD') => T.trustCheck(r.base, head, r.dir, ROOT);

test('순수: 의존 찾기 · 닫힘 · 지키는 자리', () => {
  assert.deepEqual(T.depsOf('judicial/a.js', "const x = require('./b.js'); import y from '../model.js'; createRequire(import.meta.url)('../vocab.js'); require('fs')").sort(), ['judicial/b.js', 'model.js', 'vocab.js']);
  const files = { 'r.mjs': "import './a.js'", 'a.js': "require('./b')", 'b.js': '', 'c.js': '' };
  assert.deepEqual(T.closure(['r.mjs'], (p) => files[p] ?? null), ['a.js', 'b.js', 'r.mjs']);
  const isG = T.guardedOf({ files: [{ path: 'x/*', level: 'L6', write_keys: ['human'] }, { path: 'workspace/receipts/*', level: 'L6', write_keys: ['gate'] }, { path: 'y', level: 'L2' }] }, ['m.js']);
  assert.ok(isG('x/1') && isG('m.js')); assert.ok(!isG('y') && !isG('workspace/receipts/s.jsonl'), '영수증 · L6 아닌 자리는 지키지 않음');
});

test('실제 판정 코드의 의존 닫힘에 N10 의 파일이 든다 (손으로 적지 않음)', () => {
  const r = T.trustCheck('HEAD', 'HEAD', ROOT, ROOT);
  for (const f of ['model.js', 'vocab.js', 'judicial/identity.js', 'judicial/trend.js', 'judicial/reliability.js', 'legislative/clerk.mjs', 'rebuild/trust-check.mjs']) assert.ok(r.deps.includes(f), f);
});

test('보통 변경은 통과 · 판정 코드 의존 파일(N10) 변경은 사람 확인', () => {
  const r = setup();
  try {
    r.put('engine/x.js', '1\n'); r.commit('엔진');
    assert.equal(run(r).exit, 0);
    r.put('model.js', '0\n// 위조 도장 하나 빼기\n'); r.commit('model 한 줄');
    const v = run(r); assert.equal(v.exit, 1); assert.deepEqual(v.guarded, ['model.js']);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('병합 커밋 속 승인 도장 지우기(N9) · 사람 아닌 승인자 밖 새 도장 · 승인자 도장 더하기는 통과', () => {
  const r = setup();
  try {
    r.g('checkout', '-qb', 'a'); r.g('commit', '-q', '--allow-empty', '-m', 'a');
    r.g('checkout', '-qb', 'b', r.base); r.g('commit', '-q', '--allow-empty', '-m', 'b');
    r.g('merge', '-q', '--no-ff', '--no-commit', 'a'); r.put('attestations/registry.json', reg(stamp('O1'))); r.commit('병합 + 지우기');
    const v = run(r); assert.equal(v.exit, 1); assert.match(v.lines.join('\n'), /RULE-0542/);
    r.g('checkout', '-qb', 'c', r.base); r.put('attestations/registry.json', reg(stamp('O1'), stamp('O2'), stamp('O3'))); r.commit('새 human 도장');
    assert.match(run(r).lines.join('\n'), /RULE-0546/);
    r.g('checkout', '-qb', 'd', r.base); r.put('attestations/registry.json', reg(stamp('O1'), stamp('O2'), stamp('O3', 'integrator'))); r.commit('승인자 도장');
    assert.equal(run(r).exit, 0);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('PR 이 자기 저장 지도를 낮춰도 판정 쪽(main) 지도로 본다', () => {
  const r = setup();
  try {
    r.put('docs/textbook/storage-map.json', JSON.stringify({ files: [] })); r.put('rebuild/gate.mjs', '// 꺼짐\n'); r.commit('지도 낮추고 문지기 고침');
    const v = run(r); assert.equal(v.exit, 1); assert.ok(v.guarded.includes('rebuild/gate.mjs'));
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

// PLAN-135 · DEC-0098 · DEC-0101 · RULE-0553 — 지키는 자리는 사람 서명 커밋으로만 (사람의 승인은 GitHub 규칙 세트가)
const human = (...cs) => Object.fromEntries(cs.map((c) => [c, { verified: true, committer: 'Duckiteat' }]));

test('순수 (RULE-0553): 지키는 자리를 바꾼 커밋이 모두 사람 서명일 때만 · 병합 커밋 속 새 내용 · 설명 안 되는 변경은 실패', () => {
  const S = (ok) => (c) => ok.includes(c);
  assert.equal(T.signedPaths({ guarded: ['a'], touches: { a: ['c1', 'c2'] }, merges: [], signed: S(['c1', 'c2']) }).ok, true);
  assert.deepEqual(T.signedPaths({ guarded: ['a'], touches: { a: ['c1', 'c2'] }, merges: [], signed: S(['c1']) }).unsigned, [{ path: 'a', commit: 'c2' }], '하나라도 서명 없음');
  assert.deepEqual(T.signedPaths({ guarded: ['a'], touches: { a: ['c1'] }, merges: [{ c: 'm', paths: { a: { self: 'x', parents: ['y', 'z'] } } }], signed: S(['c1']) }).evil, [{ path: 'a', commit: 'm' }], '병합 커밋이 새 내용을 넣음');
  assert.equal(T.signedPaths({ guarded: ['a'], touches: { a: ['c1'] }, merges: [{ c: 'm', paths: { a: { self: 'y', parents: ['y', 'z'] } } }], signed: S(['c1']) }).ok, true, '부모 하나와 같으면 정상 병합');
  assert.deepEqual(T.signedPaths({ guarded: ['a'], touches: { a: [] }, merges: [], signed: S([]) }).unexplained, ['a']);
  assert.equal(T.signedPaths({ guarded: [], touches: {}, merges: [], signed: S([]) }).ok, true, '지키는 자리 변경 없음');
});

test('통합 (RULE-0553): 사람 서명 커밋의 지키는 자리 변경은 통과 · 봇 서명 · 웹 흐름 · 서명 없음 · 섞임은 실패 · 서명 사실이 없으면 실패', () => {
  const r = setup();
  try {
    r.put('model.js', '1\n'); const h = r.commit('사람이 판정 의존 파일을 고침');
    const ok = T.trustCheck(r.base, 'HEAD', r.dir, ROOT, human(h));
    assert.equal(ok.exit, 0); assert.match(ok.lines.join('\n'), /모두 사람 서명 커밋/);
    assert.equal(T.trustCheck(r.base, 'HEAD', r.dir, ROOT, { [h]: { verified: true, committer: 'daduteria' } }).exit, 1, '봇 계정의 서명');
    assert.equal(T.trustCheck(r.base, 'HEAD', r.dir, ROOT, { [h]: { verified: true, committer: 'web-flow' } }).exit, 1, 'Codespaces GPG · 웹 편집 (DEC-0100)');
    assert.equal(T.trustCheck(r.base, 'HEAD', r.dir, ROOT, { [h]: { verified: false, committer: 'Duckiteat' } }).exit, 1, '검증 안 된 서명');
    assert.equal(T.trustCheck(r.base, 'HEAD', r.dir, ROOT).exit, 1, '서명 사실 없음 = 사람 아님');
    r.put('model.js', '2\n'); const b = r.commit('봇이 이어서 고침');
    const mix = T.trustCheck(r.base, 'HEAD', r.dir, ROOT, human(h));
    assert.equal(mix.exit, 1); assert.match(mix.lines.join('\n'), new RegExp(`\\[RULE-0553\\] model\\.js 을 바꾼 커밋 ${b.slice(0, 8)}`));
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('통합 (RULE-0553): 병합 커밋 속에 몰래 넣은 지키는 자리 변경은 실패 · 정상 병합은 통과', () => {
  const r = setup();
  try {
    r.g('checkout', '-qb', 'a'); r.put('model.js', 'A\n'); const a = r.commit('사람 서명 A');
    r.g('checkout', '-qb', 'b', r.base); r.put('engine/x.js', 'B\n'); r.commit('보통 B');
    r.g('merge', '-q', '--no-ff', '-m', '정상 병합', 'a');
    assert.equal(T.trustCheck(r.base, 'HEAD', r.dir, ROOT, human(a)).exit, 0, '병합 커밋의 model.js = 부모 a 의 것');
    r.g('checkout', '-qb', 'c', r.base); r.put('engine/x.js', 'C\n'); r.commit('보통 C');
    r.g('merge', '-q', '--no-ff', '--no-commit', 'a'); r.put('model.js', 'A\n// 병합하며 몰래 한 줄\n'); r.commit('몰래 넣은 병합');
    const v = T.trustCheck(r.base, 'HEAD', r.dir, ROOT, human(a));
    assert.equal(v.exit, 1); assert.match(v.lines.join('\n'), /병합 커밋 [0-9a-f]{8} 이 model\.js 에 부모 어디에도 없던 내용을 넣음/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('통합 (PLAN-135 새 파일 구멍): L6 폴더 아래 새 파일(.github/**)도 지키는 자리 — PR #27 의 approval.yml 처럼', () => {
  const r = setup();
  try {
    r.put('.github/workflows/new.yml', 'name: x\n'); const c = r.commit('새 워크플로');
    const v = T.trustCheck(r.base, 'HEAD', r.dir, ROOT);
    assert.equal(v.exit, 1); assert.deepEqual(v.guarded, ['.github/workflows/new.yml']);
    assert.equal(T.trustCheck(r.base, 'HEAD', r.dir, ROOT, human(c)).exit, 0, '사람 서명이면 통과');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
