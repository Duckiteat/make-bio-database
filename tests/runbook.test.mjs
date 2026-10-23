// 실행 설명서가 낡지 않게 묶는다 (docs/RUNBOOK.md).
//   설명서는 "적힌 명령은 전부 실제로 돌려 확인했다" 고 약속한다 — 그 약속이 썩지 않게 시험이 지킨다.
//   여기서 시뮬레이션을 돌리지는 않는다(느리다). 가리키는 것이 존재하는지만 본다:
//   ① dbtool 명령 이름 ② 운명 표의 상태×시나리오 짝 ③ 경로 목록의 번호와 kind ④ 문서·파일 경로.
//   표 모양이 바뀌면 이 시험이 먼저 실패한다 — 설명서와 파서를 같이 고친다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const DefDB = req('../core.js');
const ROOT = new URL('../', import.meta.url);
const DB = DefDB.normalize(JSON.parse(readFileSync(new URL('data/db.json', ROOT), 'utf8')));
const DOC = readFileSync(new URL('docs/RUNBOOK.md', ROOT), 'utf8');
const uniq = (a) => [...new Set(a)];
const has = (p) => existsSync(new URL(p, ROOT));

test('① 설명서가 적는 dbtool 명령이 모두 실재한다', () => {
  const src = readFileSync(new URL('dbtool.mjs', ROOT), 'utf8');
  const known = new Set((src.match(/명령: ([^\n(]+)/) || [, ''])[1].split('|').map((x) => x.trim()).filter(Boolean));
  assert.ok(known.size > 10, 'dbtool 의 명령 목록을 읽지 못했다');
  const used = uniq([...DOC.matchAll(/node dbtool\.mjs ([a-z-]+)/g)].map((m) => m[1]));
  assert.ok(used.length > 10, `설명서에서 명령을 찾지 못했다 (${used.length} 개)`);
  assert.deepEqual(used.filter((c) => !known.has(c)), [], `설명서가 없는 명령을 적고 있다 (dbtool 목록: ${[...known].join(' ')})`);
});

// 운명 표의 행: | `D000174` | `fate-effector-il12` | … | PASS |   (막힌 짝은 ~~`D000203`~~ 로 적는다)
const fateRows = [...DOC.matchAll(/^\| (~~)?`(D\d{6})`(~~)? \| `([a-z0-9-]+)` \|.*\|\s*(?:\*\*)?(PASS|FAIL)/gm)]
  .map((m) => ({ struck: !!m[1], id: m[2], scen: m[4], verdict: m[5] }));

test('② 운명 표의 상태×시나리오 짝이 실재하고, 상태는 cell_state 다', () => {
  assert.ok(fateRows.length >= 9, `운명 표를 읽지 못했다 (${fateRows.length} 행) — 표 모양이 바뀌었으면 파서도 고친다`);
  for (const r of fateRows) {
    assert.ok(DB.senses[r.id], `${r.id} 없음`);
    assert.equal(DB.senses[r.id].kind, 'cell_state', `${r.id} 는 표에서 세포 상태로 적혀 있다`);
    assert.ok(has(`examples/scenarios/${r.scen}-hypothetical.json`), `시나리오 없음: ${r.scen}-hypothetical.json`);
  }
  // 권하는 짝은 PASS, 막은 짝(취소선)은 FAIL 로 적혀 있어야 한다
  assert.deepEqual(fateRows.filter((r) => r.struck && r.verdict !== 'FAIL').map((r) => r.id), [], '취소선 행은 FAIL 이어야 한다');
  assert.deepEqual(fateRows.filter((r) => !r.struck && r.verdict !== 'PASS').map((r) => r.id), [], 'PASS 가 아닌 짝을 권하고 있다');
});

test('③ 경로·상태 목록의 번호가 실재하고 kind 가 맞다', () => {
  const sec = (re) => (DOC.match(re) || [, ''])[1];
  const paths = uniq([...sec(/\*\*경로 \d+ 개\*\* \(`simulate`\):([\s\S]*?)\n\n/).matchAll(/`(D\d{6})`/g)].map((m) => m[1]));
  const states = uniq([...sec(/\*\*세포 상태 \d+ 개\*\* \(`fate`\):([\s\S]*?)\n\n/).matchAll(/`(D\d{6})`/g)].map((m) => m[1]));
  assert.ok(paths.length >= 8 && states.length >= 6, `목록을 읽지 못했다 (경로 ${paths.length} · 상태 ${states.length})`);
  for (const id of paths) { assert.ok(DB.senses[id], `${id} 없음`); assert.equal(DB.senses[id].kind, 'pathway', `${id} 는 목록에서 경로로 적혀 있다`); }
  for (const id of states) { assert.ok(DB.senses[id], `${id} 없음`); assert.equal(DB.senses[id].kind, 'cell_state', `${id} 는 목록에서 세포 상태로 적혀 있다`); }
  // 목록이 db 의 전부를 담고 있는지 (새 경로·상태가 들어오면 설명서를 갱신하게)
  const allPaths = Object.entries(DB.senses).filter(([, s]) => s.kind === 'pathway').map(([k]) => k);
  const allStates = Object.entries(DB.senses).filter(([, s]) => s.kind === 'cell_state').map(([k]) => k);
  assert.deepEqual(allPaths.filter((id) => !paths.includes(id)), [], '설명서에 빠진 경로 — 목록을 갱신한다');
  assert.deepEqual(allStates.filter((id) => !states.includes(id)), [], '설명서에 빠진 세포 상태 — 목록을 갱신한다');
});

test('⑤ 설명서가 적는 시험 수가 지금 수와 같다 (숫자가 썩지 않게)', () => {
  const FLOOR = JSON.parse(readFileSync(new URL('fixtures/FLOOR.json', import.meta.url), 'utf8'));
  const m = DOC.match(/node --test tests\/\*\.test\.mjs\s+# (\d+)\/(\d+)/);
  assert.ok(m, '설명서의 시험 수 줄을 찾지 못했다');
  assert.equal(Number(m[1]), FLOOR.tests, '설명서의 시험 수가 낡았다 — 설명서와 FLOOR.json 을 같이 고친다');
  assert.equal(Number(m[2]), FLOOR.tests, '설명서의 시험 수가 낡았다');
});

test('④ 설명서가 가리키는 문서·파일 경로가 모두 있다', () => {
  const paths = uniq([...DOC.matchAll(/`((?:docs|tests|examples|data|engine|schemas|compiler|judicial|legislative|migrations)\/[^`]+)`/g)].map((m) => m[1]))
    .filter((p) => !/[*…<>]/.test(p) && !p.endsWith('/'));
  assert.ok(paths.length >= 8, `설명서에서 경로를 찾지 못했다 (${paths.length} 개)`);
  assert.deepEqual(paths.filter((p) => !has(p)), [], '설명서가 없는 파일을 가리킨다');
});
