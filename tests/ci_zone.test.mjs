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

test('판정 (순수): 선언한 모드의 구역 안 · 밖 · 선언 없음 · 영수증 자체는 판정 밖', () => {
  assert.equal(Z.judgeCommit(P, ['engine/x.js', 'workspace/receipts/s.jsonl'], [{ mode: 'develop', role: null }]).status, 'ok');
  const v = Z.judgeCommit(P, ['data/db.json', 'engine/x.js'], [{ mode: 'develop', role: null }]);
  assert.equal(v.status, 'violation'); assert.deepEqual(v.bad, ['data/db.json'], 'develop 은 data 를 쓰지 않는다');
  assert.deepEqual(Z.judgeCommit(P, ['engine/x.js'], [{ mode: 'author', role: null }]).bad, ['engine/x.js'], 'author 는 엔진을 쓰지 않는다');
  assert.deepEqual(Z.judgeCommit(P, ['rebuild/gate.mjs'], [{ mode: 'develop', role: null }]).bad, ['rebuild/gate.mjs'], '권한의 뿌리는 develop 에서도 밖');
  const u = Z.judgeCommit(P, ['.claude/settings.json'], []); assert.equal(u.status, 'undeclared'); assert.deepEqual(u.files, ['.claude/settings.json']);
  assert.deepEqual(Z.declaredOf([{ file: 'a', text: open('baseline') + '{"t":"tool"}\n' + open('develop') }]).map((d) => d.mode), ['develop'], '마지막 open');
  assert.deepEqual(Z.declaredOf([{ file: 'a', text: '{"t":"tool"}\n깨짐\n' }]), []);
});

test('통합: 구역 밖 커밋은 종료 코드 1 · 선언 없음은 알리기만 · 병합 커밋 건너뜀', () => {
  const r = setup();
  try {
    r.put('workspace/receipts/s1.jsonl', open('develop')); r.put('engine/a.js', '1\n'); const ok = r.commit('develop 안');
    r.put('workspace/receipts/s1.jsonl', open('develop') + '{"t":"tool"}\n'); r.put('data/db.json', '{}\n'); const bad = r.commit('develop 이 data 를 씀');
    r.put('.claude/settings.json', '{}\n'); const human = r.commit('사람의 설정 커밋');
    const res = Z.zoneCheck(r.base, 'HEAD', r.dir), text = res.lines.join('\n');
    assert.equal(res.exit, 1);
    assert.deepEqual(res.commits.map((x) => [x.c, x.status]), [[ok, 'ok'], [bad, 'violation'], [human, 'undeclared']]);
    assert.match(text, /✗ \S+ develop 이 data 를 씀 — 선언 develop 의 쓰기 구역 밖 1: data\/db\.json/);
    assert.match(text, /사람의 설정 커밋 — 모드 선언\(영수증\) 없음 → 사람의 커밋으로 봄 \(알리기만\)/);
    // 선언 없음만 있으면 통과
    assert.equal(Z.zoneCheck(bad, 'HEAD', r.dir).exit, 0);
    // 병합 커밋은 건너뛴다
    r.g('checkout', '-qb', 'side'); r.put('workspace/receipts/s2.jsonl', open('author')); r.put('data/x.json', '{}\n'); r.commit('author 안');
    r.g('checkout', '-q', 'main'); r.g('-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', '-q', '--no-ff', '-m', '합침', 'side');
    const m = Z.zoneCheck(human, 'HEAD', r.dir); assert.equal(m.exit, 0); assert.equal(m.commits.length, 1, '병합 커밋 제외');
    assert.equal(Z.zoneCheck('없는커밋', 'HEAD', r.dir).exit, 2);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('사람 계정 (RULE-0551 · PLAN-117): CODEOWNERS 의 @계정만 사람 · 봇이 민 선언 없는 커밋은 거부 · 모르면 옛 판정', () => {
  assert.deepEqual(Z.humansOf('# 주석 @Nobody\n/.github/  @Duckiteat\n/x @Duckiteat @org/team\nfoo@bar.com @Second-One\n'), ['duckiteat', 'second-one'], '주석 · 팀 · 전자우편은 세지 않음');
  assert.deepEqual(Z.whoOf('Duckiteat', ['duckiteat']), { actor: 'Duckiteat', human: true });
  assert.deepEqual(Z.whoOf('daduteria', ['duckiteat']), { actor: 'daduteria', human: false });
  assert.equal(Z.whoOf(null, ['duckiteat']).human, null, '행위자 모름');
  assert.equal(Z.whoOf('daduteria', null).human, null, '사람 목록 모름');
  const bot = Z.judgeCommit(P, ['engine/x.js'], [], null, [], Z.whoOf('daduteria', ['duckiteat']));
  assert.equal(bot.status, 'violation'); assert.equal(bot.agent, true);
  assert.equal(Z.judgeCommit(P, ['engine/x.js'], [], null, [], Z.whoOf('Duckiteat', ['duckiteat'])).status, 'undeclared', '사람 계정은 알리기만');
  assert.equal(Z.judgeCommit(P, ['engine/x.js'], []).status, 'undeclared', 'who 없음 = 옛 판정');
  assert.equal(Z.judgeCommit(P, ['engine/x.js'], [{ mode: 'develop', role: null }], null, [], Z.whoOf('daduteria', ['duckiteat'])).status, 'ok', '선언이 있으면 봇도 구역 판정만');
});

test('통합 (RULE-0551): 사람 목록은 부모의 CODEOWNERS 에서 · 봇 push 는 선언 없는 커밋에서 종료 1 · 커밋이 자기를 사람으로 올리지 못함 · main 에 든 커밋은 다시 안 봄', () => {
  const r = setup();
  try {
    r.put('.github/CODEOWNERS', '/.github/ @Duckiteat\n'); const owners = r.commit('사람 목록');
    r.put('engine/a.js', '1\n'); r.commit('선언 없는 커밋');
    const bot = Z.zoneCheck(owners, 'HEAD', r.dir, { actor: 'daduteria' }), text = bot.lines.join('\n');
    assert.equal(bot.exit, 1); assert.match(text, /AI 계정\(daduteria\)이 민 커밋인데 모드 선언\(영수증\)이 없음 \(RULE-0551\)/); assert.match(text, /행위자 daduteria/);
    const human = Z.zoneCheck(owners, 'HEAD', r.dir, { actor: 'Duckiteat' });
    assert.equal(human.exit, 0); assert.match(human.lines.join('\n'), /사람 계정\(Duckiteat\)의 커밋 \(알리기만\)/);
    assert.equal(Z.zoneCheck(owners, 'HEAD', r.dir, { actor: null }).exit, 0, '행위자 모름 = 옛 판정');
    // 커밋이 CODEOWNERS 에 봇을 더해도 그 커밋은 부모의 목록으로 판정된다
    r.put('.github/CODEOWNERS', '/.github/ @Duckiteat @daduteria\n'); r.put('engine/b.js', '1\n'); const self = r.commit('봇을 사람으로');
    const s = Z.zoneCheck(owners, 'HEAD', r.dir, { actor: 'daduteria' }); assert.equal(s.commits.find((x) => x.c === self).status, 'violation');
    // main 에 이미 든 커밋(사람이 받아들인 것)은 봇 브랜치 범위에 들어와도 다시 판정하지 않는다 — 단 main 으로의 push 는 그대로 판정
    r.g('checkout', '-qb', 'bot'); r.put('workspace/receipts/s.jsonl', open('develop')); r.put('engine/c.js', '1\n'); const mine = r.commit('봇의 선언 커밋');
    const onBot = Z.zoneCheck(r.base, 'HEAD', r.dir, { actor: 'daduteria', main: 'main' });
    assert.deepEqual(onBot.commits.map((x) => x.c), [mine], 'main 의 커밋은 빠짐'); assert.equal(onBot.exit, 0);
    r.g('checkout', '-q', 'main');
    assert.equal(Z.zoneCheck(r.base, 'HEAD', r.dir, { actor: 'daduteria', main: 'main' }).exit, 1, 'main 으로의 push 는 빼지 않음');
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
