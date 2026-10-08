// 매핑·검사 규칙 테스트 (형식 v4): 규칙이 느슨해지면 여기서 실패한다.   실행: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const IX = DefDB.index(BASE);
const id = (ref) => { const r = DefDB.resolveRef(IX, ref); if (r.error) throw new Error(r.error); return r.id; };
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 4 }, o);
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
  const { res, g } = run(one('아데닐산고리화효소', { kind: 'molecule_class' }));
  assert.ok(res.report.mapped.some((m) => m.to === BASE.senses[AC].term));
  assert.equal(g.ok, false);
  assert.ok(g.errors.some((e) => /distinction/.test(e.msg)));
});
test('영문 이름·그리스 문자 표기 차이도 같은 개념', () => {
  const { res } = run(one('glycogen phosphorylase', { kind: 'molecule_class', distinction: '테스트' }));
  assert.ok(res.report.mapped.some((m) => m.to === BASE.senses[GP].term));
  assert.equal(id('beta-아드레날린 수용체'), REC);
});
test('뜻이 여러 개인 이름으로 연결하면 거부, "이름#n" 은 통과', () => {
  rejectedFor(one('테스트', { kind: 'molecule_class', desc: desc('효소 관련', { links: [{ to: '효소', rel: 'is_a', span: '효소' }] }) }), /뜻이 여러 개/);
  const res = passes(one('테스트', { kind: 'molecule_class', desc: desc('효소 관련', { links: [{ to: '효소#2', rel: 'is_a', span: '효소' }] }) }));
  assert.equal(findText(res.db, '효소 관련').desc[0].links[0].to, id('효소#2'));
});
test('외부 ID 로 연결하면 정의항 번호로 매핑', () => {
  const res = passes(one('테스트 부류', { kind: 'molecule_class', desc: desc('ATP 관련', { links: [{ to: 'CHEBI:15422', rel: 'refers', span: 'ATP' }] }) }));
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
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'curated' } }) }), /출처\(source\)/);
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'computed' } }) }), /도구\(tool\)/);
  rejectedFor(one('테스트', { desc: desc('t', { evidence: { level: 'predicted', confidence: 2 } }) }), /confidence/);
  passes(one('테스트', { desc: desc('t', { evidence: { level: 'curated', source: { db: 'PMID', id: '12345' } } }) }));
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
