// Governor 의 CI 겹 시험 (PLAN-114) — 임시 git 저장소에서: 선언한 모드의 구역 밖 변경은 거부 · 선언 없음은 알리기만 · 정책은 부모에서 · 병합 커밋 건너뜀
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as Z from '../rebuild/ci-zone.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const MODES = readFileSync(join(ROOT, 'rebuild/rules/modes.json'), 'utf8');
const P = JSON.parse(MODES).gate;
const open = (mode, role = null) => JSON.stringify({ at: '2026-01-01T00:00:00Z', t: 'open', mode, role, prev: null }) + '\n';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cz-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  const put = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); };
  const commit = (m) => { g('add', '-A'); g('commit', '-qm', m); return g('rev-parse', 'HEAD').trim(); };
  g('init', '-q', '-b', 'main'); put('rebuild/rules/modes.json', MODES); put('src/x.js', '0\n');
  return { dir, g, put, commit, base: commit('base') };
}

const signed = (...cs) => Object.fromEntries(cs.map((c) => [c, { verified: true, committer: 'Duckiteat' }])); // 사람 서명 사실 (DEC-0094)
test('판정 (순수): 선언한 모드의 구역 안 · 밖 · 선언 없음(사람 서명이면 알리기만 · 아니면 AI 로 봄, DEC-0094) · 영수증 자체는 판정 밖', () => {
  assert.equal(Z.judgeCommit(P, ['engine/x.js', 'workspace/receipts/s.jsonl'], [{ mode: 'develop', role: null }]).status, 'ok');
  const v = Z.judgeCommit(P, ['data/db.json', 'engine/x.js'], [{ mode: 'develop', role: null }]);
  assert.equal(v.status, 'violation'); assert.deepEqual(v.bad, ['data/db.json'], 'develop 은 data 를 쓰지 않는다');
  assert.deepEqual(Z.judgeCommit(P, ['engine/x.js'], [{ mode: 'author', role: null }]).bad, ['engine/x.js'], 'author 는 엔진을 쓰지 않는다');
  assert.deepEqual(Z.judgeCommit(P, ['rebuild/gate.mjs'], [{ mode: 'develop', role: null }]).bad, ['rebuild/gate.mjs'], '권한의 뿌리는 develop 에서도 밖');
  const u = Z.judgeCommit(P, ['.claude/settings.json'], [], null, [], true); assert.equal(u.status, 'undeclared'); assert.deepEqual(u.files, ['.claude/settings.json']);
  const a = Z.judgeCommit(P, ['.claude/settings.json', 'workspace/receipts/s.jsonl'], []); assert.equal(a.status, 'violation', '선언도 사람 서명도 없음 = AI'); assert.deepEqual(a.bad, ['.claude/settings.json']);
  assert.equal(Z.judgeCommit(P, ['workspace/receipts/s.jsonl'], []).status, 'ok', '영수증만 바뀐 커밋은 판정 밖');
  // 사람 서명: GitHub 이 검증 + 커미터가 사람 계정 — 작성자 · 웹 흐름 · 검증 안 됨은 아님
  assert.equal(Z.humanSigned({ verified: true, committer: 'Duckiteat' }), true);
  for (const f of [{ verified: false, committer: 'Duckiteat' }, { verified: true, committer: 'daduteria' }, { verified: true, committer: 'web-flow' }, { verified: 'true', committer: 'Duckiteat' }, null, undefined]) assert.equal(Z.humanSigned(f), false, JSON.stringify(f));
  assert.deepEqual(Z.declaredOf([{ file: 'a', text: open('baseline') + '{"t":"tool"}\n' + open('develop') }]).map((d) => d.mode), ['develop'], '마지막 open');
  assert.deepEqual(Z.declaredOf([{ file: 'a', text: '{"t":"tool"}\n깨짐\n' }]), []);
});

test('통합: 구역 밖 커밋은 종료 코드 1 · 선언 없음은 사람 서명이면 알리기만, 아니면 1 (DEC-0094) · 병합 커밋 건너뜀', () => {
  const r = setup();
  try {
    r.put('workspace/receipts/s1.jsonl', open('develop')); r.put('engine/a.js', '1\n'); const ok = r.commit('develop 안');
    r.put('workspace/receipts/s1.jsonl', open('develop') + '{"t":"tool"}\n'); r.put('data/db.json', '{}\n'); const bad = r.commit('develop 이 data 를 씀');
    r.put('.claude/settings.json', '{}\n'); const human = r.commit('사람의 설정 커밋');
    const res = Z.zoneCheck(r.base, 'HEAD', r.dir, signed(human)), text = res.lines.join('\n');
    assert.equal(res.exit, 1);
    assert.deepEqual(res.commits.map((x) => [x.c, x.status]), [[ok, 'ok'], [bad, 'violation'], [human, 'undeclared']]);
    assert.match(text, /✗ \S+ develop 이 data 를 씀 — 선언 develop 의 쓰기 구역 밖 1: data\/db\.json/);
    assert.match(text, /사람의 설정 커밋 — 모드 선언\(영수증\) 없음 · 사람 서명\(Duckiteat\) → 알리기만/);
    // 사람 서명 커밋만 있으면 통과 · 서명 사실이 없으면(또는 봇 계정) AI 로 봄 — 공격 재검토 N8 의 선언 없는 커밋
    assert.equal(Z.zoneCheck(bad, 'HEAD', r.dir, signed(human)).exit, 0);
    const n8 = Z.zoneCheck(bad, 'HEAD', r.dir);
    assert.equal(n8.exit, 1); assert.match(n8.lines.join('\n'), /사람의 설정 커밋 — 모드 선언\(영수증\)도 사람 서명도 없는 커밋 → AI 로 봄 \(DEC-0094 · RULE-0551\): 바뀐 파일 1: \.claude\/settings\.json/);
    assert.equal(Z.zoneCheck(bad, 'HEAD', r.dir, { [human]: { verified: true, committer: 'daduteria' } }).exit, 1, '봇 계정의 검증된 서명은 사람이 아님');
    // 병합 커밋은 건너뛴다
    r.g('checkout', '-qb', 'side'); r.put('workspace/receipts/s2.jsonl', open('author')); r.put('data/x.json', '{}\n'); r.commit('author 안');
    r.g('checkout', '-q', 'main'); r.g('-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', '-q', '--no-ff', '-m', '합침', 'side');
    const m = Z.zoneCheck(human, 'HEAD', r.dir); assert.equal(m.exit, 0); assert.equal(m.commits.length, 1, '병합 커밋 제외');
    assert.equal(Z.zoneCheck('없는커밋', 'HEAD', r.dir).exit, 2);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('판정 (순수, DEC-0094 · DEC-0097 섞기): 서명은 선언을 대신하지 않고 등록부 정책도 못 피함 · 영수증만 바꾼 커밋은 통과 · 사람 계정은 GitHub 이 돌려준 로그인 그대로', () => {
  const st = (by) => ({ subject: { sense: 'O900001', field: 'accept', ns: 'evidence', value: 'O900001' }, claim: 'accept', issued_at: '2026-01-01', by, reason: 'x' });
  assert.equal(Z.judgeCommit(P, ['data/db.json'], [{ mode: 'develop', role: null }], null, [], true).status, 'violation', '사람 서명이어도 선언한 모드의 구역은 그대로 본다');
  assert.equal(Z.judgeCommit(P, ['engine/x.js'], [], null, [], true).status, 'undeclared', '사람 서명 · 선언 없음 → 알리기만');
  assert.equal(Z.judgeCommit(P, ['engine/x.js'], [], null, [], false).status, 'violation', '서명 없음 · 선언 없음 → AI');
  assert.equal(Z.judgeCommit(P, ['workspace/receipts/s.jsonl'], [], null, [], false).status, 'ok', '영수증만 바꾼 커밋은 바꾼 파일이 없음');
  assert.equal(Z.judgeCommit(P, ['attestations/registry.json'], [], { before: { stamps: [] }, after: { stamps: [st('human')] } }, [], true).status, 'violation', '사람 서명도 by: human 승인 도장은 못 넣음 (RULE-0548)');
  assert.equal(Z.humanSigned({ verified: true, committer: 'duckiteat' }), false, '로그인은 GitHub 이 돌려준 글자 그대로 — 대소문자를 바꾼 이름은 사람 아님');
  assert.deepEqual(Z.HUMANS, ['Duckiteat'], '사람 계정 목록 = CODEOWNERS 의 계정 (DEC-0090)');
  const owners = readFileSync(join(ROOT, '.github/CODEOWNERS'), 'utf8');
  assert.ok(Z.HUMANS.every((h) => owners.includes('@' + h)), 'HUMANS 의 계정이 CODEOWNERS 에 있음');
  assert.ok(!/@daduteria\b/.test(owners), '봇 계정은 CODEOWNERS 에 없음');
});

test('통합 (PLAN-118 · DEC-0097): main 에 이미 든 커밋은 봇 브랜치 범위에 들어와도 다시 판정하지 않음 — main 으로의 push 는 그대로', () => {
  const r = setup();
  try {
    r.put('engine/old.js', '1\n'); r.commit('main 의 옛 사람 커밋 (서명 없음)');
    r.g('checkout', '-qb', 'bot'); r.put('workspace/receipts/s.jsonl', open('develop')); r.put('engine/c.js', '1\n'); const mine = r.commit('봇의 선언 커밋');
    const onBot = Z.zoneCheck(r.base, 'HEAD', r.dir, {}, { main: 'main' });
    assert.deepEqual(onBot.commits.map((x) => x.c), [mine], 'main 의 커밋은 빠짐'); assert.equal(onBot.exit, 0);
    assert.match(onBot.lines.join('\n'), /main 에 든 커밋 제외/);
    r.g('checkout', '-q', 'main');
    assert.equal(Z.zoneCheck(r.base, 'HEAD', r.dir, {}, { main: 'main' }).exit, 1, 'main 으로의 push 는 빼지 않음 — 서명 없는 선언 없음은 AI');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('통합: 정책은 부모에서 읽는다 — 커밋이 자기 정책을 넓혀 통과하지 못한다', () => {
  const r = setup();
  try {
    const wide = JSON.parse(MODES); wide.gate.modes.develop.except = []; wide.gate.modes.develop.write = ['**'];
    r.put('rebuild/rules/modes.json', JSON.stringify(wide)); r.put('workspace/receipts/s.jsonl', open('develop')); r.put('data/db.json', '{}\n');
    r.commit('정책을 넓히며 data 를 씀');
    const res = Z.zoneCheck(r.base, 'HEAD', r.dir);
    assert.equal(res.exit, 1); assert.deepEqual(res.commits[0].bad.sort(), ['data/db.json', 'rebuild/rules/modes.json']);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
