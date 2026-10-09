#!/usr/bin/env node
// 형식 버전 3 → 4 변환: 두 해상도 구조 (2026-10-08, 1회성 — 기록용 보관). 설계는 DESIGN-v4.md.
//
//   지식 해상도(정의항 D): text·field·context·links 를 desc[0] 으로 옮기고, 막 위상·구성 요소(소단위·보조인자)·부위·규칙을 채운다.
//     - 상태(states) 는 사라지고, 같은 정보가 "부위 + 상태 의미 규칙" 으로 바뀐다 (예: 글리코겐 인산화효소 a형 = reg_phos:phosphorylated → 활성).
//     - 복합체의 소단위를 새 정의항으로 만든다: Gs(αs·β·γ), PKA(R·C), 인산화효소 키네이스(α·β·γ·δ=칼모듈린).
//       글리코겐 인산화효소의 보조인자 피리독살 인산도 새 정의항.
//     - 모르는 값은 지어내지 않는다: 잔기 번호를 모르면 residue_unknown, 외부 ID 를 모르면 unmapped.
//   시뮬레이션 해상도(단계 S): 단계는 "원천 정의항의 전이 규칙이 이 묶음들에 적용됨" 이 된다.
//     - 단계의 label·text·action 은 규칙으로 옮기고, 단계에는 규칙 참조·묶음 키·part_of 만 남는다.
//     - 위치는 단계 하나가 아니라 묶음마다 (에피네프린은 세포 밖, 수용체는 세포막, ATP 는 세포질 …).
//
// 사용: node migrations/003-v3-to-v4.mjs data/db.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v3 = JSON.parse(readFileSync(path, 'utf8'));
if (v3.version !== 3) { console.error(`버전 ${v3.version} — 3 이 아니라 변환하지 않음`); process.exit(1); }

const pad = (p, n) => p + String(n).padStart(6, '0');
const AT = '2026-10-08', BY = 'Claude';
const v4 = { format: 'definition-db', version: 4, meta: { next: { ...v3.meta.next } }, terms: structuredClone(v3.terms), senses: {}, steps: {} };

// ----- 1. 기존 정의항 → desc[0] -----
for (const [id, d] of Object.entries(v3.senses)) {
  const desc = { text: d.text, field: d.field, context: { scope: d.context }, links: d.links, examples: d.examples || [], evidence: { level: 'asserted' } };
  if (d.by) desc.by = d.by;
  if (d.at) desc.at = d.at;
  const s = { term: d.term, n: d.n, kind: d.kind, xrefs: d.xrefs || [], components: [], desc: [desc], site: {}, rule: [], obs: [] };
  if (d.unmapped) s.unmapped = d.unmapped;
  if (d.fingerprint) s.fingerprint = d.fingerprint;
  if (d.distinction) s.distinction = d.distinction;
  if (d.note) s.note = d.note;
  v4.senses[id] = s;
}
const S = (id) => { if (!v4.senses[id]) throw new Error('없음: ' + id); return v4.senses[id]; };

// 유전자#1: 특정 핵산 분자가 아니라 부류
S('D000017').kind = 'molecule_class';
// 경로의 맥락: 간세포
S('D000051').desc[0].context.cell = 'hepatocyte';

// ----- 2. 새 정의항 (소단위·보조인자) -----
const newSense = (ko, en, aliases, sense) => {
  const tid = pad('T', v4.meta.next.T++), did = pad('D', v4.meta.next.D++);
  v4.terms[tid] = { names: en ? { ko, en } : { ko }, aliases };
  v4.senses[did] = { term: tid, n: 1, xrefs: [], components: [], site: {}, rule: [], obs: [], ...sense,
    desc: sense.desc.map((x) => ({ links: [], examples: [], evidence: { level: 'asserted' }, by: BY, at: AT, ...x })) };
  return did;
};
const desc = (text, field, links, extra) => ({ text, field, context: { scope: field }, links, ...(extra || {}) });
const L = (to, rel, span) => ({ to, rel, span });
const INNER = (assoc) => ({ association: assoc, location: 'plasma_membrane', side: 'cytosolic' });

const GAS = newSense('Gαs 소단위', 'G protein alpha-s subunit', ['Gsα', 'Gαs'], {
  kind: 'protein', reference_species: '9606',
  xrefs: [{ db: 'UniProt', id: 'P63092', status: 'asserted' }],
  membrane: INNER('lipid_anchored'),
  desc: [desc('Gs 단백질의 α 소단위로, GDP 또는 GTP 를 결합하고 결합한 GTP 를 스스로 가수분해하는 단백질', '세포생물학',
    [L('D000005', 'is_a', '단백질'), L('D000029', 'refers', 'Gs 단백질'), L('D000036', 'refers', 'GDP'), L('D000035', 'refers', 'GTP')])],
  site: { nucleotide: { type: 'binding_site', features: ['GDP_bound', 'GTP_bound'], face: 'cytosolic', note: '뉴클레오타이드 결합 주머니 — 잔기 번호는 기록하지 않음' } },
  note: '지질(팔미토일기)로 세포막 안쪽 면에 고정된다. 유전자 GNAS 는 여러 전사체를 만들며, 외부 ID 는 원본 대조 전(asserted).',
});
const GB = newSense('Gβ 소단위', 'G protein beta subunit', ['Gβ'], {
  kind: 'molecule_class', membrane: INNER('peripheral'),
  desc: [desc('이형 삼량체 G 단백질의 β 소단위로, γ 소단위와 단단한 이량체를 이루는 단백질', '세포생물학',
    [L('D000028', 'refers', 'G 단백질'), L('D000005', 'is_a', '단백질')])],
  note: 'β1–β5 여러 아형이 있어 분자 부류로 둔다. γ 소단위의 지질 닻을 통해 막에 붙는다.',
});
const GG = newSense('Gγ 소단위', 'G protein gamma subunit', ['Gγ'], {
  kind: 'molecule_class', membrane: INNER('lipid_anchored'),
  desc: [desc('이형 삼량체 G 단백질의 γ 소단위로, 지질로 세포막 안쪽에 고정되어 β 소단위와 결합하는 단백질', '세포생물학',
    [L('D000028', 'refers', 'G 단백질'), L('D000005', 'is_a', '단백질')])],
  note: '여러 아형이 있어 분자 부류로 둔다. 지질 닻은 프레닐기.',
});
const PKAR = newSense('PKA 조절 소단위', 'PKA regulatory subunit', ['PKA R 소단위'], {
  kind: 'molecule_class',
  desc: [desc('단백질 키네이스 A 의 조절 소단위로, cAMP 가 없을 때 촉매 소단위에 결합해 활성을 막는 단백질', '생화학',
    [L('D000042', 'refers', '단백질 키네이스 A'), L('D000039', 'refers', 'cAMP'), L('D000005', 'is_a', '단백질')])],
  site: {
    cnb_a: { type: 'binding_site', features: ['bound'], ligand: 'D000039', note: 'cAMP 결합 도메인 A' },
    cnb_b: { type: 'binding_site', features: ['bound'], ligand: 'D000039', note: 'cAMP 결합 도메인 B' },
  },
  note: 'RIα·RIβ·RIIα·RIIβ 아형이 있어 분자 부류로 둔다. 조절 소단위 하나에 cAMP 결합 자리가 둘(A·B).',
});
const PKAC = newSense('PKA 촉매 소단위', 'PKA catalytic subunit', ['PKA C 소단위'], {
  kind: 'molecule_class',
  xrefs: [{ db: 'EC', id: 'EC 2.7.11.11', status: 'asserted' }],
  desc: [desc('단백질 키네이스 A 의 촉매 소단위로, ATP 의 인산기를 표적 단백질의 세린·트레오닌에 옮기는 효소', '생화학',
    [L('D000041', 'is_a', '단백질 키네이스'), L('D000032', 'refers', 'ATP')])],
  note: 'Cα·Cβ 아형이 있어 분자 부류로 둔다. 효소 번호(EC)는 촉매 소단위가 가진다.',
});
const PHKA = newSense('인산화효소 키네이스 α 소단위', 'phosphorylase kinase alpha subunit', [], {
  kind: 'molecule_class',
  desc: [desc('인산화효소 키네이스의 α 소단위로, 인산화되어 효소 활성을 조절하는 조절 소단위', '생화학', [L('D000043', 'refers', '인산화효소 키네이스')])],
  note: '근육형·간형 아형이 있어 분자 부류로 둔다.',
});
const PHKB = newSense('인산화효소 키네이스 β 소단위', 'phosphorylase kinase beta subunit', [], {
  kind: 'molecule_class',
  desc: [desc('인산화효소 키네이스의 β 소단위로, PKA 에 의해 인산화되어 효소를 활성화하는 조절 소단위', '생화학',
    [L('D000043', 'refers', '인산화효소 키네이스'), L('D000042', 'refers', 'PKA')])],
});
const PHKG = newSense('인산화효소 키네이스 γ 소단위', 'phosphorylase kinase gamma subunit', [], {
  kind: 'molecule_class',
  desc: [desc('인산화효소 키네이스의 γ 소단위로, 글리코겐 인산화효소를 인산화하는 촉매 소단위', '생화학',
    [L('D000043', 'refers', '인산화효소 키네이스'), L('D000044', 'refers', '글리코겐 인산화효소'), L('D000041', 'is_a', '키네이스')])],
  note: '근육형·간형(정소형) 아형이 있어 분자 부류로 둔다.',
});
const CALM = newSense('칼모듈린', 'calmodulin', ['CaM'], {
  kind: 'molecule_class',
  desc: [desc('칼슘 이온과 결합해 여러 단백질의 활성을 조절하는 작은 단백질로, 인산화효소 키네이스의 δ 소단위로도 들어 있다', '생화학',
    [L('D000005', 'is_a', '단백질'), L('D000043', 'refers', '인산화효소 키네이스')])],
  note: '사람에서는 서로 다른 세 유전자(CALM1·2·3)가 같은 단백질을 만든다 — 한 UniProt 항목으로 정하지 않고 분자 부류로 둔다. 칼슘 이온 정의항은 아직 없음.',
});
const PLP = newSense('피리독살 인산', 'pyridoxal 5\'-phosphate', ['PLP'], {
  kind: 'small_molecule',
  unmapped: 'ChEBI 번호 원본 미확인 (네트워크로 대조할 수 없어 비워 둠)',
  desc: [desc('비타민 B6 의 활성형으로, 글리코겐 인산화효소를 비롯한 여러 효소의 보조인자로 작용하는 분자', '생화학',
    [L('D000022', 'is_a', '보조인자'), L('D000044', 'refers', '글리코겐 인산화효소')])],
});
// 이름의 ' 는 정규화에서 지워지지만 예약 문자는 아니다
v4.terms[v4.senses[PLP].term].names.en = "pyridoxal 5'-phosphate";

// ----- 3. 구조·규칙 (기존 정의항) -----
const REC = 'D000030', GS = 'D000029', AC = 'D000031', PKA = 'D000042', PHK = 'D000043', GP = 'D000044', PDE = 'D000049', PP1 = 'D000052';
const EPI = 'D000027', ATP = 'D000032', ADP = 'D000033', AMP = 'D000034', GTP = 'D000035', GDP = 'D000036', PI = 'D000037', CAMP = 'D000039',
  GLC = 'D000046', GLY = 'D000047', G1P = 'D000048';
const meaning = (id, label, when, activity) => ({ id, type: 'meaning', label, when, activity, evidence: { level: 'asserted' } });
const transition = (id, label, o) => ({ id, type: 'transition', label, agent: false, regulators: [], evidence: { level: 'asserted' }, ...o });

Object.assign(S(REC), {
  membrane: { association: 'integral', location: 'plasma_membrane' },
  site: {
    ligand: { type: 'binding_site', features: ['bound'], face: 'extracellular', ligand: EPI, note: '리간드 결합 주머니 (막관통 나선 사이, 바깥쪽에서 열림)' },
    coupling: { type: 'binding_site', features: ['bound'], face: 'cytosolic', ligand: GS, note: 'G 단백질과 맞물리는 세포질 쪽 면' },
  },
  rule: [
    meaning('active', '리간드 결합 시 활성', { ligand: 'bound' }, 'active'),
    meaning('basal', '리간드 없음 — 비활성', {}, 'inactive'),
    transition('ligand_binding', '수용체 활성화', { action: '결합', effect: { type: 'modify', site: 'ligand', add: ['bound'], partner: EPI }, where: ['plasma_membrane'],
      text: '에피네프린이 β-아드레날린 수용체의 바깥쪽 결합 부위에 결합해 수용체의 구조가 바뀐다.' }),
    transition('gs_gef', 'Gs 활성화', { action: '뉴클레오타이드 교환', agent: true, via_site: 'coupling',
      effect: { type: 'modify', target: GS, site: 'nucleotide', remove: ['GDP_bound'], add: ['GTP_bound'] }, with: { consumes: [GTP], produces: [GDP] },
      text: '활성 수용체가 세포질 쪽 면에서 Gs 의 α 소단위에서 GDP 를 내보내고 GTP 가 붙게 한다. 수용체는 그대로 남아 다른 Gs 를 계속 활성화한다.' }),
  ],
});
S(REC).note = 'β1·β2·β3 아형이 있어 분자 부류로 둔다. 일곱 번 막을 관통하는 G 단백질 연결 수용체.';

Object.assign(S(GS), {
  membrane: INNER('lipid_anchored'),
  components: [{ ref: GAS, n: 1, role: 'α 소단위' }, { ref: GB, n: 1, role: 'β 소단위' }, { ref: GG, n: 1, role: 'γ 소단위' }],
  site: { nucleotide: { type: 'binding_site', features: ['GDP_bound', 'GTP_bound'], on: GAS, face: 'cytosolic', note: 'α 소단위의 뉴클레오타이드 결합 부위' } },
  rule: [
    meaning('on', 'GTP 결합 — 활성', { nucleotide: 'GTP_bound' }, 'active'),
    meaning('off', 'GDP 결합 — 비활성', { nucleotide: 'GDP_bound' }, 'inactive'),
    transition('ac_activation', '아데닐산 고리화효소 활성화', { action: '결합', agent: true, via_component: GAS,
      effect: { type: 'modify', target: AC, site: 'gs_site', add: ['bound'] },
      text: 'GTP 가 붙은 Gs α 소단위가 아데닐산 고리화효소에 결합해 활성화한다.' }),
    transition('gtpase', 'Gs 자체 비활성화', { action: '가수분해', via_component: GAS,
      effect: { type: 'modify', site: 'nucleotide', remove: ['GTP_bound'], add: ['GDP_bound'] }, with: { consumes: [], produces: [PI] },
      text: 'Gs α 소단위가 스스로 GTP 를 GDP 로 가수분해해 비활성으로 돌아간다. 신호가 저절로 꺼지는 장치.' }),
  ],
});
S(GS).note = '활성화되면 실제로는 α(GTP) 와 βγ 로 갈라지지만, 여기서는 삼량체를 한 단위로 두고 α 소단위의 뉴클레오타이드 부위만 추적한다.';

Object.assign(S(AC), {
  membrane: { association: 'integral', location: 'plasma_membrane' },
  site: {
    catalytic: { type: 'catalytic_site', features: ['bound'], face: 'cytosolic', note: '세포질 쪽 C1·C2 도메인 사이의 촉매 자리' },
    gs_site: { type: 'binding_site', features: ['bound'], face: 'cytosolic', ligand: GS, note: 'Gs α 소단위가 붙는 자리' },
  },
  rule: [
    meaning('active', 'Gsα 결합 시 활성', { gs_site: 'bound' }, 'active'),
    meaning('basal', '기본 — 비활성', {}, 'inactive'),
    transition('cyclization', 'cAMP 합성', { action: '고리화', agent: true, via_site: 'catalytic',
      effect: { type: 'convert', consumes: [ATP], produces: [CAMP] },
      text: '활성 아데닐산 고리화효소가 ATP 를 cAMP 와 피로인산으로 바꾼다(피로인산 정의항은 아직 없음). 효소 하나가 많은 cAMP 를 만들어 신호가 증폭된다.' }),
  ],
});
S(AC).note = '여러 아형(AC1–9)이 있어 분자 부류로 둔다. 막관통 도메인 두 묶음과 세포질 쪽 촉매 도메인을 가진다.';

Object.assign(S(PKA), {
  xrefs: [],
  components: [{ ref: PKAR, n: 2, role: '조절 소단위 R' }, { ref: PKAC, n: 2, role: '촉매 소단위 C' }],
  rule: [
    meaning('holo', '전효소(R2C2) — 비활성', {}, 'inactive'),
    transition('camp_release', 'PKA 활성화', { action: '해리',
      effect: { type: 'dissociate', partner: CAMP, partner_site: { component: PKAR, sites: ['cnb_a', 'cnb_b'] } },
      text: 'cAMP 가 조절 소단위마다 두 자리(A·B)에 결합하면 촉매 소단위 두 개가 떨어져 나와 활성이 된다.' }),
  ],
});
S(PKA).note = '전효소는 조절 소단위 2개 + 촉매 소단위 2개(R2C2). 효소 번호(EC 2.7.11.11)는 촉매 소단위 정의항으로 옮겼다.';
S(PKAC).rule = [
  meaning('free', '풀려난 촉매 소단위 — 활성', {}, 'active'),
  transition('phk_phos', '인산화효소 키네이스 활성화', { action: '인산화', agent: true,
    effect: { type: 'modify', target: PHK, site: 'pka_phos', add: ['phosphorylated'] }, with: { consumes: [ATP], produces: [ADP] },
    text: '풀려난 PKA 촉매 소단위가 인산화효소 키네이스의 조절 소단위를 인산화해 활성화한다.' }),
];

Object.assign(S(PHK), {
  components: [{ ref: PHKA, n: 4, role: 'α 조절 소단위' }, { ref: PHKB, n: 4, role: 'β 조절 소단위' }, { ref: PHKG, n: 4, role: 'γ 촉매 소단위' }, { ref: CALM, n: 4, role: 'δ 소단위(칼모듈린)' }],
  site: { pka_phos: { type: 'modification_site', features: ['phosphorylated'], on: PHKB, residue_unknown: true, note: 'PKA 가 인산화하는 β 소단위의 세린 — 사람 번호 미확인' } },
  rule: [
    meaning('active', 'PKA 인산화 시 활성', { pka_phos: 'phosphorylated' }, 'active'),
    meaning('basal', '비인산화 — 비활성', {}, 'inactive'),
    transition('gp_phos', '글리코겐 인산화효소 활성화', { action: '인산화', agent: true, via_component: PHKG,
      effect: { type: 'modify', target: GP, site: 'reg_phos', add: ['phosphorylated'] }, with: { consumes: [ATP], produces: [ADP] },
      text: '활성 인산화효소 키네이스(γ 촉매 소단위)가 글리코겐 인산화효소 b형을 인산화해 활성 a형으로 바꾼다.' }),
  ],
});
S(PHK).note = '(αβγδ)4 의 16량체. δ 소단위는 칼모듈린이라 칼슘 이온으로도 활성화된다(칼슘 경로는 아직 없음).';

Object.assign(S(GP), {
  site: {
    reg_phos: { type: 'modification_site', features: ['phosphorylated'], numbering: { 9606: 'Ser14' },
      note: '관례 번호(개시 메싸이오닌 제외). UniProt 서열 번호(개시 메싸이오닌 포함)로는 15번 — 원본 대조 필요' },
    amp_site: { type: 'binding_site', features: ['bound'], ligand: AMP, note: '알로스테릭 활성 부위 (근육형에서 b형도 AMP 로 활성화)' },
    catalytic: { type: 'catalytic_site', features: ['bound'], ligand: GLC, note: '촉매 자리 — 포도당이 결합하면 a형이 억제되고 탈인산화되기 쉬워진다' },
    plp: { type: 'binding_site', features: ['bound'], ligand: PLP, note: '보조인자 피리독살 인산이 라이신과 공유 결합한 자리 — 잔기 번호 미확인' },
  },
  rule: [
    meaning('a_form', 'a형(인산화) — 활성', { reg_phos: 'phosphorylated' }, 'active'),
    meaning('b_form', 'b형(비인산화) — 부분 활성', {}, 'partial'),
    transition('phosphorolysis', '글리코겐 가인산분해', { action: '가인산분해', agent: true, via_site: 'catalytic',
      effect: { type: 'convert', consumes: [GLY], produces: [G1P] }, with: { consumes: [PI], produces: [] },
      regulators: [{ ref: GLC, effect: 'inhibits', note: '간에서 포도당이 a형의 촉매 자리에 결합하면 활성이 억제되고 탈인산화되기 쉬운 구조가 된다' }],
      text: 'a형 글리코겐 인산화효소가 글리코겐 말단의 포도당 잔기를 무기 인산으로 떼어 포도당-1-인산을 만든다. 효소 자신은 변하지 않고 반복 작용한다.' }),
  ],
});
S(GP).note = "인산화된 a형이 활성형, 비인산화 b형은 덜 활성. 이름에 '인산화'가 들어가지만 단백질 키네이스가 아니라 가인산분해 효소다. 동종 이량체이며 간형·근육형·뇌형 아형이 있어 분자 부류로 둔다.";

S(PDE).rule = [
  meaning('basal', '기본 — 활성', {}, 'active'),
  transition('camp_hydrolysis', 'cAMP 분해 (신호 종료)', { action: '가수분해', agent: true, effect: { type: 'convert', consumes: [CAMP], produces: [AMP] },
    text: '포스포다이에스터레이스가 cAMP 를 AMP 로 바꿔 신호를 끈다.' }),
];
S(PP1).rule = [
  meaning('basal', '기본 — 활성', {}, 'active'),
  transition('gp_dephos', '포스포릴레이스 비활성화', { action: '탈인산화', agent: true,
    effect: { type: 'modify', target: GP, site: 'reg_phos', remove: ['phosphorylated'] }, with: { consumes: [], produces: [PI] },
    regulators: [{ ref: GLC, effect: 'activates', note: '포도당이 a형에 결합하면 PP1 이 작용하기 쉬운 구조가 된다' }],
    text: 'PP1 이 a형 글리코겐 인산화효소에서 인산기를 떼어 b형으로 되돌린다.' }),
];

// ----- 4. 단계 → 규칙 적용 + 묶음 -----
const B = (base, feats, loc) => DefDB.bundleKey({ base, features: Object.entries(feats).map(([site, feature]) => ({ site, feature })), location: loc });
const P = (b, o) => ({ b, ...(o || {}) });
const PM = 'plasma_membrane', CY = 'cytosol', EX = 'extracellular', GRAN = 'glycogen_granule';
const recOn = B(REC, { ligand: 'bound' }, PM), gsGDP = B(GS, { nucleotide: 'GDP_bound' }, PM), gsGTP = B(GS, { nucleotide: 'GTP_bound' }, PM);
const acOn = B(AC, { gs_site: 'bound' }, PM), phkOn = B(PHK, { pka_phos: 'phosphorylated' }, CY), gpA = B(GP, { reg_phos: 'phosphorylated' }, CY), gpB = B(GP, {}, CY);
const step = (rule, o) => ({ rule, agents: [], inputs: [], outputs: [], regulators: [], ...o });
const steps = {
  S000001: step(`${REC}/rule/ligand_binding`, { inputs: [P(B(EPI, {}, EX)), P(B(REC, {}, PM))], outputs: [P(recOn)], part_of: ['D000050'] }),
  S000002: step(`${REC}/rule/gs_gef`, { agents: [P(recOn)], inputs: [P(gsGDP), P(B(GTP, {}, CY), { minor: true })], outputs: [P(gsGTP), P(B(GDP, {}, CY), { minor: true })], part_of: ['D000050'] }),
  S000003: step(`${GS}/rule/ac_activation`, { agents: [P(gsGTP)], inputs: [P(B(AC, {}, PM))], outputs: [P(acOn)], part_of: ['D000050'] }),
  S000004: step(`${GS}/rule/gtpase`, { inputs: [P(gsGTP)], outputs: [P(gsGDP), P(B(PI, {}, CY), { minor: true })], part_of: ['D000050'] }),
  S000005: step(`${AC}/rule/cyclization`, { agents: [P(acOn)], inputs: [P(B(ATP, {}, CY))], outputs: [P(B(CAMP, {}, CY))], part_of: ['D000050'] }),
  S000006: step(`${PKA}/rule/camp_release`, { inputs: [P(B(PKA, {}, CY)), P(B(CAMP, {}, CY), { n: 4 })],
    outputs: [P(B(PKAR, { cnb_a: 'bound', cnb_b: 'bound' }, CY), { n: 2 }), P(B(PKAC, {}, CY), { n: 2 })], part_of: ['D000050'] }),
  S000007: step(`${PDE}/rule/camp_hydrolysis`, { agents: [P(B(PDE, {}, CY))], inputs: [P(B(CAMP, {}, CY))], outputs: [P(B(AMP, {}, CY))], part_of: ['D000050'] }),
  S000008: step(`${PKAC}/rule/phk_phos`, { agents: [P(B(PKAC, {}, CY))], inputs: [P(B(PHK, {}, CY)), P(B(ATP, {}, CY), { minor: true })], outputs: [P(phkOn), P(B(ADP, {}, CY), { minor: true })], part_of: ['D000051'] }),
  S000009: step(`${PHK}/rule/gp_phos`, { agents: [P(phkOn)], inputs: [P(gpB), P(B(ATP, {}, CY), { minor: true })], outputs: [P(gpA), P(B(ADP, {}, CY), { minor: true })], part_of: ['D000051'] }),
  S000010: step(`${GP}/rule/phosphorolysis`, { agents: [P(gpA)], inputs: [P(B(GLY, {}, GRAN)), P(B(PI, {}, CY), { minor: true })], outputs: [P(B(G1P, {}, CY)), P(B(GLY, {}, GRAN), { minor: true })],
    regulators: [P(B(GLC, {}, CY))], part_of: ['D000051'] }),
  S000011: step(`${PP1}/rule/gp_dephos`, { agents: [P(B(PP1, {}, CY))], inputs: [P(gpA)], outputs: [P(gpB), P(B(PI, {}, CY), { minor: true })], regulators: [P(B(GLC, {}, CY))], part_of: ['D000051'] }),
};
for (const id of Object.keys(v3.steps)) if (!steps[id]) throw new Error('변환 규칙 없는 단계: ' + id);
v4.steps = steps;

// ----- 5. 검사 후 저장 -----
const db = DefDB.normalize(v4);
const { errors, warnings } = createRequire(import.meta.url)('../judicial/judicial.js').validate(db) /* 검사는 사법부 (삼권 분립) */;
for (const e of errors) console.error('오류', e.where, e.msg);
for (const w of warnings) console.error('경고', w.where, w.msg);
if (errors.length) { console.error(`오류 ${errors.length}개 — 저장하지 않음`); process.exit(1); }
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`변환 완료: 개념 ${Object.keys(db.terms).length}, 정의항 ${Object.keys(db.senses).length}, 단계 ${Object.keys(db.steps).length}, 경고 ${warnings.length}`);
