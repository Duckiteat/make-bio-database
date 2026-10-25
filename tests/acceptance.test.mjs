// 인정 = (기록, 용도) (build-plan 72, judicial/acceptance.js)
//   ① 지금 표: 서술·비교·추정은 계산, 검증 근거는 승인된 정성 관찰 6, 기준 0 — 추정 인정 = anchor·parameter
//   ② 승인 없음 → needs_approval · 승인 → accepted · 승인 뒤 축이 내려감 → review · 철회 → 다시 needs_approval
//   ③ 승인은 축·관계 조건을 넘지 못한다 (서기가 쓰지 않음) ④ 도장 검사: 역할·이유·변조·주체·용도
//   ⑤ 관계 조건: 다른 종 · 추정에 쓴 관찰 · 미확인 문헌 ⑥ 결론은 가장 약한 근거 — 보고서 판정이 인정 재검토 필요로
import SCN from '../scenarios.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const ACC = req('../judicial/acceptance.js'), REL = req('../judicial/reliability.js'), ATT = req('../judicial/attestation.js'), TR = req('../judicial/trend.js');
const CLERK = await import('../legislative/clerk.mjs');
const db = JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8')), reg = ATT.readRegistry(ROOT), v = ATT.validStamps(db, reg, { root: ROOT, reverify: false });
const input = { attestations: v.keys, stale: v.stale, stamps: reg.stamps, literature: req('../inbox.js').literatureStatus(join(ROOT, 'data')), trend: TR.verdicts(db, reg, { root: ROOT, reverify: false, today: '2026-10-11' }).map };
const T = ACC.table(db, { ...input, registry: reg });
const QUAL = ['O000019', 'O000020', 'O000021', 'O000022', 'O000027', 'O000028'];
const obsRow = (t, id) => t.rows.find((x) => x.row.what === 'observation' && x.row.sense === id);
const stamp = (o) => ACC.issue({ id: 'O000019', use: 'evidence', by: 'human', reason: '시험', date: '2026-10-25', ...o });

test('① 지금 표: 추정 인정 = anchor·parameter · 서술 = blocked 말고 전부 · 검증 근거 = 승인된 정성 관찰 6 · 기준 0', () => {
  const sum = REL.summary(T.rows.map((x) => x.row)).byGrade;
  const n = (u) => T.rows.filter((x) => x.uses[u].ok).length;
  assert.equal(n('estimate'), sum.anchor + sum.parameter + sum.bounded);
  assert.equal(n('describe'), T.rows.length - sum.blocked);
  assert.deepEqual(T.rows.filter((x) => x.uses.evidence.ok).map((x) => x.row.sense).sort(), QUAL);
  assert.equal(n('standard'), 0, '기준은 I 축 전에는 닿지 못한다');
  for (const x of T.rows) if (x.uses.estimate.ok) assert.ok(['anchor', 'parameter', 'bounded'].includes(x.row.grade), `${x.row.sense} ${x.row.grade}`);
  assert.equal(T.invalid.length, 0);
});

test('② 승인 없음 → needs_approval · 승인 → accepted · 축이 내려가면 review · 철회 → needs_approval', () => {
  const bare = ACC.table(db, { ...input, registry: { stamps: [] } });
  assert.equal(obsRow(bare, 'O000019').uses.evidence.status, 'needs_approval');
  assert.equal(obsRow(T, 'O000019').uses.evidence.status, 'accepted');
  const one = { ...input, registry: { stamps: [stamp()] } }, t1 = ACC.table(db, one);
  assert.equal(obsRow(t1, 'O000019').uses.evidence.status, 'accepted');
  // 축이 내려감: 문헌 확인이 사라지면(S3.unconfirmed) 승인은 남아 있어도 review
  const t2 = ACC.table(db, { ...one, literature: {} });
  const u = obsRow(t2, 'O000019').uses.evidence;
  assert.equal(u.status, 'review'); assert.match(u.reasons.join(), /확인되지 않음/); assert.ok(u.approval);
  // 철회: 같은 주체의 새 도장(revoked) 이 승인을 대신한다
  const t3 = ACC.table(db, { ...input, registry: { stamps: [stamp({ verdict: 'revoked', reason: '시험 철회' })] } });
  assert.equal(obsRow(t3, 'O000019').uses.evidence.status, 'needs_approval');
});

test('③ 승인은 축·관계 조건을 넘지 못한다 — 서기가 쓰지 않는다', () => {
  const est = Object.entries(db.observations).find(([, o]) => o.use === 'estimation')[0];
  const r = ACC.checkIssue(ACC.issue({ id: est, use: 'evidence', by: 'human', reason: '시험', date: '2026-10-25' }), db, input);
  assert.equal(r.ok, false); assert.match(r.reasons.join(), /넘지 못한다/);
  assert.ok(ACC.checkIssue(stamp(), db, input).ok, '조건을 넘는 관찰의 승인은 통과');
  const dir = mkdtempSync(join(tmpdir(), 'acc-')); mkdirSync(join(dir, 'attestations'));
  try {
    assert.throws(() => CLERK.appendAttestations({ root: dir, db, context: input, stamps: [ACC.issue({ id: est, use: 'evidence', by: 'human', reason: '시험', date: '2026-10-25' })] }), /넘지 못한다/);
    assert.ok(!existsSync(join(dir, ATT.REGISTRY)), '거부되면 등록부를 쓰지 않음');
    assert.throws(() => CLERK.appendAttestations({ root: dir, db, context: input, stamps: [ACC.issue({ id: 'O000019', use: 'standard', by: 'human', reason: '시험', date: '2026-10-25' })] }), /I 축/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('④ 도장 검사: 수집가 역할 · 이유 없음 · 변조 · 관찰이 아닌 주체 · 승인 없이 되는 용도는 거부', () => {
  assert.match(ACC.verifyAcceptStamp(stamp({ by: 'collector' }), db).reasons.join(), /역할/);
  assert.match(ACC.verifyAcceptStamp(stamp({ reason: ' ' }), db).reasons.join(), /이유/);
  const t = stamp(); t.reason = '바꿈';
  assert.match(ACC.verifyAcceptStamp(t, db).reasons.join(), /digest/);
  assert.match(ACC.verifyAcceptStamp(ACC.issue({ id: 'D000149', use: 'evidence', by: 'human', reason: 'x', date: '2026-10-25' }), db).reasons.join(), /관찰 번호/);
  assert.match(ACC.verifyAcceptStamp(stamp({ use: 'estimate' }), db).reasons.join(), /승인이 필요한 용도가 아님/);
  assert.ok(ACC.verifyAcceptStamp(stamp({ by: 'integrator' }), db).ok, '통합 에이전트도 승인 (2026-10-25 결정)');
});

test('⑤ 관계 조건: 다른 종은 서술·비교만 · 추정에 쓴 관찰은 검증 근거가 아님 · 미확인 문헌은 높은 용도에 못 씀', () => {
  const ctx = { ...T.ctx, approvals: new Map() };
  const row = { ...obsRow(T, 'O000019').row };
  const mouse = { ...ctx, db: { ...ctx.db, observations: { ...ctx.db.observations, O000019: { ...ctx.db.observations.O000019, condition: { species: '10090' } } } } };
  assert.match(ACC.accept(row, 'evidence', mouse).reasons.join(), /기준 종/);
  assert.ok(ACC.accept(row, 'describe', mouse).ok);
  assert.match(ACC.accept(row, 'evidence', { ...ctx, estimated: new Set(['O000019']) }).reasons.join(), /순환/);
  assert.match(ACC.accept({ ...row, cs: 'S3.unconfirmed' }, 'evidence', ctx).reasons.join(), /확인되지 않음/);
  assert.equal(ACC.accept({ ...row, what: 'kinetics' }, 'evidence', ctx).status, 'rejected', '검증 근거는 관찰 기록만');
  assert.equal(ACC.accept({ s: 4, d: 2, trend: 'unchecked', what: 'rule', sense: 'D000149' }, 'estimate', ctx).status, 'conditional', 'S4∧D2 는 오차 막대 조건부');
});

test('⑥ 결론은 가장 약한 근거를 따른다 — 검증 세트 관찰이 인정되지 않으면 보고서 판정이 인정 재검토 필요', () => {
  const ER = req('../judicial/evidence_report.js'), C = req('../core.js');
  const BASE = C.normalize(JSON.parse(JSON.stringify(db)));
  const prereg = readFileSync(join(ROOT, 'data/preregistrations.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const b2m = SCN.read(join(ROOT, 'examples/scenarios', 'mhc-i-b2m-validation-hypothetical.json'));
  const ok = ER.evidenceReport(BASE, b2m, { target: 'D000202', prereg, acceptance: T });
  assert.match(ok.judgment.level, /^검증 \(사전 등록 #1\)/); assert.equal(ok.judgment.acceptance.ok, true);
  const none = ER.evidenceReport(BASE, b2m, { target: 'D000202', prereg, acceptance: ACC.table(db, { ...input, registry: { stamps: [] } }) });
  assert.equal(none.judgment.key, 'acceptance_review'); assert.match(none.judgment.why, /O000021 \(needs_approval/);
  assert.equal(ER.evidenceReport(BASE, b2m, { target: 'D000202', prereg }).judgment.acceptance, null, '인정 표를 받지 않으면 확인 안 함으로');
});

// build-plan 74 (2026-10-25): 관문 = 인정 '추정' — 두 판정이 같은 함수
test('⑦ 관문은 인정의 추정 조건을 본다: 다른 종 상수 거부 · 조건부(오차 막대)도 관문은 통과시키지 않음 · 사람 상수는 그대로', () => {
  const DOI = { level: 'curated', sources: [{ db: 'PMID', id: '31141475' }] };
  const ir = (k) => ({ rules: [{ ref: 'D000149/rule/condense', kind: 'mm', k: { src: 'data', kcat: 1, evidence: DOI, ...k } }] });
  assert.equal(REL.constantVerdict(ir({ context: { species: '9606' } }), {}).ok, true);
  const m = REL.constantVerdict(ir({ context: { species: '10090' } }), {});
  assert.equal(m.ok, false); assert.match(m.violations[0].msg, /기준 종/);
  assert.match(REL.gateMessage({ s: 4, d: 2, cs: 'S4.stamp' }, 'parameter'), /등급/, 'S4D2 는 문턱에서 먼저 막힘');
  // 같은 판정: 인정 표의 추정과 관문이 같은 함수
  assert.equal(ACC.accept, REL.accept);
  const C = req('../core.js');
  const base = C.normalize(JSON.parse(JSON.stringify(db)));
  const rule = base.senses.D000149.rule.find((r) => r.id === 'condense');
  rule.kinetics.context.species = '10090';
  assert.equal(REL.speciesOf(base, { what: 'kinetics', sense: 'D000149', target: 'D000149/rule/condense' }), '10090', '속도 상수의 종은 kinetics.context.species');
});

// build-plan 75 (2026-10-25): observe·fate 판정도 가장 약한 근거 — 인정되지 않은 관찰은 결론이 아니다
test('⑧ 정성·정량 판정의 결론은 인정을 따른다 — 인정되지 않으면 결론 아님 · 넘기지 않으면 확인 안 함(그대로)', () => {
  const QC = req('../judicial/qual_compare.js');
  const pv = { declared: true, ok: true, problems: [], validation: ['O000009'] };
  const Q = { kind: 'qualitative', readout: { kind: 'amount', target: 'X|c' }, expect: 'decrease', condition: { species: '9606' } };
  const j = (extra) => QC.judgeQualitative(Object.assign({ o: Q, control: { values: [100] }, perturbed: { values: [90] }, resolution: 1, quantum: 1, protocol: pv, observationId: 'O000009' }, extra));
  assert.equal(j({}).conclusive, true, '인정을 넘기지 않으면 예전 그대로');
  assert.equal(j({ acceptance: { ok: true, status: 'accepted', reasons: [] } }).conclusive, true);
  const no = j({ acceptance: { ok: false, status: 'needs_approval', reasons: [] } });
  assert.equal(no.conclusive, false); assert.match(no.requirement, /검증 근거로 인정되지 않음 \(needs_approval\)/);
  const PR = req('../judicial/process_report.js');
  assert.match(readFileSync(join(ROOT, 'judicial/process_report.js'), 'utf8'), /검증 세트 관찰이 검증 근거로 인정됨/, '운명 과정 보고서에도 인정 점검 줄');
  assert.ok(PR.processReport);
});

// build-plan 76 (2026-10-25): 승인 도장은 추가만 — 경과가 등록부에 남고 마지막 도장이 유효
test('⑨ 승인 이력: 승인 → 철회 → 재승인이 등록부에 모두 남고 마지막이 유효 · 같은 도장은 거부', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acc-h-')); mkdirSync(join(dir, 'attestations'));
  try {
    const put = (o) => CLERK.appendAttestations({ root: dir, db, context: input, stamps: [stamp(o)] });
    const now = () => ATT.readRegistry(dir);
    put({ reason: '첫 승인' }); put({ verdict: 'revoked', reason: '철회' });
    assert.equal(obsRow(ACC.table(db, { ...input, registry: now() }), 'O000019').uses.evidence.status, 'needs_approval', '철회가 마지막');
    put({ reason: '다시 승인' });
    const reg2 = now(), mine = reg2.stamps.filter((x) => x.claim === 'accept');
    assert.deepEqual(mine.map((x) => x.reason), ['첫 승인', '철회', '다시 승인'], '경과가 순서대로 남음');
    assert.equal(obsRow(ACC.table(db, { ...input, registry: reg2 }), 'O000019').uses.evidence.status, 'accepted');
    assert.throws(() => put({ reason: '다시 승인' }), /이미 있음/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
