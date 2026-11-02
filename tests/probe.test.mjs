// 작업 도구 (STG-11a–d · DEC-0047) — 파일 탐침 · 깨진 참조 세 등급 · 규칙 한 번에 · 감싼 확인 명령
//   ① 글 속 경로 찾기 ② 깨진 참조: 첫 등급(경로 없음) · 둘째 등급(변이 자리 어긋남) · 아직 안 만든 자리는 깨짐 아님
//   ③ 고치기 계획: 이동만 자동(장부 · 계획 · 저장 지도 줄), 둘째 등급과 이동 기록 없는 깨짐은 남김
//   ④ 지금 저장소: 깨진 참조 0 · 탐침이 규칙·같이 고친 파일을 보임 ⑤ 규칙 한 번에: 먼저 확인 · 묶음이 장부 검사를 지남
//   ⑥ 확인(ask) 명령을 감싼 스크립트는 설정 allow 에 없다 — 감싸서 확인을 건너뛰지 않음 (RULE-0461)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as PR from '../rebuild/probe.mjs';
import * as RU from '../rebuild/rules.mjs';

const root = new Set(['vocab.js', 'CHANGES.md']);
const ctxOf = (o) => ({ exists: new Set(o.exists), rootFiles: root, rules: o.rules || [], enforcement: o.enforcement || [], links: o.links || [], plan: o.plan || [], map: o.map || null, read: (p) => (o.src || {})[p] ?? null, everTracked: (p) => (o.tracked || []).includes(p) });

test('① 글 속 경로 — a/b.js 꼴과 최상위 맨 이름만, 별표·숨김은 뺌', () => {
  assert.deepEqual(PR.pathsIn('judicial/judicial.js checkReported · vocab.js unitExact · assay_audit.js · tests/*.mjs · docs/textbook/03-데이터-모델.md', root).sort(),
    ['docs/textbook/03-데이터-모델.md', 'judicial/judicial.js', 'vocab.js']);
});

test('② 깨진 참조 — 첫 등급 · 둘째 등급 · 폴더 · 아직 안 만든 자리', () => {
  const ctx = ctxOf({
    exists: ['judicial/a.js', 'tests/x.test.mjs', 'tests/fixtures/rej/1.json'],
    rules: [{ id: 'RULE-0001', where: 'judicial/gone.js check · judicial/a.js' }, { id: 'RULE-0002', where: 'judicial/gone.js', retired: true }],
    enforcement: [{ rule: 'RULE-0001', op: 'replace', file: 'judicial/a.js', find: "E('RULE-0001', w, 'old'", tests: ['tests/x.test.mjs'] }, { rule: 'RULE-0003', op: 'delete', file: 'tests/fixtures/rej/' }],
    links: [{ from: 'RULE-0001', rel: 'because', to: 'code:judicial/gone.js' }],
    plan: [{ id: 'PLAN-901', mark: '☐', fields: { '자리': '`judicial/gone.js`' } }, { id: 'PLAN-902', mark: '☑', fields: { '자리': 'judicial/gone.js' } }],
    map: { files: [{ path: 'data/future.jsonl' }, { path: 'judicial/deleted.js' }] }, tracked: ['judicial/deleted.js'],
    src: { 'judicial/a.js': "E('RULE-0001', w, 'new')" },
  });
  const b = PR.brokenRefs(ctx), k = b.map((x) => `${x.tier} ${x.kind} ${x.key}`).sort();
  assert.deepEqual(k, ['1 links.to RULE-0001|because|code:judicial/gone.js', '1 plan.자리 PLAN-901', '1 rules.where RULE-0001', '1 storage-map.path judicial/deleted.js', '2 enforcement.find RULE-0001'],
    '은퇴 규칙 · 끝난 계획 · 폴더(끝 /) · 아직 안 만든 저장 자리는 깨짐이 아님');
  assert.match(PR.findCandidates(ctx, 'RULE-0001', 'judicial/a.js')[0], /^judicial\/a\.js:1 /, '둘째 등급 후보 — 그 규칙 번호를 내는 줄');
});

test('③ 고치기 계획 — git 이 이동으로 본 것만 자동, 둘째 등급과 이동 기록 없는 것은 남김', () => {
  const ctx = ctxOf({
    exists: ['judicial/new.js', 'tests/y.test.mjs'],
    rules: [{ id: 'RULE-0001', where: 'judicial/old.js f · judicial/old.js g' }],
    enforcement: [{ rule: 'RULE-0001', op: 'replace', file: 'judicial/old.js', find: 'x', tests: ['tests/x.test.mjs', 'tests/keep.test.mjs'] }],
    plan: [{ id: 'PLAN-901', mark: '☐', fields: { '자리': 'judicial/old.js' } }],
  });
  const broken = [
    { tier: 1, kind: 'rules.where', key: 'RULE-0001', path: 'judicial/old.js' }, { tier: 1, kind: 'enforcement.file', key: 'RULE-0001', path: 'judicial/old.js' },
    { tier: 1, kind: 'enforcement.tests', key: 'RULE-0001', path: 'tests/x.test.mjs' }, { tier: 1, kind: 'plan.자리', key: 'PLAN-901', path: 'judicial/old.js' },
    { tier: 1, kind: 'storage-map.path', key: 'judicial/old.js', path: 'judicial/old.js' }, { tier: 1, kind: 'enforcement.tests', key: 'RULE-0001', path: 'tests/keep.test.mjs' },
    { tier: 2, kind: 'enforcement.find', key: 'RULE-0001', path: 'judicial/new.js', count: 0 },
  ];
  const fx = PR.planFixes(ctx, broken, new Map([['judicial/old.js', 'judicial/new.js'], ['tests/x.test.mjs', 'tests/y.test.mjs']]));
  assert.deepEqual(fx.rules.find((o) => o.file === 'rules').fields, { where: 'judicial/new.js f · judicial/new.js g' });
  assert.deepEqual(fx.rules.find((o) => o.fields.file).fields, { file: 'judicial/new.js' });
  assert.deepEqual(fx.rules.find((o) => o.fields.tests).fields, { tests: ['tests/y.test.mjs', 'tests/keep.test.mjs'] });
  assert.deepEqual(fx.plan, [{ op: 'scope', id: 'PLAN-901', field: '자리', to: 'judicial/new.js' }]);
  assert.deepEqual(fx.mapSub, [['judicial/old.js', 'judicial/new.js']]);
  assert.deepEqual(fx.left.map((b) => `${b.tier} ${b.kind} ${b.path}`).sort(), ['1 enforcement.tests tests/keep.test.mjs', '2 enforcement.find judicial/new.js'], '이동 기록 없음 · 둘째 등급은 고치지 않음');
});

test('④ 지금 저장소 — 깨진 참조 0 · 탐침이 규칙 · 같이 고친 파일 · 처방을 보임', async () => {
  const ctx = PR.context();
  assert.deepEqual(PR.brokenRefs(ctx).map((b) => `${b.kind} ${b.key} ${b.path}`), [], '깨진 참조 — node rebuild/probe.mjs --check');
  const out = (await PR.probe(ctx, 'judicial/judicial.js')).join('\n');
  assert.match(out, /^규칙 \d+/m); assert.match(out, /^처방 — /m);
  assert.match((await PR.probe(ctx, 'RULE-0526')).join('\n'), /집행 — replace judicial\/judicial\.js · find 1 곳/);
});

test('⑤ 규칙 한 번에 — 먼저 확인(find 한 곳 · 규칙 번호 글자 그대로 · code: 연결) · 묶음은 장부 검사를 지남', () => {
  const src = { 'judicial/x.js': "if (bad) E('RULE-9999', w, 'msg');\n" };
  const read = (p) => src[p] ?? null;
  const spec = (o = {}) => ({ at: '2026-11-01', why: '시험', rule: { id: 'RULE-9999', text: '시험 규칙', modes: ['develop'], where: 'judicial/x.js check', from_code: '시험' }, link: { rel: 'because', to: 'code:judicial/x.js', by: 'judged' }, enforcement: { op: 'replace', file: 'judicial/x.js', find: "if (bad) E('RULE-9999'", repl: "if (false) E('RULE-9999'", tests: ['tests/x.test.mjs'] }, ...o });
  assert.deepEqual(RU.rulePreflight(spec(), read), []);
  assert.match(RU.rulePreflight(spec({ enforcement: { ...spec().enforcement, find: 'nowhere' } }), read).join(), /0 곳 — 정확히 1/);
  assert.match(RU.rulePreflight(spec({ link: { rel: 'because', to: 'RULE-0001', by: 'judged' } }), read).join(), /code:/);
  assert.match(RU.rulePreflight(spec(), () => "if (bad) E(x.rule, w, 'msg');").join(), /0 곳|글자 그대로/);
  assert.match(RU.rulePreflight(spec({ rule: { ...spec().rule, from_code: undefined } }), read).join(), /from_code/);
  const change = RU.ruleOps(spec(), { result: 'caught', red: '① 시험' });
  assert.equal(change.ops[2].row.red, '① 시험'); assert.equal(change.ops[0].row.enforce, 'machine');
  const { errs } = RU.apply(RU.load(), change);
  assert.deepEqual(errs, [], '규칙 · 연결 · 집행 세 줄이 한 묶음으로 장부 검사를 지남 (쓰지는 않음)');
});

test('⑥ 확인(ask) 명령을 감싼 스크립트는 설정 allow 에 없다 — 감싸서 확인을 건너뛰지 않음 (RULE-0461)', () => {
  const S = JSON.parse(readFileSync(new URL('../.claude/settings.json', import.meta.url), 'utf8')).permissions;
  const wraps = ['rebuild/regen.mjs']; // dbtool textbook --write (ask) 를 부름
  for (const w of wraps) {
    assert.match(readFileSync(new URL('../' + w, import.meta.url), 'utf8'), /'textbook', '--write'/, `${w} 가 감싼 명령`);
    assert.ok(!S.allow.some((a) => a.includes(w)), `${w} 이 allow 에 있으면 확인 없이 교과서 부록을 씀`);
  }
  assert.ok(S.ask.some((a) => a.includes('textbook --write')), '감싼 명령이 여전히 확인(ask) 명령');
});

test('⑦ 새 파일의 연결 후보: 규칙에 닿는 파일은 규칙을 보이고, 어디에도 안 닿으면 알린다 (제안 — 막지 않음)', async () => {
  const ctx = PR.context(PR.ROOT ?? undefined);
  const hit = (await PR.linkHints(ctx, ['judicial/authority.js'])).join('\n');
  assert.match(hit, /새 파일 judicial\/authority\.js/);
  assert.match(hit, /규칙 1/);
  assert.doesNotMatch(hit, /연결 없음/);
  const miss = (await PR.linkHints(ctx, ['tests/authority.test.mjs'])).join('\n');
  assert.match(miss, /새 파일 tests\/authority\.test\.mjs/);
  assert.deepEqual(await PR.linkHints(ctx, ['없는/파일.js']), []); // 없는 파일은 건너뜀
  assert.ok(Array.isArray(PR.newFiles()));
});

test('⑧ 자기 검사 시험(L6)에 새 시험 블록을 더하면 새 L2 파일로 안내한다 (제안 — 막지 않음)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'l6add-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  try {
    g('init', '-q'); mkdirSync(join(dir, 'tests'));
    for (const f of ['a.test.mjs', 'b.test.mjs']) writeFileSync(join(dir, 'tests', f), "test('x', () => {});\n");
    g('add', '-A'); g('commit', '-qm', 'base');
    const ctx = { root: dir, map: { files: [{ path: 'tests/a.test.mjs', area: 'guard:self-tests' }, { path: 'tests/b.test.mjs', area: 'code:tests' }] } };
    assert.deepEqual(PR.l6TestAdds(ctx), [], '바뀐 것이 없으면 안내 없음');
    appendFileSync(join(dir, 'tests/a.test.mjs'), "test('y', () => {});\ntest('z', () => {});\n");
    appendFileSync(join(dir, 'tests/b.test.mjs'), "test('w', () => {});\n");
    const out = PR.l6TestAdds(ctx);
    assert.equal(out.length, 1, 'L6 파일만 — 일반 시험 파일에 더하는 것은 안내하지 않음');
    assert.match(out[0], /tests\/a\.test\.mjs: 새 시험 블록 2 개 — 일상 시험이면 새 L2 파일/);
    assert.deepEqual(PR.l6TestAdds({ root: dir, map: null }), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('⑨ 영수증 감사 (RULE-0529): GitHub 파일 쓰기 도구가 영수증에 있으면 잡고, 읽기 도구나 다른 일은 건드리지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-'));
  try {
    mkdirSync(join(dir, 'workspace', 'receipts'), { recursive: true });
    const w = (name, evs) => writeFileSync(join(dir, 'workspace', 'receipts', name), evs.map((e) => JSON.stringify(e)).join('\n') + '\n');
    w('ok.jsonl', [{ t: 'tool', tool: 'mcp__github__get_me' }, { t: 'tool', tool: 'mcp__github__create_pull_request' }, { t: 'tool', tool: 'Bash', target: 'echo push_files' }, { t: 'open', mode: 'develop' }]);
    assert.deepEqual(PR.auditReceipts(dir), [], '읽기 도구 · PR 만들기 · 명령 글 속 이름은 통과');
    w('bad.jsonl', [{ t: 'tool', tool: 'mcp__github__push_files', at: '2026-11-02T00:00:00Z' }, { t: 'tool', tool: 'mcp__github__create_or_update_file' }, { t: 'tool', tool: 'mcp__github__delete_file' }]);
    const out = PR.auditReceipts(dir);
    assert.equal(out.length, 3); assert.match(out[0], /^RULE-0529 영수증 bad\.jsonl:1 .*push_files/);
    assert.deepEqual(PR.auditReceipts(join(dir, 'nowhere')), [], '영수증 폴더가 없으면 비어 있음');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('⑩ 세션 끊기 (STG-11f): 넘김 기록의 "다음에" 표 · 열린 작업 앞 셋 · 바뀐 파일 수로 첫 작업 자리에 닿는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'next-'));
  try {
    mkdirSync(join(dir, 'workspace'), { recursive: true }); mkdirSync(join(dir, 'rebuild', 'state'), { recursive: true });
    writeFileSync(join(dir, 'workspace', 'NEXT-2026-01-01.md'), '# 옛 것\n## 다음에 할 일\n| a | b |\n|---|---|\n| 낡음 | x |\n');
    writeFileSync(join(dir, 'workspace', 'NEXT-2026-02-02.md'), '# 새 넘김\n\n## 1. 지금\n| a |\n|---|\n| 무시 |\n\n## 2. 다음에 할 수 있는 일\n| 범위 | 이유 |\n|---|---|\n| 첫 일 | 이유 하나 |\n| 둘째 | 이유 둘 |\n\n## 3. 함정\n| 무시 | 무시 |\n');
    const it = (id, st, mark) => JSON.stringify({ kind: 'item', id, state: st, mark, fields: { 단계: id + ' 제목' } });
    writeFileSync(join(dir, 'rebuild', 'state', 'plans.jsonl'), [it('X-1', 'done', '☑'), it('X-2', 'open', '☐'), it('X-3', 'hold', '보류'), it('X-4', 'open', '☐'), it('X-5', 'partial', '◐'), it('X-6', 'open', '☐'), JSON.stringify({ kind: 'order', seq: ['X-1', 'X-2', 'X-3', 'X-4', 'X-5', 'X-6'].map((id) => ({ id, why: '' })) })].join('\n') + '\n');
    const out = PR.nextFrom(dir).join('\n');
    assert.match(out, /workspace\/NEXT-2026-02-02\.md \(이전 1 개는 낡음\)/); assert.doesNotMatch(out, /낡음 \| x/);
    assert.match(out, /첫 일 \| 이유 하나/); assert.match(out, /둘째 \| 이유 둘/); assert.doesNotMatch(out, /무시/);
    assert.match(out, /X-2 ☐/); assert.match(out, /X-4 ☐/); assert.match(out, /X-5 ◐/); assert.doesNotMatch(out, /X-3|X-1 |X-6/, '끝난 것 · 보류 · 넷째 이후는 안 보인다');
    assert.match(PR.nextFrom(join(dir, 'nowhere')).join('\n'), /넘김 기록 없음/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
