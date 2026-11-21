// 병합 사전 점검 시험 — 충돌 종류 · 번호 충돌 · 권한 칸 · L6 를 임시 git 저장소에서 확인한다 (읽기 전용 도구)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as M from '../rebuild/merge-check.mjs';

const dec = (id, t) => JSON.stringify({ kind: 'decision', id, title: t });
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'mc-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  const put = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); };
  const add = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); appendFileSync(join(dir, p), t); };
  g('init', '-q', '-b', 'main');
  put('rebuild/state/plans.jsonl', dec('DEC-0001', '기반') + '\n'); put('rebuild/state/plan-log.jsonl', '{"seq":1}\n');
  put('rebuild/rules/rules.jsonl', '{"id":"RULE-0001"}\n'); put('rebuild/rules/permissions.jsonl', '{"id":"PERM-0001"}\n');
  put('docs/textbook/storage-map.json', JSON.stringify({ files: [{ path: 'a.js', level: 'L2', area: 'code:x', write_keys: ['session:develop'] }, { path: 'guard.js', level: 'L6', area: 'guard:x', write_keys: ['human'] }] }));
  put('CHANGES.md', '| 행 |\n'); put('rebuild/status/00.md', '기반\n'); put('src/a.js', '1\n');
  g('add', '-A'); g('commit', '-qm', 'base');
  return { dir, g, put, add };
}

test('번호 비교: 새로 만든 같은 번호가 다른 내용이면 충돌 · 같은 내용이면 아님 · 양쪽이 고친 기존 항목 따로', () => {
  const base = M.idsOf('{"id":"X-1","v":1}\n{"id":"X-2","v":1}\n');
  const a = M.idsOf('{"id":"X-1","v":1}\n{"id":"X-2","v":"a"}\n{"id":"N-1","v":"a"}\n{"id":"S-1","v":9}\n{"id":"O-A","v":1}\n');
  const b = M.idsOf('{"id":"X-1","v":1}\n{"id":"X-2","v":"b"}\n{"id":"N-1","v":"b"}\n{"id":"S-1","v":9}\n{"id":"O-B","v":1}\n');
  const c = M.compareIds(base, a, b);
  assert.deepEqual(c.collisions, ['N-1']); assert.deepEqual(c.sameNew, ['S-1']); assert.deepEqual(c.bothModified, ['X-2']);
  assert.deepEqual(c.onlyA, ['O-A']); assert.deepEqual(c.onlyB, ['O-B']);
});

test('충돌 파일 종류와 권한 칸 없는 새 자리', () => {
  assert.equal(M.kindOf('rebuild/status/00-summary.md').kind, '다시 만든다'); assert.equal(M.kindOf('CHANGES.md').kind, '두 쪽 합집합');
  assert.equal(M.kindOf('rebuild/state/plans.jsonl').kind, '도구나 손으로'); assert.equal(M.kindOf('engine/x.rs').kind, '손으로');
  const base = JSON.stringify({ files: [{ path: 'old.js' }] }), tip = JSON.stringify({ files: [{ path: 'old.js' }, { path: 'new.js' }, { path: 'ok.js', level: 'L2', area: 'a', write_keys: [] }] });
  assert.deepEqual(M.missingColumns(tip, base), ['new.js'], '옛 자리는 합칠 때 우리 칸이 남으니 새 자리만');
  assert.equal(M.missingColumns('not json', base), null);
});

test('통합: 번호 충돌 · 충돌 종류 · 권한 칸 · L6 를 모두 잡고 종료 코드 1, 작업 트리는 그대로', () => {
  const r = setup();
  try {
    r.g('checkout', '-qb', 'b');
    r.add('rebuild/state/plans.jsonl', dec('DEC-0002', '그쪽 결정') + '\n' + dec('DEC-0003', '그쪽 둘째') + '\n'); r.add('rebuild/state/plan-log.jsonl', '{"seq":2,"w":"b"}\n');
    r.put('docs/textbook/storage-map.json', JSON.stringify({ files: [{ path: 'a.js', level: 'L2', area: 'code:x', write_keys: ['session:develop'] }, { path: 'guard.js', level: 'L6', area: 'guard:x', write_keys: ['human'] }, { path: 'newb.js' }] }));
    r.put('rebuild/status/00.md', 'b 쪽\n'); r.put('guard.js', 'b 가 바꿈\n'); r.add('src/a.js', 'b\n'); r.g('add', '-A'); r.g('commit', '-qm', 'b');
    r.g('checkout', '-q', 'main');
    r.add('rebuild/state/plans.jsonl', dec('DEC-0002', '우리 결정') + '\n'); r.add('rebuild/state/plan-log.jsonl', '{"seq":2,"w":"a"}\n');
    r.put('rebuild/status/00.md', 'a 쪽\n'); r.put('src/a.js', '2\n'); r.g('add', '-A'); r.g('commit', '-qm', 'a');
    const before = r.g('status', '--porcelain'), res = M.mergeCheck('b', r.dir), text = res.lines.join('\n');
    assert.equal(res.exit, 1); assert.match(text, /번호 충돌 1: DEC-0002/);
    assert.match(text, /다시 만든다 \(1\)[\s\S]*rebuild\/status\/00\.md/); assert.match(text, /손으로 \(1\)[\s\S]*src\/a\.js/);
    assert.match(text, /plan-log\)을 양쪽이 덧붙임/); assert.match(text, /권한 칸.*없는 것 1.*newb\.js/); assert.match(text, /그쪽이 L6.*guard\.js/);
    assert.equal(r.g('status', '--porcelain'), before, '시험 합치기가 작업 트리 · 색인을 바꾸지 않는다');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('통합: 겹침이 없으면 종료 코드 0 · 없는 브랜치는 2', () => {
  const r = setup();
  try {
    r.g('checkout', '-qb', 'b'); r.add('rebuild/state/plans.jsonl', dec('DEC-0003', '그쪽') + '\n'); r.g('add', '-A'); r.g('commit', '-qm', 'b');
    r.g('checkout', '-q', 'main'); r.put('src/other.js', 'x\n'); r.g('add', '-A'); r.g('commit', '-qm', 'a');
    const ok = M.mergeCheck('b', r.dir); assert.equal(ok.exit, 0); assert.match(ok.lines.join('\n'), /번호 충돌 없음/); assert.match(ok.lines.join('\n'), /결론: 손으로 풀 충돌과 번호 충돌이 없음/);
    const bad = M.mergeCheck('없는브랜치', r.dir); assert.equal(bad.exit, 2); assert.match(bad.lines[0], /읽을 수 없음/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

// PLAN-111 — db.json 의 새 번호 · 가정 원장 · 전환 기록의 차례 겹침
const db = (senses) => JSON.stringify({ format: 'definition-db', meta: { next: {} }, terms: {}, senses, steps: {}, limitations: {}, observations: {}, values: {} }, null, 2) + '\n';
const asm = (seq, id, v) => JSON.stringify({ seq, id, value: v, prev: 'p' });
const tr = (seq, why) => JSON.stringify({ seq, from: 'develop', to: 'author', why });

test('읽는 함수: db 번호 · seq 와 가정 번호', () => {
  assert.deepEqual([...M.dbIdsOf(db({ D900001: { k: 1 } })).keys()], ['D900001']);
  assert.equal(M.dbIdsOf('깨진 json').size, 0);
  assert.deepEqual([...M.seqsOf(asm(1, 'A900001', 1) + '\n' + tr(2, 'x') + '\n').keys()], ['seq 1', 'A900001', 'seq 2']);
});

test('통합 (PLAN-111): 두 브랜치가 같은 새 db 번호 · 가정 번호 · 전환 seq 를 다른 내용에 — 번호 충돌로 잡음 · 계획 기록 seq 는 막지 않음', () => {
  const r = setup();
  try {
    r.put('data/db.json', db({ D900001: { k: 'base' } })); r.put('data/assumptions.jsonl', asm(1, 'A900001', 1) + '\n'); r.put('workspace/transitions.jsonl', tr(1, '기반') + '\n');
    r.g('add', '-A'); r.g('commit', '-qm', 'ledgers');
    r.g('checkout', '-qb', 'b');
    r.put('data/db.json', db({ D900001: { k: 'base' }, D900002: { k: '그쪽' } })); r.add('data/assumptions.jsonl', asm(2, 'A900002', 'b') + '\n'); r.add('workspace/transitions.jsonl', tr(2, '그쪽') + '\n');
    r.add('rebuild/state/plan-log.jsonl', '{"seq":2,"w":"b"}\n'); r.g('add', '-A'); r.g('commit', '-qm', 'b');
    r.g('checkout', '-q', 'main');
    r.put('data/db.json', db({ D900001: { k: 'base' }, D900002: { k: '우리' } })); r.add('data/assumptions.jsonl', asm(2, 'A900002', 'a') + '\n'); r.add('workspace/transitions.jsonl', tr(2, '우리') + '\n');
    r.add('rebuild/state/plan-log.jsonl', '{"seq":2,"w":"a"}\n'); r.g('add', '-A'); r.g('commit', '-qm', 'a');
    const res = M.mergeCheck('b', r.dir), text = res.lines.join('\n');
    assert.equal(res.exit, 1);
    assert.match(text, /db \(T · D · S · L · O · V\)[^\n]*\n\s+★ 번호 충돌 1: D900002/);
    assert.match(text, /가정 원장[^\n]*\n\s+★ 번호 충돌 2: seq 2 · A900002/);
    assert.match(text, /전환 기록[^\n]*\n\s+★ 번호 충돌 1: seq 2/);
    assert.match(text, /계획 기록 \(seq\)[^\n]*\n\s+차례 겹침 1: seq 2 — 합칠 때 다시 매긴다/);
    assert.match(text, /결론: 번호 충돌 4/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('통합 (PLAN-111): 계획 기록 seq 만 겹치면 막지 않는다', () => {
  const r = setup();
  try {
    r.g('checkout', '-qb', 'b'); r.add('rebuild/state/plan-log.jsonl', '{"seq":2,"w":"b"}\n'); r.g('add', '-A'); r.g('commit', '-qm', 'b');
    r.g('checkout', '-q', 'main'); r.add('rebuild/state/plan-log.jsonl', '{"seq":2,"w":"a"}\n'); r.g('add', '-A'); r.g('commit', '-qm', 'a');
    const res = M.mergeCheck('b', r.dir);
    assert.match(res.lines.join('\n'), /차례 겹침 1: seq 2/); assert.equal(res.exit, 0, res.lines.join('\n'));
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
