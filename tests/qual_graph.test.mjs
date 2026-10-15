// 정성 그래프 0 층 판정 (build-plan 7) — judicial/qual_graph.js
//   합성 그래프로: 지지 · 경로 없음 · 모순 후보 · 부호 섞임 · 효과 모르는 조절 · 음성 되먹임이 부호를 뒤집지 않음 · 정의상 판정 · 긴장 · 판정 대상 아님 · 양방향 색인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const Q = req('../judicial/qual_graph.js'), M = req('../model.js');

// 합성 기전: A|c —(r1, 작용자 E, 조절자 G 활성)→ B|c · Mod ⊣ r1 · K 는 r1 의 작용자이면서 r1 을 억제(부호 섞임)
//   U 는 효과를 적지 않은 조절자 · B ⊣ r1 (음성 되먹임) · 세포 상태 CS 는 B 높음이 표지 · X 는 고립
const rule = (id, o) => Object.assign({ id }, o);
const sense = (kind, rules, extra) => Object.assign({ kind, rule: rules || [] }, extra || {});
const DB = {
  senses: {
    A: sense('molecule', [rule('r1', { type: 'transition', regulators: [{ ref: 'G', effect: 'activates' }] })]),
    B: sense('molecule', [rule('fb', { type: 'modulation', target: 'A/rule/r1', effect: 'inhibits' })]),
    E: sense('molecule'), G: sense('molecule'), U: sense('molecule'), X: sense('molecule'),
    Mod: sense('molecule', [rule('m', { type: 'modulation', target: 'A/rule/r1', effect: 'inhibits' })]),
    K: sense('molecule', [rule('k', { type: 'modulation', target: 'A/rule/r1', effect: 'inhibits' })]),
    CS: sense('cell_state', [], { signature: [{ ref: 'B', level: 'high', location: 'c' }], transitions: [] }),
  },
  steps: { S1: { rule: 'A/rule/r1', inputs: [{ b: 'A|c' }], agents: [{ b: 'E|c' }, { b: 'K|c' }], outputs: [{ b: 'B|c' }], regulators: [{ b: 'G|c' }, { b: 'U|c' }] } },
  observations: {},
};
const G = Q.buildGraph(DB);
const claim = (type, target, readout, expect, extra) => Object.assign({ kind: 'qualitative', perturbation: type ? { type, target } : undefined, readout: { kind: readout === 'CS' ? 'fraction' : 'amount', target: readout }, expect, condition: { species: '9606' } }, extra || {});
const judge = (...a) => Q.judgeClaim(DB, G, claim(...a));

test('지지 · 모순 후보 · 경로 없음 (교란 부호 × 경로 부호 = 예측 변화)', () => {
  let r = judge('knockout', 'E', 'B|c', 'decrease');
  assert.equal(r.verdict, 'supported', r.why); assert.deepEqual(r.predicted, [-1]);
  assert.deepEqual(r.paths['1'].map((x) => x.node), ['E', 'E|c', 'A/rule/r1', 'B|c']);
  assert.equal(judge('knockout', 'E', 'B|c', 'increase').verdict, 'contradiction_candidate');
  assert.equal(judge('knockout', 'Mod', 'B|c', 'increase').verdict, 'supported', '억제자를 없애면 늘어남 (− × − )');
  assert.equal(judge('knockout', 'G', 'B|c', 'decrease').verdict, 'supported', '규칙 regulators 의 activates');
  assert.equal(judge('knockout', 'X', 'B|c', 'decrease').verdict, 'no_path');
  assert.equal(judge('block', 'A/rule/r1', 'A|c', 'increase').verdict, 'supported', '규칙을 막으면 소비되던 입력이 쌓임');
  assert.equal(judge('inhibit', 'A/rule/r1', 'B|c', 'decrease').verdict, 'supported');
});

test('부호 섞임: 부호가 다른 경로 · 효과를 모르는 조절 간선', () => {
  const r = judge('knockout', 'K', 'B|c', 'decrease');
  assert.equal(r.verdict, 'mixed'); assert.deepEqual(r.predicted, [-1, 1]);
  const u = judge('knockout', 'U', 'B|c', 'decrease');
  assert.equal(u.verdict, 'mixed'); assert.match(u.why, /효과를 모르는/);
});

test('음성 되먹임(B ⊣ r1)은 직접 효과의 부호를 뒤집지 않는다 · knockout 은 대상의 다른 형태를 지나지 않는다', () => {
  const r = judge('knockout', 'E', 'B|c', 'decrease');
  assert.ok(!('-1' in r.paths), '되먹임 순환을 경로로 세면 반대 부호가 생긴다');
  const d = judge('knockout', 'A', 'A|c', 'decrease');
  assert.equal(d.verdict, 'supported'); assert.match(d.why, /정의상/);
  assert.equal(judge('knockout', 'A', 'A|c', 'increase').verdict, 'contradiction_candidate');
});

test('세포 상태: 표지 서명(high +)으로 상태 비율에 닿음', () => {
  const r = judge('knockout', 'E', 'CS', 'decrease');
  assert.equal(r.verdict, 'supported', r.why);
  assert.equal(r.paths['1'].at(-1).node, 'CS');
});

test('효과 없음 주장 · 0 층 판정 대상이 아닌 것', () => {
  assert.equal(judge('knockout', 'X', 'B|c', 'no_change').verdict, 'supported');
  assert.equal(judge('knockout', 'E', 'B|c', 'no_change').verdict, 'tension');
  assert.equal(judge(null, null, 'B|c', 'present').verdict, 'not_applicable');
  assert.equal(judge('clamp', 'A|c', 'B|c', 'increase').verdict, 'not_applicable', 'clamp 은 대조군 대비 방향이 정해지지 않음');
  assert.equal(Q.judgeClaim(DB, G, { kind: 'qualitative', readout: { kind: 'amount' }, expect: { order: ['A|c', 'B|c'] }, condition: { species: '9606' } }).verdict, 'not_applicable');
});

test('양방향 색인: 교란 대상 · 읽을 거리(묶음과 정의항) · 맥락 열쇠 — 철회된 것은 빠짐', () => {
  const db = { ...DB, observations: {
    O000001: claim('knockout', 'E', 'B|c', 'decrease', { condition: { species: '9606', cell: 'dendritic_cell' } }),
    O000002: claim('block', 'A/rule/r1', 'B|c', 'decrease'),
    O000003: Object.assign(claim('knockout', 'X', 'B|c', 'decrease'), { retracted: { note: '시험' } }),
  } };
  const v = Q.qualGraphVerdict(db), ix = v.index;
  assert.deepEqual(ix.byPerturbation.E, ['O000001']);
  assert.deepEqual(ix.byPerturbation.A, ['O000002'], '규칙 교란은 소유 정의항으로도 찾음');
  assert.deepEqual(ix.byReadout['B|c'], ['O000001', 'O000002']);
  assert.deepEqual(ix.byReadout.B, ['O000001', 'O000002']);
  assert.equal(Object.keys(ix.byContext).length, 2, '맥락이 다르면 다른 열쇠');
  assert.deepEqual(v.counts, { supported: 2 });
  assert.match(Q.qualGraphText(v), /구조 지지/);
  assert.match(Q.qualGraphText(v), /"구조 지지" 는 일치가 아니다/);
});

test('지금 저장소: 기전 그래프가 서고, 정성 관찰이 없으면 판정 행도 없다', () => {
  const db = M.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
  const v = Q.qualGraphVerdict(db);
  assert.ok(v.graph.nodes > 100 && v.graph.edges > v.graph.nodes);
  assert.equal(v.rows.length, Object.values(db.observations).filter((o) => o.kind === 'qualitative' && !o.retracted).length);
});
