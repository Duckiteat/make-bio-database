// 전환 기록 (재건 PLAN §3, 6c) — 한 세션 = 한 모드. 검사(judicial/transition_audit.js) → 서기(appendTransition, 끝에만 붙임)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import * as CLERK from '../legislative/clerk.mjs';

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

test('RULE-0513 서기는 검사 통과 뒤에만, 끝에만 붙이고 순번을 매긴다', () => {
  const root = mkdtempSync(join(tmpdir(), 'tr-'));
  try {
    writeFileSync(join(root, 'CLAUDE.md'), 'x');
    assert.throws(() => CLERK.appendTransition({ ...OK, why: '' }, root), (e) => e.rule === 'RULE-0513');
    CLERK.appendTransition(OK, root); CLERK.appendTransition({ ...OK, from: 'develop', to: 'baseline', why: '고친 뒤 다시 기초시험' }, root);
    const t = CLERK.readTransitions(root);
    assert.deepEqual(t.map((x) => [x.seq, x.from, x.to]), [[1, 'baseline', 'develop'], [2, 'develop', 'baseline']]);
    assert.equal(readFileSync(join(root, CLERK.TRANSITIONS), 'utf8').split('\n').filter(Boolean).length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
