// 사전 봉인 (build-plan 16A) — data/dictionary.jsonl 은 추가만 하는 사슬, 새 항목은 사법부 검사 → 봉인 → 서기만 쓴다
//   ① 지금 사슬은 통과 (사슬·revises·렌더 모호·vocab 덮임)
//   ② 변조·삭제는 거부 (root 재계산·seq·prev)
//   ③ 잘못된 새 항목은 거부 (register·키·빈 영어·날짜·사슬 칸·중복·revises·렌더 충돌·xref)
//   ④ 고치기는 revises 로만, 서기는 봉인 없이·다른 항목으로 쓰지 않는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const req = createRequire(import.meta.url);
const DA = req('../judicial/dictionary_audit.js'), ATT = req('../judicial/attestation.js');
const CLERK = await import('../legislative/clerk.mjs');
const ROOT = new URL('..', import.meta.url).pathname;
const EVENTS = CLERK.readDictionary(join(ROOT, 'data'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const ok = { register: 'stiffnessFlags', key: 'well_conditioned', label_en: 'Well conditioned (no stiffness symptom)', meaning_en: 'No stiffness symptom was seen.', xref: null, since: '2026-10-23' };
const seal = (p, good = true) => ATT.sealVerdict({ ok: good, errors: good ? [] : ['x'], warnings: [] }, p, { issuer: 'judicial/dictionary_audit.js#checkProposals' });

test('① 지금 사슬은 통과 — vocab 의 모든 토큰에 영어 항목', () => {
  const a = DA.audit(EVENTS);
  assert.ok(a.ok, a.errors.join('\n'));
  assert.equal(a.tokens, a.events - EVENTS.filter((e) => e.revises).length, '토큰 수 = 사건 수 − 고친 사건 수 (고치기는 새 토큰이 아님)');
});

test('② 변조·삭제는 거부', () => {
  const t = clone(EVENTS); t[3].label_en = 'tampered';
  assert.match(DA.audit(t).errors.join('\n'), /root 재계산 불일치/);
  const d = clone(EVENTS); d.splice(5, 1);
  const e = DA.audit(d).errors.join('\n');
  assert.match(e, /seq/); assert.match(e, /prev/); assert.match(e, /사전 항목\(en\)이 없음/, '지운 토큰은 덮임에서도 걸림');
});

test('③ 잘못된 새 항목은 거부', () => {
  const cur = DA.current(EVENTS).cur, root = cur.get('stiffnessFlags/well_conditioned').root;
  const bad = (p, re) => { const v = DA.checkProposals(EVENTS, [p]); assert.ok(!v.ok, `통과하면 안 됨: ${JSON.stringify(p)}`); assert.match(v.errors.join('\n'), re); };
  bad({ ...ok, register: 'nope', revises: root }, /register 어휘 밖/);
  bad({ ...ok, key: 'imaginary', revises: undefined }, /vocab\.stiffnessFlags 에 없는 키/);
  bad({ ...ok, label_en: ' ', revises: root }, /비지 않은 문자열/);
  bad({ ...ok, since: '23-10-2026', revises: root }, /YYYY-MM-DD/);
  bad({ ...ok, seq: 999, revises: root }, /받지 않는 칸 seq/);
  bad({ ...ok }, /이미 있는 토큰 — 고치려면 revises/);
  bad({ ...ok, revises: 'f'.repeat(64) }, /이미 있는 토큰 — 고치려면 revises/);
  bad({ ...ok, label_en: 'Match', revises: root }, /렌더 'Match' 가/, '다른 토큰(qualOutcomes/match)과 같은 영어 라벨');
  bad({ ...ok, xref: { db: 'Nope', id: 'x' }, revises: root }, /xref/);
  assert.ok(!DA.checkProposals(EVENTS, [{ ...ok, revises: root }, { ...ok, revises: root }]).ok, '한 묶음에 같은 토큰 둘');
  assert.ok(!DA.checkProposals(EVENTS, []).ok, '빈 묶음');
});

test('④ 고치기는 revises 로 — 서기는 봉인 있을 때만 사슬 끝에 붙인다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dict-'));
  try {
    writeFileSync(join(dir, 'dictionary.jsonl'), readFileSync(join(ROOT, 'data/dictionary.jsonl'), 'utf8'));
    const events = CLERK.readDictionary(dir), root = DA.current(events).cur.get('stiffnessFlags/well_conditioned').root;
    const p = [{ ...ok, revises: root }];
    assert.ok(DA.checkProposals(events, p).ok, DA.checkProposals(events, p).errors.join('\n'));
    assert.throws(() => CLERK.appendDictionary({ dataDir: dir, proposals: p, seal: { ...seal(p), ok: false } }), /봉인이 없거나 변조|거부/);
    assert.throws(() => CLERK.appendDictionary({ dataDir: dir, proposals: p, seal: seal([{ ...p[0], label_en: 'other' }]) }), /봉인된 항목과 쓰려는 항목이 다름/);
    const out = CLERK.appendDictionary({ dataDir: dir, proposals: p, seal: seal(p) });
    assert.equal(out[0].seq, events.length + 1);
    const after = CLERK.readDictionary(dir), a = DA.audit(after);
    assert.ok(a.ok, a.errors.join('\n'));
    assert.equal(a.tokens, DA.audit(events).tokens, '고치기는 토큰을 늘리지 않음');
    assert.equal(DA.current(after).cur.get('stiffnessFlags/well_conditioned').label_en, ok.label_en, '마지막 사건이 현재 값');
    assert.equal(after.length, events.length + 1, '지우지 않고 붙임');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
