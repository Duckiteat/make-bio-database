// PLAN-116 G2–G4 (DEC-0077) — 막힘의 두 종류(거부 · 보류) · 검수 독립성 다섯 요소 · 최종 권고 · 승인 보고서 12 칸. 모두 계산 — 장부에 새 칸 없음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as SV from '../rebuild/supervise.mjs';
import * as AP from '../judicial/supervise_approval.js';

const AZ = ['data/**', 'attestations/**', 'limitations.md', 'workspace/handoff/**', 'docs/reports/**'];
const IZ = ['attestations/**', 'docs/reports/**'];
const base = (o = {}) => ({
  author: { modes: ['author'], sessions: ['aaaa1111-aaa'], zones: ['data/**', 'docs/reports/**'] },
  inspect: { mode: 'inspect', session: 'bbbb2222-bbb', zone: ['docs/reports/**'] },
  receipt: { touches: 3, pmids: ['111111', '222222'] }, cited: ['111111', '222222'], ...o,
});

test('① G2 원인 태그 일곱이 모두 거부 · 보류 중 하나 — 빠진 태그 · 다른 값 없음', () => {
  assert.deepEqual(Object.keys(SV.CAUSE_KIND).sort(), [...SV.CAUSES].sort());
  for (const k of Object.values(SV.CAUSE_KIND)) assert.ok(['deny', 'hold'].includes(k));
  assert.equal(SV.CAUSE_KIND.ENGINE_DEFECT, 'deny'); assert.equal(SV.CAUSE_KIND.DATA_GAP, 'hold');
});

test('② G3 독립성: 다섯이 서면 full · 권한 겹침 · 원문을 안 가리킴 · 출처 빠짐은 limited · 영수증 없음은 unknown', () => {
  assert.equal(AP.independence(base()).level, 'full');
  const ov = AP.independence(base({ author: { modes: ['author'], sessions: ['aaaa1111-aaa'], zones: AZ }, inspect: { mode: 'inspect', session: 'bbbb2222-bbb', zone: IZ } }));
  assert.equal(ov.level, 'limited'); assert.equal(ov.factors.authority.ok, false); assert.match(ov.factors.authority.why, /attestations/);
  assert.equal(AP.independence(base({ receipt: { touches: 0, pmids: [] } })).factors.info_access.ok, false);
  const miss = AP.independence(base({ receipt: { touches: 1, pmids: ['111111'] } }));
  assert.equal(miss.level, 'limited'); assert.match(miss.factors.basis.why, /빠짐 222222/);
  const none = AP.independence(base({ receipt: null }));
  assert.equal(none.level, 'unknown'); assert.equal(none.factors.info_access.estimated, true);
  assert.equal(AP.independence(base({ inspect: { mode: 'inspect', session: 'aaaa1111-aaa', zone: ['docs/reports/**'] } })).factors.execution.ok, false);
});

test('③ G3 영수증 추정: 원문 자리를 가리킨 도구 호출만 세고 그 글의 문헌 번호를 모음', () => {
  const r = SV.rawTouches([
    { t: 'tool', tool: 'Bash', target: 'for p in 111111 2222222; do cat data/fetched/europepmc/MED-$p.json; done' },
    { t: 'tool', tool: 'Bash', target: 'ls data/patches/ && echo 333333' },
    { t: 'open', mode: 'inspect' },
  ]);
  assert.equal(r.touches, 1);
  assert.deepEqual(r.pmids.sort(), ['111111', '2222222']);
});

const sup = (o = {}) => ({ id: 'SUP-9001', state: 'running', active: null, steps: ['author', 'inspect'], blocked: null,
  runs: [{ run: 'SUP-9001/r1', mode: 'author', result: 'handed_off', verify: { finish: 'pass' } }, { run: 'SUP-9001/r2', mode: 'inspect', result: 'handed_off', verify: { finish: 'pass' } }], ...o });
const kindOf = (c) => SV.CAUSE_KIND[c];
const full = AP.independence(base());

test('④ G4 최종 권고는 규칙: 거부 · 보류 · 검수 전 · 독립성 제한 · 시험 실패 · 병합해도 됨 · 이미 승인', () => {
  const rec = (o, v = { status: 'not_merged' }, ind = full) => AP.recommend({ sup: sup(o), verdict: v, kindOf, indep: ind }).code;
  assert.equal(rec({ state: 'blocked', blocked: { cause: 'ENGINE_DEFECT', why: 'x' } }), 'deny');
  assert.equal(rec({ state: 'blocked', blocked: { cause: 'DOMAIN_CONFLICT', why: 'x' } }), 'hold');
  assert.equal(rec({ runs: [sup().runs[0]] }), 'hold', '독립 검수 전');
  assert.equal(rec({}, { status: 'not_merged' }, AP.independence(base({ receipt: { touches: 0, pmids: [] } }))), 'hold');
  assert.equal(rec({ runs: [{ ...sup().runs[0], verify: { finish: 'fail' } }, sup().runs[1]] }), 'deny');
  assert.equal(rec({}), 'mergeable');
  assert.equal(rec({}, { status: 'approved' }), 'approved');
  assert.equal(rec({}, { status: 'merged_ai', text: 'AI 병합' }), 'hold');
  assert.match(AP.recommend({ sup: sup(), verdict: { status: 'not_merged' }, kindOf, indep: AP.independence(base({ receipt: null })) }).text, /사람이 확인/);
});

test('⑤ G4 승인 보고서: 제안서 §8 의 12 칸이 그 순서로 · 승인이 아니라고 적음 · 쓰지 않음', () => {
  const R = { items: new Set(['PLAN-103']), decisions: new Set(['DEC-0066']), transitions: new Set([11]), files: () => true };
  const A = { tag: 'aaaa1111-aaa', mode: 'author', executor: 'claude-code', enforcement: { hooks: true, receipts: true } };
  const evs = [];
  const add = (ev, input) => { const r = SV.admit(evs, ev, { why: '시험', ...input }, A, R, new Date(Date.UTC(2026, 10, 23, 0, 0, evs.length)).toISOString()); assert.ok(r.event, (r.errors || []).join(' · ')); evs.push(r.event); };
  add('propose', { plan_item: 'PLAN-103', purpose: '시험 순환', inputs: { transitions: [11], files: [], ids: [] }, steps: ['author', 'inspect'], done_when: '시험', decision: 'DEC-0066' });
  const s = SV.fold(evs, R).sups[0];
  const r = SV.report(s);
  assert.deepEqual(r.rows.map(([k]) => k), ['작업 목적', '실행 내역', '변경 내역', '근거', '검증', '독립 검수', '절차 감사', '실패 이력', '미해결', '영향 분석', '승인 대상', '최종 권고']);
  assert.match(r.text, /승인이 아니다 — 병합 = 사람/);
  assert.equal(r.recommendation.code, 'hold');
});

test('⑥ G3 권한 요소: 겹친 도장 자리는 두 모드가 도장 종류를 선언했고 겹치지 않을 때만 갈림 — 정책 없음 · 종류 겹침은 그대로 limited (DEC-0078)', () => {
  const f = (as, is) => AP.independence(base({ author: { modes: ['author'], sessions: ['aaaa1111-aaa'], zones: AZ, stamps: as }, inspect: { mode: 'inspect', session: 'bbbb2222-bbb', zone: IZ, stamps: is } })).factors.authority;
  assert.equal(f(['verified', 'trend'], ['accept']).ok, true);
  assert.equal(f(null, ['accept']).ok, false, '작성 쪽 정책 없음');
  assert.equal(f(['verified', 'trend'], null).ok, false, '검수 쪽 정책 없음');
  assert.equal(f(['verified', 'trend'], ['accept', 'trend']).ok, false, '추세 도장이 겹침');
  assert.equal(f(['verified'], []).ok, false, '검수 쪽이 아무 도장도 못 내면 갈린 것이 아니라 정책이 빈 것');
  assert.equal(AP.independence(base({ author: { modes: ['author'], sessions: ['aaaa1111-aaa'], zones: ['data/**', 'attestations/**'], stamps: ['verified'] }, inspect: { mode: 'inspect', session: 'bbbb2222-bbb', zone: ['data/**', 'attestations/**'], stamps: ['accept'] } })).factors.authority.ok, false, '내용 정책이 없는 자리(data)의 겹침은 그대로');
});
