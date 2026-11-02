// 승인 묶음 판정 시험 (STG-12 · 승인 묶음 설계 보고서) — 분류 · 거부 · 지문 · 승인 화면
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, decide, digest, screen, LIMITS } from '../judicial/approval.js';

const set = (o) => JSON.stringify(o, null, 2);
const S = (p) => set({ permissions: { allow: ['Read', ...(p.allow || [])], ask: p.ask || [], deny: p.deny || ['Edit(data/db.json)'] } });
const M = (develop) => set({ gate: { common: { write: ['x/status/**'], protect: ['workspace/receipts/**'] }, modes: { develop } } });

test('자기 검사 시험: 새 시험 블록을 통째로 더하면 자동 통과, 삭제가 있으면 사람 승인', () => {
  const t = "test('a', () => { assert.ok(1); });\n";
  assert.equal(classify({ path: 'tests/rebuild.test.mjs', before: t, after: t + "\ntest('b', () => {\n  assert.equal(2, 2);\n});\n" }).kind, 'added_only');
  assert.equal(classify({ path: 'tests/rebuild.test.mjs', before: t + 'x\n', after: t + 'y\n' }).kind, 'changed');
  const d = decide([{ path: 'tests/rebuild.test.mjs', before: t, after: t + "\ntest('b', () => {\n  assert.equal(2, 2);\n});\n" }]);
  assert.equal(d.auto.length, 1); assert.equal(d.approve.length + d.refused.length, 0);
});

test('눌러도 거부 ①: 검사를 느슨하게 — 검사 문장 줄이기 · 건너뛰기 · 바닥값 내리기', () => {
  assert.equal(classify({ path: 'tests/gate.test.mjs', before: 'assert.ok(1);\nassert.ok(2);\n', after: 'assert.ok(1);\n' }).kind, 'loosened');
  assert.equal(classify({ path: 'tests/gate.test.mjs', before: "test('a', () => {});\n", after: "test('a', () => {});\ntest.skip('b', () => {});\n" }).kind, 'loosened');
  assert.equal(classify({ path: 'tests/rebuild.test.mjs', before: 'const FLOOR = 22;\n', after: 'const FLOOR = 10;\n' }).kind, 'loosened');
  assert.equal(decide([{ path: 'tests/gate.test.mjs', before: 'assert.ok(1);\n', after: '' }]).refused.length, 1);
});

test('눌러도 거부 ②: 권한을 넓힘 — settings 의 allow 추가 · deny 제거 · ask 제거', () => {
  assert.equal(classify({ path: 'cfg/settings.json', role: 'settings', before: S({}), after: S({ allow: ['Bash(curl:*)'] }) }).kind, 'widened');
  assert.equal(classify({ path: 'cfg/settings.json', role: 'settings', before: S({}), after: S({ deny: [] }) }).kind, 'widened');
  assert.equal(classify({ path: 'cfg/settings.json', role: 'settings', before: S({ ask: ['Bash(git push:*)'] }), after: S({ ask: [] }) }).kind, 'widened');
  assert.equal(classify({ path: 'cfg/settings.json', role: 'settings', before: S({}), after: S({ ask: ['Bash(*)'] }) }).kind, 'widened', '마스터 권한 모양');
});

test('눌러도 거부 ③: 권한을 넓힘 — 모드 표의 write 추가 · except 제거', () => {
  assert.equal(classify({ path: 'cfg/modes.json', role: 'modes', before: M({ write: ['**'], except: ['data/**'] }), after: M({ write: ['**'], except: [] }) }).kind, 'widened');
  assert.equal(classify({ path: 'cfg/modes.json', role: 'modes', before: M({ write: ['a/**'] }), after: M({ write: ['a/**', 'data/**'] }) }).kind, 'widened');
});

test('좁히는 변경은 거부가 아니라 사람 승인 — except 추가 · ask 추가', () => {
  const r = classify({ path: 'cfg/modes.json', role: 'modes', before: M({ write: ['**'], except: ['data/**'] }), after: M({ write: ['**'], except: ['data/**', 'guard/gate.mjs'] }) });
  assert.equal(r.kind, 'changed'); assert.match(r.reasons.join(), /항상 사람 승인/);
  assert.equal(classify({ path: 'cfg/settings.json', role: 'settings', before: S({}), after: S({ ask: ['Edit(guard/gate.mjs)'] }) }).kind, 'changed');
});

test('문지기 코드는 줄만 더해도 항상 사람 승인', () => {
  assert.equal(classify({ path: 'guard/gate.mjs', role: 'guard', before: 'a\n', after: 'a\nb\n' }).kind, 'changed');
  assert.equal(decide([{ path: 'guard/gate.mjs', role: 'guard', before: 'a\n', after: 'a\nb\n' }]).approve.length, 1);
});

test('눌러도 거부 ④: 검토할 수 없는 내용 — 제어 문자 · 긴 줄 · 큰 묶음', () => {
  assert.equal(classify({ path: 'tests/gate.test.mjs', before: '', after: 'a‮b\n' }).kind, 'unreviewable');
  assert.equal(classify({ path: 'tests/gate.test.mjs', before: '', after: 'x'.repeat(LIMITS.maxLineLength + 1) + '\n' }).kind, 'unreviewable');
  assert.equal(classify({ path: 'tests/gate.test.mjs', before: '', after: Array.from({ length: LIMITS.maxChangedLines + 1 }, (_, i) => 'l' + i).join('\n') }).kind, 'unreviewable');
});

test('지문: 같은 묶음은 같고 한 글자나 파일이 달라지면 달라진다 · 순서와 무관', () => {
  const a = { path: 'a.js', before: '', after: 'one\n' }, b = { path: 'b.js', before: '', after: 'two\n' };
  assert.equal(digest([a, b]), digest([b, a]));
  assert.notEqual(digest([a, b]), digest([{ ...a, after: 'onf\n' }, b]));
  assert.notEqual(digest([a, b]), digest([a]));
  assert.match(digest([a]), /^[0-9a-f]{64}$/);
});

test('승인 화면: 지문이 첫 줄, 거부는 맨 위, 바뀐 줄 전부와 자리 정보를 보인다', () => {
  const ch = [{ path: 'guard/gate.mjs', role: 'guard', before: 'a\n', after: 'a\nb\n' }, { path: 'tests/gate.test.mjs', before: 'assert.ok(1);\n', after: '' }];
  const out = screen(ch, (p) => (p === 'guard/gate.mjs' ? { level: 'L6', area: 'guard:gate', write_keys: ['human'] } : null));
  const ls = out.split('\n');
  assert.equal(ls[0], `지문 ${digest(ch)}`);
  assert.ok(out.indexOf('거부 — 눌러도') < out.indexOf('사람 승인 필요'));
  assert.match(out, /guard\/gate\.mjs \[L6 guard:gate · human\]/);
  assert.match(out, /^\s+\+ b$/m); assert.match(out, /^\s+- assert\.ok\(1\);$/m);
});

test('줄만 더해도 사람 승인: 기존 블록 안에 끼움 · 목록에 줄 · 위험한 모양 · 검사 문장 없는 시험', () => {
  const base = "import x from 'y';\n\ntest('a', () => {\n  assert.equal(1, 1);\n});\n";
  const ap = (after) => classify({ path: 'tests/rebuild.test.mjs', before: base, after });
  assert.equal(ap(base.replace('  assert.equal(1, 1);\n', '  assert.equal(1, 1);\n  return;\n  assert.equal(2, 2);\n')).kind, 'changed', '기존 블록 안에 끼움');
  const list = "const OK = [\n  'a',\n];\n\ntest('t', () => {\n  assert.deepEqual(OK, ['a']);\n});\n";
  assert.equal(classify({ path: 'tests/rebuild.test.mjs', before: list, after: list.replace("  'a',\n", "  'a',\n  'evil',\n") }).kind, 'changed', '목록에 줄 더하기');
  for (const bad of ["test('x', () => {\n  process.exit(0);\n  assert.ok(0 === 0);\n});\n", "test('x', () => {\n  try { f(); } catch {}\n  assert.ok(1);\n});\n", "test('x', () => {\n  assert.ok(true);\n});\n", "test('x', () => {\n  const y = 1;\n});\n", "test('x', () => {\n  const FLOOR = 1;\n  assert.ok(FLOOR);\n});\n"])
    assert.equal(ap(base + '\n' + bad).kind, 'changed', bad);
  assert.equal(ap(base + "\ntest('ok', () => {\n  assert.equal(3, 3);\n});\n").kind, 'added_only', '안전한 새 블록은 자동 통과');
});
