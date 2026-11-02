// 보안 기준 고정 시험 (STG-12) — 어느 모드에서도 L6 를 못 쓰고, 합치기·되돌리기 뒤에도 그대로인지
//   병합 사고를 막으려는 시험: 모드 표(except)가 한 줄 빠지거나 저장 지도에서 L6 가 낮은 등급으로 바뀌어도 여기서 빨개진다.
//   기준(앵커)을 이 파일에 글자로 적어 둔다 — 기준을 바꾸려면 이 파일의 diff 가 보인다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../rebuild/gate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
// 기준 — 사람의 커밋으로만 바뀌어야 하는 파일 (문지기 · 설정 · 모드 표 · 권한의 뿌리)
const CORE = ['rebuild/gate.mjs', '.claude/settings.json', 'rebuild/rules/modes.json', 'docs/textbook/authority.json', 'judicial/authority.js', 'judicial/approval.js', 'rebuild/bundle.mjs', 'tests/authority.test.mjs', 'tests/approval.test.mjs', 'tests/bundle.test.mjs'];
// develop 이 설정 ask 로만 쓸 수 있는 자기 검사 시험
const SELF_TESTS = ['tests/gate.test.mjs', 'tests/affected.mjs', 'tests/trace.mjs', 'tests/snapshot.mjs', 'tests/permissions.test.mjs', 'tests/mutation/run.mjs', 'tests/governance.test.mjs', 'tests/rebuild.test.mjs'];

const l6 = () => J('docs/textbook/storage-map.json').files.filter((f) => f.level === 'L6' && !f.path.includes('*')).map((f) => f.path);
const writable = (P, mode, role, paths) => paths.filter((p) => G.mayWrite(P, mode, role, p));

test('기준 파일은 모두 저장 지도에서 L6 이다 — 등급을 낮춰 보호를 푸는 길 차단', () => {
  const have = new Set(l6());
  assert.deepEqual([...CORE, ...SELF_TESTS].filter((p) => !have.has(p)), [], 'L6 가 아니게 된 기준 파일');
});

test('author · baseline · field · inspect 와 수집가는 L6 를 쓰지 못한다', () => {
  const P = G.loadPolicy(), paths = l6();
  for (const m of ['author', 'baseline', 'field', 'inspect']) assert.deepEqual(writable(P, m, null, paths), [], `${m} 가 쓸 수 있는 L6`);
  assert.deepEqual(writable(P, 'author', 'collector', paths), [], '수집가가 쓸 수 있는 L6');
});

test('develop 은 기준 파일을 못 쓰고, 쓸 수 있는 L6 는 자기 검사 시험 8 뿐이며 그것들은 설정 ask 에 있다', () => {
  const P = G.loadPolicy(), paths = l6(), w = writable(P, 'develop', null, paths), ask = new Set(J('.claude/settings.json').permissions.ask);
  assert.deepEqual(w.filter((p) => !SELF_TESTS.includes(p)), [], 'develop 이 쓸 수 있는 L6 중 자기 검사 시험이 아닌 것');
  assert.deepEqual(writable(P, 'develop', null, CORE), [], 'develop 이 쓸 수 있는 기준 파일');
  for (const t of SELF_TESTS) for (const tool of ['Edit', 'Write']) assert.ok(ask.has(`${tool}(${t})`), `${tool}(${t}) 가 설정 ask 에 없음`);
});

test('검사가 실제로 무는지 — 정책에서 except 한 줄을 빼면 새는 것을 잡는다', () => {
  const P = JSON.parse(JSON.stringify(G.loadPolicy()));
  assert.deepEqual(writable(P, 'field', null, CORE), []);
  P.modes.field.except = P.modes.field.except.filter((x) => x !== 'docs/textbook/authority.json');
  assert.deepEqual(writable(P, 'field', null, CORE), ['docs/textbook/authority.json'], 'field 의 except 에서 빠진 권한 표가 새는 것을 잡는다');
  const Q = JSON.parse(JSON.stringify(G.loadPolicy()));
  Q.modes.develop.except = Q.modes.develop.except.filter((x) => x !== 'rebuild/gate.mjs');
  assert.deepEqual(writable(Q, 'develop', null, CORE), ['rebuild/gate.mjs'], 'develop 의 except 에서 빠진 문지기가 새는 것을 잡는다');
});
