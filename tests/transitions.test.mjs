// 전환 기록 (재건 PLAN §3, 6c) — 한 세션 = 한 모드. 검사(judicial/transition_audit.js) → 서기(appendTransition, 끝에만 붙임)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import * as CLERK from '../legislative/clerk.mjs';
import * as STATE from '../rebuild/state.mjs';

const req = createRequire(import.meta.url);
const TA = req('../judicial/transition_audit.js');
const ROOT = new URL('..', import.meta.url).pathname;
const OK = { from: 'baseline', to: 'develop', at: '2026-10-29', why: '무결성 FAIL — 엔진 결함으로 보임', target: ['D900001', 'RULE-0010'], files: ['CLAUDE.md'], open: ['원장 불일치가 어느 단계에서 시작되나?'] };

test('RULE-0513 전환 기록 검사: 통과 1 + 거부 사유별', () => {
  assert.deepEqual(TA.checkTransition(OK, ROOT), { ok: true, errors: [], rules: [] });
  const bad = (rec, re) => { const v = TA.checkTransition(rec, ROOT); assert.equal(v.ok, false, JSON.stringify(rec)); assert.match(v.errors.join(' · '), re); assert.ok(v.rules.every((r) => r === 'RULE-0513')); };
  bad(null, /JSON 객체/);
  bad({ ...OK, to: 'baseline' }, /같음/);
  bad({ ...OK, from: 'qa' }, /from 'qa'/);
  bad({ ...OK, at: '29/10/2026' }, /YYYY-MM-DD/);
  bad({ ...OK, why: ' ' }, /why 가 없음/);
  bad({ ...OK, target: ['PKA'] }, /번호가 아님/);
  bad({ ...OK, files: ['../etc/passwd'] }, /상대 경로만/);
  bad({ ...OK, files: ['없는/파일.md'] }, /가 없음/);
  bad({ ...OK, target: [], files: [], open: [] }, /모두 비었음/);
  bad({ ...OK, seq: 3 }, /받지 않는 칸 seq/);
});

test('RULE-0513 서기는 검사 통과 뒤에만, 끝에만 붙이고 번호 + 글자를 매긴다 (DEC-0092 · DEC-0093)', () => {
  const root = mkdtempSync(join(tmpdir(), 'tr-'));
  try {
    writeFileSync(join(root, 'CLAUDE.md'), 'x');
    mkdirSync(join(root, 'workspace'), { recursive: true });
    writeFileSync(join(root, CLERK.TRANSITIONS), '{"seq":1,"from":"inspect","to":"develop"}\n{"seq":2,"from":"develop","to":"inspect"}\n'); // 옛 정수 기록
    const rule = (re) => (e) => e.rule === 'RULE-0513' && re.test(e.message);
    assert.throws(() => CLERK.appendTransition({ ...OK, why: '' }, root), rule(/why/));
    assert.throws(() => CLERK.appendTransition(OK, root), rule(/work 가 없음/));
    assert.throws(() => CLERK.appendTransition({ ...OK, work: 3 }, root), rule(/opened_by/));
    assert.throws(() => CLERK.appendTransition({ ...OK, work: 2, opened_by: 'DEC-0001' }, root), rule(/옛 기록/));
    CLERK.appendTransition({ ...OK, work: 3, opened_by: 'DEC-0001', sup: 'SUP-0001' }, root);
    assert.throws(() => CLERK.appendTransition({ ...OK, work: 3, opened_by: 'DEC-0001' }, root), rule(/첫 기록에만/));
    assert.throws(() => CLERK.appendTransition({ ...OK, work: 4, opened_by: 'DEC-0001' }, root), rule(/이미 번호 3/));
    CLERK.appendTransition({ ...OK, work: 3, from: 'develop', to: 'baseline', why: '고친 뒤 다시 기초시험' }, root);
    CLERK.appendTransition({ ...OK, work: 4, opened_by: 'DEC-0002' }, root); // 두 일이 함께 진행
    CLERK.appendTransition({ ...OK, work: 3, close: true }, root);
    assert.throws(() => CLERK.appendTransition({ ...OK, work: 3 }, root), rule(/완결됨/));
    const t = CLERK.readTransitions(root);
    assert.deepEqual(t.map((x) => x.seq), [1, 2, '3a', '3b', '4a', '3c']);
    assert.equal(t[2].opened_by, 'DEC-0001'); assert.equal(t[2].sup, 'SUP-0001'); assert.equal(t[2].work, undefined); assert.equal(t[5].close, true);
    assert.deepEqual(TA.openWorks(t), [{ num: 4, last: '4a', count: 1, opened_by: 'DEC-0002' }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('RULE-0513 번호 글자 — z 다음 aa · 새 칸 형식', () => {
  assert.deepEqual(['a', 'y', 'z', 'az', 'zz'].map(TA.nextLetter), ['b', 'z', 'aa', 'ba', 'aaa']);
  assert.deepEqual(TA.parseSeq(20), { num: 20, legacy: true });
  assert.deepEqual(TA.parseSeq('21ab'), { num: 21, letter: 'ab' });
  for (const s of ['21', '021a', '21A', 0, -1, null]) assert.equal(TA.parseSeq(s), null, String(s));
  const bad = (rec, re) => { const v = TA.checkTransition(rec, ROOT); assert.equal(v.ok, false); assert.match(v.errors.join(' · '), re); };
  bad({ ...OK, work: '21' }, /work/); bad({ ...OK, work: 0 }, /work/);
  bad({ ...OK, opened_by: 'PLAN-116' }, /opened_by/); bad({ ...OK, close: false }, /close/);
  assert.ok(TA.checkTransition({ ...OK, work: 21, opened_by: 'DEC-0093', close: true }, ROOT).ok);
  // 결정 집합을 주면 존재를 본다 (서기는 null — 실제 장부는 아래 시험이 계획과 대조)
  assert.match(TA.nextSeq([], { ...OK, work: 3, opened_by: 'DEC-0009' }, new Set(['DEC-0001'])).errors.join(' · '), /계획에 그 결정이 없음/);
  assert.equal(TA.nextSeq([], { ...OK, work: 3, opened_by: 'DEC-0001' }, new Set(['DEC-0001'])).seq, '3a');
});

test('RULE-0513 장부 전체 — 두 브랜치를 합친 뒤 같은 글자 · 완결 뒤 기록 · opened_by 를 잡는다', () => {
  const r = (seq, o = {}) => ({ seq, ...o });
  const msgs = (recs) => TA.checkLedger(recs).map((x) => x.msg).join(' · ');
  assert.deepEqual(TA.checkLedger([r(20), r(20), r('21a', { opened_by: 'DEC-0001' }), r('21b'), r('22a', { opened_by: 'DEC-0002' })]), []); // 옛 #20 둘은 그대로
  assert.match(msgs([r('21a', { opened_by: 'DEC-0001' }), r('21b'), r('21b')]), /21b 가 둘/);
  assert.match(msgs([r('21a', { opened_by: 'DEC-0001' }), r('21b', { close: true }), r('21c')]), /완결됨 — 그 뒤 기록 21c/);
  assert.match(msgs([r('21b', { opened_by: 'DEC-0001' })]), /21a 부터/);
  assert.match(msgs([r('21a')]), /opened_by 가 없음/);
  assert.match(msgs([r('21a', { opened_by: 'DEC-0001' }), r('21b', { opened_by: 'DEC-0001' })]), /첫 기록에만/);
  assert.match(msgs([r('21a', { opened_by: 'DEC-0001' }), r('22a', { opened_by: 'DEC-0001' })]), /결정 하나 = 번호 하나/);
  assert.match(msgs([r(21), r('21a', { opened_by: 'DEC-0001' })]), /옛 기록과 새 기록/);
  assert.match(msgs([r('x')]), /seq 'x'/);
  // 병합 순서가 바뀌어도(덧붙이기 장부를 합친 순서) 글자 순으로 본다
  assert.deepEqual(TA.checkLedger([r('21b'), r('21a', { opened_by: 'DEC-0001' })]), []);
});

test('RULE-0513 이 저장소의 전환 기록 장부가 검사를 통과하고, 새 번호를 연 결정(opened_by)이 계획에 있다', () => {
  const t = CLERK.readTransitions(ROOT);
  assert.deepEqual(TA.checkLedger(t), []);
  const decisions = new Set(STATE.load(ROOT).decisions.map((d) => d.id));
  assert.deepEqual(t.filter((r) => r.opened_by && !decisions.has(r.opened_by)).map((r) => `${r.seq} ${r.opened_by}`), [], '계획에 없는 결정이 번호를 엶');
});
