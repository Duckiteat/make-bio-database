// 측정법 장부 (측정법 계획 ASY-00 · RULE-0522) — judicial/assay_audit.js · legislative/clerk.mjs appendAssays
//   ① 기초 판독 → 분리 → 조합이 사다리대로 쌓이고, 고치기는 revises + why 로 내력이 남는다 (합성 측정법)
//   ② 거부 사례: 만든 방법·근거·버린 대안 · 단(값을 내는가) · 조합 · 분리 속성 · 고칠 때 why · 받지 않는 칸
//   ③ 서기: 봉인 없이·다른 항목으로는 쓰지 않음 · 사슬을 고치면 판정이 잡음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const AS = req('../judicial/assay_audit.js'), ATT = req('../judicial/attestation.js');
const CLERK = await import('../legislative/clerk.mjs');

const made = (o) => ({ how: '교과서의 원리 장과 대표 프로토콜을 보고 판독 단위로 정함', sources: [{ db: 'ISBN', id: '9780000000000' }], alternatives: [{ what: '장비 이름으로 묶기', why_not: '같은 원리를 여러 장비가 씀' }], by: 'test', ...o });
const A = (o) => ({ key: 'syn_absorbance', label: '흡광 측정 (합성)', rung: 'readout', principle: 'Beer–Lambert — 흡광도 = ε · c · l', produces: ['concentration'], measurement_noise: ['normal'], composed_of: [], made: made(), ...o });
const SEP = { key: 'syn_gel', label: '전기영동 (합성)', rung: 'separation', principle: '전하·크기로 분리', produces: [], measurement_noise: [], composed_of: [], made: made() };
const COMB = { key: 'syn_enzyme_assay', label: '효소 활성 분광 측정 (합성)', rung: 'combined', principle: '기질 소모를 흡광으로 — 초기 속도', produces: ['kinetic_constant'], measurement_noise: ['normal'], composed_of: ['syn_absorbance'], separation: ['syn_gel'], made: made() };
const sealed = (proposals) => ATT.sealVerdict({ ok: true, errors: [], warnings: [] }, proposals, { issuer: 'judicial/assay_audit.js#checkProposals' });

test('① 사다리대로 쌓기 · 고치기는 revises + why 로 내력이 남음', () => {
  const dir = mkdtempSync(join(tmpdir(), 'assay-'));
  try {
    for (const batch of [[A()], [SEP], [COMB]]) { assert.deepEqual(AS.checkProposals(CLERK.readAssays(dir), batch).errors, []); CLERK.appendAssays({ dataDir: dir, proposals: batch, seal: sealed(batch) }); }
    let a = AS.audit(CLERK.readAssays(dir));
    assert.ok(a.ok, a.errors.join('\n')); assert.equal(a.assays, 3);
    const old = a.current.get('syn_absorbance');
    const fix = [A({ principle: 'Beer–Lambert — A = ε · c · l (직선 범위 안에서만)', revises: old.root, why: '직선 범위 조건을 원리에 적음' })];
    assert.deepEqual(AS.checkProposals(CLERK.readAssays(dir), fix).errors, []);
    CLERK.appendAssays({ dataDir: dir, proposals: fix, seal: sealed(fix) });
    a = AS.audit(CLERK.readAssays(dir));
    assert.ok(a.ok); assert.equal(a.events, 4); assert.match(a.current.get('syn_absorbance').principle, /직선 범위/);
    assert.equal(CLERK.readAssays(dir).filter((e) => e.key === 'syn_absorbance').length, 2, '옛 판도 사슬에 남음');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('② 거부 사례 — 만든 방법 · 단 · 조합 · 분리 · 고칠 때 why', () => {
  const bad = (p, re, ev = []) => assert.match(AS.checkProposals(ev, [p]).errors.join('\n'), re);
  bad(A({ made: made({ how: ' ' }) }), /made\.how/);
  bad(A({ made: made({ sources: [] }) }), /made\.sources/);
  bad(A({ made: made({ sources: [{ db: 'blog', id: 'x' }] }) }), /made\.sources 의/);
  bad(A({ made: made({ alternatives: undefined }) }), /made\.alternatives/);
  bad(A({ made: undefined }), /made\(어떻게 만들었나\)가 없음/);
  bad(A({ rung: 'quantum' }), /rung 은 사다리의 단/);
  bad(A({ produces: [] }), /값을 낸다 — produces 가 비었음/);
  bad({ ...SEP, produces: ['concentration'], measurement_noise: ['normal'] }, /혼자서 값을 내지 않는다/);
  bad(A({ produces: ['mood'] }), /관찰 종류가 아님/);
  bad(A({ measurement_noise: [] }), /측정 잡음 모형이 하나 이상/);
  bad(A({ noise: ['normal'] }), /noise 칸은 받지 않음 — 측정법에는 측정 잡음만/); // 화학 잡음과 섞이지 않게 칸 이름이 측정 잡음을 말한다 (DEC-0045)
  bad({ ...COMB, composed_of: [] }, /판독\(readout · combined\)을 하나 이상 조합/);
  bad({ ...COMB, composed_of: ['nowhere'] }, /장부에 없는 측정법/);
  bad(A({ key: 'X' }), /key 는 소문자/);
  bad(A({ seq: 1 }), /받지 않는 칸 seq/);
  const ev = [{ ...A(), seq: 1, root: 'r1' }];
  bad(A(), /이미 있는 측정법 — 고치려면 revises/, ev);
  bad(A({ revises: 'r1' }), /고칠 때는 why/, ev);
  bad({ ...COMB, separation: ['syn_absorbance'] }, /분리 단이 아님/, [{ ...A(), seq: 1, root: 'r1' }]);
});

test('③ 서기 — 봉인 없이 · 다른 항목으로는 쓰지 않음 · 사슬을 고치면 판정이 잡음', () => {
  const dir = mkdtempSync(join(tmpdir(), 'assay-'));
  try {
    assert.throws(() => CLERK.appendAssays({ dataDir: dir, proposals: [A()], seal: null }), /봉인이 없거나/);
    assert.throws(() => CLERK.appendAssays({ dataDir: dir, proposals: [A()], seal: sealed([SEP]) }), /봉인된 항목과 쓰려는 항목이 다름/);
    CLERK.appendAssays({ dataDir: dir, proposals: [A()], seal: sealed([A()]) });
    const f = join(dir, 'assays.jsonl');
    writeFileSync(f, readFileSync(f, 'utf8').replace('Beer–Lambert', 'Beer'));
    assert.match(AS.audit(CLERK.readAssays(dir)).errors.join('\n'), /root 재계산 불일치/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('④ 관찰의 측정법 (RULE-0524 · DEC-0045): 등록된 측정법만 · 그 측정법이 관찰 종류를 냄 · 장부를 못 받으면 경고 · 반복 종류 어휘 · 같은 측정 깃발', () => {
  const C = req('../core.js'), J = req('../judicial/judicial.js');
  const base = C.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
  const tpl = Object.values(base.observations).find((o) => o.observable && o.observable.kind === 'concentration' && !o.retracted);
  const withObs = (extra) => { const d = JSON.parse(JSON.stringify(base)); Object.assign(d.observations, extra); return C.normalize(d); };
  const reg = new Map([['syn_absorbance', { key: 'syn_absorbance', rung: 'readout', produces: ['concentration'] }], ['syn_kinetics', { key: 'syn_kinetics', rung: 'combined', produces: ['kinetic_constant'] }]]);
  const errs = (db, opt) => J.validate(db, opt).errors.filter((e) => e.rule === 'RULE-0524').map((e) => e.msg).join('\n');
  const warns = (db, opt) => J.validate(db, opt).warnings.filter((e) => e.rule === 'RULE-0524').map((e) => e.msg).join('\n');
  assert.equal(errs(withObs({ O900001: { ...tpl, assay: 'syn_absorbance', replicate_type: 'technical' } }), { assays: reg }), '', '등록 · 내는 값 맞음');
  assert.match(errs(withObs({ O900001: { ...tpl, assay: 'nowhere_assay' } }), { assays: reg }), /미등록 측정법 'nowhere_assay'/);
  assert.match(errs(withObs({ O900001: { ...tpl, assay: 'syn_kinetics' } }), { assays: reg }), /'concentration' 를 내지 않음/);
  assert.match(warns(withObs({ O900001: { ...tpl, assay: 'syn_absorbance' } }), {}), /측정법 장부를 받지 않아 확인하지 못함/, '장부를 못 받으면 조용히 넘어가지 않음');
  assert.match(errs(withObs({ O900001: { ...tpl, replicate_type: 'cells' } }), { assays: reg }), /반복 종류\(replicate_type\) 'cells'/);
  // 같은 측정 — 같은 측정법 · 같은 출처는 독립 근거가 아님 (철회·측정법 없음은 묶지 않음)
  const g = AS.sameMeasurement({ observations: { O900001: { ...tpl, assay: 'syn_absorbance' }, O900002: { ...tpl, assay: 'syn_absorbance' }, O900003: { ...tpl, assay: 'syn_absorbance', retracted: { note: 'x' } }, O900004: { ...tpl } } });
  assert.deepEqual(g.map((x) => x.obs), [['O900001', 'O900002']]);
  assert.equal(g[0].assay, 'syn_absorbance');
});
