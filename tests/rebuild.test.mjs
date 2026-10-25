// 재건 관리 파일 (rebuild/PLAN.md §6) — 자동 갱신되고, 읽기 점검용으로만 쓰인다.
//   ① 관리 파일이 지금 저장소와 같다 (개수·크기·건수가 바뀌면 갱신돼야 함)
//   ② 읽기 점검용: rebuild/ 밖의 코드는 rebuild/ 를 가리키지 않는다 (서기의 구역 표만 예외)
//   ③ 서기 구역 rebuild 는 rebuild/status/ 의 .md 만
//   ④ 분류 장부에 형식 오류가 없다
//   ⑧ 파일 → 모드: 모든 파일이 규칙 하나에 맞고, 쓰이지 않는 규칙·모르는 모드가 없다
//   ⑩ 맥락: 규칙마다 이유 판정(because·inline·decided_by·none) · 대상 종류 · 표 머리
//   ⑤–⑦ 번호 사전 (rebuild/index): 표 형식 · 예시가 자기 이름공간에만 · 저장소의 번호 모양이 모두 이름공간 하나에
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build, ROOT, STATUS } from '../rebuild/status.mjs';
import * as CLERK from '../legislative/clerk.mjs';
import * as IDX from '../rebuild/index.mjs';

const X = IDX.build();

test('① 관리 파일이 최신이다 (node rebuild/status.mjs --write)', () => {
  const out = build();
  const stale = Object.entries(out).filter(([n, t]) => { const p = join(ROOT, STATUS, n); return !existsSync(p) || readFileSync(p, 'utf8') !== t; }).map(([n]) => n);
  assert.deepEqual(stale, [], '관리 파일이 낡음 — node rebuild/status.mjs --write');
  const extra = readdirSync(join(ROOT, STATUS)).filter((f) => !out[f]);
  assert.deepEqual(extra, [], '생성기가 만들지 않는 파일이 관리 폴더에 있음');
});

test('② 읽기 점검용: rebuild/ 밖의 코드는 rebuild/ 를 읽지 않는다', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules', 'target', 'rebuild'].includes(n)) return []; return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p)]; });
  const code = walk(ROOT).filter((p) => /\.(js|mjs|html)$/.test(p) && p !== 'tests/rebuild.test.mjs');
  const users = code.filter((p) => /rebuild\//.test(readFileSync(join(ROOT, p), 'utf8')));
  assert.deepEqual(users, ['legislative/clerk.mjs'], 'rebuild/ 를 가리키는 코드');
  const clerk = readFileSync(join(ROOT, 'legislative/clerk.mjs'), 'utf8').split('\n').filter((l) => /rebuild\//.test(l));
  assert.ok(clerk.every((l) => /ZONES|rebuild:|writeStatus|rebuild\/status|PLAN\.md/.test(l)), '서기는 구역 표와 쓰기 함수에서만 가리킨다');
});

test('③ 서기 구역 rebuild 는 rebuild/status/ 의 .md 만', () => {
  assert.deepEqual(CLERK.ZONES.rebuild.allow, ['rebuild/status/']);
  for (const bad of ['../x.md', 'x.json', 'X.md', 'a/b.md']) assert.throws(() => CLERK.writeStatus(bad, 'x', ROOT), /관리 파일 이름/, bad);
});

test('④ 분류 장부에 형식 오류가 없고, 분류한 문서는 빠진 줄이 없다', () => {
  const t = build()['04-ledger.md'];
  assert.match(t, /## 형식 오류\n\n없음\n/, '장부 형식 오류 — rebuild/status/04-ledger.md 를 본다');
  // 분류를 시작한 문서는 모든 줄에 단위가 있다 (부분 분류를 끝난 것으로 두지 않는다)
  const cov = (t.split('## 단위가 없는 줄')[1] || '').split('## ')[0];
  for (const row of cov.split('\n').filter((l) => /^\| `/.test(l))) assert.match(row, /\| 없음 \|$/, `단위가 빠진 줄: ${row}`);
  assert.doesNotMatch(t, /없는 단위를 가리킴/, 'same_as 가 없는 단위를 가리킴');
});

test('⑤ 번호 사전: 이름공간 표에 형식 오류가 없고, 형식은 모두 정규식으로 풀린다', () => {
  assert.deepEqual(X.bad, []);
  assert.ok(X.rows.length >= 40, `이름공간 ${X.rows.length}`);
  for (const r of X.rows) if (r.shape !== 'vocab') assert.ok(r.re instanceof RegExp, r.ns);
});

test('⑥ 번호 사전: 예시는 자기 이름공간에만 맞는다 (형식끼리 겹치지 않는다)', () => {
  assert.deepEqual(X.exampleIssues, []);
});

test('⑦ 번호 사전: 저장소의 번호 모양 토큰은 모두 이름공간 하나에 맞는다 (새 번호 종류는 표에 먼저)', () => {
  assert.deepEqual(X.unknown, [], '미등록 번호 모양 — rebuild/index/namespaces.jsonl 에 이름공간을 올리거나 exceptions.jsonl 에 이유와 함께');
  assert.deepEqual(X.overlap, [], '두 이름공간에 맞는 토큰');
});

test('⑧ 파일 → 모드: 모든 파일이 규칙 하나에 맞고, 쓰이지 않는 규칙·모르는 모드가 없다', () => {
  const t = build()['06-file-modes.md'];
  assert.match(t, /## 규칙에 맞지 않는 파일 \(0 이어야 함\)\n\n없음\n/, 'rebuild/index/file-modes.jsonl 에 규칙을 더한다');
  assert.match(t, /## 아무 파일에도 맞지 않는 규칙 · 모르는 모드\n\n없음\n/);
});

test('⑨ 규칙 장부: 번호·단위가 맞고, 판단 규칙 단위는 모두 RULE 하나에 있다', () => {
  const t = build()['07-rules.md'];
  assert.match(t, /## 장부에 없는 판단 규칙 단위 \(0 이어야 함\)\n\n없음\n/);
  assert.match(t, /## 형식 오류\n\n없음\n/);
});

test('⑩ 맥락: 규칙마다 이유 판정 행이 있고, 연결 대상 종류가 맞고, 표 줄 규칙은 머리를 가진다', () => {
  const t = build()['08-context.md'];
  assert.match(t, /## 판정 행이 없는 규칙 \(0 이어야 함\)\n\n없음\n/);
  assert.match(t, /## 표 줄인데 머리가 없는 규칙 \(0 이어야 함\)\n\n없음\n/);
  assert.match(t, /## 형식 오류\n\n없음\n/);
});
