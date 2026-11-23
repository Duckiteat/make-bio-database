// PLAN-116 G5 우회 시나리오 (DEC-0079) — 기존 시험이 다루지 않던 것만. 시나리오 표 전체는 PLAN-116 결과 칸의 G5 보고서
//   임시 git 저장소의 실제 커밋 · 감독 장부의 실제 접기로 — 정상 흐름이 통과하는지도 함께 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as Z from '../rebuild/ci-zone.mjs';
import * as SV from '../rebuild/supervise.mjs';
import * as AP from '../judicial/supervise_approval.js';

const ROOT = new URL('..', import.meta.url).pathname;
const open = (mode) => JSON.stringify({ at: '2026-01-01T00:00:00Z', t: 'open', mode, role: null, prev: null }) + '\n';
function setup(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'g5-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  const put = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); };
  const commit = (m) => { g('add', '-A'); g('commit', '-qm', m); return g('rev-parse', 'HEAD').trim(); };
  g('init', '-q', '-b', 'main'); put('rebuild/rules/modes.json', readFileSync(join(ROOT, 'rebuild/rules/modes.json'), 'utf8'));
  for (const [p, t] of Object.entries(files)) put(p, t);
  return { dir, put, commit, base: commit('base') };
}
const done = (r) => rmSync(r.dir, { recursive: true, force: true });

test('A2 검수 모드가 작성 자리(data)에 쓴 커밋은 CI 가 거부 — 검수 자리(보고서)는 통과', () => {
  const r = setup({ 'data/db.json': '{}\n' });
  try {
    r.put('workspace/receipts/i.jsonl', open('inspect')); r.put('docs/reports/r.md', '검토\n'); const ok = r.commit('inspect 의 보고서');
    r.put('workspace/receipts/i.jsonl', open('inspect') + '{"t":"tool"}\n'); r.put('data/db.json', '{"x":1}\n'); const bad = r.commit('inspect 가 db 를 고침');
    const res = Z.zoneCheck(r.base, 'HEAD', r.dir), by = (c) => res.commits.find((x) => x.c === c);
    assert.equal(by(ok).status, 'ok'); assert.equal(by(bad).status, 'violation'); assert.deepEqual(by(bad).bad, ['data/db.json']); assert.equal(res.exit, 1);
  } finally { done(r); }
});

test('C4 검수 · 넘김 기록(감독 장부 · 전환 기록)의 기존 줄을 고치면 CI 가 거부 — 덧붙이기는 통과 · 선언 없는(사람의) 커밋은 알리기만', () => {
  const L1 = '{"id":"aaaa1111-aaa-1","ev":"propose"}\n', L2 = '{"id":"bbbb2222-bbb-1","ev":"start"}\n';
  const r = setup({ 'rebuild/state/supervise.jsonl': L1, 'workspace/transitions.jsonl': '{"seq":1,"why":"검수 끝"}\n' });
  try {
    r.put('workspace/receipts/a.jsonl', open('author')); r.put('rebuild/state/supervise.jsonl', L1 + L2); const add = r.commit('덧붙임');
    r.put('workspace/receipts/a.jsonl', open('author') + '{"t":"tool"}\n'); r.put('rebuild/state/supervise.jsonl', L1.replace('propose', 'cancel') + L2); const edit = r.commit('줄을 고침');
    r.put('workspace/receipts/a.jsonl', open('author') + '{"t":"tool"}\n{"t":"tool"}\n'); r.put('workspace/transitions.jsonl', '{"seq":1,"why":"검수 안 함"}\n'); const edit2 = r.commit('전환 기록을 고침');
    r.put('workspace/transitions.jsonl', '{"seq":1,"why":"사람이 고침"}\n'); const human = r.commit('사람의 커밋');
    const res = Z.zoneCheck(r.base, 'HEAD', r.dir), by = (c) => res.commits.find((x) => x.c === c);
    assert.equal(by(add).status, 'ok');
    assert.equal(by(edit).status, 'violation'); assert.equal(by(edit).rewrites[0].file, 'rebuild/state/supervise.jsonl');
    assert.equal(by(edit2).status, 'violation'); assert.equal(by(edit2).rewrites[0].file, 'workspace/transitions.jsonl');
    assert.equal(by(human).status, 'undeclared', '선언 없음은 알리기만 (PLAN-114 사용자 결정 그대로)');
    assert.equal(res.exit, 1);
  } finally { done(r); }
  // 줄 순서만 바뀐 것(두 브랜치를 합친 장부)은 고침이 아니다
  assert.deepEqual(Z.appendOnly(L1 + L2, L2 + L1), []);
  assert.equal(Z.appendOnly(L1 + L1, L1).length, 1, '같은 줄 둘 중 하나를 지움');
});

// 감독 장부를 실제로 접어서 — author → inspect → (author) 의 상위 작업
const R = { items: new Set(['PLAN-103']), decisions: new Set(['DEC-0066']), transitions: new Set([11, 12, 13]), files: () => true };
const who = (tag, mode) => ({ tag, mode, executor: 'claude-code', enforcement: { hooks: true, receipts: true } });
const A = who('aaaa1111-aaa', 'author'), I = who('bbbb2222-bbb', 'inspect');
function fold(steps) {
  const evs = [];
  for (const [ev, input, w] of steps) { const r = SV.admit(evs, ev, { why: '시험', ...input }, w, R, new Date(Date.UTC(2026, 10, 23, 0, 0, evs.length)).toISOString()); assert.ok(r.event, (r.errors || []).join(' · ')); evs.push(r.event); }
  return SV.fold(evs, R).sups[0];
}
const PROP = ['propose', { plan_item: 'PLAN-103', purpose: '시험', inputs: { transitions: [11], files: [], ids: [] }, steps: ['author', 'inspect'], done_when: '시험', decision: 'DEC-0066' }, A];
const HAND = (seq, c) => ({ sup: 'SUP-0001', transition_seq: seq, verify: { finish: 'pass' }, outputs: { commits: [c] } });
const FULL = AP.independence({ author: { modes: ['author'], sessions: [A.tag], zones: ['data/**'], stamps: ['verified'] }, inspect: { mode: 'inspect', session: I.tag, zone: ['docs/reports/**'], stamps: ['accept'] }, receipt: { touches: 1, pmids: ['111111'] }, cited: ['111111'] });
const rec = (sup, indep = FULL) => AP.recommend({ sup, verdict: { status: 'not_merged', text: '병합 전' }, kindOf: (c) => SV.CAUSE_KIND[c], indep });

test('B4 검수 뒤에 작성이 더 넘기면 최종 권고는 보류 — 승인 대상에 검수하지 않은 변경 (SUP-0001 의 모양) · 다시 검수하면 풀림', () => {
  const normal = fold([PROP, ['start', { sup: 'SUP-0001', branch: 'b' }, A], ['handoff', HAND(11, 'aaaaaa1'), A], ['start', { sup: 'SUP-0001', branch: 'b' }, I], ['handoff', HAND(12, 'bbbbbb1'), I]]);
  assert.equal(rec(normal).code, 'mergeable', '정상 흐름은 막지 않는다');
  const late = fold([PROP, ['start', { sup: 'SUP-0001', branch: 'b' }, A], ['handoff', HAND(11, 'aaaaaa1'), A], ['start', { sup: 'SUP-0001', branch: 'b' }, I], ['handoff', HAND(12, 'bbbbbb1'), I], ['start', { sup: 'SUP-0001', branch: 'b' }, A], ['handoff', HAND(13, 'aaaaaa2'), A]]);
  const r = rec(late);
  assert.equal(r.code, 'hold'); assert.equal(r.rule, 'RULE-0543'); assert.deepEqual(r.reasons, ['SUP-0001/r3 author']);
  // 독립성이 full 이어도 — 검수 뒤 변경은 독립성 계산이 보지 못하는 것
  assert.equal(FULL.level, 'full');
  const I2 = who('cccc3333-ccc', 'inspect');
  const again = fold([PROP, ['start', { sup: 'SUP-0001', branch: 'b' }, A], ['handoff', HAND(11, 'aaaaaa1'), A], ['start', { sup: 'SUP-0001', branch: 'b' }, I], ['handoff', HAND(12, 'bbbbbb1'), I], ['start', { sup: 'SUP-0001', branch: 'b' }, A], ['handoff', HAND(13, 'aaaaaa2'), A], ['start', { sup: 'SUP-0001', branch: 'b' }, I2], ['handoff', HAND(13, 'cccccc1'), I2]]);
  assert.equal(rec(again).code, 'mergeable', '나중 변경을 다시 검수하면 풀림');
});

test('C2 · C3 검수 세션의 영수증이 없으면(무엇을 읽었는지 모름) 보류 — 독립성 unknown 을 병합 가능으로 치지 않는다', () => {
  const sup = fold([PROP, ['start', { sup: 'SUP-0001', branch: 'b' }, A], ['handoff', HAND(11, 'aaaaaa1'), A], ['start', { sup: 'SUP-0001', branch: 'b' }, I], ['handoff', HAND(12, 'bbbbbb1'), I]]);
  const unknown = AP.independence({ author: { modes: ['author'], sessions: [A.tag], zones: ['data/**'], stamps: ['verified'] }, inspect: { mode: 'inspect', session: I.tag, zone: ['docs/reports/**'], stamps: ['accept'] }, receipt: null, cited: ['111111'] });
  assert.equal(unknown.level, 'unknown');
  const r = rec(sup, unknown);
  assert.equal(r.code, 'hold'); assert.equal(r.rule, 'RULE-0543'); assert.match(r.reasons.join(' '), /info_access/);
  assert.equal(rec(sup, null).code, 'hold', '독립성 계산 자체가 없어도 보류');
});
