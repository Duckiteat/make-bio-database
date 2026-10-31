// 상시 권한 장부 (재건 10g · RULE-0521) — rebuild/permissions.mjs
//   ① 지금: .claude/settings.json allow·ask 와 문지기 모드 write·also 가 장부와 같다 · 장부는 규칙 장부 도구의 봉인 아래
//   ② 거부 사례 (합성): 장부 밖 권한 · 두 곳에 없는 장부 줄 · 보호 자리 · 전부 허용 · 빈 칸 · 모르는 층·목록·모드 · 겹침
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../rebuild/permissions.mjs';
import * as LEDGER from '../rebuild/rules.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

test('① 권한은 장부에 있는 것만 — settings · 문지기 모드 모두 (RULE-0521)', () => {
  const L = P.load(ROOT);
  assert.ok(L.rows.length > 0, '장부가 비었음');
  assert.deepEqual(P.check(L), []);
  assert.deepEqual(LEDGER.check(LEDGER.load(ROOT)).filter((e) => /permissions/.test(e)), [], '장부는 규칙 장부 도구의 봉인 아래 (RULE-0519)');
  for (const r of L.rows) assert.match(r.id, /^PERM-\d{4}$/);
});

test('② 거부 사례 (합성)', () => {
  const row = (o) => ({ id: 'PERM-9001', layer: 'settings', list: 'allow', what: ['Read'], why: '읽기', by: 'user', at: '2026-10-31', revoke: '지움', ...o });
  const base = { rows: [row({})], settings: { allow: ['Read'], ask: [] }, gate: { develop: { write: [], also: [] } } };
  const errs = (o) => P.check({ ...base, ...o }).join('\n');
  assert.deepEqual(P.check(base), [], '같으면 통과');
  assert.match(errs({ settings: { allow: ['Read', 'Bash(curl:*)'], ask: [] } }), /^RULE-0521 \.claude\/settings\.json allow: 'Bash\(curl:\*\)' 는 장부 밖 권한/m);
  assert.match(errs({ settings: { allow: [], ask: [] } }), /장부 줄의 'Read' 가 \.claude\/settings\.json allow 에 없음/);
  assert.match(errs({ rows: [row({ what: ['Edit(.claude/settings.json)'] })], settings: { allow: ['Edit(.claude/settings.json)'], ask: [] } }), /보호 자리\(\.claude\/settings\.json\)/);
  assert.match(errs({ rows: [row({ layer: 'gate', mode: 'develop', list: 'also', what: ['rebuild/gate.mjs'] })], settings: { allow: [], ask: [] }, gate: { develop: { write: [], also: ['rebuild/gate.mjs'] } } }), /보호 자리\(rebuild\/gate\.mjs\)/);
  for (const w of ['Bash', 'Bash(*)', '*', 'mcp__github__*']) assert.match(errs({ rows: [row({ what: [w] })], settings: { allow: [w], ask: [] } }), /전부 허용\(마스터 권한\)/, w);
  assert.match(errs({ rows: [row({ why: ' ' })] }), /'why' 가 비었음/);
  assert.match(errs({ rows: [row({ revoke: '' })] }), /'revoke' 가 비었음/);
  assert.match(errs({ rows: [row({ layer: 'hook' })] }), /모르는 층 'hook'/);
  assert.match(errs({ rows: [row({ list: 'deny' })] }), /settings 의 목록은 allow · ask/);
  assert.match(errs({ rows: [row({ layer: 'gate', mode: 'admin', list: 'write' })] }), /모르는 모드 'admin'/);
  assert.match(errs({ rows: [row({}), row({ id: 'PERM-9002' })] }), /'Read' 가 PERM-9001 에도 있음/);
  assert.match(errs({ gate: { develop: { write: ['**'], also: [] } } }), /modes\.json gate develop write: '\*\*' 는 장부 밖 권한/);
});
