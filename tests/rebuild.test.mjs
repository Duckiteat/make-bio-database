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
import * as RENDER from '../rebuild/render.mjs';

const X = IDX.build();

test('① 관리 파일이 최신이다 (node rebuild/status.mjs --write)', () => {
  const out = build();
  const stale = Object.entries(out).filter(([n, t]) => { const p = join(ROOT, STATUS, n); return !existsSync(p) || readFileSync(p, 'utf8') !== t; }).map(([n]) => n);
  assert.deepEqual(stale, [], '관리 파일이 낡음 — node rebuild/status.mjs --write');
  const extra = readdirSync(join(ROOT, STATUS)).filter((f) => !out[f]);
  assert.deepEqual(extra, [], '생성기가 만들지 않는 파일이 관리 폴더에 있음');
  // 6 단계 새 구조 초안 (rebuild/draft) — 원본에서 바이트 동일하게 다시 만들어진다
  const drafts = RENDER.build(ROOT), D = join(ROOT, 'rebuild/draft');
  const dStale = Object.entries(drafts).filter(([n, t]) => { const p = join(D, n); return !existsSync(p) || readFileSync(p, 'utf8') !== t; }).map(([n]) => n);
  assert.deepEqual(dStale, [], '새 구조 초안이 낡음 — node rebuild/status.mjs --write');
  const walk = (d, pre = '') => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n), pre + n + '/') : [pre + n]));
  assert.deepEqual(walk(D).filter((f) => !drafts[f]), [], '생성기가 만들지 않는 파일이 초안 폴더에 있음');
});

test('② 읽기 점검용: rebuild/ 밖의 코드는 rebuild/ 를 읽지 않는다', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules', 'target', 'rebuild'].includes(n)) return []; return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p)]; });
  const code = walk(ROOT).filter((p) => /\.(js|mjs|html)$/.test(p) && p !== 'tests/rebuild.test.mjs');
  const users = code.filter((p) => /rebuild\//.test(readFileSync(join(ROOT, p), 'utf8')));
  assert.deepEqual(users, ['legislative/clerk.mjs'], 'rebuild/ 를 가리키는 코드');
  const clerk = readFileSync(join(ROOT, 'legislative/clerk.mjs'), 'utf8').split('\n').filter((l) => /rebuild\//.test(l));
  assert.ok(clerk.every((l) => /ZONES|rebuild:|writeStatus|rebuild\/status|PLAN\.md/.test(l)), '서기는 구역 표와 쓰기 함수에서만 가리킨다');
});

test('③ 서기 구역 rebuild 는 rebuild/status/ 의 .md 와 rebuild/draft/ 의 새 구조 초안만', () => {
  assert.deepEqual(CLERK.ZONES.rebuild.allow, ['rebuild/status/', 'rebuild/draft/']);
  for (const bad of ['../x.md', 'x.json', 'X.md', 'a/b.md']) assert.throws(() => CLERK.writeStatus(bad, 'x', ROOT), /관리 파일 이름/, bad);
  for (const bad of ['../CLAUDE.md', 'modes/Author.md', 'modes/a/b.md', 'skills/x/other.md', 'x.md']) assert.throws(() => CLERK.writeDraftDoc(bad, 'x', ROOT), /새 구조 초안 이름/, bad);
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
  assert.match(build()['09-review.md'], /## 형식 오류\n\n없음\n/, '규칙 검토 목록: 없는 규칙·모르는 종류·근거 없음');
});

test('⑩ 맥락: 규칙마다 이유 판정 행이 있고, 연결 대상 종류가 맞고, 표 줄 규칙은 머리를 가진다', () => {
  const t = build()['08-context.md'];
  assert.match(t, /## 판정 행이 없는 규칙 \(0 이어야 함\)\n\n없음\n/);
  assert.match(t, /## 표 줄인데 머리가 없는 규칙 \(0 이어야 함\)\n\n없음\n/);
  assert.match(t, /## 형식 오류\n\n없음\n/);
});

test('⑪ 집행 변이 시험: 형식 오류가 없고, 놓친 규칙은 모두 검토 목록(enforcement_gap)에 있고, 모든 machine 규칙을 시험했다', () => {
  const t = build()['10-enforcement.md'];
  assert.match(t, /## 형식 오류\n\n없음\n/);
  assert.match(t, /## 아직 시험 안 함 — 0\n/);
});

test('⑫ 판정 코드가 규칙 번호를 낸다: 검사 자리마다 첫 인자가 살아 있는 RULE 번호 (5d)', () => {
  const rules = new Map(readFileSync(join(ROOT, 'rebuild/rules/rules.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.id, r]));
  // 파일 → 오류를 내는 도우미 (정의 줄은 '= (rule,' 로 시작해 건너뛴다)
  //   객체로 쌓는 모듈은 오류 객체의 rule 칸, 문자열로 쌓는 모듈은 같은 순서의 rules 목록 (rules[i] ↔ errors[i])
  const SITES = { 'judicial/judicial.js': ['E', 'W', 'AE'], 'legislative/legislative.js': ['ERR'], 'legislative/clerk.mjs': ['refuse'], 'judicial/fate_audit.js': ['AE', 'prob'], 'judicial/contract.js': ['E'],
    'judicial/assumption_audit.js': ['E', 'err'], 'judicial/dictionary_audit.js': ['err'], 'judicial/log_audit.js': ['err'], 'judicial/protocol.js': ['prob'], 'judicial/collection_audit.js': ['push', 'err'],
    'judicial/derivative.js': ['err'], 'judicial/identity.js': ['fail'], 'judicial/perturb_audit.js': ['P'], 'judicial/transition_audit.js': ['err'] };
  const bad = [], used = new Set(); let n = 0;
  for (const [f, names] of Object.entries(SITES)) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      for (const m of line.matchAll(new RegExp(`(?<![.\\w$])(${names.join('|')})\\(\\s*([^,)]*)`, 'g'))) {
        if (/=\s*$/.test(line.slice(0, m.index))) continue; // 도우미 정의
        n++;
        const id = (m[2].match(/^'(RULE-\d{4})'$/) || [])[1];
        if (!id && /^(?:[\w.]+\.)?rules\[\w+\]$|^rule$/.test(m[2].trim())) continue; // 앞 검사가 정한 번호를 그대로 넘김
        if (!id) bad.push(`${f}:${i + 1} ${m[1]}( 첫 인자가 규칙 번호가 아님: ${m[2].slice(0, 40)}`);
        else if (!rules.has(id)) bad.push(`${f}:${i + 1} 없는 규칙 ${id}`);
        else if (rules.get(id).retired) bad.push(`${f}:${i + 1} 은퇴한 규칙 ${id}`);
        else used.add(id);
      }
    });
  }
  assert.deepEqual(bad, [], `검사 자리 ${n}`);
  assert.ok(n >= 550, `검사 자리가 ${n} — 자리를 지웠는지 본다`);
  // 거꾸로: 코드에서 찾은 규칙(from_code)은 코드 어딘가에서 쓰인다
  const orphan = [...rules.values()].filter((r) => r.from_code && !used.has(r.id) && !readdirSync(join(ROOT, 'judicial')).some((x) => readFileSync(join(ROOT, 'judicial', x), 'utf8').includes(`'${r.id}'`)));
  assert.deepEqual(orphan.map((r) => r.id), [], '코드에서 찾은 규칙인데 코드가 쓰지 않음');
});

test('⑬ 옛 규칙 대조 (6 단계): 살아 있는 규칙은 모두 새 구조에 있다 — 글 규칙은 중심·모드 문서에 번호로, 기계 규칙은 그 모드의 개수에', () => {
  const rules = readFileSync(join(ROOT, 'rebuild/rules/rules.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.retired);
  const d = RENDER.build(ROOT), docs = Object.entries(d).filter(([n]) => !n.startsWith('skills/'));
  const where = (id) => docs.filter(([, t]) => t.includes('`' + id + '`')).map(([n]) => n);
  const lost = [], twice = [];
  for (const r of rules) {
    if (r.enforce === 'machine') continue;
    const w = where(r.id), want = r.modes.includes('common') ? ['CLAUDE.md'] : r.modes.map((m) => `modes/${m}.md`);
    if (!w.length) lost.push(r.id);
    else if (w.sort().join() !== want.sort().join()) twice.push(`${r.id}: ${w.join(', ')} (기대 ${want.join(', ')})`);
  }
  assert.deepEqual(lost, [], '새 구조에서 빠진 글 규칙');
  assert.deepEqual(twice, [], '모드와 다른 문서에 적힌 규칙');
  // 기계 규칙: 각 모드 문서가 밝힌 개수 = 장부에서 센 개수 (공통은 중심 문서)
  const count = (t, h) => Number((t.split(h)[1] || '').match(/(\d+) 개/)[1]);
  const mm = (m) => rules.filter((r) => r.enforce === 'machine' && (m === 'common' ? r.modes.includes('common') : r.modes.includes(m) && !r.modes.includes('common'))).length;
  assert.equal(count(d['CLAUDE.md'], '## 공통 규칙 — 컴퓨터가 막는다'), mm('common'));
  for (const m of RENDER.MODE_KEYS) assert.equal(count(d[`modes/${m}.md`], '## 컴퓨터가 막는 규칙'), mm(m), m);
  // 스킬은 모드 문서와 같은 본문
  for (const m of RENDER.MODE_KEYS) assert.ok(d[`skills/${m}/SKILL.md`].endsWith(d[`modes/${m}.md`]), m);
});

test('⑭ 명령 장부 (6c): dbtool 의 명령·MCP 의 도구가 장부와 하나씩 맞고, 모드·쓰기 구역은 정해진 것만', () => {
  const C = readFileSync(join(ROOT, 'rebuild/rules/commands.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const cli = [...readFileSync(join(ROOT, 'dbtool.mjs'), 'utf8').matchAll(/^  case '([a-z-]+)'/gm)].map((m) => 'dbtool ' + m[1]).sort();
  const mcp = readdirSync(join(ROOT, 'mcp')).flatMap((f) => [...readFileSync(join(ROOT, 'mcp', f), 'utf8').matchAll(/\{ name: '([a-z_]+)', roles:/g)].map((m) => 'mcp ' + m[1])).sort();
  assert.deepEqual(C.filter((c) => c.kind === 'cli').map((c) => c.cmd).sort(), cli, 'dbtool 명령 ↔ 장부');
  assert.deepEqual(C.filter((c) => c.kind === 'mcp').map((c) => c.cmd).sort(), [...new Set(mcp)].sort(), 'MCP 도구 ↔ 장부');
  const modes = Object.keys(JSON.parse(readFileSync(join(ROOT, 'rebuild/rules/modes.json'), 'utf8')).modes.reduce((o, m) => ({ ...o, [m.key]: 1 }), {}));
  for (const c of C) {
    assert.ok(c.modes.length && c.modes.every((m) => modes.includes(m)), `${c.cmd}: 모드 ${c.modes}`);
    assert.ok(c.what && c.what.trim(), `${c.cmd}: 설명`);
    for (const z of c.writes ? c.writes.split(' · ') : []) assert.ok(CLERK.ZONES[z], `${c.cmd}: 모르는 구역 ${z}`);
  }
});
