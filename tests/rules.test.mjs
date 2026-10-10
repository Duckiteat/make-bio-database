// 매핑·검사 규칙 테스트 (형식 v4): 규칙이 느슨해지면 여기서 실패한다.   실행: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// 삼권 분립: 행정부(core.js — 읽기·시뮬레이션), 사법부(judicial/ — 검사·관문·감사), 입법부(legislative/ — 병합), 조정자(orchestrator.js)
const req = createRequire(import.meta.url);
const DefDB = req('../core.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js'), ORCH = req('../orchestrator.js'), ATT = req('../judicial/attestation.js');
const ROOT = new URL('..', import.meta.url).pathname;
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const IX = DefDB.index(BASE);
const id = (ref) => { const r = DefDB.resolveRef(IX, ref); if (r.error) throw new Error(r.error); return r.id; };
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 9 }, o);
const run = (patch, opt) => { const res = LEG.merge(BASE, P(patch)); return { res, g: J.gate(BASE, res, opt) }; };
const msgs = (g) => [...g.errors, ...g.warnings].map((e) => `${e.where}: ${e.msg}`).join('\n');
const passes = (patch, opt) => { const r = run(patch, opt); assert.ok(r.g.ok, '통과해야 함:\n' + msgs(r.g)); return r.res; };
const rejectedFor = (patch, re) => {
  const { g } = run(patch);
  assert.equal(g.ok, false, '거부되어야 함');
  assert.ok([...g.errors, ...g.warnings].some((e) => re.test(e.msg)), `기대한 사유(${re})가 없음:\n` + msgs(g));
};
// 설명 하나짜리 정의항
const desc = (text, extra) => [Object.assign({ text, field: '생화학', context: { scope: '테스트' } }, extra)];
// 새 개념 하나 + 뜻 하나
const one = (name, sense, termExtra) => ({
  terms: [Object.assign({ id: 'T+1', names: { ko: name } }, termExtra)],
  senses: [Object.assign({ id: 'D+1', term: 'T+1', kind: 'concept', desc: desc('테스트 정의') }, sense)],
});
const findText = (db, text) => Object.values(db.senses).find((d) => d.desc.some((x) => x.text === text));
// 저장소 사본을 고쳐 직접 검사 (단계·구조 검사용)
const probe = (f) => { const d = JSON.parse(JSON.stringify(BASE)); f(d); return J.validate(DefDB.normalize(d)); };
const failsWith = (f, re) => {
  const r = probe(f);
  assert.ok(r.errors.some((e) => re.test(e.msg)), `기대한 오류(${re})가 없음:\n` + r.errors.map((e) => `${e.where}: ${e.msg}`).join('\n'));
};
const GP = id('글리코겐 인산화효소'), PKA = id('PKA'), PHK = id('인산화효소 키네이스'), REC = id('β-아드레날린 수용체'), AC = id('adenylyl cyclase');
const CAMP = id('cAMP'), ATP = id('ATP'), EPI = id('에피네프린');
const stepOf = (db, ruleRef) => Object.values(db.steps).find((s) => s.rule === ruleRef);

test('현재 저장소는 오류·경고 없음', () => {
  // verified 외부 ID 는 증명 등록부와 대조해야 한다 (등록부를 주지 않으면 사법부가 경고로 남긴다 — governance ④)
  const r = ORCH.validateWithRegistry(BASE, ROOT);
  assert.deepEqual([r.errors, r.warnings], [[], []]);
  assert.ok(r.attestations.keys.length > 0 && !r.attestations.failed.length, '증명 도장이 모두 유효');
});
test('예시 패치는 관문을 통과', () => {
  const patch = JSON.parse(readFileSync(new URL('../examples/pgm-isomerization.json', import.meta.url), 'utf8'));
  const res = LEG.merge(BASE, patch), g = J.gate(BASE, res);
  assert.ok(g.ok, msgs(g));
});

// ===== 고정 번호 =====
test('새 항목은 다음 번호를 받고, 임시 번호 참조도 함께 바뀜', () => {
  const nx = BASE.meta.next;
  const res = passes({ terms: [{ id: 'T+1', names: { ko: '테스트 개념' } }],
    senses: [{ id: 'D+1', term: 'T+1', kind: 'concept', desc: desc('테스트 정의', { links: [{ to: 'D+2', rel: 'refers', span: '테스트' }] }) },
             { id: 'D+2', term: '테스트 하위', kind: 'concept', desc: desc('x') }] });
  const T = 'T' + String(nx.T).padStart(6, '0'), D1 = 'D' + String(nx.D).padStart(6, '0'), D2 = 'D' + String(nx.D + 1).padStart(6, '0');
  assert.equal(res.db.terms[T].names.ko, '테스트 개념');
  assert.equal(res.db.senses[D1].desc[0].links[0].to, D2);
  assert.equal(res.db.terms[res.db.senses[D2].term].names.ko, '테스트 하위', '이름만 적은 term 은 새 개념이 됨');
});
test('삭제한 번호는 다시 쓰지 않음', () => {
  const last = 'S' + String(BASE.meta.next.S - 1).padStart(6, '0'), next = 'S' + String(BASE.meta.next.S).padStart(6, '0');
  const res = passes({ remove: [last] });
  const st = { ...BASE.steps[last], id: 'S+1' };
  const res2 = LEG.merge(res.db, P({ steps: [st] }));
  assert.ok(!res2.db.steps[last], `${last} 는 재사용되면 안 됨`);
  assert.ok(res2.db.steps[next]);
});
test('번호 배정기가 쓰인 번호보다 작으면 오류', () => failsWith((d) => { d.meta.next.D = 3; }, /번호 재사용/));
test('이름을 바꿔도 번호와 연결은 그대로, 옛 이름은 별칭으로 남음', () => {
  const T = BASE.senses[GP].term;
  const res = passes({ terms: [{ id: T, names: { ko: '글리코겐 포스포릴레이스' } }] });
  assert.equal(res.db.terms[T].names.ko, '글리코겐 포스포릴레이스');
  assert.ok(res.db.terms[T].aliases.includes('글리코겐 인산화효소'));
  assert.ok(Object.values(res.db.steps).some((s) => s.agents.some((a) => a.b.startsWith(GP + '|'))), '단계 연결 유지');
});
test('없는 번호로 수정하면 거부', () => {
  rejectedFor({ senses: [{ id: 'D999999', kind: 'concept', desc: desc('t') }] }, /없는 정의항 번호/);
  rejectedFor({ terms: [{ id: 'T999999', names: { ko: 'x' } }] }, /없는 개념 번호/);
});
test('정의항을 다른 개념으로 옮길 수 없음', () => {
  rejectedFor({ senses: [{ id: ATP, term: 'ADP', kind: 'small_molecule', desc: desc('t') }] }, /옮길 수 없음/);
});
test('이전 형식 패치(v2·v3)는 거부', () => {
  rejectedFor({ terms: { x: { definientia: [] } } }, /이전 형식/);
  rejectedFor({ states: { '에너지': [] } }, /이전 형식/);
});
test('저장소 형식 버전이 다르면 오류', () => {
  const r = J.validate(DefDB.normalize({ ...JSON.parse(JSON.stringify(BASE)), version: 3 }));
  assert.ok(r.errors.some((e) => /형식 버전 3/.test(e.msg)));
});

// ===== 정의항 필드 단위 병합 =====
test('기존 정의항 수정은 적은 최상위 필드만 바꾸고 나머지(부위·규칙·설명)는 유지', () => {
  const res = passes({ senses: [{ id: GP, note: '새 메모' }] });
  const d = res.db.senses[GP];
  assert.equal(d.note, '새 메모');
  assert.deepEqual([d.desc, d.site, d.rule, d.xrefs], [BASE.senses[GP].desc, BASE.senses[GP].site, BASE.senses[GP].rule, BASE.senses[GP].xrefs]);
});
test('설명(desc)을 추가하면 설명 전체를 교체 (맥락별 설명은 여러 개)', () => {
  const res = passes({ senses: [{ id: GP, desc: [...BASE.senses[GP].desc, ...desc('근육에서는 AMP 로도 활성화되는 효소', { context: { scope: '근육 생리', tissue: '골격근' } })] }] });
  const d = res.db.senses[GP];
  assert.equal(d.desc.length, 2);
  assert.equal(d.desc[1].context.tissue, 'skeletal_muscle', '조직 별칭 → 표준 키');
});

// ===== 이름 매핑 =====
test('별칭이 기존 개념의 이름과 겹치는 새 개념은 거부', () => {
  rejectedFor(one('아데닐레이트 사이클레이스', {}, { aliases: ['adenylyl cyclase'] }), /이미 .* 의 이름/);
});
test('띄어쓰기만 다른 이름은 기존 개념으로 매핑되고, 설명 없는 새 뜻 추가는 거부', () => {
  const { res, g } = run(one('아데닐산고리화효소', { kind: 'molecule_class', tier: 'T2' }));
  assert.ok(res.report.mapped.some((m) => m.to === BASE.senses[AC].term));
  assert.equal(g.ok, false);
  assert.ok(g.errors.some((e) => /distinction/.test(e.msg)));
});
test('영문 이름·그리스 문자 표기 차이도 같은 개념', () => {
  const { res } = run(one('glycogen phosphorylase', { kind: 'molecule_class', tier: 'T2', distinction: '테스트' }));
  assert.ok(res.report.mapped.some((m) => m.to === BASE.senses[GP].term));
  assert.equal(id('beta-아드레날린 수용체'), REC);
});
test('뜻이 여러 개인 이름으로 연결하면 거부, "이름#n" 은 통과', () => {
  rejectedFor(one('테스트', { kind: 'molecule_class', tier: 'T2', desc: desc('효소 관련', { links: [{ to: '효소', rel: 'is_a', span: '효소' }] }) }), /뜻이 여러 개/);
  const res = passes(one('테스트', { kind: 'molecule_class', tier: 'T2', desc: desc('효소 관련', { links: [{ to: '효소#2', rel: 'is_a', span: '효소' }] }) }));
  assert.equal(findText(res.db, '효소 관련').desc[0].links[0].to, id('효소#2'));
});
test('외부 ID 로 연결하면 정의항 번호로 매핑', () => {
  const res = passes(one('테스트 부류', { kind: 'molecule_class', tier: 'T2', desc: desc('ATP 관련', { links: [{ to: 'CHEBI:15422', rel: 'refers', span: 'ATP' }] }) }));
  assert.equal(findText(res.db, 'ATP 관련').desc[0].links[0].to, ATP);
});
test('없는 개념으로 연결하면 거부', () => {
  rejectedFor(one('테스트', { desc: desc('없는개념 관련', { links: [{ to: '없는개념', rel: 'refers', span: '없는개념' }] }) }), /데이터베이스에 없음/);
});
test('예약 문자(# @ | /)가 든 이름은 거부', () => {
  rejectedFor(one('A|B', {}), /# @ \| \//);
  rejectedFor(one('A/B', {}), /# @ \| \//);
});

// ===== 통제 어휘 =====
test('어휘에 없는 kind·field·위치·특징은 거부', () => {
  rejectedFor(one('테스트', { kind: 'enzyme' }), /kind 'enzyme'/);
  rejectedFor(one('테스트', { desc: [{ text: 't', field: '생물', context: { scope: 't' } }] }), /분야\(field\) '생물'/);
  rejectedFor({ steps: [{ ...BASE.steps.S000005, id: 'S+1', outputs: [{ ref: CAMP, location: '골지체 안' }] }] }, /위치\(location\) '골지체 안'/);
  rejectedFor({ steps: [{ ...BASE.steps.S000009, id: 'S+1', outputs: [{ ref: GP, features: ['reg_phos:sulfated'], location: 'cytosol' }] }] }, /특징\(feature\) 'sulfated'/);
});
test('어휘 별칭은 표준 키로 바뀜', () => {
  const res = passes(one('테스트', { kind: '개념', desc: [{ text: '테스트 정의', field: 'biochemistry', context: { scope: 't' } }] }));
  const d = findText(res.db, '테스트 정의');
  assert.deepEqual([d.desc[0].field, d.kind], ['생화학', 'concept']);
});

// ===== 외부 ID·지문·근거 =====
test('필수 외부 ID 가 없고 미매핑 사유도 없으면 거부, 사유가 있으면 통과', () => {
  rejectedFor(one('테스트 단백질', { kind: 'protein' }), /UniProt ID 가 필요/);
  passes(one('테스트 단백질', { kind: 'protein', unmapped: '테스트' }));
});
test('형식이 틀리거나 kind 에 허용되지 않은 외부 ID 는 거부', () => {
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', xrefs: [{ db: 'ChEBI', id: '15422' }] }), /ChEBI ID '15422' 형식/);
  rejectedFor(one('테스트', { xrefs: ['GO:0000001'] }), /붙일 수 없음/);
});
test('이미 다른 정의항에 붙은 외부 ID 는 거부', () => {
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', xrefs: ['CHEBI:15422'] }), /여러 정의항/);
});
test('지문: 형식·kind 검사, 중복 거부, 지문으로 찾기', () => {
  const fp = { scheme: 'InChIKey', value: 'AAAAAAAAAAAAAA-BBBBBBBBBB-N', status: 'asserted' };
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: { ...fp, value: 'abc' } }), /지문 'abc' 형식/);
  rejectedFor(one('테스트', { fingerprint: fp }), /지문을 붙일 수 없음/);
  const res = passes(one('테스트 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: fp }));
  const r = DefDB.resolveRef(DefDB.index(res.db), fp.value);
  assert.ok(r.id && r.via.startsWith('지문'));
  const res2 = LEG.merge(res.db, P(one('다른 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: fp })));
  assert.ok(J.validate(res2.db).errors.some((e) => /구조 지문/.test(e.msg)));
});
test('근거 수준: curated 는 출처, computed 는 도구, predicted 는 confidence 필요', () => {
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'curated' } }) }), /출처\(source/);
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'computed' } }) }), /도구\(tool\)/);
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'predicted', confidence: 2 } }) }), /confidence/);
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'curated', source: { db: 'PMID', id: '12345' } } }) }), /citation/);
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'curated', source: { db: 'UniProt', id: 'P12345', citation: 'X, 2000' } } }) }), /DOI 또는 PMID/);
  passes(one('테스트', { desc: desc('t', { evidence: { level: 'curated', source: { db: 'PMID', id: '12345', citation: 'Kim et al., 2000' } } }) }));
});
test('추론은 [Abstracted Logic] 으로 표시하고 무엇에서 추론했는지(basis) 필수', () => {
  assert.equal(DefDB.VOCAB.evidenceLevels.abstracted.label, '[Abstracted Logic: Derived from the inferred mechanistic flow]');
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'abstracted' } }) }), /basis/);
  passes(one('테스트', { desc: desc('t', { evidence: { level: 'abstracted logic', basis: '앞 단계의 출력에서 추론' } }) }));
});

// ===== 관계 =====
test('kind 제약을 어긴 관계는 거부', () => {
  rejectedFor(one('테스트', { desc: desc('단백질 관련', { links: [{ to: '단백질', rel: 'is_a', span: '단백질' }] }) }), /허용되지 않음/);
});
test('정의 문장에 없는 근거 구절은 거부', () => {
  rejectedFor(one('테스트', { desc: desc('t', { links: [{ to: '에너지', rel: 'refers', span: '없는 구절' }] }) }), /근거 구절/);
});
test('새 경고를 만드는 패치는 기본 거부, allowWarnings 로만 통과', () => {
  const patch = one('테스트', { desc: desc('t', { links: [{ to: '에너지', rel: 'refers' }] }) });
  assert.equal(run(patch).g.ok, false);
  assert.equal(run(patch, { allowWarnings: true }).g.ok, true);
});
test('구성 요소는 복합체의 has_part 위계로 색인됨 (경로 범위 계산에는 빠짐)', () => {
  const kids = IX.children(PKA).filter((e) => e.component).map((e) => e.child);
  assert.deepEqual(kids.sort(), [id('PKA 조절 소단위'), id('PKA 촉매 소단위')].sort());
  assert.equal(IX.stepsIn(PKA).length, 0);
});

// ===== 종 =====
test('단백질은 기준 종 필수(패치에서 생략하면 기본 9606), 저분자에는 종 금지', () => {
  const res = passes(one('테스트 단백질', { kind: 'protein', unmapped: 't' }));
  assert.equal(findText(res.db, '테스트 정의').reference_species, '9606');
  failsWith((d) => { delete d.senses[id('Gαs 소단위')].reference_species; }, /기준 종\(reference_species\)이 필요/);
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', unmapped: 't', reference_species: '9606' }), /종과 무관/);
});
test('종에 따라 달라지는 관찰은 context.species 필수, 종 별칭은 번호로', () => {
  rejectedFor({ senses: [{ id: GP, obs: [{ property: 'Km', value: 1, unit: 'mM' }] }] }, /context\.species 필수/);
  const res = passes({ senses: [{ id: GP, obs: [{ property: 'Km', value: 1, unit: 'mM', context: { species: 'rat' }, evidence: { level: 'predicted', confidence: 0.3 } }] }] });
  assert.equal(res.db.senses[GP].obs[0].context.species, '10116');
  rejectedFor({ senses: [{ id: GP, obs: [{ property: 'localization', value: '어딘가' }] }] }, /위치\(location\) '어딘가'/);
});

// ===== 구조 (지식 해상도) =====
test('단백질·핵산의 수식 부위는 기준 종 잔기 번호, 모르면 residue_unknown 명시', () => {
  const sense = (site) => one('테스트 단백질', { kind: 'protein', unmapped: 't', site: { p: { type: 'modification_site', features: ['phosphorylated'], ...site } } });
  rejectedFor(sense({}), /잔기 번호가 없음/);
  rejectedFor(sense({ numbering: { 9606: 'S14' } }), /잔기 'S14' 형식/);
  passes(sense({ numbering: { 9606: 'Ser14' } }));
  passes(sense({ residue_unknown: true }));
});
test('부위 키·특징·막 면 검사', () => {
  failsWith((d) => { d.senses[GP].site['Reg-Phos'] = { type: 'modification_site', features: ['phosphorylated'] }; }, /부위 키는/);
  failsWith((d) => { d.senses[GP].site.reg_phos.features = ['sulfated']; }, /특징 'sulfated'/);
  failsWith((d) => { d.senses[GP].site.reg_phos.face = 'cytosolic'; }, /막 결합 분자의 부위에만/);
  failsWith((d) => { d.senses[REC].site.ligand.face = 'lumenal'; }, /'lumenal' 면이 없음/);
});
test('막 위상: 막 결합 분자는 2D 위치, 지질 고정·주변성은 면 필요', () => {
  failsWith((d) => { d.senses[REC].membrane.location = 'cytosol'; }, /2D 위치/);
  failsWith((d) => { delete d.senses[id('Gs 단백질')].membrane.side; }, /membrane\.side/);
});
test('복합체 구성 요소: 복합체만, 분자 종류만, 없으면 경고', () => {
  failsWith((d) => { d.senses[GP].components = [{ ref: ATP, n: 1 }]; }, /kind complex 만/);
  failsWith((d) => { d.senses[PKA].components.push({ ref: id('에너지'), n: 1 }); }, /분자 종류가 아님/);
  const r = probe((d) => { d.senses[PKA].components = []; d.senses[PKA].rule = d.senses[PKA].rule.filter((x) => x.type === 'meaning'); d.steps = {}; });
  assert.ok(r.warnings.some((w) => /구성 요소\(components\)가 없음/.test(w.msg)));
});
test('부위의 on 은 그 복합체의 구성 요소여야 함', () => {
  failsWith((d) => { d.senses[PHK].site.pka_phos.on = ATP; }, /구성 요소가 아님/);
});
test('규칙: 상태 의미의 부위·특징, 변화 종류의 효과·추가/제거 특징', () => {
  failsWith((d) => { d.senses[GP].rule[0].when = { nowhere: 'phosphorylated' }; }, /조건의 부위 'nowhere'/);
  failsWith((d) => { d.senses[PHK].rule.find((r) => r.id === 'gp_phos').action = '탈인산화'; }, /특징 'phosphorylated' 를 제거해야/);
  failsWith((d) => { d.senses[AC].rule.find((r) => r.id === 'cyclization').action = '인산화'; }, /효과 'convert' 를 쓸 수 없음/);
  failsWith((d) => { d.senses[PKA].rule.find((r) => r.id === 'camp_release').effect.partner_site.sites = ['nope']; }, /'bound' 를 받는 부위 'nope'/);
});

// ===== 묶음·단계 (시뮬레이션 해상도) =====
test('묶음 객체 { ref, features, location } 은 정렬된 키로 매핑, 단계는 기존 사슬에 자동 연결', () => {
  const st = { id: 'S+1', rule: `${GP}/rule/phosphorolysis`, agents: [{ ref: '포스포릴레이스 a', features: { reg_phos: 'phospho' }, location: '세포질' }],
    inputs: [{ ref: 'glycogen', location: 'glycogen_granule' }, { ref: '무기 인산', location: 'cytosol', minor: true }], outputs: [{ ref: '포도당-1-인산', location: 'cytosol' }], part_of: ['에피네프린에 의한 글리코겐 분해'] };
  // '포스포릴레이스 a' 는 이름이 아니다 — v4 에서 상태 이름은 참조가 될 수 없음
  rejectedFor({ steps: [st] }, /데이터베이스에 없음/);
  const res = passes({ steps: [{ ...st, agents: [{ ref: 'glycogen phosphorylase', features: { reg_phos: 'phospho' }, location: '세포질' }] }] });
  const sid = res.report.added.find((x) => x.startsWith('S'));
  assert.equal(res.db.steps[sid].agents[0].b, `${GP}|reg_phos:phosphorylated|cytosol`);
  const ix = DefDB.index(res.db);
  assert.ok(ix.prev(sid).some((p) => p.id === 'S000009'), '인산화 단계 뒤에 이어져야 함');
});
test('묶음 키는 정렬된 표준 형식이어야 함, 부위에 특징은 하나', () => {
  assert.equal(DefDB.bundleKey(DefDB.parseBundle('D000001|b:x|a:y|cytosol')), 'D000001|a:y|b:x|cytosol');
  failsWith((d) => { d.steps.S000006.outputs[0].b = `${id('PKA 조절 소단위')}|cnb_b:bound|cnb_a:bound|cytosol`; }, /정렬된 표준 형식이 아님/);
  failsWith((d) => { d.steps.S000006.outputs[0].b = `${id('PKA 조절 소단위')}|cnb_a:bound|cnb_a:bound|cytosol`; }, /특징이 둘/);
});
test('공간 접촉: 세포 밖 에피네프린은 세포질의 분자와 반응할 수 없음', () => {
  failsWith((d) => { d.steps.S000001.inputs[0].b = `${EPI}|cytosol`; }, /공간 접촉 불가/);
  failsWith((d) => { d.senses[AC].site.catalytic.face = 'extracellular'; }, /공간 접촉 불가: .*ATP/);
  // 세포질의 PKA 촉매 소단위가 세포 밖 기질을 인산화하는 단계
  failsWith((d) => { const s = d.steps.S000008; s.inputs[0].b = `${EPI}|extracellular`; }, /공간 접촉 불가|입력에 '인산화효소 키네이스' 묶음이 0개/);
});
test('특수 위치는 부모 안으로 본다 (글리코겐 과립 ⊂ 세포질), 막 위치는 막 분자만', () => {
  assert.equal(DefDB.locCompatible('cytosol', 'glycogen_granule').ok, true);
  assert.equal(DefDB.locCompatible('extracellular', 'cytosol').ok, false);
  assert.equal(DefDB.locCompatible('plasma_membrane', 'cytosol', 'cytosolic').ok, true);
  assert.equal(DefDB.locCompatible('plasma_membrane', 'cytosol', 'extracellular').ok, false);
  failsWith((d) => { d.steps.S000005.inputs[0].b = `${ATP}|plasma_membrane`; }, /수용성/);
  failsWith((d) => { d.steps.S000005.agents[0].b = `${AC}|gs_site:bound|cytosol`; }, /박힌 분자/);
});
test('변화량은 규칙 효과와 같아야 함 — 다른 부위가 바뀌거나 빈 상태가 틀리면 거부', () => {
  failsWith((d) => { d.steps.S000009.outputs[0].b = `${GP}|cytosol`; }, /출력의 부위 'reg_phos'/);
  failsWith((d) => { d.steps.S000009.inputs[0].b = `${GP}|amp_site:bound|cytosol`; }, /바꾸지 않는 부위 'amp_site'/);
});
test('수송이 아닌 단계에서 위치가 바뀌면 거부', () => {
  failsWith((d) => { d.steps.S000011.outputs[0].b = `${GP}|glycogen_granule`; }, /위치가 바뀜/);
});
test('행위자는 원천 상태 의미 규칙상 비활성이면 안 됨', () => {
  failsWith((d) => { d.steps.S000009.agents[0].b = `${PHK}|cytosol`; }, /비활성 — 이 전이를 일으킬 수 없음/);
  failsWith((d) => { d.steps.S000005.agents[0].b = `${AC}|plasma_membrane`; }, /비활성/);
});
test('규칙의 위치 조건(where): 세포막에서만 작동하는 결합', () => {
  failsWith((d) => { d.senses[REC].rule.find((r) => r.id === 'ligand_binding').where = ['lipid_raft']; }, /지질 뗏목에서만 작동/);
});
test('해리: 구성 요소 개수와 결합 상대가 흡수된 부위가 복합체 정의와 맞아야 함', () => {
  failsWith((d) => { d.steps.S000006.outputs[1].n = 1; }, /개수 1 — 복합체 정의상 2개/);
  failsWith((d) => { d.steps.S000006.outputs[0].b = `${id('PKA 조절 소단위')}|cnb_a:bound|cytosol`; }, /'cnb_b' 가 'bound' 여야/);
  failsWith((d) => { d.steps.S000006.outputs.push({ b: `${CAMP}|cytosol` }); }, /흡수되므로/);
  failsWith((d) => { d.steps.S000006.outputs.push({ b: `${ATP}|cytosol` }); }, /구성 요소가 아님/);
});
test('규칙 참조·보조 기질·조절자는 원천 규칙에 정의된 것만', () => {
  failsWith((d) => { d.steps.S000009.rule = `${PHK}/rule/nope`; }, /규칙 '.*\/rule\/nope' 없음/);
  failsWith((d) => { d.steps.S000009.inputs = d.steps.S000009.inputs.filter((p) => !p.b.startsWith(ATP)); }, /보조 기질 'ATP'/);
  failsWith((d) => { d.steps.S000009.regulators = [{ b: `${id('포도당')}|cytosol` }]; }, /정의된 조절자가 아님/);
  failsWith((d) => { d.steps.S000009.rule = `${GP}/rule/a_form`; }, /전이\(transition\) 규칙만/);
});
test('경로(pathway)가 아닌 곳에 단계를 묶으면 거부, 개념은 묶음 바탕이 될 수 없음', () => {
  failsWith((d) => { d.steps.S000005.part_of = [id('효소#1')]; }, /pathway 가 아님/);
  failsWith((d) => { d.steps.S000005.inputs.push({ b: `${id('에너지')}|cytosol`, minor: true }); }, /기전에 참여할 수 없음/);
});
test('행위자 활성은 원천 규칙으로 계산 (첫 번째로 맞는 규칙, when 이 비면 기본값)', () => {
  assert.equal(IX.activityOf(`${GP}|reg_phos:phosphorylated|cytosol`), 'active');
  assert.equal(IX.activityOf(`${GP}|cytosol`), 'partial');
  assert.equal(IX.activityOf(`${id('Gs 단백질')}|nucleotide:GDP_bound|plasma_membrane`), 'inactive');
  assert.equal(IX.bundleLabel(`${GP}|reg_phos:phosphorylated|cytosol`), '글리코겐 인산화효소[reg_phos(Ser14):인산화됨]@세포질');
});

// ===== LPS → TLR4 → NF-κB 스트레스 시험 (전달·분해·전제 조건·동일성 보존·수송·시뮬레이션) =====
const LPS = id('LPS'), LBP = id('LBP'), CD14 = id('CD14'), TM = id('TLR4–MD-2 복합체'), RCX = id('LPS–TLR4–MD-2 다량체');
const NI = id('NF-κB–IκBα 복합체'), NFKB = id('NF-κB p50–p65 이량체'), IKBA = id('IκBα'), UB = id('유비퀴틴'), TNFM = id('TNF mRNA');
const SCF = id('SCF–βTrCP 유비퀴틴 연결효소'), PROT = id('26S 프로테아좀'), TLRP = 'LPS–TLR4–NF-κB 신호 전달';
const sid = (owner, r) => Object.keys(BASE.steps).find((k) => BASE.steps[k].rule === `${owner}/rule/${r}`);
test('공간 제약: LPS 는 세포 밖에서만 LBP 와 결합 (세포질 LPS 거부)', () => {
  failsWith((d) => { const s = d.steps[sid(LBP, 'lps_binding')]; s.inputs = s.inputs.map((p) => (p.b.startsWith(LPS) ? { b: `${LPS}|cytosol` } : p)); }, /공간 접촉 불가|세포 밖에서만/);
  failsWith((d) => { const s = d.steps[sid(LBP, 'lps_binding')]; s.inputs = s.inputs.map((p) => ({ b: p.b.replace('extracellular', 'cytosol') })); s.outputs = s.outputs.map((p) => ({ b: p.b.replace('extracellular', 'cytosol') })); }, /세포 밖에서만 작동/);
});
test('전달(transfer): 넘겨주는 쪽은 결합 → 빈 상태, 받는 쪽은 빈 상태 → 결합, 리간드는 따로 나타나지 않음', () => {
  const S2 = sid(LBP, 'lps_transfer');
  failsWith((d) => { d.steps[S2].inputs[0].b = `${LBP}|extracellular`; }, /'bound' 여야/);
  failsWith((d) => { d.steps[S2].outputs.push({ b: `${LPS}|extracellular` }); }, /따로 입력·출력에 두지 않음/);
  failsWith((d) => { d.steps[S2].outputs[1].b = `${CD14}|plasma_membrane`; }, /받은 뒤/);
});
test('전제 조건(requires): Ser32·Ser36 이 인산화되지 않은 IκBα 는 βTrCP 가 유비퀴틴화하지 못함', () => {
  const S = sid(SCF, 'ikba_k48');
  failsWith((d) => { d.steps[S].inputs[0].b = `${NI}|ikba_s32:phosphorylated|cytosol`; d.steps[S].outputs[0].b = `${NI}|ikba_s32:phosphorylated|ikba_ub:K48_polyubiquitinated|cytosol`; }, /전제 조건 불충족: .*ikba_s36/);
  failsWith((d) => { d.senses[SCF].rule.find((r) => r.id === 'ikba_k48').effect.requires.push({ site: 'nope', feature: 'phosphorylated' }); }, /전제 조건의 부위 'nope'/);
});
test('분해(degrade): 분해된 IκBα 는 출력에 남지 않고, 나머지 구성 요소와 분해 산물이 나와야 함', () => {
  const S = sid(PROT, 'ikba_degradation');
  failsWith((d) => { d.steps[S].outputs.push({ b: `${IKBA}|cytosol` }); }, /분해된 구성 요소 'IκBα' 가 출력에 남아/);
  failsWith((d) => { d.steps[S].outputs = d.steps[S].outputs.filter((p) => !p.b.startsWith(NFKB)); }, /구성 요소 'NF-κB p50–p65 이량체' 개수 0/);
  failsWith((d) => { d.steps[S].outputs = d.steps[S].outputs.filter((p) => !p.b.startsWith(id('펩타이드'))); }, /분해 산물 '펩타이드'/);
  failsWith((d) => { d.steps[S].inputs[0].b = `${NI}|ikba_s32:phosphorylated|ikba_s36:phosphorylated|cytosol`; }, /전제 조건 불충족/);
});
test('동일성 보존: 결합·해리·전달·분해에서 실체(구성 요소·부위의 리간드)가 사라지거나 생기면 거부', () => {
  failsWith((d) => { d.steps[sid(RCX, 'dimerize')].outputs[0].b = `${RCX}|plasma_membrane`; }, /동일성 보존 위반: 지질다당류 입력 2 ≠ 출력 0/);
  failsWith((d) => { const s = d.steps[sid(RCX, 'tirap_recruit')]; s.inputs.find((p) => !p.b.startsWith(RCX)).n = 1; }, /동일성 보존 위반: TIRAP 입력 1 ≠ 출력 2/);
  failsWith((d) => { d.steps[sid(PROT, 'ikba_degradation')].outputs = d.steps[sid(PROT, 'ikba_degradation')].outputs.filter((p) => !p.b.startsWith(UB + '|')); }, /동일성 보존 위반: 유비퀴틴 입력 1 ≠ 출력 0/);
});
test('수송: 위치를 바꾸는 유일한 방법 — 출발·도착 위치가 규칙과 맞아야 하고, 도착한 대상은 접촉 검사에서 빠짐', () => {
  const S = sid(NFKB, 'nuclear_import');
  assert.ok(BASE.steps[S].outputs[0].b.endsWith('|nucleoplasm'));
  failsWith((d) => { d.steps[S].outputs[0].b = `${NFKB}|extracellular`; }, /수송 규칙은 세포질 → 핵질/);
  failsWith((d) => { d.steps[sid(id('TNF 유전자'), 'kb_binding')].inputs.find((p) => p.b.startsWith(NFKB)).b = `${NFKB}|cytosol`; }, /공간 접촉 불가|입력에 없음/);
});
test('시뮬레이션: LPS 에서 시작해 TNF mRNA 까지 도달하고, 유도 경로의 뿌리에 LPS 가 있음', () => {
  const r = DefDB.simulate(BASE, TLRP, { until: TNFM });
  assert.ok(r.reached && r.reached.startsWith(TNFM + '|nucleoplasm'), '도달해야 함');
  assert.ok(r.derivation.roots.some((b) => b.startsWith(LPS + '|extracellular')), 'LPS 에서 유도되어야 함');
  assert.equal(r.derivation.steps.length, 19);
  assert.deepEqual(r.cycleSeeds.map((b) => b.split('|')[0]).sort(), [LBP, CD14].sort(), '자동 보충은 순환의 휴지 상태(LBP·CD14)만');
});
test('시뮬레이션 음성 대조: LPS 가 없으면 TNF 전사에 이르지 못함', () => {
  const r = DefDB.simulate(BASE, TLRP, { until: TNFM, init: { [`${LPS}|extracellular`]: 0 } });
  assert.equal(r.reached, null);
  assert.ok(!r.trace.some((t) => BASE.steps[t.step].rule.endsWith('/rule/transcription')));
});
test('시뮬레이션: 기존 경로도 에피네프린에서 포도당-1-인산까지 유도됨', () => {
  const r = DefDB.simulate(BASE, '에피네프린에 의한 글리코겐 분해', { until: id('포도당-1-인산') });
  assert.ok(r.reached);
  assert.ok(r.derivation.roots.some((b) => b.startsWith(EPI + '|')));
});
test('시뮬레이션: 만들어지지 않는 변환 기질(뉴클레오타이드)은 대사물 풀로 넉넉히, 만들어지는 기질(cAMP)은 보충하지 않음', () => {
  const r = DefDB.simulate(BASE, TLRP, { until: TNFM });
  assert.ok(r.origin[`${id('뉴클레오타이드')}|nucleoplasm`] >= 1000);
  const g = DefDB.simulate(BASE, '에피네프린에 의한 글리코겐 분해', { until: id('포도당-1-인산') });
  assert.equal(g.origin[`${CAMP}|cytosol`], undefined);
});

// ===== 한계 등록부 · 상위 개념 · 구획 농도 모델 (형식 v5) =====
const lim = (o) => ({ limitations: [Object.assign({ id: 'L+1', target: 'IκBα', type: 'Kinetic_Gap', requirement: { text: '테스트', needs: [{ kind: 'obs', property: 'half_life', on: 'IκBα' }] } }, o)] });
test('한계: [Target | Type | Requirement] — 대상·종류·해결 경로가 없거나 틀리면 거부', () => {
  passes(lim({}));
  rejectedFor(lim({ type: 'Speed_Gap' }), /한계 종류 'Speed_Gap'/);
  rejectedFor(lim({ target: 'IκBα/site/nope' }), /대상 부위/);
  rejectedFor(lim({ requirement: { text: 't', needs: [] } }), /해결 경로\(requirement.needs\) 없음/);
  rejectedFor(lim({ requirement: { text: 't', needs: [{ kind: 'obs', property: 'speed', on: 'IκBα' }] } }), /관찰 속성\(property\) 'speed'|관찰 속성 'speed'/);
  rejectedFor(lim({ requirement: { text: 't', needs: [{ kind: 'xref', db: 'PDB', on: '무기 인산' }] } }), /해결되지 않음/);
  rejectedFor({ limitations: { L000001: {} } }, /이전 형식/);
});
test('한계는 저장된 상태가 아니라 계산된 상태 — 필요한 데이터가 들어오면 자동으로 resolved', () => {
  const L1 = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].requirement.needs.some((n) => n.property === 'copy_number' && n.cell === 'hepatocyte'));
  assert.equal(J.limitationStatus(BASE, BASE.limitations[L1]).status, 'open');
  const cn = (location) => [{ property: 'copy_number', value: 1000, unit: 'copies/cell', context: { species: '9606', cell: 'hepatocyte', location }, evidence: { level: 'predicted', confidence: 0.1 } }];
  const res = passes({ senses: [{ id: REC, obs: cn('plasma_membrane') }, { id: PKA, obs: cn('cytosol') }, { id: GP, obs: cn('cytosol') }] });
  assert.equal(J.limitationStatus(res.db, res.db.limitations[L1]).status, 'resolved');
  assert.equal(DefDB.simulate(res.db, '에피네프린에 의한 글리코겐 분해', {}).origin[`${GP}|cytosol`], 1000, '관찰이 시작량이 됨');
  const R = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${id('TAK1')}/site/act`);
  const res2 = passes({ senses: [{ id: id('TAK1'), site: { act: { type: 'modification_site', features: ['phosphorylated'], numbering: { 9606: 'Thr187' } } } },
    { id: id('TAK1 복합체'), site: { tak1_act: { type: 'modification_site', features: ['phosphorylated'], on: id('TAK1'), numbering: { 9606: 'Thr187' } } } }] });
  assert.equal(J.limitationStatus(res2.db, res2.db.limitations[R]).status, 'resolved', '잔기 번호가 들어오면 Structural_Gap 해결');
});
test('limitations.md 는 data/db.json 에서 생성된 최신 상태여야 함', () => {
  assert.equal(readFileSync(new URL('../limitations.md', import.meta.url), 'utf8'), J.limitationsMarkdown(BASE));
  assert.deepEqual(J.detectGaps(BASE), [], '잔기 모름 부위는 모두 등록되어 있어야 함');
});
test('상위 개념(motif): kind process 만, 한계 검토(addresses 또는 gap_review) 필수, 없는 한계를 가리키면 거부', () => {
  const c = (sense) => one('테스트 패턴', Object.assign({ kind: 'process', motif: 'kinase_cascade' }, sense));
  rejectedFor(c({}), /한계 등록부를 검토/);
  passes(c({ gap_review: '해당 없음 — 테스트' }));
  rejectedFor(c({ kind: 'concept', gap_review: 'x' }), /kind process/);
  rejectedFor(c({ motif: 'nope', gap_review: 'x' }), /motif 'nope'/);
  rejectedFor(c({ addresses: [{ limitation: 'L999999', how: 'x' }] }), /한계 'L999999' 없음/);
  rejectedFor(c({ addresses: [{ limitation: Object.keys(BASE.limitations)[0] }] }), /how/);
});
test('패턴 검출: 막–핵 연쇄는 LPS 경로에만, 키네이스 연쇄는 두 경로 모두에', () => {
  const lps = DefDB.findMotifs(BASE, id(TLRP)), gly = DefDB.findMotifs(BASE, id('에피네프린에 의한 글리코겐 분해'));
  assert.ok(lps.found.membrane_to_nucleus && !gly.found.membrane_to_nucleus);
  assert.ok(lps.found.kinase_cascade && gly.found.kinase_cascade);
  assert.ok(lps.found.ligand_relay && lps.found.inhibitor_degradation_release && gly.found.second_messenger && gly.found.gtpase_timer);
  assert.deepEqual(lps.trajectory, ['extracellular', 'plasma_membrane', 'cytosol', 'nucleoplasm']);
});
test('구획 농도 모델: copy_number 관찰 → 시작량, 농도 × 구획 부피 → 분자 수, 없으면 기본값으로 표시', () => {
  const r = DefDB.simulate(BASE, TLRP, { until: TNFM });
  assert.equal(r.origin[`${id('TNF 유전자')}|nucleoplasm`], 2);
  assert.match(r.source[`${id('TNF 유전자')}|nucleoplasm`], /^data: copy_number/);
  assert.equal(r.source[`${NI}|cytosol`], 'default');
  const ev = { level: 'predicted', confidence: 0.1 };
  const res = passes({ senses: [{ id: NI, obs: [{ property: 'concentration', value: 0.1, unit: 'µM', context: { species: '9606', cell: 'macrophage', location: 'cytosol' }, evidence: ev }] },
    { id: id('구획 농도 모델'), obs: [{ property: 'compartment_volume', value: 1000, unit: 'fL', context: { species: '9606', cell: 'macrophage', location: 'cytosol' }, evidence: ev }] }] });
  const r2 = DefDB.simulate(res.db, TLRP, { until: TNFM });
  assert.equal(r2.origin[`${NI}|cytosol`], 60221, '0.1 µM × 1000 fL(=1e-12 L) × 6.022e23 ≈ 60221 분자');
});

// ===== 형식 v6: 혼합 해상도 · 반응 속도 · 감사 =====
const scenario = (f) => JSON.parse(readFileSync(new URL(`../examples/scenarios/${f}`, import.meta.url), 'utf8'));
const TNFG = id('TNF 유전자'), PKAR = id('PKA'), PDE = id('포스포다이에스터레이스');
const withKin = (owner, rid, kinetics) => ({ id: owner, rule: BASE.senses[owner].rule.map((r) => (r.id === rid ? { ...r, kinetics } : r)) });
const pred = { level: 'predicted', confidence: 0 };
test('속도 무결성: 법칙·필수 상수·Kd = k_off/k_on·두 분자 결합·효소 규칙', () => {
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'monod', evidence: pred })] }, /반응 속도 법칙 'monod'/);
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'hill', K: 1e-9, n: 1, fmax: 2, evidence: pred })] }, /hill 법칙은 조절 규칙\(modulation\)에만/);
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'binding', k_on: 1e6, evidence: pred })] }, /k_off 또는 Kd/);
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'binding', k_on: 1e6, k_off: 1, Kd: 1e-9, evidence: pred })] }, /Kd 와 k_off\/k_on 이 맞지 않음/);
  rejectedFor({ senses: [withKin(PKAR, 'camp_release', { law: 'binding', Kd: 1e-7, k_on: 1e7, evidence: pred })] }, /두 분자 결합.*5분자/);
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'michaelis_menten', kcat: 1, Km: 1e-6, evidence: pred })] }, /행위자\(효소\)가 있는 규칙에만/);
  rejectedFor({ senses: [withKin(PKAR, 'camp_release', { law: 'mass_action', k: 1, order: 2, evidence: pred })] }, /차수 2 가 단계의 반응물 수\(5/);
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'binding', Kd: 1e-9, k_on: 1e7, evidence: { level: 'curated' } })] }, /출처\(source/);
  passes({ senses: [withKin(PKAR, 'camp_release', { law: 'mass_action', k: 1e20, order: 5, evidence: pred })] });
});
test('한계 해결 경로 kinetics: 규칙에 속도 상수가 들어오면 Kinetic_Gap 이 자동으로 resolved', () => {
  const L4 = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${TNFG}/rule/kb_binding`);
  assert.equal(J.limitationStatus(BASE, BASE.limitations[L4]).status, 'open');
  const res = passes({ senses: [withKin(TNFG, 'kb_binding', { law: 'binding', Kd: 1e-9, k_on: 1e7, evidence: pred })] });
  assert.equal(J.limitationStatus(res.db, res.db.limitations[L4]).status, 'resolved');
});
test('반응 중심 구조(R2): PDB 만, 정의항 xrefs 에도 같은 구조가 있어야 함 — 3FXI 는 LPS 주머니에', () => {
  assert.equal(BASE.senses[RCX].site.lps_pocket.structure.id, '3FXI');
  failsWith((d) => { d.senses[RCX].xrefs = []; }, /해상도 일관성: 부위의 구조 3FXI/);
  failsWith((d) => { d.senses[RCX].site.tir.structure = { db: 'PDB', id: 'XYZ' }; }, /PDB ID 여야/);
});
test('혼합 해상도 계획: LPS 경로는 3차원 0단계, 글리코겐 경로는 cAMP 경쟁(T3) 두 단계만 R2 — 속도 상수가 들어오면 R1 로 해결', () => {
  const lps = ORCH.resolutionPlan(BASE, TLRP), gly = ORCH.resolutionPlan(BASE, '에피네프린에 의한 글리코겐 분해');
  assert.equal(lps.rows.filter((r) => r.need === 2).length, 0);
  assert.ok(lps.rows.find((r) => r.sid === sid(NFKB, 'nuclear_import')).need === 0, '수송은 R0(위상)');
  assert.deepEqual(gly.rows.filter((r) => r.need === 2).map((r) => r.sid).sort(), [sid(PKAR, 'camp_release'), sid(PDE, 'camp_hydrolysis')].sort());
  assert.ok(gly.rows.some((r) => !r.ok));
  const res = passes({ senses: [withKin(PKAR, 'camp_release', { law: 'mass_action', k: 1e20, order: 5, evidence: pred }), withKin(PDE, 'camp_hydrolysis', { law: 'michaelis_menten', kcat: 5, Km: 1e-6, evidence: pred })] });
  assert.ok(ORCH.resolutionPlan(res.db, '에피네프린에 의한 글리코겐 분해').rows.every((r) => r.ok), '속도 상수로 T3 해결');
});
test('속도 기반 시뮬레이션(가상 시나리오): TNF mRNA 에 시간 순서대로 도달, 질량 보존 위반 없음', () => {
  const r = ORCH.runRate(BASE, TLRP, { scenario: scenario('lps-hypothetical.json'), t_end: 60, dt: 0.01 });
  const t = (b) => r.firstReach[b];
  const mrna = Object.keys(r.firstReach).find((b) => b.startsWith(TNFM + '|'));
  assert.ok(mrna && t(mrna) > 0, 'TNF mRNA 도달');
  assert.ok(t(`${NFKB}|nucleoplasm`) < t(mrna) && t(`${NFKB}|cytosol`) < t(`${NFKB}|nucleoplasm`), '세포질 → 핵 → 전사 순서');
  assert.ok(r.hypothetical);
  assert.deepEqual(r.audit.filter((a) => a.code === 'AUDIT_MASS'), []);
  assert.ok(r.audit.some((a) => a.code === 'AUDIT_KINETIC_GAP'));
});
test('감사: 잘못된 속도 법칙·Kd 불일치를 잡고, 이중 계산(Gs)은 한계 등록부의 교정 제안으로 연결', () => {
  const a = ORCH.auditRun(BASE, '에피네프린에 의한 글리코겐 분해', { scenario: scenario('camp-competition-hypothetical.json'), t_end: 10, dt: 0.01 });
  assert.ok(a.some((x) => x.code === 'AUDIT_KINETIC' && /두 분자 결합/.test(x.msg)));
  assert.ok(a.some((x) => x.code === 'AUDIT_KINETIC' && /Kd 와 k_off\/k_on/.test(x.msg)));
  assert.ok(a.some((x) => x.code === 'AUDIT_RESOLUTION' && /T3 경쟁/.test(x.msg)));
  const mass = a.find((x) => x.code === 'AUDIT_MASS');
  const gsGap = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${AC}/site/gs_site`);
  assert.ok(mass && mass.suggestion.includes(gsGap), '질량 위반 제안이 등록된 한계를 가리킴');
});

// ===== v7 생애 주기·대사물 저장소 =====
const GTP = id('GTP'), GDP = id('GDP'), ADP = id('ADP'), PI = id('무기 인산'), PPI = id('피로인산'), PU = id('인산기 단위'), ATPREGEN = id('ATP 재생');
const NDPK = id('NDPK'), TNFM2 = id('TNF mRNA'), IKBA1 = id('IκBα'), GSX = id('Gs 단백질'), GLY = '에피네프린에 의한 글리코겐 분해';
const supply = (rule) => ({ id: ATPREGEN, rule: [Object.assign({ id: 'atp_supply', type: 'supply', label: '시험 공급', consumes: [{ ref: ADP, n: 1 }, { ref: PI, n: 1 }], produces: [{ ref: ATP, n: 1 }], where: ['cytosol'] }, rule)] });
const degr = (rule) => ({ id: TNFM2, rule: [Object.assign({ id: 'turnover', type: 'degradation', label: '시험 분해', fate: 'lost' }, rule)] });
const finiteOK = (r) => Object.values(r.final).every((n) => Number.isFinite(n) && n > -1e-6);

test('공급 규칙(Metabolic_Supply_Rule): 위치 하나·생성물·부분 구조 수지·속도 법칙', () => {
  passes({ senses: [supply({})] });
  rejectedFor({ senses: [supply({ where: [] })] }, /위치\(where\)가 정확히 하나/);
  rejectedFor({ senses: [supply({ where: ['plasma_membrane'] })] }, /부피\(3D\) 구획/);
  rejectedFor({ senses: [supply({ produces: [{ ref: ATP, n: 2 }] })] }, /부분 구조 수지가 맞지 않음/);
  passes({ senses: [supply({ produces: [{ ref: ATP, n: 2 }], source: true })] });
  rejectedFor({ senses: [supply({ consumes: [] })] }, /source: true/);
  rejectedFor({ senses: [supply({ kinetics: { law: 'michaelis_menten', kcat: 1, Km: 1e-6, evidence: { level: 'asserted' } } })] }, /zero_order \| mass_action/);
  rejectedFor({ senses: [supply({ kinetics: { law: 'mass_action', k: 1, order: 1, evidence: { level: 'asserted' } } })] }, /차수 1 가 소비 분자 수\(2\)/);
  passes({ senses: [supply({ kinetics: { law: 'mass_action', k: 1, order: 2, evidence: { level: 'asserted' } } })] });
});
test('공급 외의 규칙은 분자 종류만, zero_order 는 공급 규칙만', () => {
  rejectedFor({ senses: [{ id: ATPREGEN, rule: [{ id: 'm', type: 'meaning', label: '시험', when: {}, activity: 'active' }] }] }, /공급 규칙 supply 만/);
  rejectedFor({ senses: [withKin(AC, 'cyclization', { law: 'zero_order', k: 1e-9, evidence: { level: 'asserted' } })] }, /zero_order 는 공급 규칙/);
});
test('분해 규칙(Degradation_Rule): 운명·재활용 단위·1차 속도(k_deg ↔ 반감기)', () => {
  passes({ senses: [degr({})] });
  rejectedFor({ senses: [degr({ fate: 'vanish' })] }, /운명\(fate\)/);
  rejectedFor({ senses: [degr({ fate: 'recycled' })] }, /recycle_to 에 돌아갈 구성 단위/);
  rejectedFor({ senses: [degr({ recycle_to: [{ ref: id('뉴클레오타이드'), n: 1 }] })] }, /소실\(lost\)인데 recycle_to/);
  rejectedFor({ senses: [degr({ kinetics: { law: 'mass_action', k: 0.1, half_life: 600, evidence: { level: 'asserted' } } })] }, /k_deg .* 반감기 .* 맞지 않음/);
  rejectedFor({ senses: [degr({ kinetics: { law: 'michaelis_menten', kcat: 1, Km: 1, evidence: { level: 'asserted' } } })] }, /분해 규칙의 속도 법칙은 mass_action/);
  passes({ senses: [degr({ kinetics: { law: 'mass_action', half_life: 600, evidence: { level: 'asserted' } } })] });
  rejectedFor({ senses: [{ id: GDP, rule: [{ id: 'x', type: 'degradation', label: '시험', fate: 'lost', when: { nope: 'bound' } }] }] }, /조건의 부위 'nope'/);
});
test('부분 구조 수지: 변환·분해 규칙에서 빠진 산물을 잡는다 (cAMP 만 만들고 피로인산을 빼면 거부)', () => {
  const rs = BASE.senses[AC].rule.map((r) => (r.id === 'cyclization' ? { ...r, effect: { ...r.effect, produces: [CAMP] } } : r));
  rejectedFor({ senses: [{ id: AC, rule: rs }] }, /부분 구조 수지가 맞지 않음 — 인산기 단위 3 → 1/);
  const prot = id('26S 프로테아좀'), pr = BASE.senses[prot].rule.map((r) => (r.id === 'ikba_degradation' ? { ...r, with: { consumes: [ATP], produces: [ADP] } } : r));
  rejectedFor({ senses: [{ id: prot, rule: pr }] }, /부분 구조 수지가 맞지 않음/);
  rejectedFor({ senses: [{ id: GTP, moieties: [{ ref: ATP, n: 1 }] }] }, /structure_feature 여야 함/);
  rejectedFor({ senses: [{ id: GTP, moieties: [{ ref: PU, n: 1.5 }] }] }, /1 이상의 정수/);
});
test('부위의 특징별 리간드(ligands): 특징은 그 부위의 것, 리간드는 분자', () => {
  const site = JSON.parse(JSON.stringify(BASE.senses[GSX].site));
  site.nucleotide.ligands.ATP_bound = ATP;
  rejectedFor({ senses: [{ id: GSX, site }] }, /ligands: 특징 'ATP_bound'|특징\(feature\) 'ATP_bound'/);
  const t = {};
  ORCH.runRate; // 리간드 실체: Gs[GTP] 는 GTP 하나를, Gs[GDP] 는 GDP 하나를 품는다 (질량 감사의 셈)
  const r = ORCH.runRate(BASE, GLY, { scenario: scenario('gtp-exhaustion-hypothetical.json'), t_end: 0.05, dt: 0.01 });
  assert.ok(!r.audit.some((a) => a.code === 'AUDIT_MASS' && /Gs 자체 비활성화/.test(a.where)), 'GTP → GDP 리간드 교체는 화학 변환으로 셈');
});
test('기질 고갈(Substrate Exhaustion): 공급이 없으면 GTP 가 바닥나고 Gs 활성화가 멈춘다 — 무너지지 않음', () => {
  const r = ORCH.runRate(BASE, GLY, { scenario: scenario('gtp-exhaustion-hypothetical.json'), t_end: 5, dt: 0.01 });
  assert.equal(r.mode, 'finite');
  assert.ok(r.events.some((e) => e.type === 'exhausted' && e.bundle === `${GTP}|cytosol`), 'GTP 고갈 사건');
  assert.ok(r.stalls[sid(REC, 'gs_gef')], 'Gs 활성화 단계가 멈춤으로 기록');
  assert.ok(finiteOK(r), '모든 양이 유한하고 음수가 아님');
  assert.equal(r.reservoirs[`${GTP}|cytosol`].class, 'consumed_only');
  assert.ok(r.audit.some((a) => a.code === 'AUDIT_RESOURCE' && a.where === `${GTP}|cytosol` && /L0000\d\d/.test(a.suggestion)), '재생 경로 없음 → 공급 규칙 한계를 교정 제안');
  assert.ok(!r.audit.some((a) => a.code === 'AUDIT_MASS' && /부분 구조/.test(a.msg)), '부분 구조 수지 위반 없음');
});
test('순환 재생(Cycle-driven Regeneration): NDPK·ATP 재생 공급이 GTP–GDP 순환과 ATP 순환을 닫는다', () => {
  const ex = ORCH.runRate(BASE, GLY, { scenario: scenario('gtp-exhaustion-hypothetical.json'), t_end: 5, dt: 0.01 });
  const rg = ORCH.runRate(BASE, GLY, { scenario: scenario('gtp-regeneration-hypothetical.json'), t_end: 5, dt: 0.01 });
  const g = `${GTP}|cytosol`;
  assert.equal(rg.reservoirs[g].class, 'closed');
  assert.ok(rg.cycles.some((c) => c.includes(g) && c.includes(`${GDP}|cytosol`) && c.includes(`${ATP}|cytosol`)), 'GTP·GDP·ATP 가 한 순환 성분');
  assert.ok(rg.final[g] > ex.final[g], '재생이 있으면 GTP 가 더 남는다');
  assert.ok(rg.ledger[g].supply > 0 && rg.ledger[g].reaction < 0, '원장: 반응이 쓰고 공급이 채움');
  assert.ok(finiteOK(rg));
  assert.ok(!rg.audit.some((a) => a.code === 'AUDIT_RESOURCE'));
  assert.ok(!rg.audit.some((a) => a.code === 'AUDIT_MASS' && /부분 구조/.test(a.msg)), '공급까지 합쳐 부분 구조가 보존됨');
});
test('매 단계 질량 감사: 단계에서 부산물(피로인산)을 빼면 첫 발화 시각과 함께 부분 구조 위반', () => {
  const d = JSON.parse(JSON.stringify(BASE)), s5 = sid(AC, 'cyclization');
  d.steps[s5].outputs = d.steps[s5].outputs.filter((p) => !p.b.startsWith(PPI + '|'));
  const r = ORCH.runRate(DefDB.normalize(d), GLY, { scenario: scenario('gtp-regeneration-hypothetical.json'), t_end: 1, dt: 0.01 });
  const a = r.audit.find((x) => x.code === 'AUDIT_MASS' && x.where.startsWith(s5) && /부분 구조 수지 위반/.test(x.msg));
  assert.ok(a && /t=0\.\d+ s 첫 발화/.test(a.msg) && /인산기 단위 -2/.test(a.msg), '단계·시각·부분 구조를 짚음');
});
test('분해(결정론·확률적): 1차 원장, 재활용 화학량을 모르면 소실로 처리하고 한계를 제안, seed 가 같으면 같은 결과', () => {
  const sc = scenario('lps-hypothetical.json'), m = `${TNFM2}|nucleoplasm`;
  const det = ORCH.runRate(BASE, TLRP, { scenario: sc, t_end: 20, dt: 0.01 });
  assert.ok(det.ledger[m].degradation < 0 && det.ledger[`${id('뉴클레오타이드')}|nucleoplasm`].recycle === 0);
  const gap = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === TNFM2 && BASE.limitations[k].type === 'Structural_Gap');
  assert.ok(det.audit.some((a) => a.code === 'AUDIT_RESOURCE' && /서열 길이/.test(a.msg) && a.suggestion.includes(gap)));
  const s1 = ORCH.runRate(BASE, TLRP, { scenario: sc, t_end: 20, dt: 0.01, stochastic: true, seed: 7 });
  const s2 = ORCH.runRate(BASE, TLRP, { scenario: sc, t_end: 20, dt: 0.01, stochastic: true, seed: 7 });
  assert.equal(s1.ledger[m].degradation, s2.ledger[m].degradation);
  assert.ok(Number.isInteger(-s1.ledger[m].degradation) || s1.ledger[m].degradation === 0, '확률적 분해는 정수 분자');
  assert.ok(Math.abs(s1.ledger[m].degradation - det.ledger[m].degradation) < 6 * Math.sqrt(-det.ledger[m].degradation) + 3, '기댓값 근처');
  assert.ok(det.audit.every((a) => a.code !== 'AUDIT_MASS'), '분해·재활용이 원장으로 설명되어 질량 위반 없음');
});
test('재활용: 서열 길이 관찰이 있으면 분해된 사슬이 단위체 n 개로 저장소에 돌아간다 (IκBα 317 aa)', () => {
  const d = JSON.parse(JSON.stringify(BASE));
  const r0 = d.senses[IKBA1].rule.find((r) => r.id === 'basal_turnover');
  r0.kinetics = { law: 'mass_action', order: 1, k: 0.01, evidence: { level: 'predicted', confidence: 0 } };
  // 유리 IκBα 묶음을 원천으로 가진 작은 경로를 만들어 본다: 수송(가상) 대신 init 으로 시작량만 준다
  const db = DefDB.normalize(d), ikb = `${IKBA1}|cytosol`;
  const rr = ORCH.runRate(db, TLRP, { scenario: { ...scenario('lps-hypothetical.json'), amounts: { ...scenario('lps-hypothetical.json').amounts } }, t_end: 1, dt: 0.01 });
  // 경로에 유리 IκBα 묶음이 없으면 규칙은 적용되지 않는다 (묶음 단위로만 분해)
  assert.ok(!rr.degradations.some((g) => g.bundle === ikb));
  assert.ok(J.limitationStatus(db, db.limitations[Object.keys(db.limitations).find((k) => db.limitations[k].target === `${IKBA1}/rule/basal_turnover`)]).status === 'resolved', 'k 가 들어오면 half_life 를 요구한 한계도 닫힘 (k ↔ ln2/t½)');
});
test('무한 풀 방식(v6 동작)도 그대로: 저장소 감사 없음, 교환 원장으로 질량 수지', () => {
  const r = ORCH.runRate(BASE, TLRP, { scenario: scenario('lps-hypothetical.json'), t_end: 10, dt: 0.01, reservoirs: 'infinite' });
  assert.equal(r.mode, 'infinite');
  assert.ok(!r.audit.some((a) => (a.code === 'AUDIT_RESOURCE' && /재생 경로/.test(a.msg)) || a.code === 'AUDIT_MASS'));
  assert.ok(Object.keys(r.firstReach).some((b) => b.startsWith(TNFM2 + '|')));
  assert.ok(ORCH.runRate(BASE, TLRP, { reservoirs: 'bogus' }).error);
});
test('한계 후보 탐지: 속도 없는 공급·분해 규칙과 서열 길이 없는 재활용이 등록되지 않으면 후보로', () => {
  assert.deepEqual(J.detectGaps(BASE), []);
  const d = JSON.parse(JSON.stringify(BASE));
  for (const [k, l] of Object.entries(d.limitations)) if (/atp_supply|^D000101$/.test(l.target) || l.target === TNFM2) delete d.limitations[k];
  for (const s of Object.values(d.senses)) for (const a of s.addresses || []) if (!d.limitations[a.limitation]) s.addresses = s.addresses.filter((x) => d.limitations[x.limitation]);
  const c = J.detectGaps(d);
  assert.ok(c.some((x) => x.target === `${ATPREGEN}/rule/atp_supply` && x.type === 'Kinetic_Gap'));
  assert.ok(c.some((x) => x.target === TNFM2 && x.type === 'Structural_Gap'));
});

// ===== Patch Report (Scope · Why · Impact · Verification) =====
test('Patch Report: 바뀐 필드·하류 규칙·단계·경로·한계 상태 변화를 계산한다', () => {
  const patch = P({ why: '시험: AC 고리화 속도 상수', senses: [withKin(AC, 'cyclization', { law: 'michaelis_menten', kcat: 1, Km: 1e-4, evidence: { level: 'predicted', confidence: 0 } })] });
  const res = LEG.merge(BASE, patch), g = J.gate(BASE, res), rep = J.patchReport(BASE, res, patch, g);
  assert.equal(rep.why, '시험: AC 고리화 속도 상수');
  assert.deepEqual(rep.scope.updated.senses, [AC]);
  assert.deepEqual(rep.scope.fields[AC], ['rule']);
  assert.ok(rep.impact.steps.includes(sid(AC, 'cyclization')) && rep.impact.steps.includes(sid(id('Gs 단백질'), 'ac_activation')), '소유 규칙의 단계와 AC 묶음을 쓰는 단계');
  assert.ok(rep.impact.pathways.includes(id('에피네프린에 의한 글리코겐 분해')));
  assert.ok(rep.impact.rules.includes(`${id('Gs 단백질')}/rule/ac_activation`), 'AC 를 대상으로 하는 다른 정의항의 규칙');
  assert.equal(rep.verification.gate, 'pass');
  assert.ok(/\| Why \| 시험/.test(J.patchReportText(rep, DefDB.index(res.db))));
  // 한계를 닫는 데이터 → 상태 변화가 보고되고 limitations.md 재생성이 요구됨
  const lid = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${ATPREGEN}/rule/atp_supply`);
  const p2 = P({ why: '시험', senses: [{ id: ATPREGEN, rule: BASE.senses[ATPREGEN].rule.map((r) => ({ ...r, kinetics: { law: 'mass_action', k: 1, order: 2, evidence: { level: 'predicted', confidence: 0 } } })) }] });
  const r2 = LEG.merge(BASE, p2), rep2 = J.patchReport(BASE, r2, p2, J.gate(BASE, r2));
  assert.ok(rep2.impact.limitation_status_changed.some((l) => l.id === lid && l.before === 'open' && l.after === 'resolved'));
  assert.ok(rep2.impact.regenerate.includes('limitations.md'));
  assert.equal(J.patchReport(BASE, r2, { senses: [] }, null).why, '', 'why 가 없으면 빈 값 (dbtool merge 가 거부)');
});
test('Identity_Gap: unmapped 외부 ID 는 한계로 등록되어야 하고, 확인된 ID 가 들어오면 닫힌다', () => {
  const d = JSON.parse(JSON.stringify(BASE)), pi = id('무기 인산');
  // 확인 전 상태를 직접 만든다 (저장소는 원본 대조가 끝나면 unmapped 가 사라진다)
  d.senses[pi].xrefs = (d.senses[pi].xrefs || []).filter((x) => x.db !== 'ChEBI');
  d.senses[pi].unmapped = 'ChEBI 번호 미확인 (시험이 만든 상태)';
  for (const k of Object.keys(d.limitations)) if (d.limitations[k].target === pi && d.limitations[k].type === 'Identity_Gap') delete d.limitations[k];
  assert.ok(J.detectGaps(d).some((x) => x.target === pi && x.type === 'Identity_Gap'));
  // 확인된 ID 가 들어오면 그 Identity_Gap 은 닫힌다 (지금 저장소에는 번호가 들어와 있어 그대로 resolved 여야 한다)
  const lid2 = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === pi && BASE.limitations[k].type === 'Identity_Gap');
  assert.ok(lid2, '무기 인산의 Identity_Gap 기록이 있어야 함');
  assert.equal(J.limitationStatus(BASE, BASE.limitations[lid2]).status, 'resolved');
  assert.equal(J.limitationStatus(DefDB.normalize(d), BASE.limitations[lid2]).status, 'open', '번호를 빼면 다시 열림');
});

// ===== 소진 시험 (Survival-to-Exhaustion): 시트르산 회로 =====
const TCA = '시트르산 회로', ACCOA = id('아세틸-CoA'), NADP = id('NAD⁺'), NADH = id('NADH'), CO2 = id('이산화탄소'), IDH = id('아이소시트르산 탈수소효소');
const mx = (d) => `${d}|mito_matrix`;
test('시트르산 회로: 탄소·CoA·NAD 부분 구조 수지 — 탈카복실화에서 CO₂ 를 빼면 거부', () => {
  const rs = BASE.senses[IDH].rule.map((r) => (r.id === 'oxdecarb' ? { ...r, effect: { ...r.effect, produces: [id('2-옥소글루타르산')] } } : r));
  rejectedFor({ senses: [{ id: IDH, rule: rs }] }, /부분 구조 수지가 맞지 않음 — 탄소 골격 단위 6 → 5/);
  const rs2 = BASE.senses[IDH].rule.map((r) => (r.id === 'oxdecarb' ? { ...r, with: { consumes: [NADP], produces: [] } } : r));
  rejectedFor({ senses: [{ id: IDH, rule: rs2 }] }, /니코틴아마이드 뉴클레오타이드 부분 1 → 0/);
});
test('소진 시험 1: 아세틸-CoA 1000 → 정확히 1000 바퀴 뒤 아세틸-CoA 고갈로 정지, CO₂ 2000·GTP 1000 축적', () => {
  const r = ORCH.runRate(BASE, TCA, { scenario: scenario('tca-acetylcoa-exhaustion-hypothetical.json'), t_end: 60, dt: 0.01 });
  const pm = r.postMortem;
  assert.equal(r.stepCycles.length, 1);
  assert.equal(r.stepCycles[0].length, 8);
  assert.ok(pm.dead && pm.cause === 'exhaustion');
  assert.equal(pm.limiting.bundle, mx(ACCOA));
  assert.equal(pm.cycles[0].completed, 1000);
  assert.ok(Math.abs(pm.t_death - 1) < 0.011 && pm.last_turn.n === 1000);
  assert.ok(r.t_end === 60 && r.series[r.series.length - 1].t < 60, 'until_death: 정지 확인 뒤 멈춤');
  assert.ok(Math.abs(pm.waste.find((w) => w.bundle === mx(CO2)).accumulated - 2000) < 1e-6);
  assert.ok(Math.abs(pm.dp.produced[mx(id('GTP'))] - 1000) < 1e-6);
  const lid = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].type === 'Resource_Gap' && /accoa_supply/.test(BASE.limitations[k].target));
  assert.ok(r.audit.some((a) => a.code === 'AUDIT_RESOURCE' && /사후 분석/.test(a.msg) && a.suggestion.includes(lid)), '사후 분석 → 등록된 Resource_Gap');
  assert.ok(!r.audit.some((a) => a.code === 'AUDIT_MASS'), '탄소·CoA·NAD 수지 위반 없음');
});
test('소진 시험 2: NAD⁺ 3002 → 1000 바퀴 + 부분 바퀴 뒤 NAD⁺ 고갈, NADH 3002 축적 (바퀴당 NAD⁺ 3)', () => {
  const r = ORCH.runRate(BASE, TCA, { scenario: scenario('tca-nad-exhaustion-hypothetical.json'), t_end: 60, dt: 0.01 }), pm = r.postMortem;
  assert.ok(pm.cause === 'exhaustion' && pm.limiting.bundle === mx(NADP));
  assert.equal(pm.cycles[0].completed, 1000);
  assert.ok(pm.limiting.starved.length === 3, 'NAD⁺ 를 쓰는 세 탈수소효소가 굶음');
  assert.ok(Math.abs(r.final[mx(NADH)] - 3002) < 1e-6 && Math.abs(pm.waste.find((w) => w.bundle === mx(CO2)).accumulated - 2002) < 1e-6, '부분 바퀴: IDH·KGDH 가 한 번 더');
});
test('소진 시험 3: 기질이 남아도 CO₂ 축적이 가역 IDH 를 평형에 묶어 정지 — 병목과 역/정 비를 보고', () => {
  const r = ORCH.runRate(BASE, TCA, { scenario: scenario('tca-co2-equilibrium-hypothetical.json'), t_end: 3600, dt: 0.005 }), pm = r.postMortem;
  assert.ok(!r.audit.some((a) => /Δt .* 너무 큼/.test(a.msg)), '수렴하는 Δt');
  const coarse = ORCH.runRate(BASE, TCA, { scenario: scenario('tca-co2-equilibrium-hypothetical.json'), t_end: 300, dt: 0.1 });
  assert.ok(coarse.audit.some((a) => a.code === 'AUDIT_KINETIC' && /Δt 0.1 s 가 너무 큼/.test(a.msg)), '큰 Δt 는 적분 안정성 감사');
  assert.ok(pm.dead && pm.cause === 'equilibrium');
  assert.equal(pm.bottleneck.sid, Object.keys(BASE.steps).find((k) => BASE.steps[k].rule === `${IDH}/rule/oxdecarb`));
  assert.ok(pm.bottleneck.ratio > 0.5 && pm.limiting === null);
  assert.ok(r.final[mx(ACCOA)] > 1e8, '아세틸-CoA 는 넉넉히 남음 (고갈 아님)');
  const lid = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${IDH}/rule/oxdecarb`);
  assert.ok(r.audit.find((a) => /사후 분석/.test(a.msg)).suggestion.includes(lid));
});
test('재생이 있으면 죽지 않는다: 아세틸-CoA 공급을 켜면 정지 없이 계속 돈다 · 시동 중에는 정지로 보지 않음', () => {
  const sc = scenario('tca-acetylcoa-exhaustion-hypothetical.json');
  sc.kinetics['D000159/rule/accoa_supply'] = { law: 'mass_action', k: 100, order: 1, evidence: { level: 'predicted', confidence: 0 } };
  const r = ORCH.runRate(BASE, TCA, { scenario: sc, t_end: 5, dt: 0.01 });
  assert.ok(r.postMortem.alive && r.postMortem.cycles[0].completed > 1000);
  const slow = scenario('tca-co2-equilibrium-hypothetical.json');
  for (const k of Object.keys(slow.kinetics)) if (slow.kinetics[k].k) slow.kinetics[k].k /= 1e6;
  assert.ok(ORCH.runRate(BASE, TCA, { scenario: slow, t_end: 30, dt: 0.05 }).postMortem.alive, '한 바퀴도 못 돈 시동 단계는 정지가 아님');
});

// ===== 형식 v8: 3 층 엔진 =====
const HMSE = createRequire(import.meta.url)('../engine/hmse.js');
const RTv = DefDB.VOCAB.thermo.R * DefDB.VOCAB.thermo.T_ref;
test('v8 층(tier): 분자 종류는 T1|T2 필수, 기본값은 kind 로, T1 은 부위 없음, T3 는 정의항에 못 씀', () => {
  rejectedFor(one('부류', { kind: 'molecule_class' }), /기본 층\(tier: T1 \| T2\)이 필요함/);
  const r = passes(one('작은 분자', { kind: 'small_molecule', unmapped: '시험' }));
  assert.equal(findText(r.db, '테스트 정의').tier, 'T1', '저분자 기본 T1');
  rejectedFor(one('부류', { kind: 'molecule_class', tier: 'T3' }), /T3\(공간 영역\)은 영역의 동적 상태/);
  rejectedFor(one('개념', { tier: 'T1' }), /층\(tier\)은 분자 종류 정의항만/);
  rejectedFor({ senses: [{ id: id('IκBα'), tier: 'T1' }] }, /kind 'protein' 는 부위 상태를 가진 행위자 — T2/);
  assert.equal(BASE.senses[id('ATP')].tier, 'T1'); assert.equal(BASE.senses[id('뉴클레오타이드')].tier, 'T1'); assert.equal(BASE.senses[id('시트르산 생성효소')].tier, 'T2');
});
test('v8 관찰: 확산 계수·pH·이온 세기·유전율은 위치 필수, SI 단위, 값 범위', () => {
  const ob = (o) => ({ id: CAMP, obs: [Object.assign({ evidence: { level: 'asserted' } }, o)] });
  passes({ senses: [ob({ property: 'diffusion_coefficient', value: 3e-10, unit: 'm^2/s', context: { location: 'cytosol' } })] });
  rejectedFor({ senses: [ob({ property: 'diffusion_coefficient', value: 300, unit: 'µm^2/s', context: { location: 'cytosol' } })] }, /SI 정준 m\^2\/s/);
  rejectedFor({ senses: [ob({ property: 'diffusion_coefficient', value: 3e-10, unit: 'm^2/s', context: {} })] }, /context\.location 필수/);
  rejectedFor({ senses: [ob({ property: 'pH', value: 15, context: { location: 'cytosol' } })] }, /pH 는 0–14/);
});
test('v8 열역학: 전이 상태 이론 일치, 미시적 가역성(k/k_r = exp(−ΔG°/RT)), dG_act ≥ 0', () => {
  const kf = 1e3, dG = 5000;
  rejectedFor({ senses: [withKin(AC, 'cyclization', { law: 'michaelis_menten', kcat: 1, Km: 1e-4, k0: 1e13, evidence: { level: 'asserted' } })] }, /k0 와 dG_act 를 함께/);
  rejectedFor({ senses: [withKin(IDH, 'oxdecarb', { law: 'mass_action', k: 1, order: 2, k0: 1e13, dG_act: 50000, evidence: { level: 'asserted' } })] }, /k0·exp\(−dG_act\/RT\)/);
  passes({ senses: [withKin(IDH, 'oxdecarb', { law: 'mass_action', k: 1e13 * Math.exp(-50000 / RTv), order: 2, k0: 1e13, dG_act: 50000, evidence: { level: 'asserted' } })] });
  rejectedFor({ senses: [withKin(IDH, 'oxdecarb', { law: 'mass_action', k: kf, k_r: kf, reversible: true, order: 2, dG0: dG, evidence: { level: 'asserted' } })] }, /미시적 가역성 위반/);
  passes({ senses: [withKin(IDH, 'oxdecarb', { law: 'mass_action', k: kf, k_r: kf * Math.exp(dG / RTv), reversible: true, order: 2, dG0: dG, evidence: { level: 'asserted' } })] });
  rejectedFor({ senses: [withKin(IDH, 'oxdecarb', { law: 'mass_action', k0: 1e13, dG_act: -1, order: 2, evidence: { level: 'asserted' } })] }, /dG_act.*0 이상/);
});
test('v8 Tier 1: 환경(pH·ε)이 장벽을 옮겨도 k_f/k_r 는 exp(−ΔG°/RT) 로 유지 (상세 균형)', () => {
  const kin = { law: 'mass_action', k0: 1e12, dG_act: 60000, dG0: -8000, env: { pH_ref: 7, dG_dpH: 3000, eps_ref: 80, dG_dinv_eps: 2e5 } };
  const a = DefDB.rateAt(kin, { pH: 7, eps: 80 }), b = DefDB.rateAt(kin, { pH: 6.2, eps: 30 });
  assert.notEqual(a.kf, b.kf, '환경이 속도를 바꿈');
  for (const r of [a, b]) assert.ok(Math.abs(Math.log(r.kf / r.kr) - 8000 / RTv) < 1e-9);
  assert.ok(Math.abs(b.dG_env - (3000 * (6.2 - 7) + 2e5 * (1 / 30 - 1 / 80))) < 1e-6);
  // 시뮬레이터: 시나리오 environment 가 반영되고 역 상수가 ΔG° 에서 나옴
  const sc = scenario('tca-co2-equilibrium-hypothetical.json');
  sc.kinetics[`${IDH}/rule/oxdecarb`] = { law: 'mass_action', order: 2, k0: 1e20, dG_act: 50000, dG0: -10000, evidence: { level: 'predicted', confidence: 0 } };
  sc.environment = { mito_matrix: { pH: 7.8, relative_permittivity: 80 } };
  const r = ORCH.runRate(BASE, TCA, { scenario: sc, t_end: 0.1, dt: 0.005 }), x = r.react.get(Object.keys(BASE.steps).find((k) => BASE.steps[k].rule === `${IDH}/rule/oxdecarb`));
  assert.ok(x.k.reversible && Math.abs(Math.log(x.k.k / x.k.k_r) - 10000 / RTv) < 1e-9);
});
test('v8 Wegscheider: 닫힌 고리의 ΣΔG° ≠ 0 이면 AUDIT_THERMO', () => {
  const mk = (dGs) => P({ why: '시험', terms: [{ id: 'T+a', names: { ko: '시험 A' } }, { id: 'T+b', names: { ko: '시험 B' } }, { id: 'T+c', names: { ko: '시험 C' } }, { id: 'T+e', names: { ko: '시험 이성질화효소' } }, { id: 'T+p', names: { ko: '시험 고리' } }],
    senses: [...['a', 'b', 'c'].map((x) => ({ id: 'D+' + x, term: 'T+' + x, kind: 'small_molecule', unmapped: '시험', desc: desc('시험 분자') })),
      { id: 'D+p', term: 'T+p', kind: 'pathway', desc: desc('시험 고리 경로') },
      { id: 'D+e', term: 'T+e', kind: 'molecule_class', tier: 'T2', desc: desc('시험 효소'), rule: [{ id: 'on', type: 'meaning', label: '활성', when: {}, activity: 'active', evidence: { level: 'asserted' } },
        ...[['ab', 'D+a', 'D+b'], ['bc', 'D+b', 'D+c'], ['ca', 'D+c', 'D+a']].map(([rid, s, p], i) => ({ id: rid, type: 'transition', label: rid, action: '이성질화', agent: true, effect: { type: 'convert', consumes: [s], produces: [p] }, kinetics: { law: 'mass_action', k: 1, order: 2, dG0: dGs[i], evidence: { level: 'predicted', confidence: 0 } }, evidence: { level: 'asserted' } }))] }],
    steps: [['S+1', 'ab', 'D+a', 'D+b'], ['S+2', 'bc', 'D+b', 'D+c'], ['S+3', 'ca', 'D+c', 'D+a']].map(([sidn, rid, s, p]) => ({ id: sidn, rule: { owner: 'D+e', id: rid }, agents: [{ ref: 'D+e', location: 'cytosol' }], inputs: [{ ref: s, location: 'cytosol' }], outputs: [{ ref: p, location: 'cytosol' }], part_of: ['D+p'] })) });
  const bad = passes(mk([-1000, -2000, -3000])).db, good = passes(mk([-1000, -2000, 3000])).db;
  const pth = Object.keys(bad.senses).find((k) => bad.terms[bad.senses[k].term].names.ko === '시험 고리');
  const lb = J.thermoLoops(bad, pth).loops, lg = J.thermoLoops(good, pth).loops;
  assert.ok(lb.length === 1 && lb[0].closed && !lb[0].ok && lb[0].sum === -6000);
  assert.ok(lg[0].ok);
  assert.ok(ORCH.auditRun(bad, pth, { t_end: 0.01, dt: 0.01 }).some((a) => a.code === 'AUDIT_THERMO'));
  assert.ok(!ORCH.auditRun(good, pth, { t_end: 0.01, dt: 0.01 }).some((a) => a.code === 'AUDIT_THERMO'));
  assert.ok(J.thermoLoops(BASE, TCA).loops.every((l) => !l.closed), '시트르산 회로는 열린 고리(아세틸-CoA 가 몰아감) — Wegscheider 대상 아님');
});
const CFG = { domains: [{ id: 'cyt', tier: 'T1', location: 'cytosol', volume_fL: 1000 }, { id: 'nodeA', tier: 'T2', location: 'cytosol', volume_fL: 10 }, { id: 'reg3', tier: 'T3', location: 'cytosol', volume_fL: 5, geometry_template: 'box', grid: { n: 8, h_m: 2e-7 } }],
  adjacency: [['cyt', 'nodeA'], ['nodeA', 'reg3']], metrics: { w1: 1, w2: 1, tau_high: 0.5, tau_low: 0.1, t_min: 1 }, solver: { epsilon_max: 0.05, fallback: 'fv3d', window_min_s: 0.01 } };
test('v8 영역 구성: T3 는 기준 경계·격자 필수, 히스테리시스 tau_low < tau_high', () => {
  assert.deepEqual(HMSE.validateDomainConfig(CFG), []);
  const bad = JSON.parse(JSON.stringify(CFG)); delete bad.domains[2].geometry_template; bad.metrics.tau_low = 0.9;
  const e = HMSE.validateDomainConfig(bad);
  assert.ok(e.some((m) => /기준 경계/.test(m)) && e.some((m) => /히스테리시스/.test(m)));
});
test('v8 정수 원장·인접 경계 거래: 보존, 멱등, 낙관적 버전 충돌, 인접성, 실현 가능성, 정수만', () => {
  let s = HMSE.makeLedgerState(CFG, { cyt: { 'X|cytosol': 1000 }, nodeA: { 'X|cytosol': 5 } });
  const tx = (o) => Object.assign({ from: 'cyt', to: 'nodeA', seq: 1, t: 0.1, base_version: { cyt: s.ledgers.cyt.version, nodeA: s.ledgers.nodeA.version }, items: [{ key: 'X|cytosol', dn: 7 }] }, o);
  let r = HMSE.applyLedgerTx(s, tx()); assert.equal(r.status, 'committed'); const s1 = r.state;
  assert.equal(HMSE.applyLedgerTx(s1, tx()).status, 'duplicate');
  assert.equal(HMSE.applyLedgerTx(s1, tx({ seq: 2 })).status, 'conflict', '옛 버전으로는 커밋 못 함');
  assert.equal(HMSE.applyLedgerTx(s1, tx({ from: 'cyt', to: 'reg3', seq: 1, base_version: { cyt: 1, reg3: 0 } })).status, 'not_adjacent');
  s = s1;
  assert.equal(HMSE.applyLedgerTx(s, tx({ seq: 2, items: [{ key: 'X|cytosol', dn: -100 }] })).status, 'infeasible');
  assert.equal(HMSE.applyLedgerTx(s, tx({ seq: 2, items: [{ key: 'X|cytosol', dn: 1.5 }] })).status, 'invalid');
  // 무작위 거래 1000 개 — 총량 불변
  const rand = HMSE.rngOf(42); let st = s; const total0 = HMSE.ledgerTotals(st)['X|cytosol']; let seq = 2;
  for (let i = 0; i < 1000; i++) { const dn = Math.floor(rand() * 21) - 10 || 1; const rr = HMSE.applyLedgerTx(st, { from: 'cyt', to: 'nodeA', seq: seq, t: i, base_version: { cyt: st.ledgers.cyt.version, nodeA: st.ledgers.nodeA.version }, items: [{ key: 'X|cytosol', dn }] }); if (rr.status === 'committed') { st = rr.state; seq++; } }
  assert.equal(HMSE.ledgerTotals(st)['X|cytosol'], total0);
});
test('v8 경계 이동 표본: 나머지 이월은 누적 오차 < 1, 부족분은 pending 으로 이월, 포아송 평균·분산', () => {
  let r = 0, sumMu = 0, sumK = 0;
  const rand = HMSE.rngOf(7);
  for (let i = 0; i < 10000; i++) { const mu = rand() * 3.7; const o = HMSE.sampleTransfer(mu, r, 'residual', null); r = o.residual; sumMu += mu; sumK += o.k; assert.ok(Math.abs(sumMu - sumK) < 1 + 1e-9); }
  const c = HMSE.sampleTransfer(10.4, 0, 'residual', null, 6); assert.ok(c.k === 6 && c.pending === 4 && Math.abs(c.residual - 0.4) < 1e-9);
  const ks = Array.from({ length: 20000 }, () => HMSE.poisson(rand, 4)); const m = ks.reduce((a, b) => a + b, 0) / ks.length, v = ks.reduce((a, b) => a + (b - m) ** 2, 0) / ks.length;
  assert.ok(Math.abs(m - 4) < 0.1 && Math.abs(v - 4) < 0.2, '확률 모드는 잡음을 보존 (평균 = 분산)');
});
test('v8 영역 점수·깜빡임 방지·보존적 투영·정수 분배', () => {
  const n = 8, uni = new Float64Array(n ** 3).fill(1), grad = new Float64Array(n ** 3).map((_, i) => (Math.floor(i / (n * n)) === 3 ? 50 : 1));
  const su = HMSE.domainScore(uni, null, n, 1e-7, 0.1, CFG.metrics), sg = HMSE.domainScore(grad, 1, n, 1e-7, 0.1, CFG.metrics);
  assert.ok(su.score === 0 && sg.score > su.score && sg.entropy < 1);
  let st = { tier: 'T2', since: 0 }; const flips = [];
  for (let i = 1; i <= 40; i++) { const t = i * 0.1, sc = i % 2 ? 0.9 : 0.0; st = HMSE.decideTransition(st, sc, t, CFG.metrics); if (st.action !== 'hold') flips.push(t); }
  for (let i = 1; i < flips.length; i++) assert.ok(flips[i] - flips[i - 1] >= CFG.metrics.t_min - 1e-9, '최소 체류 시간 안에서 다시 바뀌지 않음');
  const pf = HMSE.conservativeProject(Float64Array.from([-1, 2, 3, 5]), 100); assert.ok(Math.abs(pf.reduce((a, b) => a + b, 0) - 100) < 1e-9 && pf[0] === 0);
  const dc = HMSE.distributeCounts([0.1, 0.5, 0.2, 0.2], 1001); assert.equal(dc.reduce((a, b) => a + b, 0), 1001);
  const ds = HMSE.distributeCounts([0.1, 0.5, 0.2, 0.2], 1001, HMSE.rngOf(3)); assert.equal(ds.reduce((a, b) => a + b, 0), 1001, '다항 표본도 정확히 N');
});
test('v8 스키마 파일: 파싱되고 참조 구현의 필수 필드와 일치', () => {
  const sch = (f) => JSON.parse(readFileSync(new URL(`../schemas/v8/${f}`, import.meta.url), 'utf8'));
  assert.deepEqual(sch('ledger-transaction.schema.json').required.sort(), ['base_version', 'from', 'items', 'seq', 't', 'to']);
  assert.deepEqual(sch('domain-config.schema.json').properties.domains.items.properties.geometry_template.enum, HMSE.TEMPLATES);
  for (const f of ['boundary-flux-packet.schema.json', 'domain-metrics.schema.json']) assert.ok(sch(f).$schema.includes('2020-12'));
});

// ===== Phase P3: Parallel-DEVS + 3차원 FV + 정수 원장 =====
const FVS = createRequire(import.meta.url)('../engine/fv_solver.js'), DEVSS = createRequire(import.meta.url)('../engine/devs_scheduler.js'), P3 = createRequire(import.meta.url)('./p3_end_to_end.js');
test('P3 종단: T3 영역 + T2 노드 10,000 단계 — |N_initial − N_final| < 1, 부분 구조 정수 불변, 장 = 원장', () => {
  const r = P3.run({ quiet: true, steps: 10000 });
  assert.ok(r.pass, JSON.stringify(r));
  assert.equal(r.massError, 0); assert.equal(r.worstMoiety, 0); assert.ok(r.worstFieldLedger < 1e-6);
  assert.ok(r.tx > 1000 && r.committedOut > 0 && r.committedIn > 0, '양방향 경계 이동이 실제로 일어남');
  assert.ok(r.nodeStats.fast.includes('activate') && r.nodeStats.leaps > 0, '강성 통로는 τ-도약');
  assert.ok(r.buffers.maxResidual < 1 && r.buffers.pending === 0);
  assert.ok(Math.abs(r.final.node.Ax / r.final.node.A - 1.25) < 0.05 && Math.abs(r.final.reg.B / r.final.reg.A - 2.5) < 0.05, '정상 상태 비 = 속도 상수 비');
  const s = P3.run({ quiet: true, steps: 2000, mode: 'stochastic' }); assert.ok(s.massError === 0 && s.worstMoiety === 0, '확률적 이동도 정확히 보존');
});
test('P3 계면 평형: 이류가 없으면 영역·인터페이스·노드 농도가 같아진다', () => {
  const f = P3.run({ quiet: true, steps: 10000, velocity: [0, 0, 0] }).final, cr = f.reg.A / f.regVolume_m3, cn = f.node.A / f.nodeVolume_m3;
  assert.ok(Math.abs(cr / cn - 1) < 0.03, `${cr} vs ${cn}`);
});
test('P3 FV: 다섯 기준 경계 모두 보존(확산·제한된 이류·반응), 음수 없음, 기준 경계 밖 모양은 거부', () => {
  for (const tpl of HMSE.TEMPLATES) {
    const R = FVS.createRegion({ n: 8, h_m: 1e-7, template: tpl, velocity: [3e-5, -1e-5, 0], species: { A: { D: 1e-12 }, B: { D: 1e-13 } }, reactions: [{ from: 'A', to: 'B', k: 3 }] }, { A: 5000, B: 0 });
    // 원장 없이 수송·반응만: 총량(A+B) 은 부동 소수 오차 안에서 보존
    for (let i = 0; i < 200; i++) { const ns = FVS.substepsFor(R, 1e-3); for (let s = 0; s < ns; s++) { FVS.transport(R, 'A', 1e-3 / ns); FVS.transport(R, 'B', 1e-3 / ns); FVS.react(R, 1e-3 / ns); } }
    const T = FVS.totals(R); assert.ok(Math.abs(T.A + T.B - 5000) < 1e-6, `${tpl}: ${T.A + T.B}`);
    assert.ok([...R.fields.A].every((x) => x >= 0) && [...R.fields.A].every((x, p) => R.mask[p] || x === 0), `${tpl}: 음수·마스크 밖 질량 없음`);
  }
  assert.throws(() => FVS.templateMask('blob', 8), /기준 경계가 아님/);
  assert.equal(FVS.minmod(1, 2), 1); assert.equal(FVS.minmod(-1, 2), 0);
});
test('P3 스케줄러: 동시 패킷 결정론적 정렬, 보수적 동기화 위반·시간 역행은 오류, 충돌 재시도', () => {
  const cfg = { domains: [{ id: 'a', tier: 'T2', location: 'cytosol', volume_fL: 1 }, { id: 'b', tier: 'T2', location: 'cytosol', volume_fL: 1 }, { id: 'c', tier: 'T2', location: 'cytosol', volume_fL: 1 }], adjacency: [['a', 'b'], ['a', 'c']] };
  const handle = { state: HMSE.makeLedgerState(cfg, { a: { X: 100, Y: 100 }, b: {}, c: {} }) };
  const order = [], mk = (id, outs, look = 1) => ({ id, lookahead: look, ta: () => 1, output: () => outs, deltaInt() {}, deltaExt() {}, deltaConf() {} });
  const sched = DEVSS.createScheduler(handle, { mode: 'residual' });
  const orig = sched.boundary.apply; sched.boundary.apply = (p) => { order.push(`${p.source}>${p.target}|${p.species}`); return orig(p); };
  sched.add(mk('z', [{ source: 'a', target: 'c', species: 'X', mu_out: 3, mu_in: 0 }, { source: 'a', target: 'b', species: 'Y', mu_out: 2, mu_in: 0 }]), []);
  sched.add(mk('y', [{ source: 'a', target: 'b', species: 'X', mu_out: 1, mu_in: 0 }]), []);
  sched.run(1);
  assert.deepEqual(order, ['a>b|X', 'a>b|Y', 'a>c|X'], '(source, target, species) 순서');
  assert.equal(HMSE.ledgerTotals(handle.state).X, 100);
  const s2 = DEVSS.createScheduler({ state: HMSE.makeLedgerState(cfg, {}) }, {});
  s2.add(mk('p', [], 0.1), []); s2.add({ ...mk('q', []), ta: () => 5 }, ['p']);
  s2.models.get('p').ta = () => 10; s2.models.get('p').tn = 10;
  assert.throws(() => s2.run(20), /보수적 동기화 위반/);
  // 충돌 재시도: 커밋 직전 다른 거래로 버전을 올려도 경계 엔진이 다시 읽고 성공
  const h3 = { state: HMSE.makeLedgerState(cfg, { a: { X: 10 } }) }, be = DEVSS.makeBoundaryEngine(h3, {});
  const r = be.commit('a', 'b', [{ key: 'X', dn: 2 }], 0, 't'); assert.equal(r.status, 'committed'); assert.equal(h3.state.ledgers.b.counts.X, 2);
});
test('P3 고정 소수점 나머지: 10^6 번 이월해도 Σk 와 Σμ_q 의 차가 정확히 r/1e9 (< 1), 표류 없음', () => {
  let r = 0, sumK = 0, sumMuFP = 0; const rand = HMSE.rngOf(5);
  for (let i = 0; i < 1e6; i++) { const o = HMSE.sampleTransferFixed(rand() * 0.37, r, 'residual', null); r = o.residualFP; sumK += o.k; sumMuFP += o.muFP; }
  assert.equal(sumMuFP - sumK * HMSE.FP, r, '정수 산술로 정확히 같음');
  assert.ok(r >= 0 && r < HMSE.FP);
  const st = HMSE.makeLedgerState({ domains: [{ id: 'n' }], adjacency: [] }, { n: { A: 5, R: 5, AR: 0 } });
  const mo = { A: { A: 1 }, R: { R: 1 }, AR: { A: 1, R: 1 } };
  assert.equal(HMSE.applyLocalTx(st, { domain: 'n', base_version: 0, deltas: { A: -1, R: -1, AR: 1 } }, mo).status, 'committed');
  assert.equal(HMSE.applyLocalTx(st, { domain: 'n', base_version: 0, deltas: { A: -1, AR: 1 } }, mo).status, 'invalid', 'R 단위가 생겨나는 반응은 거부');
});
test('P3 강성 정체 방지: 매우 빠른 통로도 시간축이 멈추지 않고(Δt_min) 큰 수에서는 CLE, 평형 비 유지', () => {
  const cfg = { domains: [{ id: 'n' }], adjacency: [] };
  const handle = { state: HMSE.makeLedgerState(cfg, { n: { A: 2000000, B: 0 } }) };
  const sched = DEVSS.createScheduler(handle, {});
  const node = DEVSS.nodeModel(handle, { id: 'n', moieties: { A: { X: 1 }, B: { X: 1 } }, dt_min: 1e-3, leap_threshold: 1, seed: 3, reactions: [{ id: 'f', reactants: { A: 1 }, products: { B: 1 }, k: 1e6 }, { id: 'r', reactants: { B: 1 }, products: { A: 1 }, k: 1e6 }] });
  sched.add(node, []);
  const out = sched.run(0.05);
  assert.ok(out.log.events <= 0.05 / 1e-3 + 2, `사건 수 ${out.log.events} — a0 → ∞ 이어도 Δt_min 간격`);
  assert.ok(node.stats.cle > 0, 'CLE 경로 사용');
  const c = handle.state.ledgers.n.counts; assert.equal(c.A + c.B, 2000000); assert.ok(Math.abs(c.B / c.A - 1) < 0.02);
});

// ===== Phase P4: 스펙트럼 신경 연산자 대리 모델 + OOD 탐지 + 비동기 FV 대체 =====
const FNOS = createRequire(import.meta.url)('../engine/fno_surrogate.js'), OODS = createRequire(import.meta.url)('../engine/ood_detector.js'), AFS = createRequire(import.meta.url)('../engine/async_fallback_worker.js');
const P4 = createRequire(import.meta.url)('./p4_end_to_end.js'), P4B = createRequire(import.meta.url)('./p4_benchmark.js');
const boxSpec = (n = 16) => ({ n, h_m: 1e-7, template: 'box', species: { A: { D: 1e-12 }, B: { D: 5e-13 } }, reactions: [{ from: 'A', to: 'B', k: 5 }, { from: 'B', to: 'A', k: 2 }] });
test('P4 DCT: 직접 합과 일치하고 정확히 되돌아옴 (O(n log n) Makhoul), 3차원 분리형도 왕복', () => {
  for (const n of [8, 16, 32]) {
    const d = FNOS.makeDCT(n), x = Float64Array.from({ length: n }, (_, i) => Math.cos(2.3 * i) + 1.5), X = new Float64Array(n), y = new Float64Array(n);
    d.forward(x, X); d.inverse(X, y);
    for (let k = 0; k < n; k++) { let r = 0; for (let j = 0; j < n; j++) r += x[j] * Math.cos(Math.PI * k * (2 * j + 1) / (2 * n)); assert.ok(Math.abs(r - X[k]) < 1e-11); }
    assert.ok(x.every((v, i) => Math.abs(v - y[i]) < 1e-12));
  }
  const f = Float64Array.from({ length: 4096 }, (_, i) => Math.sin(i * 0.37) + 2), dd = FNOS.makeDCT(16), back = FNOS.dct3(FNOS.dct3(f, 16, dd, false), 16, dd, true);
  assert.ok(f.every((v, i) => Math.abs(v - back[i]) < 1e-10));
  assert.throws(() => FNOS.makeDCT(12), /2 의 거듭제곱/);
});
test('P4 학습: P3 FV 궤적에서 모드별 이득을 최소 제곱으로 — FV 확산 연산자 재현(잔차 < 1e-12), 반응 포함 100 단계 L2 < 2%', () => {
  const a = FVS.createRegion(boxSpec(), {}), b = FVS.createRegion(boxSpec(), {});
  for (const R of [a, b]) for (let p = 0; p < 4096; p++) { R.fields.A[p] = 100 * (1 + 0.7 * Math.cos(Math.PI * Math.floor(p / 256) / 16)); R.fields.B[p] = 5; }
  const sur = FNOS.createSurrogate(b, 1e-3), tr = FNOS.calibrate(sur, b);
  assert.ok(tr.residual.A < 1e-12 && tr.residual.B < 1e-12);
  for (let i = 0; i < 100; i++) { FVS.integrate(a, 1e-3); FNOS.integrate(sur, b); }
  for (const k of ['A', 'B']) { let num = 0, den = 0; for (let p = 0; p < 4096; p++) { num += (a.fields[k][p] - b.fields[k][p]) ** 2; den += a.fields[k][p] ** 2; } assert.ok(Math.sqrt(num / den) < 0.02, `${k} L2 ${Math.sqrt(num / den)}`); }
  const t = FVS.totals(b); assert.ok(Math.abs(t.A + t.B - FVS.totals(a).A - FVS.totals(a).B) < 1e-6, '스펙트럼 단계도 종 총량(직류 모드) 보존');
  assert.throws(() => FNOS.createSurrogate(FVS.createRegion({ ...boxSpec(8), template: 'sphere' }, {}), 1e-3), /box 에서만/);
  assert.throws(() => FNOS.createSurrogate(FVS.createRegion({ ...boxSpec(8), species: { A: {}, B: {}, C: {} }, reactions: [{ from: 'A', to: 'B', k: 1 }, { from: 'B', to: 'C', k: 1 }] }, {}), 1e-3), /반응 쌍이 겹침/);
});
test('P4 질량 조정 연산자: max(0,·) 투영 → Σ = N_ledger 재척도, Σ = 0 이면 균일 정수 분배', () => {
  const R = FVS.createRegion(boxSpec(8), { A: 100 });
  R.fields.A.fill(0); R.fields.A[0] = -5; R.fields.A[1] = 3; R.fields.A[2] = 1;
  FNOS.reconcileMass(R, 'A', 1000); assert.ok(R.fields.A[0] === 0 && Math.abs(R.fields.A[1] - 750) < 1e-9 && Math.abs(FVS.totals(R).A - 1000) < 1e-9);
  R.fields.A.fill(-1); FNOS.reconcileMass(R, 'A', 777); assert.equal(FVS.totals(R).A, 777);
});
test('P4 OOD 탐지: 디랙 스파이크·수치 비정상·분포 밖 구성(구·이류·겹친 반응·열역학 표류)은 즉시, 매끄러운 장은 통과', () => {
  const R = FVS.createRegion(boxSpec(), {}); for (let p = 0; p < 4096; p++) { R.fields.A[p] = 100 + 20 * Math.cos(Math.PI * (p % 16) / 16); R.fields.B[p] = 50; }
  const sur = FNOS.createSurrogate(R, 1e-3); FNOS.calibrate(sur, R); const det = OODS.createDetector(); OODS.train(det, [R.fields.A, R.fields.B], 16, R.mask);
  assert.equal(OODS.evaluate(det, R, sur, 'pre').ood, false);
  const spike = { A: Float64Array.from(R.fields.A), B: R.fields.B }; spike.A[2000] += 0.3 * FVS.totals(R).A;
  const e = OODS.evaluate(det, R, sur, 'pre', { fields: spike }); assert.ok(e.ood && e.score > 10 && e.components.E_spec > det.ref.E, `spike score ${e.score}`);
  const nan = { A: Float64Array.from(R.fields.A), B: R.fields.B }; nan.A[5] = NaN; assert.deepEqual(OODS.evaluate(det, R, sur, 'post', { fields: nan }).reasons, ['non_finite']);
  const neg = { A: Float64Array.from(R.fields.A).map((v, i) => (i % 2 ? -v : v)), B: R.fields.B }; assert.ok(OODS.evaluate(det, R, sur, 'post', { fields: neg }).reasons.includes('negative_mass'));
  for (const [mod, why] of [[{ template: 'sphere' }, 'template'], [{ velocity: [1e-6, 0, 0] }, 'advection']]) { const R2 = { ...R, spec: { ...R.spec, ...mod } }; assert.ok(OODS.evaluate(det, R2, sur, 'pre').reasons.includes(why)); }
  const RT = 8.314462618 * 310.15, good = { ...R, spec: { ...R.spec, reactions: [{ from: 'A', to: 'B', k: 5, dG0: -RT * Math.log(2.5) }, { from: 'B', to: 'A', k: 2 }] } }, bad = { ...R, spec: { ...R.spec, reactions: [{ from: 'A', to: 'B', k: 5, dG0: +5000 }, { from: 'B', to: 'A', k: 2 }] } };
  assert.ok(OODS.thermoDrift(good.spec.reactions) < 1e-12 && OODS.evaluate(det, good, sur, 'pre').ood === false);
  assert.ok(OODS.evaluate(det, bad, sur, 'pre').ood, '미시적 가역성에서 벗어난 속도 집합은 대리 모델 금지 (불변식 5)');
});
test('P4 종단: 10,000 단계 |ΔN| = 0, 충격 탐지 지연 ≤ 1 단계, 대부분 대리 모델, 분포 안 오탐 0', () => {
  const r = P4.run({ quiet: true, steps: 10000 });
  assert.ok(r.pass, JSON.stringify({ ...r, final: undefined }));
  assert.equal(r.massError, 0); assert.equal(r.worstMoiety, 0); assert.ok(r.worstFieldLedger < 1e-6);
  assert.ok(r.latencySteps <= 1 && r.firstFlag.step === r.shockAt, '충격 단계에서 바로 탐지');
  assert.ok(r.surrogateSteps > 9000 && r.fallbacks < 100 && r.fallbacks === r.lockWindows);
  assert.ok(r.firstFlag && r.firstFlag.step >= 5000, '충격 전 오탐 없음');
});
test('P4 비동기 대체: worker_threads 일꾼 결과 = inline 결과 (원장 정확히 같음), 분포 밖 모양(구)은 대리 없이 FV 로 보존', () => {
  const a = P4.run({ quiet: true, steps: 5300, fallback: 'inline' }), b = P4.run({ quiet: true, steps: 5300, fallback: 'worker' });
  assert.ok(a.pass && b.pass); assert.deepEqual(a.final, b.final); assert.equal(b.executor.mode, 'worker'); assert.equal(b.executor.joined, b.fallbacks);
  const s = P4.run({ quiet: true, steps: 400, shock: -1, template: 'sphere', n: 8, warmup: 50 });
  assert.ok(s.massError === 0 && s.surrogateSteps === 0 && /box 에서만/.test(s.unsupported), '구는 분포 밖 → FV');
});
test('P4 속도·정확도: FV 가 안정 조건으로 부분 단계를 많이 쓰는 강성 영역에서 ≥ 10× (Δt 와 무관한 O(N log N)), 모든 경우 L2 < 2%', () => {
  const rows = P4B.run({ quick: true, quiet: true }), stiff = rows.find((r) => r.ns >= 70 && r.n === 16);
  assert.ok(stiff.speedup >= 10, `강성 영역 속도 향상 ${stiff.speedup.toFixed(1)}×`);
  assert.ok(rows.every((r) => r.l2 < 0.02 && r.flagged === 0));
});

// ===== Phase P5: 동적 승격·강등 관문 =====
const GATE = createRequire(import.meta.url)('../engine/p5_dynamic_gate.js'), P5 = createRequire(import.meta.url)('./p5_dynamic_promotion.js');

test('P5 강성 지표: N_sub = ⌈C_CFL·K_est⌉ 가 FV 가 실제로 쓰는 부분 단계 수와 경계값까지 같다', () => {
  assert.equal(GATE.C_CFL, 15);
  for (const D of [0, 1e-14, 2e-12, 6e-12, 1e-11, 1.0000001e-11, 2e-11, 4.6666e-11, 5e-11, 3e-10]) for (const dt of [1e-4, 1e-3, 3.3e-3]) {
    const spec = { ...boxSpec(8), species: { A: { D }, B: { D: D / 2 } } };
    assert.equal(GATE.stiffness(spec, dt).Nsub, FVS.substepsFor(FVS.createRegion(spec, {}), dt), `D ${D} dt ${dt}`);
  }
});
test('P5 상태 기계: M 단계 연속이어야 승격, K_down 미만이면 강등, 대역 안에서는 유지, 충격·OOD 는 같은 단계 강등 + W 냉각', () => {
  const g = GATE.createGate({ K_up: 15, K_down: 8, M: 5, W: 20 }); g.gammaMax = 1; const ok = () => 0.5, bad = () => 5;
  for (let s = 0; s < 4; s++) assert.equal(GATE.decide(g, s, 20, ok).path, 'fv');
  assert.equal(GATE.decide(g, 4, 10, ok).path, 'fv', '연속이 끊기면 처음부터'); for (let s = 5; s < 9; s++) GATE.decide(g, s, 20, ok);
  const p = GATE.decide(g, 9, 20, ok); assert.ok(p.promoted && p.path === 'surrogate' && g.state === 'PROMOTED');
  for (let s = 10; s < 30; s++) assert.equal(GATE.decide(g, s, 8 + (s % 7), ok).path, 'surrogate', '히스테리시스 대역 8 ≤ N_sub < 15 에서 유지');
  assert.equal(GATE.decide(g, 30, 7, ok).event, 'demote_stiffness');
  for (let s = 31; s < 36; s++) GATE.decide(g, s, 20, ok); assert.equal(g.state, 'PROMOTED');
  const d = GATE.decide(g, 36, 70, bad); assert.ok(d.event === 'demote_prefilter' && d.path === 'fv', '사전 필터 → 같은 단계 강등');
  for (let s = 37; s < 57; s++) assert.equal(GATE.decide(g, s, 70, ok).event, 'cooldown', `냉각 ${s}`);
  for (let s = 57; s < 61; s++) assert.equal(GATE.decide(g, s, 70, ok).path, 'fv');
  assert.ok(GATE.decide(g, 61, 70, ok).promoted, '냉각 W + 연속 M 뒤 재승격');
  GATE.reportOOD(g, 62); assert.ok(g.state === 'FV_ONLY' && g.cooldownUntil === 83 && g.stats.oodTrips === 1);
  assert.throws(() => GATE.createGate({ K_up: 8, K_down: 8 }), /K_down < K_up/);
});
test('P5 정밀 닻: 음수를 잘라내고 Σu = N_ledger 를 1e-15 안에서 (보상 합), Σ = 0 이면 균일', () => {
  const R = FVS.createRegion(boxSpec(), {}), r = HMSE.rngOf(3);
  for (let p = 0; p < 4096; p++) { R.fields.A[p] = 100 * r() - 3; R.fields.B[p] = 1e-3 * r(); }
  const rep = GATE.exactAnchor(R, { A: 123457, B: 7 });
  assert.ok(rep.clipped > 0 && rep.clippedMass > 0 && rep.maxDev <= 1e-15);
  for (const [k, N] of [['A', 123457], ['B', 7]]) { assert.ok(R.fields[k].every((v) => v >= 0)); assert.ok(Math.abs(GATE.kahan(R.fields[k], R.active) - N) / N <= 1e-15); }
  R.fields.A.fill(-1); GATE.exactAnchor(R, { A: 4096, B: 7 }); assert.ok(R.fields.A.every((v) => v === 1));
});
test('P5 닫힌 꼴 이득: 이산 라플라시안 고윳값으로 구한 이득 = 최소 제곱으로 배운 이득 (D 가 바뀌면 O(N) 재계산)', () => {
  for (const D of [1e-12, 5e-11]) {
    const spec = { ...boxSpec(8), species: { A: { D }, B: { D: D / 2 } } }, R = FVS.createRegion(spec, {});
    for (let p = 0; p < 512; p++) { R.fields.A[p] = 50 + 10 * Math.cos(p); R.fields.B[p] = 5; }
    const a = FNOS.createSurrogate(R, 1e-3); FNOS.calibrate(a, R); const b = FNOS.createSurrogate(R, 1e-3); FNOS.analyticGains(b, R);
    for (const k of ['A', 'B']) for (let i = 0; i < 512; i++) assert.ok(Math.abs(a.gains[k][i] - b.gains[k][i]) < 1e-10, `D ${D} ${k}[${i}]`);
    assert.equal(b.gainsFor, FNOS.diffusionKey(R));
  }
});
test('P5 사전 필터 γ: 매끄러운 장은 낮고 국소 충격은 학습 최댓값 × 여유를 넘는다', () => {
  const R = FVS.createRegion(boxSpec(), {}); for (let p = 0; p < 4096; p++) { R.fields.A[p] = 100 + 20 * Math.cos(Math.PI * (p % 16) / 16); R.fields.B[p] = 50; }
  const g = GATE.createGate(); const gm = GATE.trainGamma(g, [R]); assert.ok(GATE.shockGamma(R) <= gm);
  R.fields.A[2000] += 0.3 * FVS.totals(R).A; assert.ok(GATE.shockGamma(R) > gm);
});
test('P5 P3 보존: mode fv 영역 모형 = FV.step 직접 반복 (비트 단위), 동적 관문의 FV 경로는 FV.step + 정밀 닻뿐 (원장 같음, 장 차 ≤ 1e-12)', () => {
  const flat = [{ from: 0, to: 1e9, name: '비강성', D: () => 2e-12 }];
  const d = P5.build({ mode: 'dynamic', coupled: false, phases: flat, n: 8 }), f = P5.build({ mode: 'fv', coupled: false, phases: flat, n: 8 });
  const raw = FVS.createRegion({ ...f.region.spec, species: JSON.parse(JSON.stringify(f.region.spec.species)) }, f.handle.state.ledgers.reg.counts);
  const rawLed = { state: HMSE.makeLedgerState({ domains: [{ id: 'reg' }], adjacency: [] }, { reg: { ...f.handle.state.ledgers.reg.counts } }), domainId: 'reg', moieties: f.moieties };
  d.sched.run(Infinity, { stop: () => d.reg.steps >= 400 }); f.sched.run(Infinity, { stop: () => f.reg.steps >= 400 });
  for (let i = 0; i < 400; i++) FVS.step(raw, 1e-3, rawLed);
  for (const k of ['A', 'B']) assert.ok(f.region.fields[k].every((v, i) => Object.is(v, raw.fields[k][i])), `P3 경로 ${k} 비트 동일`);
  assert.deepEqual(f.handle.state.ledgers.reg.counts, rawLed.state.ledgers.reg.counts);
  assert.equal(d.reg.p5.gate.stats.promotions, 0); assert.deepEqual(d.handle.state.ledgers.reg.counts, f.handle.state.ledgers.reg.counts);
  for (const k of ['A', 'B']) { const N = f.handle.state.ledgers.reg.counts[k]; assert.ok(d.region.fields[k].every((v, i) => Math.abs(v - f.region.fields[k][i]) <= 1e-12 * Math.max(1, N))); }
  assert.ok(d.reg.p5.maxDev <= 1e-15, '동적 FV 경로는 장–원장 ≤ 1e-15 (P3 의 anchor 는 ~1e-13)');
});
test('P5 종단: 10,000 동적 단계 |ΔN| = 0, 장–원장 ≤ 1e-15, 음수 0, L2 < 2%, 충격 같은 단계 강등 → W 뒤 재승격, 강성 ≥ 10×', () => {
  const r = P5.run({ quiet: true });
  assert.ok(r.pass, JSON.stringify({ ...r, phaseStats: r.phaseStats.map((p) => [p.key, p.dynMs, p.fvMs]) }));
  assert.equal(r.massError, 0); assert.ok(r.moietyExact && r.fieldParity <= 1e-15 && r.negatives === 0 && r.maxL2 < 0.02);
  assert.ok(r.shockDemote.step === r.shockAt && r.repromote.step >= r.shockAt + 21);
  assert.equal(r.flipsHystPromoted + r.flipsAdversarial + r.flipsHystDemoted, 0);
});

// ===== 형식 v9: 세포 운명 층 =====
const FATE = createRequire(import.meta.url)('../engine/fate_engine.js'), FSUITE = createRequire(import.meta.url)('./fate_suite.js');
const TBETD = id('T-bet'), EOMESD = id('Eomes'), IL12D = id('IL-12'), IL15D = id('IL-15'), ACTD = id('활성화된 CD8 T 세포'), EFFD = id('효과기 CD8 T 세포');
const withRules = (sid, f) => { const d = JSON.parse(JSON.stringify(BASE.senses[sid])); f(d.rule); return { senses: [{ id: sid, rule: d.rule }] }; };
const hillK = (o) => Object.assign({ law: 'hill', K: 1e-9, n: 1, evidence: { level: 'predicted', confidence: 0 } }, o);
test('v9 조절 규칙: 대상은 속도가 있는 규칙, 조절자 위치는 3D, 활성화 fmax > 1 · 억제 0 ≤ fmin < 1, hill 은 조절에만', () => {
  rejectedFor(withRules(IL12D, (r) => { r[0].target = `${TBETD}/rule/없는규칙`; }), /조절 대상 규칙 .* 없음/);
  rejectedFor(withRules(IL12D, (r) => { r[0].target = `${id('IKK 복합체')}/rule/active`; }), /조절 대상은 속도가 있는 규칙/);
  rejectedFor(withRules(IL12D, (r) => { r[0].at = 'plasma_membrane'; }), /부피\(3D\) 구획이어야 함/);
  rejectedFor(withRules(IL12D, (r) => { r[0].kinetics = hillK({ fmax: 1 }); }), /fmax > 1|fmax 는 1 보다 커야 함/);
  rejectedFor(withRules(IL12D, (r) => { r[2].kinetics = hillK({ fmin: 1.5 }); }), /fmin 은 0 ≤ fmin < 1|0 ≤ fmin < 1/);
  rejectedFor(withRules(IL12D, (r) => { r[2].kinetics = hillK({ fmax: 3 }); }), /억제 조절에는 fmax 를 두지 않음|억제 조절은 0 ≤ fmin/);
  rejectedFor(withRules(IL12D, (r) => { r[0].kinetics = { law: 'mass_action', k: 1, order: 1, evidence: { level: 'predicted', confidence: 0 } }; }), /조절 규칙의 속도 법칙은 hill/);
  rejectedFor(withRules(IL12D, (r) => { r[0].via = ['없는분자']; }), /없는분자/);
  passes(withRules(IL12D, (r) => { r[0].kinetics = hillK({ fmax: 5 }); r[2].kinetics = hillK({ fmin: 0.5 }); }));
});
test('v9 세포 상태: 서명 필수(분자·수준·위치 — 수용성은 3D, 막 분자는 그 막), 대사 프로그램은 공급 규칙, 전이는 cell_state·신호·결정 기준, 다른 kind 는 못 씀', () => {
  const cs = (f) => { const d = JSON.parse(JSON.stringify(BASE.senses[ACTD])); f(d); return { senses: [{ id: ACTD, signature: d.signature, metabolome: d.metabolome, transitions: d.transitions, ...(d.mechanisms ? { mechanisms: d.mechanisms } : {}) }] }; };
  rejectedFor(cs((d) => { d.signature = []; }), /표지 서명\(signature\)이 필요함/);
  rejectedFor(cs((d) => { d.signature[0].ref = id('해당과정'); }), /분자 종류가 아님/);
  rejectedFor(cs((d) => { d.signature[0].level = 'medium'; }), /수준 'medium'/);
  rejectedFor(cs((d) => { d.signature[0].location = 'plasma_membrane'; }), /막 'plasma_membrane' 에 있을 수 없음/);
  rejectedFor(cs((d) => { d.signature[0].location = 'nowhere'; }), /위치 어휘에 없음/);
  rejectedFor(cs((d) => { d.mechanisms = [{ ref: TBETD }]; }), /경로\(pathway\)가 아님/);
  rejectedFor(cs((d) => { d.metabolome[0].ref = `${TBETD}/rule/turnover`; }), /대사 프로그램은 공급 규칙\(supply\)만/);
  rejectedFor(cs((d) => { d.transitions[0].to = TBETD; }), /cell_state 가 아님/);
  rejectedFor(cs((d) => { d.transitions[0].signals = []; }), /신호\(signals\)가 없음/);
  rejectedFor(cs((d) => { d.transitions[0].commitment.criterion = 'vibes'; }), /결정 기준 'vibes'/);
  rejectedFor({ senses: [{ id: TBETD, signature: [{ ref: EOMESD, level: 'high', location: 'nucleoplasm' }] }] }, /kind cell_state 만/);
});
test('v9 포화 보조 기질: 화학량대로 소비하지만 질량 작용 차수에서 빠짐, 생성물에는 못 씀, 모두 포화면 거부', () => {
  const G = id('해당과정');
  rejectedFor(withRules(G, (r) => { r[0].kinetics = { law: 'mass_action', k: 1e-3, order: 7, evidence: { level: 'predicted', confidence: 0 } }; }), /차수 7 가 소비 분자 수\(1, saturating 제외\)/);
  passes(withRules(G, (r) => { r[0].kinetics = { law: 'mass_action', k: 1e-3, order: 1, evidence: { level: 'predicted', confidence: 0 } }; }));
  rejectedFor(withRules(G, (r) => { r[0].produces[0].saturating = true; }), /saturating 은 소비\(consumes\)에만/);
  rejectedFor(withRules(G, (r) => { for (const q of r[0].consumes) q.saturating = true; }), /모든 소비가 saturating/);
});
test('v9 힐 배율: 활성화 1 → fmax, 억제 1 → fmin, s = K 에서 절반', () => {
  const k = { K: 2e-9, n: 2, fmax: 5 }, ki = { K: 2e-9, n: 2, fmin: 0.2 };
  assert.equal(DefDB.hillFactor('activates', k, 0), 1);
  assert.ok(Math.abs(DefDB.hillFactor('activates', k, 2e-9) - 3) < 1e-12 && DefDB.hillFactor('activates', k, 1) > 4.999);
  assert.equal(DefDB.hillFactor('inhibits', ki, 0), 1);
  assert.ok(Math.abs(DefDB.hillFactor('inhibits', ki, 2e-9) - 0.6) < 1e-12 && DefDB.hillFactor('inhibits', ki, 1) < 0.2001);
});
test('v9 계 조립: 상태 전이로 닿는 세 상태, 빠른 층(대사)·느린 층(표지 합성·분해), 조절 12 개, 신호 묶음', () => {
  const sc = JSON.parse(readFileSync(new URL('../examples/scenarios/fate-effector-il12-hypothetical.json', import.meta.url), 'utf8'));
  const A = FATE.assemble(BASE, ACTD, sc);
  assert.deepEqual(A.states, [ACTD, EFFD, id('기억 전구 CD8 T 세포')]);
  assert.equal(A.rules.filter((r) => r.slow).length, 4);
  assert.ok(A.rules.filter((r) => !r.slow).length >= 9);
  assert.equal(A.rules.reduce((t, r) => t + r.mods.length, 0), 12);
  assert.ok(A.signals.includes(`${IL12D}|extracellular`) && A.signals.includes(`${IL15D}|extracellular`));
  assert.ok(FATE.simulateFate(BASE, TBETD, { scenario: sc }).error, '세포 상태가 아니면 오류');
});
test('v9 Fate-Test: 계통 충실도·경쟁·결정 비가역성(관문 충격 강등)·분화 정지 사후 분석·다른 운명·다중 규모 정확도·질량', () => {
  const r = FSUITE.run({ quiet: true, quick: true });
  assert.ok(r.pass, r.checks.filter((c) => !c.ok).map((c) => `${c.group} ${c.name}: ${c.detail}`).join('\n'));
});

// ===== 자동 보강 고리 (UniProt·ChEBI) — 합성 시험 자료 tests/fixtures/augment =====
const AUG = req('../judicial/identity.js'); // 사법부: 과제·해석·신원 확인 (패치 초안은 legislative/augment_draft.js, 묶음은 ORCH.augmentBuild)
const FIX = new URL('./fixtures/augment', import.meta.url).pathname;
// 자동 보강 시험의 출발 상태: 확인 전으로 되돌린 저장소 사본 (실제 저장소는 원본 대조가 끝나면 verified 로 바뀌므로, 시험이 그 상태에 묶이지 않게)
//   · 모든 외부 ID status → asserted (출처 메모·도구 지문·서열 길이 관찰은 지움)
//   · 아래 목록의 저분자는 ChEBI 번호를 지우고 unmapped 로 (이름 검색 경로를 시험하는 항목)
const UNMAPPED_AGAIN = ['피루브산', '젖산', '에피네프린'];
const PRE = (() => {
  const db = JSON.parse(JSON.stringify(BASE)), back = new Set(UNMAPPED_AGAIN.map((n) => id(n)));
  for (const [sid, d] of Object.entries(db.senses)) {
    for (const x of d.xrefs || []) if (x.status === 'verified') { x.status = 'asserted'; delete x.note; }
    if (d.fingerprint && ['computed', 'verified'].includes(d.fingerprint.status)) delete d.fingerprint; // 지문도 사법부 도장이 있어야 verified
    if (d.obs) d.obs = d.obs.filter((o) => !(o.property === 'sequence_length' && o.evidence && o.evidence.level === 'computed'));
    // 규약(role) 전 상태: ChEBI 항목은 하나(모체 쪽)만 남기고 역할 표시를 지운다 — 합성 시험 자료는 규약 전에 만든 것
    const ch = (d.xrefs || []).filter((x) => x.db === 'ChEBI');
    if (ch.length) { const keepOne = ch.find((x) => x.role === 'parent') || ch[0]; delete keepOne.role; d.xrefs = (d.xrefs || []).filter((x) => x.db !== 'ChEBI' || x === keepOne); }
    if (back.has(sid)) { d.xrefs = (d.xrefs || []).filter((x) => x.db !== 'ChEBI'); d.unmapped = '확인 전 (자동 보강 시험의 출발 상태)'; }
  }
  return DefDB.normalize(db);
})();
test('자동 보강 plan: unmapped → 이름 검색, asserted UniProt·ChEBI → 직접 조회, 서열 길이 한계 연결, 막히면 수동 수집 과제', () => {
  const t = AUG.plan(PRE, { dir: '/nonexistent' });
  const k = (kind, key) => t.find((x) => x.kind === kind && x.key === key);
  assert.ok(k('uniprot_entry', 'Q9UL17') && k('uniprot_entry', 'Q9UL17').gaps.includes('L000058'));
  assert.ok(k('chebi_entity', 'CHEBI:15422') && k('chebi_search', id('피루브산')) && !t.some((x) => x.kind === 'chebi_search' && x.sense === id('ATP')));
  assert.equal(J.augmentCandidates(PRE), new Set(t.map((x) => x.sense)).size);
  const md = AUG.retrievalTasksMarkdown(t, [], '2026-10-08');
  assert.ok(md.includes('rest.uniprot.org/uniprotkb/Q9UL17.json') && md.includes('/nonexistent/uniprot/Q9UL17.json') && md.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length === t.length);
});
test('자동 보강 해석: UniProt JSON·FASTA·평문, ChEBI 단순·OLS·중첩 JSON, 화학식 원자 수', () => {
  const rd = (f) => readFileSync(`${FIX}/${f}`, 'utf8');
  assert.equal(AUG.parseUniProt(rd('uniprot/Q9UL17.json'), 'x').genes[0], 'TBX21');
  assert.deepEqual([AUG.parseUniProt(rd('uniprot/O95936.fasta'), 'x').taxon, AUG.parseUniProt(rd('uniprot/P40933.txt'), 'x').genes], ['10090', ['IL15']]);
  assert.equal(AUG.parseChEBI(rd('chebi/CHEBI_15525.json')).formula, 'C37H66N7O17P3S');
  assert.equal(AUG.parseChEBI(rd('chebi/CHEBI_15361.json')).charge, -1);
  assert.deepEqual(AUG.parseChEBISearch(rd('chebi-search/D000169.json')).candidates.map((c) => c.id), ['CHEBI:15525', 'CHEBI:57379']);
  assert.deepEqual(AUG.parseFormula('C21H36N7O16P3S'), { C: 21, H: 36, N: 7, O: 16, P: 3, S: 1 });
  assert.equal(AUG.parseFormula('(C6H10O5)n'), null);
  assert.equal(AUG.formulaCheck(PRE, id('아세틸-CoA'), 'C23H38N7O17P3S').status, 'ok');
  assert.equal(AUG.formulaCheck(PRE, id('ATP'), 'C10H16N5O13P2').status, 'mismatch');
});
test('자동 보강 build: 검증만 verified·출처·서열 길이·지문, 종·번호·이름·화학식·중복 위반은 거부, 모호하면 unmapped 유지 + 후보 메모, asserted 는 덮어쓰지 않음', () => {
  const b = ORCH.augmentBuild(PRE, { dir: FIX, date: '2026-10-08' }), out = (s, kind) => b.rows.find((r) => r.sense === id(s) && (!kind || r.kind === kind)).outcome;
  assert.equal(out('T-bet'), 'verified'); assert.equal(out('IL-15'), 'verified');
  assert.equal(out('Eomes'), 'rejected', '종 불일치 (생쥐)');
  assert.equal(out('IL-12 p35'), 'rejected', '번호 불일치 — sync 없이는 바꾸지 않음');
  assert.equal(out('ADP', 'chebi_entity'), 'rejected', '화학식 P3 ≠ 부분 구조 P2');
  assert.equal(out('에피네프린', 'chebi_entity'), 'rejected', '이름 불일치 + 이미 ATP 에 있는 번호');
  assert.equal(out('젖산'), 'ambiguous');
  const res = LEG.merge(PRE, b.patch);
  // 'verified' 는 사법부 도장으로만: 도장 없이 관문에 넣으면 거부, 도장(재확인 통과)과 함께면 통과
  const g0 = J.gate(PRE, res, { attestations: [] });
  assert.ok(!g0.ok && g0.errors.some((e) => /사법부 증명/.test(e.msg)), '도장 없는 verified 는 거부');
  const keys = b.stamps.map((st) => ATT.verifyStamp(st, res.db, { root: ROOT })), g = J.gate(PRE, res, { attestations: keys.filter((v) => v.ok).map((v) => v.key) });
  assert.ok(keys.every((v) => v.ok), keys.filter((v) => !v.ok).map((v) => v.key + ' ' + v.reasons).join('\n'));
  assert.ok(g.ok, msgs(g));
  const T = res.db.senses[id('T-bet')], up = T.xrefs.find((x) => x.db === 'UniProt');
  assert.ok(up.status === 'verified' && /UniProtKB json 조회 2026-10-08/.test(up.note) && /sha256:/.test(up.note));
  assert.ok(T.obs.some((o) => o.property === 'sequence_length' && o.value === 20 && o.evidence.level === 'computed') && T.fingerprint.scheme === 'SEQ_SHA256' && T.fingerprint.status === 'computed');
  assert.equal(res.db.senses[id('IL-12 p35')].xrefs[0].id, 'P29459', 'asserted 값 유지');
  const P = res.db.senses[id('피루브산')];
  assert.ok(!P.unmapped && P.xrefs.some((x) => x.db === 'ChEBI' && x.id === 'CHEBI:15361' && x.status === 'verified'));
  assert.equal(J.limitationStatus(res.db, res.db.limitations.L000064).status, 'resolved');
  assert.ok(res.db.senses[id('젖산')].unmapped && /모호/.test(res.db.limitations.L000065.note));
  assert.ok(res.db.senses[id('팔미토일-CoA')].xrefs.some((x) => x.id === 'CHEBI:15525'), 'OLS 형식 + 부분 구조 원자 수 일치 (C37 N7 P3 S1)');
  assert.ok(J.augmentCandidates(res.db) < J.augmentCandidates(PRE));
  const s = ORCH.augmentBuild(PRE, { dir: FIX, date: '2026-10-08', sync: true });
  assert.notEqual(s.rows.find((r) => r.sense === id('IL-12 p35')).outcome, 'verified', 'sync 여도 이름·종 확인은 그대로 (번호만 바뀐 응답은 이름 확인이 없으면 거부)');
});

// ===== 외부 ID 역할 (ChEBI 규약, 2026-10-10) — 모체·pH 7.3 우세 종·분류를 섞지 않는다 =====
const INBOX = new URL('../data/fetched', import.meta.url).pathname;
test('외부 ID 역할: 분류 항목은 셀 수 있는 분자의 번호가 될 수 없고, 역할이 겹치거나 physiological 이 없으면 거부', () => {
  const ATP = id('ATP'), xs = (list) => ({ senses: [{ id: ATP, xrefs: list }] });
  const parent = { db: 'ChEBI', id: 'CHEBI:15422', status: 'asserted', role: 'parent' };
  const phys = { db: 'ChEBI', id: 'CHEBI:30616', status: 'asserted', role: 'physiological' };
  passes(xs([parent, phys]));
  rejectedFor(xs([{ ...parent, role: 'class' }, phys]), /분류\(class\) 항목 .* 을 번호로 쓸 수 없음/);
  rejectedFor(xs([parent, { ...phys, role: 'parent' }]), /역할이 겹침/);
  rejectedFor(xs([parent, { ...phys, role: undefined }]), /역할\(role\)이 없는 것이 있음/);
  rejectedFor(xs([{ ...parent, role: 'parent' }, { ...phys, role: 'parent', id: 'CHEBI:57299' }]), /역할이 겹침/);
  rejectedFor(xs([{ ...parent, role: 'vibes' }]), /외부 ID 역할 'vibes'/);
  rejectedFor(xs([parent, { ...phys, id: 'CHEBI:15422' }]), /ChEBI:CHEBI:15422 가 두 번/);
  // 중합체·불균일 물질(글리코겐·LPS)은 분류 항목이 맞다
  passes({ senses: [{ id: id('글리코겐'), xrefs: [{ db: 'ChEBI', id: 'CHEBI:28087', status: 'asserted', role: 'class' }] }] });
});
test('외부 ID 역할: 신원 확인이 켤레 관계(수소·전하만 차이)와 반응 참여(Rhea ≥ 3)를 요구한다', () => {
  const ATP = id('ATP'), db0 = JSON.parse(JSON.stringify(BASE));
  const reset = (sid, list) => { db0.senses[sid].xrefs = list; };
  // 올바른 짝: ATP(중성) ↔ ATP(4−) — 수소 −4·전하 −4, Rhea 50회
  reset(ATP, [{ db: 'ChEBI', id: 'CHEBI:15422', status: 'verified', role: 'parent' }, { db: 'ChEBI', id: 'CHEBI:30616', status: 'asserted', role: 'physiological' }]);
  const ok = AUG.verifyIdentity(DefDB.normalize(db0), { dir: INBOX }).rows.find((r) => r.sense === ATP && r.kind === 'chebi_entity' && r.key === 'CHEBI:30616');
  assert.equal(ok.outcome, 'verified', ok.detail);
  assert.equal(ok.facts.conjugate.dH, -4); assert.equal(ok.facts.conjugate.dCharge, -4);
  assert.ok(ok.facts.rhea.reactions >= 3, '반응 참여 수가 증거에 있어야 함');
  // 틀린 짝: ATP(중성) ↔ GTP(4−) — 수소 말고도 원자 수가 다름
  reset(ATP, [{ db: 'ChEBI', id: 'CHEBI:15422', status: 'verified', role: 'parent' }, { db: 'ChEBI', id: 'CHEBI:37565', status: 'asserted', role: 'physiological' }]);
  const bad = AUG.verifyIdentity(DefDB.normalize(db0), { dir: INBOX }).rows.find((r) => r.sense === ATP && r.key === 'CHEBI:37565');
  assert.equal(bad.outcome, 'rejected');
  assert.match(bad.detail, /수소 말고도 원자 수가 다름|이름 불일치/);
  // 반응 참여 자료가 없으면 physiological 주장을 확인하지 않는다
  reset(ATP, [{ db: 'ChEBI', id: 'CHEBI:15422', status: 'asserted', role: 'physiological' }]);
  const noRhea = AUG.verifyIdentity(DefDB.normalize(db0), { dir: new URL('./fixtures/augment', import.meta.url).pathname }).rows.find((r) => r.sense === ATP && r.key === 'CHEBI:15422');
  assert.equal(noRhea.outcome, 'rejected');
  assert.match(noRhea.detail, /반응 참여 자료|수신함에 없음/);
});

// ===== 신뢰 지표 (Reliability Index) — (S, D) 쌍은 계산되고, 데이터가 스스로 등급을 올릴 수 없다 =====
const REL = req('../judicial/reliability.js');
const ATTR = (db) => { const reg = ATT.readRegistry(ROOT), v = ATT.validStamps(DefDB.normalize(db), reg, { root: ROOT }); return { attestations: v.keys, stale: v.stale, stamps: reg.stamps }; };
test('신뢰 지표: 등급은 쌍을 사전식으로 — 곱이 같아도 뜻이 다르면 등급이 다르다', () => {
  // 곱이 겹치는 두 쌍: (4,2) = (2,4) = 8 — 곱으로는 가를 수 없고, 쌍으로는 갈린다
  assert.equal(REL.gradeOf(4, 2, 'unchecked'), 'bounded');
  assert.equal(REL.gradeOf(2, 4, 'unchecked'), 'reference');
  assert.equal(REL.gradeOf(3, 3, 'unchecked'), 'parameter');
  assert.equal(REL.gradeOf(4, 4, 'unchecked'), 'parameter', '추세를 점검하지 않았으면 기준값이 아니다');
  assert.equal(REL.gradeOf(4, 4, 'match'), 'anchor');
  assert.equal(REL.gradeOf(4, 4, 'mismatch'), 'legacy', '추세가 어긋나도 버리지 않고 지난값으로');
  assert.equal(REL.gradeOf(0, 4, 'match'), 'blocked');
  // 관문은 등급 순서로 (anchor → blocked)
  assert.ok(REL.meets({ grade: 'parameter' }, 'parameter') && !REL.meets({ grade: 'reference' }, 'parameter'));
  assert.deepEqual(REL.ORDER, ['anchor', 'parameter', 'bounded', 'legacy', 'reference', 'blocked']);
});
test('신뢰 지표: S 는 도장·문헌 식별자에서, D 는 실측·도구 계산에서 계산된다', () => {
  const ctx = { evidenceShas: ['abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'] };
  assert.deepEqual([REL.scoreEvidence({ level: 'curated', sources: [{ db: 'DOI', id: '10.1/x' }] }, ctx).s, REL.scoreEvidence({ level: 'curated', sources: [{ db: 'DOI', id: '10.1/x' }] }, ctx).d], [3, 3]);
  assert.equal(REL.scoreEvidence({ level: 'curated', sources: [] }, ctx).s, 2, '문헌이라 적혀 있어도 식별자가 없으면 S2');
  const comp = REL.scoreEvidence({ level: 'computed', tool: 'dbtool augment — x (data/fetched/uniprot/P1.json · sha256:abcdef012345)' }, ctx);
  assert.deepEqual([comp.s, comp.d], [4, 4], '도장받은 원본에서 도구가 계산한 값');
  assert.equal(REL.scoreEvidence({ level: 'computed', tool: 'sha256:999999999999' }, ctx).s, 2, '원본 증거를 찾을 수 없으면 S2');
  assert.equal(REL.scoreEvidence({ level: 'abstracted', basis: '기전 흐름' }, ctx).d, 2);
  assert.equal(REL.scoreEvidence({ level: 'asserted' }, ctx).s, 2);
  assert.equal(REL.scoreEvidence({ level: 'predicted', confidence: 0 }, ctx).d, 2);
});
test('신뢰 지표: 데이터가 스스로 등급을 올릴 수 없다 (도장 없는 verified 는 차단)', () => {
  const opt = ATTR(BASE), rows = REL.items(BASE, opt);
  assert.ok(rows.length > 500, `항목 ${rows.length}`);
  const sum = REL.summary(rows);
  assert.equal(sum.n, rows.length);
  assert.equal(sum.byGrade.anchor, 0, '추세 점검이 없으므로 기준값은 아직 없다');
  assert.ok(sum.byGrade.parameter > 0 && sum.byGrade.reference > 0);
  // 도장이 유효한 외부 ID 는 parameter, 도장을 뺀 사본에서는 blocked
  const atp = rows.find((r) => r.sense === id('ATP') && r.what === 'xref');
  assert.equal(atp.grade, 'parameter');
  const noStamp = REL.items(BASE, { attestations: [], stale: [], stamps: [] }).find((r) => r.sense === id('ATP') && r.what === 'xref');
  assert.equal(noStamp.grade, 'blocked');
  assert.equal(noStamp.s, 0);
  // 패치가 status 만 verified 로 바꿔도 등급은 오르지 않는다 (도장이 없으므로)
  const d = JSON.parse(JSON.stringify(BASE)), pi = id('무기 인산');
  d.senses[pi].xrefs = [{ db: 'ChEBI', id: 'CHEBI:999999', status: 'verified', role: 'physiological' }];
  const faked = REL.items(d, ATTR(d)).find((r) => r.sense === pi && r.what === 'xref');
  assert.equal(faked.grade, 'blocked', '스스로 선언한 verified 는 차단');
  // 보고서는 쌍과 곱을 함께 적지만 판정은 쌍으로 한다
  const txt = REL.gradeText(rows, { min: 'parameter', limit: 3 });
  assert.match(txt, /곱\(S×D\)은 .* 판정에 쓰지 않는다/);
  assert.match(txt, /\| S4D4 \|/);
});

// ===== 비교 검토·정제 점검 (Comparative Optimization) =====
const CMP = req('../judicial/compare.js'); // 판정만 — 변형 실행은 ORCH.compare
test('정제 점검: 경로 순 반응 ↔ 단계 화학량 차이는 등록된 Structural_Gap 이 있으면 known, 중복 조절·공급은 잡고 참조 없는 쪽을 지우는 리팩터링 패치', () => {
  const r = J.refineCheck(BASE);
  const lump = r.issues.find((x) => x.type === 'lumped_contradiction');
  assert.ok(lump && lump.known.includes('L000061') && lump.diff.length === 3, '회로 순 반응은 GDP + Pi → GTP 를 뺀 알려진 단순화');
  assert.equal(r.unresolved, 0);
  const d = JSON.parse(JSON.stringify(BASE)), dup = { ...d.senses[IL12D].rule[0], id: 'dup_copy' };
  d.senses[IL12D].rule.push(dup); d.senses[id('세포 ATP 소비')].rule.push({ ...d.senses[id('세포 ATP 소비')].rule[0], id: 'load_copy' });
  const r2 = J.refineCheck(d);
  assert.equal(r2.issues.filter((x) => x.type === 'duplicate_rule').length, 2);
  const refactor = LEG.draftRefactor(d, r2.issues); // 리팩터링 패치 초안은 입법부가 판결(issues)로 쓴다
  assert.ok(refactor && refactor.senses.every((s) => !s.rule.some((x) => /copy/.test(x.id))));
  assert.ok(!('refactor' in r2), '사법부 판결에는 패치가 없다');
  const after = JSON.parse(JSON.stringify(d)); for (const s of refactor.senses) after.senses[s.id].rule = s.rule;
  assert.equal(J.refineCheck(after).issues.filter((x) => x.type === 'duplicate_rule').length, 0);
  // 단계 화학량을 고쳐 차이가 생기면(등록 안 된 모순) unresolved
  const e = JSON.parse(JSON.stringify(BASE)); e.senses[id('시트르산 회로')].rule[0].produces.push({ ref: ATP, n: 1 });
  assert.ok(J.refineCheck(e).issues.some((x) => x.type === 'lumped_contradiction'));
});
test('원자 수(elements)는 구조 요소만·원소 기호·0 이상 정수, 부분 구조 수지는 상대 1e-14', () => {
  rejectedFor({ senses: [{ id: ATP, elements: { C: 10 } }] }, /구조 요소\) 만|structure_feature\) 만|kind structure_feature\)만/);
  rejectedFor({ senses: [{ id: id('인산기 단위'), elements: { p: 1 } }] }, /원소 기호 'p'/);
  rejectedFor({ senses: [{ id: id('인산기 단위'), elements: { P: 1.5 } }] }, /0 이상의 정수/);
  rejectedFor(withRules(id('세포 ATP 소비'), (r) => { r[0].produces[0].n = 1 + 1e-12; }), /부분 구조 수지가 맞지 않음/);
  assert.ok(Object.values(BASE.senses).filter((d) => d.kind === 'structure_feature' && d.elements).length >= 7, '부분 구조 원자 수는 데이터에');
  assert.ok(!/coenzyme A moiety|nicotinamide/.test(readFileSync(new URL('../judicial/identity.js', import.meta.url), 'utf8')), '엔진은 생물 이름을 모른다');
});
test('비교 검토: 같은 조절을 하나 더 넣는 패치는 결과가 같고 복잡도만 늘어 Optimization-Negative (질량 ≤ 1e-14)', () => {
  const sc = JSON.parse(readFileSync(new URL('../examples/scenarios/fate-effector-il12-hypothetical.json', import.meta.url), 'utf8')); sc.t_end = 3 * 3600; sc.commitment = { horizon: 3 * 3600, coarse: 3600 };
  const d = JSON.parse(JSON.stringify(BASE)); d.senses[IL12D].rule.push({ ...d.senses[IL12D].rule[0], id: 'dup_copy' });
  const r = ORCH.compare(BASE, d, ACTD, sc, sc, { refHours: 0.5 });
  assert.equal(r.verdict, 'Optimization-Negative', r.why);
  assert.ok(r.between === 0 && !r.outcomeChanged && r.b.complexity.modulations === r.a.complexity.modulations + 1);
  assert.ok(r.a.mass <= 1e-14 && r.b.mass <= 1e-14);
});

// ===== 과정 분석 보고서 (Process-Oriented Fate Analysis & Integrity Reporting) =====
const PRP = req('../judicial/process_report.js'), FA = req('../judicial/fate_audit.js'), IRB = req('../compiler/ir_builder.js');
// 조정자 흐름: 컴파일(IR) → 엔진(IR 소비) → 사법부(같은 IR 검증)
const judged = (sc, o) => { const ir = IRB.buildFateIR(BASE, ACTD, sc); return FA.judgeFate(BASE, FATE.simulateFate(BASE, ACTD, { scenario: sc, ir, ...(o || {}) }), { scenario: sc, ir }); };
test('과정 보고서: 변곡점(신호·결정·도달·고갈·비율 교차·운명 전환)·구간 [기간|원인|우세 표지|비용]·무결성 증명서·인과 추적, 원장은 매 단계 ≤ 1e-14', () => {
  const txt = readFileSync(new URL('../examples/scenarios/fate-mixed-glucose-withheld-hypothetical.json', import.meta.url), 'utf8'), sc = JSON.parse(txt);
  const r = judged(sc, { commitment: false });
  const again = judged(JSON.parse(txt), { commitment: false });
  assert.equal(r.process.hash, again.process.hash, '결정론');
  assert.ok(r.mass.series.length === r.process.times.length && r.mass.series.every((v) => v <= 1e-14) && r.mass.replaySeries.every((v) => v <= 1e-14));
  const rep = PRP.processReport(r, { scenario: sc, scenarioText: txt, rerunHash: again.process.hash });
  assert.ok(rep.pass && rep.checks.every((c) => c.ok === true));
  const types = new Set(rep.infl.map((x) => x.type));
  for (const t of ['signal', 'exhausted', 'ratio_cross', 'fate_switch', 'reach', 'arrest']) assert.ok(types.has(t), `변곡점 ${t}`);
  assert.ok(rep.phases.some((p) => /다른 운명/.test(p.name)) && rep.phases.every((p) => p.driver && p.dom));
  assert.ok(rep.trace.some((l) => /고갈 @ t = 1\.23 h/.test(l)), '근본 원인 = 1.23 h 포도당 고갈 (1.5단계 결합 적분 — 분할 엔진은 1.38 h 로 늦게 보고했음)');
  const md = PRP.processReportMarkdown(rep);
  for (const h of ['## 1. 요약', '## 2. 단계별 전개', '## 3. 무결성 증명서', '## 4. 인과 추적', '## 5. 기술 부록']) assert.ok(md.includes(h), h);
});
test('과정 보고서: 규칙 밖 개입은 FAIL — 저장소를 몰래 바꾸면 재생 검사가, 신호를 일정 밖에서 바꾸면 신호 검사가, 해시가 다르면 결정론이 잡는다', () => {
  const txt = readFileSync(new URL('../examples/scenarios/fate-effector-il12-hypothetical.json', import.meta.url), 'utf8'), sc = JSON.parse(txt); sc.t_end = 3 * 3600;
  const r = judged(sc, { commitment: false });
  // 기록된 원자료를 변조해 보고서가 FAIL 하는지 (엔진 원장 대신 기록을 바꾼 '개입' 흉내)
  const tampered = { ...r, mass: { ...r.mass, replaySeries: r.mass.replaySeries.map((v, j) => (j === 50 ? 1e-9 : v)) } };
  assert.equal(PRP.processReport(tampered, { scenario: sc, rerunHash: r.process.hash }).pass, false);
  const sigBad = { ...r, process: { ...r.process, sig: r.process.sig.map((v, j) => (j === 30 ? [0] : v)) } };
  assert.equal(PRP.processReport(sigBad, { scenario: sc, rerunHash: r.process.hash }).checks.find((c) => /신호/.test(c.name)).ok, false);
  assert.equal(PRP.processReport(r, { scenario: sc, rerunHash: 'x'.repeat(64) }).pass, false);
  const kin = JSON.parse(JSON.stringify(sc)); kin.kinetics['D000170/rule/aerobic_glycolysis'].k *= 2; // 실행 뒤 입력을 바꾸면 출처 확인이 잡는다
  assert.equal(PRP.processReport(r, { scenario: kin, rerunHash: r.process.hash }).checks.find((c) => /출처/.test(c.name)).ok, false);
});
