// 권한 구조 시험 (STG-12 · DEC-0048) — 저장 지도의 열쇠·구역·자리·서기 호출 표
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAuthority, checkCallers } from '../judicial/authority.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = () => ({ ...JSON.parse(readFileSync(join(ROOT, 'docs/textbook/storage-map.json'), 'utf8')), authority: JSON.parse(readFileSync(join(ROOT, 'docs/textbook/authority.json'), 'utf8')) });
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules', 'target', 'tests', 'workspace'].includes(n)) return []; return statSync(p).isDirectory() ? walk(p) : /\.(mjs|js|cjs)$/.test(n) ? [relative(ROOT, p)] : []; });

test('지금 저장 지도의 권한 구조가 통과한다', () => {
  assert.deepEqual(checkAuthority(load()), []);
});

test('어기면 거부 — 여섯 가지', () => {
  const t = (f, re) => { const m = load(); f(m.authority.areas); const e = checkAuthority(m).join('\n'); assert.match(e, re); };
  t((A) => { A['data:db'].write_keys = ['session:develop']; }, /L5 구역 'data:db' 의 쓰는 열쇠는 서기/);
  t((A) => { A['code:core'].level = 'L3'; }, /max_level L2 를 넘음/);
  t((A) => { A['ledger:rules'].write_keys = ['session:develop']; }, /max_level L2 를 넘음/);
  t((A) => { A['ledger:plan'].write_keys = ['unassigned']; A['ledger:rules'].write_keys = ['unassigned']; }, /unassigned\)이 4/);
  t((A) => { A['guard:self-tests'].judge_keys = ['none']; }, /사람 확인\(human 판정\)/);
  t((A) => { A['data:db'].judge_keys = ['none']; }, /판정 열쇠\(judicial\)가 있어야/);
});

test('자리: 구역 밖 이름 · 구역과 다른 등급 · 구역 표 밖 열쇠는 거부', () => {
  const m = load(); m.files[0].area = '없는:구역'; assert.match(checkAuthority(m).join('\n'), /authority\.areas 에 없음/);
  const n = load(); n.files[0].level = n.files[0].level === 'L2' ? 'L3' : 'L2'; assert.match(checkAuthority(n).join('\n'), /등급/);
  const o = load(); o.files[0].write_keys = ['human', 'gate', 'tool.rules']; assert.match(checkAuthority(o).join('\n'), /부분집합/);
});

test('서기 쓰기 함수를 부르는 모듈은 표(authority.callers) 안에만 있다 — 코드 전체', () => {
  const map = load(), sources = {};
  for (const f of walk(ROOT)) if (f !== 'legislative/clerk.mjs') sources[f] = readFileSync(join(ROOT, f), 'utf8');
  assert.deepEqual(checkCallers(map, sources), []);
  assert.ok(Object.keys(sources).includes('dbtool.mjs'));
});

test('표 밖 모듈의 호출 · 더는 부르지 않는 낡은 표는 거부', () => {
  const map = load();
  assert.match(checkCallers(map, { 'x/evil.js': 'CLERK.commitMerge({})' }).join('\n'), /x\/evil\.js 가 commitMerge\(\) 을 부름/);
  assert.match(checkCallers(map, { 'dbtool.mjs': '// 아무것도 안 부름' }).join('\n'), /더 이상 부르지 않음/);
});
