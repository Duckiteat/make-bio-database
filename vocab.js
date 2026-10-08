// 통제 어휘 (controlled vocabulary) — 데이터베이스에 들어갈 수 있는 값의 목록과 규칙.
//
// 데이터(data/db.json)는 AI가 채우지만, 이 파일은 사람이 검토하고 바꾼다.
// AI 패치는 여기 없는 값을 쓸 수 없다. 별칭(aliases)으로 들어온 값은 병합 때 표준 키로 바뀐다.
// 값을 추가·변경하면 SCHEMA.md 의 변경 기록에도 적는다.
(function (root, v) {
  if (typeof module === 'object' && module.exports) module.exports = v;
  else root.DefDBVocab = v;
})(typeof self !== 'undefined' ? self : this, {
  version: 1,

  // ===== 정의항 종류 =====
  // participant: 기전 단계의 참여자(행위자·입력·출력·조절자)가 될 수 있는가. 상태(states)도 이 종류만 가질 수 있다.
  // xref.required: 이 종류면 반드시 있어야 하는 외부 ID (모르면 unmapped 에 사유를 적어야 함)
  // xref.allowed : 붙일 수 있는 외부 ID 종류
  kinds: {
    protein:        { label: '단백질 (특정 유전자 산물)', aliases: ['단백질 분자'], participant: true, xref: { required: ['UniProt'], allowed: ['UniProt', 'PDB', 'EC', 'NCBIGene'] } },
    complex:        { label: '복합체', aliases: ['단백질 복합체', 'protein complex'], participant: true, xref: { allowed: ['GO', 'PDB', 'EC'] } },
    nucleic_acid:   { label: '핵산 분자·구간', aliases: ['핵산', 'gene', '유전자'], participant: true, xref: { allowed: ['NCBIGene', 'ChEBI'] } },
    small_molecule: { label: '저분자', aliases: ['소분자', 'small molecule', 'metabolite', '대사물'], participant: true, xref: { required: ['ChEBI'], allowed: ['ChEBI', 'PubChem'] } },
    macromolecule:  { label: '고분자 물질 (다당류 등)', aliases: ['polymer', '고분자'], participant: true, xref: { required: ['ChEBI'], allowed: ['ChEBI'] } },
    ion:            { label: '이온', aliases: [], participant: true, xref: { required: ['ChEBI'], allowed: ['ChEBI'] } },
    molecule_class: { label: '분자 부류 (효소 계열, 단백질 군 등)', aliases: ['class', 'family', '부류', '계열'], participant: true, xref: { allowed: ['ChEBI', 'EC', 'GO'] } },
    pathway:        { label: '경로·기전 (단계를 묶는 개념)', aliases: ['경로', '기전', 'mechanism'], participant: false, xref: { allowed: ['GO', 'Reactome', 'KEGG'] } },
    process:        { label: '과정·반응 유형', aliases: ['과정', 'reaction type'], participant: false, xref: { allowed: ['GO'] } },
    structure_feature: { label: '구조 요소 (부위·도메인)', aliases: ['부위', 'domain', 'site', '도메인'], participant: false, xref: { allowed: ['InterPro', 'PDB'] } },
    principle:      { label: '원리', aliases: ['법칙', 'principle'], participant: false, xref: { allowed: [] } },
    concept:        { label: '일반 개념', aliases: ['개념'], participant: false, xref: { allowed: [] } },
  },

  // ===== 관계의 종류 제약 (원천 정의항 kind → 대상 정의항으로 허용되는 kind) =====
  // '=' 은 원천과 같은 kind. has_kind/has_part/has_instance 는 방향을 뒤집어 같은 표로 검사한다.
  // requires / contrasts / refers 는 제약 없음.
  relationRules: {
    is_a: {
      protein: ['molecule_class', '='], complex: ['molecule_class', '='], nucleic_acid: ['molecule_class', '='],
      small_molecule: ['molecule_class', '='], macromolecule: ['molecule_class', '='], ion: ['molecule_class', '='],
      molecule_class: ['molecule_class'],
      pathway: ['pathway', 'process'], process: ['process', 'concept'],
      structure_feature: ['structure_feature', 'concept'], principle: ['principle', 'concept'], concept: ['concept'],
    },
    part_of: {
      protein: ['@molecular'], complex: ['@molecular'], nucleic_acid: ['@molecular'], small_molecule: ['@molecular'],
      macromolecule: ['@molecular'], ion: ['@molecular'], molecule_class: ['@molecular'],
      structure_feature: ['@molecular', 'structure_feature'],
      pathway: ['pathway'], process: ['process', 'pathway'], principle: ['principle'], concept: ['concept'],
    },
    instance_of: '@is_a',
  },
  groups: { molecular: ['protein', 'complex', 'nucleic_acid', 'small_molecule', 'macromolecule', 'ion', 'molecule_class'] },

  // ===== 정의가 성립하는 분야 =====
  fields: {
    '화학':        { aliases: ['일반화학', 'chemistry'] },
    '물리학':      { aliases: ['물리', 'physics'] },
    '생화학':      { aliases: ['biochemistry'] },
    '분자생물학':  { aliases: ['molecular biology'] },
    '세포생물학':  { aliases: ['cell biology'] },
    '생리학':      { aliases: ['physiology'] },
    '유전학':      { aliases: ['고전 유전학', 'genetics'] },
    '구조생물학':  { aliases: ['structural biology'] },
    '생명과학 교육': { aliases: ['고등학교 생명과학', '교과', '교과서'] },
  },

  // ===== 세포 내 위치 (기전 단계) =====
  compartments: {
    '세포 밖':     { aliases: ['세포외', 'extracellular', '혈액'] },
    '세포막':      { aliases: ['원형질막', 'plasma membrane', '세포막 안쪽', '세포막 바깥쪽'] },
    '세포질':      { aliases: ['cytoplasm', 'cytosol', '세포질 기질'] },
    '핵':          { aliases: ['nucleus'] },
    '미토콘드리아': { aliases: ['mitochondria', '미토콘드리아 기질', '미토콘드리아 내막'] },
    '소포체':      { aliases: ['ER', 'endoplasmic reticulum'] },
    '골지체':      { aliases: ['Golgi'] },
    '리소좀':      { aliases: ['lysosome'] },
    '엽록체':      { aliases: ['chloroplast'] },
  },

  // ===== 변화 종류 (기전 단계의 action) =====
  actions: {
    '결합':         { aliases: ['binding', '결합(활성화)', '결합(알로스테릭 활성화)', '알로스테릭 결합'] },
    '해리':         { aliases: ['dissociation', '분리'] },
    '인산화':       { aliases: ['phosphorylation'] },
    '탈인산화':     { aliases: ['dephosphorylation'] },
    '가수분해':     { aliases: ['hydrolysis', 'GTP 가수분해', 'ATP 가수분해'] },
    '가인산분해':   { aliases: ['phosphorolysis'] },
    '고리화':       { aliases: ['cyclization'] },
    '뉴클레오타이드 교환': { aliases: ['GDP-GTP 교환', 'nucleotide exchange', 'GEF 작용'] },
    '단백질 절단':  { aliases: ['proteolysis', '절단', '단백질 분해'] },
    '산화':         { aliases: ['oxidation'] },
    '환원':         { aliases: ['reduction'] },
    '이성질화':     { aliases: ['isomerization'] },
    '기 전이':      { aliases: ['group transfer', '전이'] },
    '수송':         { aliases: ['transport', '이동'] },
    '구조 변화':    { aliases: ['conformational change', '형태 변화'] },
  },

  // ===== 상태 =====
  activity: {
    active:   { label: '활성', aliases: ['활성형', 'on'] },
    inactive: { label: '비활성', aliases: ['비활성형', 'off'] },
    partial:  { label: '부분 활성', aliases: ['덜 활성', '약한 활성'] },
    unknown:  { label: '미상', aliases: ['모름'] },
  },
  modifications: {
    phosphorylation:     { label: '인산화', aliases: ['phospho', 'P'] },
    acetylation:         { label: '아세틸화', aliases: [] },
    methylation:         { label: '메틸화', aliases: [] },
    ubiquitination:      { label: '유비퀴틴화', aliases: [] },
    glycosylation:       { label: '당화', aliases: ['글리코실화'] },
    lipidation:          { label: '지질화', aliases: [] },
    proteolytic_cleavage: { label: '절단', aliases: ['단백질 절단'] },
  },
  // 잔기 표기: 세 글자 아미노산 약어 + 번호 (예: Ser14)
  residuePattern: '^(Ala|Arg|Asn|Asp|Cys|Gln|Glu|Gly|His|Ile|Leu|Lys|Met|Phe|Pro|Ser|Thr|Trp|Tyr|Val)[0-9]+$',
  stateKeyPattern: '^[A-Za-z0-9가-힣_-]+$',

  // 조절 효과
  effects: {
    activates: { label: '활성화', aliases: ['활성', '촉진', 'activation'] },
    inhibits:  { label: '억제', aliases: ['저해', 'inhibition'] },
  },

  // ===== 외부 ID =====
  // pattern 에 맞지 않으면 오류. url 은 화면에서 링크로 쓰임({id} 자리에 ID).
  xrefs: {
    UniProt:  { pattern: '^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$', url: 'https://www.uniprot.org/uniprotkb/{id}' },
    ChEBI:    { pattern: '^CHEBI:[0-9]+$', url: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId={id}' },
    PubChem:  { pattern: '^CID:[0-9]+$', url: 'https://pubchem.ncbi.nlm.nih.gov/compound/{id}' },
    PDB:      { pattern: '^[0-9][A-Za-z0-9]{3}$', url: 'https://www.rcsb.org/structure/{id}' },
    EC:       { pattern: '^EC [0-9]+\\.([0-9]+|-)\\.([0-9]+|-)\\.(n?[0-9]+|-)$', url: 'https://www.enzyme-database.org/query.php?ec={id}' },
    GO:       { pattern: '^GO:[0-9]{7}$', url: 'https://amigo.geneontology.org/amigo/term/{id}' },
    Reactome: { pattern: '^R-[A-Z]{3}-[0-9]+$', url: 'https://reactome.org/content/detail/{id}' },
    KEGG:     { pattern: '^(map|ko|hsa)[0-9]{5}$', url: 'https://www.kegg.jp/entry/{id}' },
    NCBIGene: { pattern: '^[0-9]+$', url: 'https://www.ncbi.nlm.nih.gov/gene/{id}' },
    InterPro: { pattern: '^IPR[0-9]{6}$', url: 'https://www.ebi.ac.uk/interpro/entry/InterPro/{id}' },
  },
  // asserted: 작성자(AI)가 적었지만 원본과 대조하지 않음, verified: 원본 데이터베이스와 대조함
  xrefStatus: ['asserted', 'verified'],
});
