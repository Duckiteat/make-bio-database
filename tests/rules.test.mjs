// 매핑·검사 규칙 테스트 (형식 v4): 규칙이 느슨해지면 여기서 실패한다.   실행: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const IX = DefDB.index(BASE);
const id = (ref) => { const r = DefDB.resolveRef(IX, ref); if (r.error) throw new Error(r.error); return r.id; };
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 8 }, o);
const run = (patch, opt) => { const res = DefDB.merge(BASE, P(patch)); return { res, g: DefDB.gate(BASE, res, opt) }; };
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
const probe = (f) => { const d = JSON.parse(JSON.stringify(BASE)); f(d); return DefDB.validate(DefDB.normalize(d)); };
const failsWith = (f, re) => {
  const r = probe(f);
  assert.ok(r.errors.some((e) => re.test(e.msg)), `기대한 오류(${re})가 없음:\n` + r.errors.map((e) => `${e.where}: ${e.msg}`).join('\n'));
};
const GP = id('글리코겐 인산화효소'), PKA = id('PKA'), PHK = id('인산화효소 키네이스'), REC = id('β-아드레날린 수용체'), AC = id('adenylyl cyclase');
const CAMP = id('cAMP'), ATP = id('ATP'), EPI = id('에피네프린');
const stepOf = (db, ruleRef) => Object.values(db.steps).find((s) => s.rule === ruleRef);

test('현재 저장소는 오류·경고 없음', () => {
  const r = DefDB.validate(BASE);
  assert.deepEqual([r.errors, r.warnings], [[], []]);
});
test('예시 패치는 관문을 통과', () => {
  const patch = JSON.parse(readFileSync(new URL('../examples/pgm-isomerization.json', import.meta.url), 'utf8'));
  const res = DefDB.merge(BASE, patch), g = DefDB.gate(BASE, res);
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
  const res2 = DefDB.merge(res.db, P({ steps: [st] }));
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
  const r = DefDB.validate(DefDB.normalize({ ...JSON.parse(JSON.stringify(BASE)), version: 3 }));
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
  const res2 = DefDB.merge(res.db, P(one('다른 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: fp })));
  assert.ok(DefDB.validate(res2.db).errors.some((e) => /구조 지문/.test(e.msg)));
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
  assert.equal(DefDB.limitationStatus(BASE, BASE.limitations[L1]).status, 'open');
  const cn = (location) => [{ property: 'copy_number', value: 1000, unit: 'copies/cell', context: { species: '9606', cell: 'hepatocyte', location }, evidence: { level: 'predicted', confidence: 0.1 } }];
  const res = passes({ senses: [{ id: REC, obs: cn('plasma_membrane') }, { id: PKA, obs: cn('cytosol') }, { id: GP, obs: cn('cytosol') }] });
  assert.equal(DefDB.limitationStatus(res.db, res.db.limitations[L1]).status, 'resolved');
  assert.equal(DefDB.simulate(res.db, '에피네프린에 의한 글리코겐 분해', {}).origin[`${GP}|cytosol`], 1000, '관찰이 시작량이 됨');
  const R = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${id('TAK1')}/site/act`);
  const res2 = passes({ senses: [{ id: id('TAK1'), site: { act: { type: 'modification_site', features: ['phosphorylated'], numbering: { 9606: 'Thr187' } } } },
    { id: id('TAK1 복합체'), site: { tak1_act: { type: 'modification_site', features: ['phosphorylated'], on: id('TAK1'), numbering: { 9606: 'Thr187' } } } }] });
  assert.equal(DefDB.limitationStatus(res2.db, res2.db.limitations[R]).status, 'resolved', '잔기 번호가 들어오면 Structural_Gap 해결');
});
test('limitations.md 는 data/db.json 에서 생성된 최신 상태여야 함', () => {
  assert.equal(readFileSync(new URL('../limitations.md', import.meta.url), 'utf8'), DefDB.limitationsMarkdown(BASE));
  assert.deepEqual(DefDB.detectGaps(BASE), [], '잔기 모름 부위는 모두 등록되어 있어야 함');
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
  rejectedFor({ senses: [withKin(TNFG, 'kb_binding', { law: 'hill', evidence: pred })] }, /반응 속도 법칙 'hill'/);
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
  assert.equal(DefDB.limitationStatus(BASE, BASE.limitations[L4]).status, 'open');
  const res = passes({ senses: [withKin(TNFG, 'kb_binding', { law: 'binding', Kd: 1e-9, k_on: 1e7, evidence: pred })] });
  assert.equal(DefDB.limitationStatus(res.db, res.db.limitations[L4]).status, 'resolved');
});
test('반응 중심 구조(R2): PDB 만, 정의항 xrefs 에도 같은 구조가 있어야 함 — 3FXI 는 LPS 주머니에', () => {
  assert.equal(BASE.senses[RCX].site.lps_pocket.structure.id, '3FXI');
  failsWith((d) => { d.senses[RCX].xrefs = []; }, /해상도 일관성: 부위의 구조 3FXI/);
  failsWith((d) => { d.senses[RCX].site.tir.structure = { db: 'PDB', id: 'XYZ' }; }, /PDB ID 여야/);
});
test('혼합 해상도 계획: LPS 경로는 3차원 0단계, 글리코겐 경로는 cAMP 경쟁(T3) 두 단계만 R2 — 속도 상수가 들어오면 R1 로 해결', () => {
  const lps = DefDB.resolutionPlan(BASE, TLRP), gly = DefDB.resolutionPlan(BASE, '에피네프린에 의한 글리코겐 분해');
  assert.equal(lps.rows.filter((r) => r.need === 2).length, 0);
  assert.ok(lps.rows.find((r) => r.sid === sid(NFKB, 'nuclear_import')).need === 0, '수송은 R0(위상)');
  assert.deepEqual(gly.rows.filter((r) => r.need === 2).map((r) => r.sid).sort(), [sid(PKAR, 'camp_release'), sid(PDE, 'camp_hydrolysis')].sort());
  assert.ok(gly.rows.some((r) => !r.ok));
  const res = passes({ senses: [withKin(PKAR, 'camp_release', { law: 'mass_action', k: 1e20, order: 5, evidence: pred }), withKin(PDE, 'camp_hydrolysis', { law: 'michaelis_menten', kcat: 5, Km: 1e-6, evidence: pred })] });
  assert.ok(DefDB.resolutionPlan(res.db, '에피네프린에 의한 글리코겐 분해').rows.every((r) => r.ok), '속도 상수로 T3 해결');
});
test('속도 기반 시뮬레이션(가상 시나리오): TNF mRNA 에 시간 순서대로 도달, 질량 보존 위반 없음', () => {
  const r = DefDB.simulateRate(BASE, TLRP, { scenario: scenario('lps-hypothetical.json'), t_end: 60, dt: 0.01 });
  const t = (b) => r.firstReach[b];
  const mrna = Object.keys(r.firstReach).find((b) => b.startsWith(TNFM + '|'));
  assert.ok(mrna && t(mrna) > 0, 'TNF mRNA 도달');
  assert.ok(t(`${NFKB}|nucleoplasm`) < t(mrna) && t(`${NFKB}|cytosol`) < t(`${NFKB}|nucleoplasm`), '세포질 → 핵 → 전사 순서');
  assert.ok(r.hypothetical);
  assert.deepEqual(r.audit.filter((a) => a.code === 'AUDIT_MASS'), []);
  assert.ok(r.audit.some((a) => a.code === 'AUDIT_KINETIC_GAP'));
});
test('감사: 잘못된 속도 법칙·Kd 불일치를 잡고, 이중 계산(Gs)은 한계 등록부의 교정 제안으로 연결', () => {
  const a = DefDB.auditRun(BASE, '에피네프린에 의한 글리코겐 분해', { scenario: scenario('camp-competition-hypothetical.json'), t_end: 10, dt: 0.01 });
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
  DefDB.simulateRate; // 리간드 실체: Gs[GTP] 는 GTP 하나를, Gs[GDP] 는 GDP 하나를 품는다 (질량 감사의 셈)
  const r = DefDB.simulateRate(BASE, GLY, { scenario: scenario('gtp-exhaustion-hypothetical.json'), t_end: 0.05, dt: 0.01 });
  assert.ok(!r.audit.some((a) => a.code === 'AUDIT_MASS' && /Gs 자체 비활성화/.test(a.where)), 'GTP → GDP 리간드 교체는 화학 변환으로 셈');
});
test('기질 고갈(Substrate Exhaustion): 공급이 없으면 GTP 가 바닥나고 Gs 활성화가 멈춘다 — 무너지지 않음', () => {
  const r = DefDB.simulateRate(BASE, GLY, { scenario: scenario('gtp-exhaustion-hypothetical.json'), t_end: 5, dt: 0.01 });
  assert.equal(r.mode, 'finite');
  assert.ok(r.events.some((e) => e.type === 'exhausted' && e.bundle === `${GTP}|cytosol`), 'GTP 고갈 사건');
  assert.ok(r.stalls[sid(REC, 'gs_gef')], 'Gs 활성화 단계가 멈춤으로 기록');
  assert.ok(finiteOK(r), '모든 양이 유한하고 음수가 아님');
  assert.equal(r.reservoirs[`${GTP}|cytosol`].class, 'consumed_only');
  assert.ok(r.audit.some((a) => a.code === 'AUDIT_RESOURCE' && a.where === `${GTP}|cytosol` && /L0000\d\d/.test(a.suggestion)), '재생 경로 없음 → 공급 규칙 한계를 교정 제안');
  assert.ok(!r.audit.some((a) => a.code === 'AUDIT_MASS' && /부분 구조/.test(a.msg)), '부분 구조 수지 위반 없음');
});
test('순환 재생(Cycle-driven Regeneration): NDPK·ATP 재생 공급이 GTP–GDP 순환과 ATP 순환을 닫는다', () => {
  const ex = DefDB.simulateRate(BASE, GLY, { scenario: scenario('gtp-exhaustion-hypothetical.json'), t_end: 5, dt: 0.01 });
  const rg = DefDB.simulateRate(BASE, GLY, { scenario: scenario('gtp-regeneration-hypothetical.json'), t_end: 5, dt: 0.01 });
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
  const r = DefDB.simulateRate(DefDB.normalize(d), GLY, { scenario: scenario('gtp-regeneration-hypothetical.json'), t_end: 1, dt: 0.01 });
  const a = r.audit.find((x) => x.code === 'AUDIT_MASS' && x.where.startsWith(s5) && /부분 구조 수지 위반/.test(x.msg));
  assert.ok(a && /t=0\.\d+ s 첫 발화/.test(a.msg) && /인산기 단위 -2/.test(a.msg), '단계·시각·부분 구조를 짚음');
});
test('분해(결정론·확률적): 1차 원장, 재활용 화학량을 모르면 소실로 처리하고 한계를 제안, seed 가 같으면 같은 결과', () => {
  const sc = scenario('lps-hypothetical.json'), m = `${TNFM2}|nucleoplasm`;
  const det = DefDB.simulateRate(BASE, TLRP, { scenario: sc, t_end: 20, dt: 0.01 });
  assert.ok(det.ledger[m].degradation < 0 && det.ledger[`${id('뉴클레오타이드')}|nucleoplasm`].recycle === 0);
  const gap = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === TNFM2 && BASE.limitations[k].type === 'Structural_Gap');
  assert.ok(det.audit.some((a) => a.code === 'AUDIT_RESOURCE' && /서열 길이/.test(a.msg) && a.suggestion.includes(gap)));
  const s1 = DefDB.simulateRate(BASE, TLRP, { scenario: sc, t_end: 20, dt: 0.01, stochastic: true, seed: 7 });
  const s2 = DefDB.simulateRate(BASE, TLRP, { scenario: sc, t_end: 20, dt: 0.01, stochastic: true, seed: 7 });
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
  const rr = DefDB.simulateRate(db, TLRP, { scenario: { ...scenario('lps-hypothetical.json'), amounts: { ...scenario('lps-hypothetical.json').amounts } }, t_end: 1, dt: 0.01 });
  // 경로에 유리 IκBα 묶음이 없으면 규칙은 적용되지 않는다 (묶음 단위로만 분해)
  assert.ok(!rr.degradations.some((g) => g.bundle === ikb));
  assert.ok(DefDB.limitationStatus(db, db.limitations[Object.keys(db.limitations).find((k) => db.limitations[k].target === `${IKBA1}/rule/basal_turnover`)]).status === 'resolved', 'k 가 들어오면 half_life 를 요구한 한계도 닫힘 (k ↔ ln2/t½)');
});
test('무한 풀 방식(v6 동작)도 그대로: 저장소 감사 없음, 교환 원장으로 질량 수지', () => {
  const r = DefDB.simulateRate(BASE, TLRP, { scenario: scenario('lps-hypothetical.json'), t_end: 10, dt: 0.01, reservoirs: 'infinite' });
  assert.equal(r.mode, 'infinite');
  assert.ok(!r.audit.some((a) => (a.code === 'AUDIT_RESOURCE' && /재생 경로/.test(a.msg)) || a.code === 'AUDIT_MASS'));
  assert.ok(Object.keys(r.firstReach).some((b) => b.startsWith(TNFM2 + '|')));
  assert.ok(DefDB.simulateRate(BASE, TLRP, { reservoirs: 'bogus' }).error);
});
test('한계 후보 탐지: 속도 없는 공급·분해 규칙과 서열 길이 없는 재활용이 등록되지 않으면 후보로', () => {
  assert.deepEqual(DefDB.detectGaps(BASE), []);
  const d = JSON.parse(JSON.stringify(BASE));
  for (const [k, l] of Object.entries(d.limitations)) if (/atp_supply|^D000101$/.test(l.target) || l.target === TNFM2) delete d.limitations[k];
  for (const s of Object.values(d.senses)) for (const a of s.addresses || []) if (!d.limitations[a.limitation]) s.addresses = s.addresses.filter((x) => d.limitations[x.limitation]);
  const c = DefDB.detectGaps(d);
  assert.ok(c.some((x) => x.target === `${ATPREGEN}/rule/atp_supply` && x.type === 'Kinetic_Gap'));
  assert.ok(c.some((x) => x.target === TNFM2 && x.type === 'Structural_Gap'));
});

// ===== Patch Report (Scope · Why · Impact · Verification) =====
test('Patch Report: 바뀐 필드·하류 규칙·단계·경로·한계 상태 변화를 계산한다', () => {
  const patch = P({ why: '시험: AC 고리화 속도 상수', senses: [withKin(AC, 'cyclization', { law: 'michaelis_menten', kcat: 1, Km: 1e-4, evidence: { level: 'predicted', confidence: 0 } })] });
  const res = DefDB.merge(BASE, patch), g = DefDB.gate(BASE, res), rep = DefDB.patchReport(BASE, res, patch, g);
  assert.equal(rep.why, '시험: AC 고리화 속도 상수');
  assert.deepEqual(rep.scope.updated.senses, [AC]);
  assert.deepEqual(rep.scope.fields[AC], ['rule']);
  assert.ok(rep.impact.steps.includes(sid(AC, 'cyclization')) && rep.impact.steps.includes(sid(id('Gs 단백질'), 'ac_activation')), '소유 규칙의 단계와 AC 묶음을 쓰는 단계');
  assert.ok(rep.impact.pathways.includes(id('에피네프린에 의한 글리코겐 분해')));
  assert.ok(rep.impact.rules.includes(`${id('Gs 단백질')}/rule/ac_activation`), 'AC 를 대상으로 하는 다른 정의항의 규칙');
  assert.equal(rep.verification.gate, 'pass');
  assert.ok(/\| Why \| 시험/.test(DefDB.patchReportText(rep, DefDB.index(res.db))));
  // 한계를 닫는 데이터 → 상태 변화가 보고되고 limitations.md 재생성이 요구됨
  const lid = Object.keys(BASE.limitations).find((k) => BASE.limitations[k].target === `${ATPREGEN}/rule/atp_supply`);
  const p2 = P({ why: '시험', senses: [{ id: ATPREGEN, rule: BASE.senses[ATPREGEN].rule.map((r) => ({ ...r, kinetics: { law: 'mass_action', k: 1, order: 2, evidence: { level: 'predicted', confidence: 0 } } })) }] });
  const r2 = DefDB.merge(BASE, p2), rep2 = DefDB.patchReport(BASE, r2, p2, DefDB.gate(BASE, r2));
  assert.ok(rep2.impact.limitation_status_changed.some((l) => l.id === lid && l.before === 'open' && l.after === 'resolved'));
  assert.ok(rep2.impact.regenerate.includes('limitations.md'));
  assert.equal(DefDB.patchReport(BASE, r2, { senses: [] }, null).why, '', 'why 가 없으면 빈 값 (dbtool merge 가 거부)');
});
test('Identity_Gap: unmapped 외부 ID 는 한계로 등록되어야 하고, 확인된 ID 가 들어오면 닫힌다', () => {
  const d = JSON.parse(JSON.stringify(BASE)), pi = id('무기 인산');
  const lid = Object.keys(d.limitations).find((k) => d.limitations[k].target === pi && d.limitations[k].type === 'Identity_Gap');
  assert.ok(lid);
  delete d.limitations[lid];
  assert.ok(DefDB.detectGaps(d).some((x) => x.target === pi && x.type === 'Identity_Gap'));
  const e = JSON.parse(JSON.stringify(BASE));
  e.senses[pi].xrefs.push({ db: 'ChEBI', id: 'CHEBI:1', status: 'asserted' });
  assert.equal(DefDB.limitationStatus(DefDB.normalize(e), DefDB.normalize(e).limitations[lid]).status, 'resolved');
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
  const r = DefDB.simulateRate(BASE, TCA, { scenario: scenario('tca-acetylcoa-exhaustion-hypothetical.json'), t_end: 60, dt: 0.01 });
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
  const r = DefDB.simulateRate(BASE, TCA, { scenario: scenario('tca-nad-exhaustion-hypothetical.json'), t_end: 60, dt: 0.01 }), pm = r.postMortem;
  assert.ok(pm.cause === 'exhaustion' && pm.limiting.bundle === mx(NADP));
  assert.equal(pm.cycles[0].completed, 1000);
  assert.ok(pm.limiting.starved.length === 3, 'NAD⁺ 를 쓰는 세 탈수소효소가 굶음');
  assert.ok(Math.abs(r.final[mx(NADH)] - 3002) < 1e-6 && Math.abs(pm.waste.find((w) => w.bundle === mx(CO2)).accumulated - 2002) < 1e-6, '부분 바퀴: IDH·KGDH 가 한 번 더');
});
test('소진 시험 3: 기질이 남아도 CO₂ 축적이 가역 IDH 를 평형에 묶어 정지 — 병목과 역/정 비를 보고', () => {
  const r = DefDB.simulateRate(BASE, TCA, { scenario: scenario('tca-co2-equilibrium-hypothetical.json'), t_end: 3600, dt: 0.005 }), pm = r.postMortem;
  assert.ok(!r.audit.some((a) => /Δt .* 너무 큼/.test(a.msg)), '수렴하는 Δt');
  const coarse = DefDB.simulateRate(BASE, TCA, { scenario: scenario('tca-co2-equilibrium-hypothetical.json'), t_end: 300, dt: 0.1 });
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
  const r = DefDB.simulateRate(BASE, TCA, { scenario: sc, t_end: 5, dt: 0.01 });
  assert.ok(r.postMortem.alive && r.postMortem.cycles[0].completed > 1000);
  const slow = scenario('tca-co2-equilibrium-hypothetical.json');
  for (const k of Object.keys(slow.kinetics)) if (slow.kinetics[k].k) slow.kinetics[k].k /= 1e6;
  assert.ok(DefDB.simulateRate(BASE, TCA, { scenario: slow, t_end: 30, dt: 0.05 }).postMortem.alive, '한 바퀴도 못 돈 시동 단계는 정지가 아님');
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
  const r = DefDB.simulateRate(BASE, TCA, { scenario: sc, t_end: 0.1, dt: 0.005 }), x = r.react.get(Object.keys(BASE.steps).find((k) => BASE.steps[k].rule === `${IDH}/rule/oxdecarb`));
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
  const lb = DefDB.thermoLoops(bad, pth).loops, lg = DefDB.thermoLoops(good, pth).loops;
  assert.ok(lb.length === 1 && lb[0].closed && !lb[0].ok && lb[0].sum === -6000);
  assert.ok(lg[0].ok);
  assert.ok(DefDB.auditRun(bad, pth, { t_end: 0.01, dt: 0.01 }).some((a) => a.code === 'AUDIT_THERMO'));
  assert.ok(!DefDB.auditRun(good, pth, { t_end: 0.01, dt: 0.01 }).some((a) => a.code === 'AUDIT_THERMO'));
  assert.ok(DefDB.thermoLoops(BASE, TCA).loops.every((l) => !l.closed), '시트르산 회로는 열린 고리(아세틸-CoA 가 몰아감) — Wegscheider 대상 아님');
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
