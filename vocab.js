// 통제 어휘 (controlled vocabulary) — 데이터베이스에 들어갈 수 있는 값의 목록과 규칙. (형식 v4)
//
// 데이터(data/db.json)는 AI가 채우지만, 이 파일은 사람이 검토하고 바꾼다.
// AI 패치는 여기 없는 값을 쓸 수 없다. 별칭(aliases)으로 들어온 값은 병합 때 표준 키로 바뀐다.
// 값을 추가·변경하면 SCHEMA.md 의 변경 기록에도 적는다.
(function (root, v) {
  if (typeof module === 'object' && module.exports) module.exports = v;
  else root.DefDBVocab = v;
})(typeof self !== 'undefined' ? self : this, {
  version: 2,

  // ===== 정의항 종류 =====
  // participant: 기전에 참여(묶음의 바탕)할 수 있는가. 부위·상태 의미 규칙·막 위상도 이 종류만 가진다.
  // species: 'required' = 기준 종(reference_species) 필수, 'forbidden' = 종 필드 금지, 'optional'
  kinds: {
    protein:        { label: '단백질 (특정 유전자 산물)', aliases: ['단백질 분자'], participant: true, species: 'required', xref: { required: ['UniProt'], allowed: ['UniProt', 'PDB', 'EC', 'NCBIGene'] } },
    complex:        { label: '복합체', aliases: ['단백질 복합체', 'protein complex'], participant: true, species: 'optional', xref: { allowed: ['GO', 'PDB', 'EC'] } },
    nucleic_acid:   { label: '핵산 분자', aliases: ['핵산'], participant: true, species: 'required', xref: { allowed: ['NCBIGene', 'ChEBI'] } },
    small_molecule: { label: '저분자', aliases: ['소분자', 'small molecule', 'metabolite', '대사물'], participant: true, species: 'forbidden', xref: { required: ['ChEBI'], allowed: ['ChEBI', 'PubChem'] } },
    macromolecule:  { label: '고분자 물질 (다당류 등)', aliases: ['polymer', '고분자'], participant: true, species: 'forbidden', xref: { required: ['ChEBI'], allowed: ['ChEBI'] } },
    ion:            { label: '이온', aliases: [], participant: true, species: 'forbidden', xref: { required: ['ChEBI'], allowed: ['ChEBI'] } },
    molecule_class: { label: '분자 부류 (효소 계열, 단백질 군 등)', aliases: ['class', 'family', '부류', '계열'], participant: true, species: 'optional', xref: { allowed: ['ChEBI', 'EC', 'GO'] } },
    pathway:        { label: '경로·기전 (단계를 묶는 개념)', aliases: ['경로', '기전', 'mechanism'], participant: false, species: 'optional', xref: { allowed: ['GO', 'Reactome', 'KEGG'] } },
    process:        { label: '과정·반응 유형', aliases: ['과정', 'reaction type'], participant: false, species: 'optional', xref: { allowed: ['GO'] } },
    structure_feature: { label: '구조 요소 (부위·도메인 개념)', aliases: ['domain', 'site', '도메인'], participant: false, species: 'optional', xref: { allowed: ['InterPro', 'PDB'] } },
    principle:      { label: '원리', aliases: ['법칙', 'principle'], participant: false, species: 'forbidden', xref: { allowed: [] } },
    concept:        { label: '일반 개념', aliases: ['개념'], participant: false, species: 'optional', xref: { allowed: [] } },
  },

  // ===== 관계의 종류 제약 (원천 kind → 대상 kind) =====
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

  // ===== 분야 =====
  fields: {
    '화학':        { aliases: ['일반화학', 'chemistry'] },
    '물리학':      { aliases: ['물리', 'physics'] },
    '생화학':      { aliases: ['biochemistry'] },
    '분자생물학':  { aliases: ['molecular biology'] },
    '세포생물학':  { aliases: ['cell biology'] },
    '생리학':      { aliases: ['physiology'] },
    '유전학':      { aliases: ['고전 유전학', 'genetics'] },
    '구조생물학':  { aliases: ['structural biology'] },
    '면역학':      { aliases: ['immunology'] },
    '생명과학 교육': { aliases: ['고등학교 생명과학', '교과', '교과서'] },
  },

  // ===== 종 (NCBI Taxonomy) — 계층 =====
  taxa: {
    '2759':  { label: '진핵생물', name: 'Eukaryota', parent: null },
    '2':     { label: '세균', name: 'Bacteria', parent: null },
    '33208': { label: '동물', name: 'Metazoa', parent: '2759' },
    '4751':  { label: '균류', name: 'Fungi', parent: '2759' },
    '7742':  { label: '척추동물', name: 'Vertebrata', parent: '33208' },
    '40674': { label: '포유류', name: 'Mammalia', parent: '7742' },
    '9606':  { label: '사람', name: 'Homo sapiens', parent: '40674', aliases: ['인간', 'human'] },
    '10090': { label: '생쥐', name: 'Mus musculus', parent: '40674', aliases: ['mouse'] },
    '10116': { label: '집쥐', name: 'Rattus norvegicus', parent: '40674', aliases: ['rat'] },
    '4932':  { label: '출아효모', name: 'Saccharomyces cerevisiae', parent: '4751', aliases: ['효모', 'yeast'] },
    '562':   { label: '대장균', name: 'Escherichia coli', parent: '2', aliases: ['E. coli'] },
  },
  defaultReferenceSpecies: '9606',

  // ===== 조직·세포 =====
  tissues: {
    liver: { label: '간', aliases: ['liver'] }, skeletal_muscle: { label: '골격근', aliases: ['근육', 'muscle'] },
    heart: { label: '심장' }, brain: { label: '뇌' }, adipose: { label: '지방 조직' }, blood: { label: '혈액' }, kidney: { label: '콩팥', aliases: ['신장'] },
  },
  cells: {
    hepatocyte: { label: '간세포', tissue: 'liver' }, myocyte: { label: '골격근 세포', tissue: 'skeletal_muscle', aliases: ['근육세포'] },
    cardiomyocyte: { label: '심근세포', tissue: 'heart' }, adipocyte: { label: '지방세포', tissue: 'adipose' },
    neuron: { label: '신경세포', tissue: 'brain', aliases: ['뉴런'] }, erythrocyte: { label: '적혈구', tissue: 'blood' },
    macrophage: { label: '대식세포', aliases: ['macrophage'] }, monocyte: { label: '단핵구', tissue: 'blood', aliases: ['monocyte'] },
  },

  // ===== 위치 — 계층·차원·인접 =====
  // dim: 3D(부피) | 2D(막 표면). parent: 특수 위치의 부모. sides(2D만): 막의 면 → 그 면이 맞닿은 3D 위치.
  // 부모에서 성립하는 규칙은 특수 위치로 자동 상속되지 않는다(규칙의 where 가 정함). 공간 접촉 판정에서는 자식 위치를 부모 안으로 본다.
  locations: {
    extracellular:     { label: '세포 밖', dim: '3D', aliases: ['세포외', '혈액'] },
    plasma_membrane:   { label: '세포막', dim: '2D', sides: { extracellular: 'extracellular', cytosolic: 'cytosol' }, aliases: ['원형질막'] },
    lipid_raft:        { label: '지질 뗏목', dim: '2D', parent: 'plasma_membrane', sides: { extracellular: 'extracellular', cytosolic: 'cytosol' } },
    cytosol:           { label: '세포질', dim: '3D', aliases: ['cytoplasm', '세포질 기질'] },
    glycogen_granule:  { label: '글리코겐 과립', dim: '3D', parent: 'cytosol' },
    nuclear_envelope:  { label: '핵막', dim: '2D', sides: { cytosolic: 'cytosol', nucleoplasmic: 'nucleoplasm' } },
    nucleoplasm:       { label: '핵질', dim: '3D', aliases: ['핵', 'nucleus'] },
    er_membrane:       { label: '소포체 막', dim: '2D', sides: { cytosolic: 'cytosol', lumenal: 'er_lumen' } },
    er_lumen:          { label: '소포체 내강', dim: '3D' },
    golgi_membrane:    { label: '골지체 막', dim: '2D', sides: { cytosolic: 'cytosol', lumenal: 'golgi_lumen' } },
    golgi_lumen:       { label: '골지체 내강', dim: '3D' },
    endosome_membrane: { label: '엔도솜 막', dim: '2D', sides: { cytosolic: 'cytosol', lumenal: 'endosome_lumen' } },
    endosome_lumen:    { label: '엔도솜 내강', dim: '3D' },
    lysosome_membrane: { label: '리소좀 막', dim: '2D', sides: { cytosolic: 'cytosol', lumenal: 'lysosome_lumen' } },
    lysosome_lumen:    { label: '리소좀 내강', dim: '3D' },
    mito_outer:        { label: '미토콘드리아 외막', dim: '2D', sides: { cytosolic: 'cytosol', ims: 'mito_ims' } },
    mito_ims:          { label: '미토콘드리아 막사이공간', dim: '3D' },
    mito_inner:        { label: '미토콘드리아 내막', dim: '2D', sides: { ims: 'mito_ims', matrix: 'mito_matrix' } },
    mito_matrix:       { label: '미토콘드리아 기질', dim: '3D' },
  },
  faces: {
    extracellular: { label: '바깥면(세포 밖 쪽)' }, cytosolic: { label: '세포질 쪽 면' }, lumenal: { label: '내강 쪽 면' },
    ims: { label: '막사이공간 쪽 면' }, matrix: { label: '기질 쪽 면' }, nucleoplasmic: { label: '핵질 쪽 면' }, transmembrane: { label: '막 안' },
  },
  // 막 위상 — integral·peripheral·lipid_anchored 는 2D 위치에, soluble 은 3D 위치에 있다
  associations: {
    soluble: { label: '수용성' }, integral: { label: '막관통(내재성)', aliases: ['막관통', 'transmembrane'] },
    peripheral: { label: '막 표면 결합(주변성)', aliases: ['주변성'] }, lipid_anchored: { label: '지질 고정', aliases: ['지질 닻'] },
  },

  // ===== 부위·특징 =====
  siteTypes: {
    modification_site: { label: '수식 부위' }, binding_site: { label: '결합 부위' }, catalytic_site: { label: '촉매 부위' },
    domain: { label: '도메인' }, motif: { label: '서열 모티프' },
  },
  // 특징 유형 F — 묶음 키의 "부위:특징" 에 쓰인다
  features: {
    phosphorylated: { label: '인산화됨', aliases: ['phospho', '인산화'] },
    bound:          { label: '결합됨', aliases: ['결합'] },
    GTP_bound:      { label: 'GTP 결합', aliases: ['GTP-bound'] },
    GDP_bound:      { label: 'GDP 결합', aliases: ['GDP-bound'] },
    acetylated:     { label: '아세틸화됨' },
    methylated:     { label: '메틸화됨' },
    ubiquitinated:  { label: '유비퀴틴화됨' },
    K48_polyubiquitinated: { label: 'K48 폴리유비퀴틴화됨 (분해 표지)', aliases: ['K48-ubiquitinated', 'K48 유비퀴틴'] },
    K63_polyubiquitinated: { label: 'K63 폴리유비퀴틴화됨 (신호 발판)', aliases: ['K63-ubiquitinated', 'K63 유비퀴틴'] },
    glycosylated:   { label: '당화됨' },
    cleaved:        { label: '절단됨' },
  },
  residuePattern: '^(Ala|Arg|Asn|Asp|Cys|Gln|Glu|Gly|His|Ile|Leu|Lys|Met|Phe|Pro|Ser|Thr|Trp|Tyr|Val)[0-9]+$',
  siteKeyPattern: '^[a-z][a-z0-9_]*$',

  // ===== 규칙 =====
  // 규칙 효과 종류: modify(대상 부위의 특징 변화) · convert(기질 → 생성물) · dissociate(복합체 → 구성 요소) · associate(구성 요소 → 복합체) · transport(위치 변화)
  //               transfer(리간드를 원천의 부위에서 대상의 부위로 넘김) · degrade(복합체의 한 구성 요소를 분해하고 나머지를 풀어 줌)
  // actions[k].effects: 이 변화 종류에 허용되는 효과, adds/removes: modify 일 때 반드시 추가/제거되어야 하는 특징
  actions: {
    '결합':         { aliases: ['binding', '알로스테릭 결합'], effects: ['modify', 'associate'] },
    '해리':         { aliases: ['dissociation', '분리'], effects: ['dissociate', 'modify'] },
    '인산화':       { aliases: ['phosphorylation'], effects: ['modify'], adds: 'phosphorylated' },
    '탈인산화':     { aliases: ['dephosphorylation'], effects: ['modify'], removes: 'phosphorylated' },
    '가수분해':     { aliases: ['hydrolysis', 'GTP 가수분해', 'ATP 가수분해'], effects: ['convert', 'modify'] },
    '가인산분해':   { aliases: ['phosphorolysis'], effects: ['convert'] },
    '고리화':       { aliases: ['cyclization'], effects: ['convert'] },
    '뉴클레오타이드 교환': { aliases: ['GDP-GTP 교환', 'nucleotide exchange', 'GEF 작용'], effects: ['modify'], adds: 'GTP_bound', removes: 'GDP_bound' },
    '단백질 절단':  { aliases: ['proteolysis', '절단'], effects: ['modify', 'convert'] },
    '산화':         { aliases: ['oxidation'], effects: ['convert', 'modify'] },
    '환원':         { aliases: ['reduction'], effects: ['convert', 'modify'] },
    '이성질화':     { aliases: ['isomerization'], effects: ['convert'] },
    '축합': { aliases: ['condensation'], effects: ['convert'] },
    '수화': { aliases: ['hydration'], effects: ['convert'] },
    '기 전이':      { aliases: ['group transfer', '전이'], effects: ['convert', 'modify'] },
    '수송':         { aliases: ['transport', '이동', '자리옮김', 'translocation'], effects: ['transport'] },
    '전달':         { aliases: ['ligand transfer', '리간드 전달', '넘겨줌'], effects: ['transfer'] },
    '유비퀴틴화':   { aliases: ['ubiquitination', 'ubiquitylation'], effects: ['modify'] },
    '단백질 분해':  { aliases: ['proteasomal degradation', '프로테아좀 분해', 'degradation'], effects: ['degrade'] },
    '전사':         { aliases: ['transcription'], effects: ['convert'] },
    '구조 변화':    { aliases: ['conformational change', '형태 변화'], effects: ['modify'] },
  },
  activity: {
    active:   { label: '활성', aliases: ['활성형', 'on'] },
    inactive: { label: '비활성', aliases: ['비활성형', 'off'] },
    partial:  { label: '부분 활성', aliases: ['덜 활성', '약한 활성'] },
    unknown:  { label: '미상', aliases: ['모름'] },
  },
  effects: {
    activates: { label: '활성화', aliases: ['활성', '촉진', 'activation'] },
    inhibits:  { label: '억제', aliases: ['저해', 'inhibition'] },
  },

  // ===== 관찰 (D/obs) =====
  // speciesRequired: 종에 따라 값이 달라지므로 context.species 필수, value: 값의 종류
  obsProperties: {
    localization:  { label: '세포 내 위치 분포', value: 'location', speciesRequired: false },
    expression:    { label: '발현 수준', value: ['high', 'medium', 'low', 'absent'], speciesRequired: true },
    Km:            { label: '미카엘리스 상수', value: 'number', unit: true, speciesRequired: true },
    kcat:          { label: '전환수', value: 'number', unit: true, speciesRequired: true },
    Kd:            { label: '해리 상수', value: 'number', unit: true, speciesRequired: true },
    concentration: { label: '농도', value: 'number', unit: true, speciesRequired: true },
    half_life:     { label: '반감기', value: 'number', unit: true, speciesRequired: true },
    activity_level:{ label: '활성 정도', value: ['high', 'medium', 'low', 'none'], speciesRequired: true },
    ortholog_xref: { label: '다른 종의 대응 외부 ID', value: 'xref', speciesRequired: true },
    copy_number:   { label: '세포당 분자 수', value: 'number', unit: true, speciesRequired: true },
    compartment_volume: { label: '구획 부피 (세포 유형·위치별)', value: 'number', unit: true, speciesRequired: true },
    sequence_length: { label: '서열 길이 (아미노산·뉴클레오타이드 수 — 재활용 화학량의 근거)', value: 'number', unit: true, speciesRequired: true },
  },

  // ===== 반응 속도 법칙 (Kinetic) — 값은 SI 정준 단위: k_on M⁻¹s⁻¹, k_off·kcat s⁻¹, Kd·Km M, mass_action k 는 M^(1-order)·s⁻¹ =====
  // required: 'a|b' 는 둘 중 하나
  kineticLaws: {
    mass_action:      { label: '질량 작용', required: ['k', 'order'], aliases: ['mass action'] },
    binding:          { label: '가역 결합 (k_on·k_off·Kd)', required: ['k_on|Kd', 'k_off|Kd'], aliases: ['reversible binding'] },
    michaelis_menten: { label: '미카엘리스–멘텐', required: ['kcat', 'Km'], aliases: ['MM', 'michaelis-menten'] },
    zero_order:       { label: '0차 (일정한 공급 속도, k 는 M·s⁻¹)', required: ['k'], aliases: ['zero order', 'constant supply'] },
  },

  // ===== 생애 주기 (Lifecycle) — 정의항의 lifecycle 필드 (형식 v7) =====
  // k_deg (s⁻¹, 1차 분해) 또는 half_life (s), k_syn (분자/s/세포, 0차 합성). fate: 분해 산물이 어디로 가나.
  lifecycleFates: {
    lost:     { label: '소실 (계 밖으로 — 질량 감사에서 소실 원장에 기록)', aliases: ['lost', '소실'] },
    recycled: { label: '재활용 (구성 단위가 대사물 저장소로 돌아감 — recycle_to)', aliases: ['recycled', '재활용'] },
  },
  // 대사물 저장소 (Metabolic Reservoir): 시뮬레이션에서 유한한 전역 풀. 공급 규칙(supply)이 채우고 단계가 소비한다.
  reservoirModes: {
    finite:   { label: '유한 저장소 (기본) — 소비하면 줄고, 공급 규칙·재활용이 채운다. 바닥나면 단계가 멈춘다(고갈).' },
    infinite: { label: '무한 풀 (v6 동작) — 양이 변하지 않음. 질량 감사는 풀과의 교환을 원장에 적는다.' },
  },
  // 규칙 종류: meaning(상태 의미) · transition(전이, 단계가 적용) · supply(대사물 공급 — 시뮬레이터가 전역으로 적용)
  ruleTypes: {
    meaning:    { label: '상태 의미 규칙 (부위:특징 조합 → 활성)' },
    transition: { label: '전이 규칙 (단계가 적용하는 변화)' },
    supply:     { label: '대사물 공급 규칙 (Metabolic_Supply_Rule — 저장소의 소비·생성, 예: ADP + Pi → ATP)' },
  },

  // ===== 혼합 해상도 (Hybrid-Resolution) — 전환 문턱 =====
  resolutionLevels: {
    R0: { label: '위상 해상도', note: '위치·상태(묶음 키)만. 풀 안에서 확산·대기·수송하는 분자, 변환 단계.' },
    R1: { label: '부위 해상도', note: '이름 붙은 부위·특징·잔기 번호·막 면. 결합·수식·전달 같은 부위 사건.' },
    R2: { label: '구조 해상도', note: '반응 중심 부위의 3차원 구조 참조(PDB). 경쟁·특이성을 속도 상수로 가를 수 없을 때만.' },
  },
  resolutionThresholds: {
    T1: { label: '부위 사건', up: 'R1', when: '규칙이 이름 붙은 부위를 바꾸거나(site·from_site·partner_site), 부위로 작용하거나(via_site), 부위 상태를 전제로 할 때(requires)' },
    T2: { label: '구성 요소 화학량', up: 'R1', when: '결합체 형성·해리·분해 — 구성 요소 개수가 결과를 정할 때' },
    T3: { label: '경쟁', up: 'R2', when: '같은 묶음을 두 단계 이상이 소비할 때. 속도 상수(Kd·kcat·Km)가 있으면 R1 에서 해결되고, 없으면 반응 중심 구조가 필요하다' },
    down: { label: '하향 전환 (반응 중심 → 풀)', when: '사건이 끝나 산물이 풀로 돌아갈 때 — 바뀐 부위는 묶음 키의 부위:특징으로 남고(무손실), 수송·해리는 특징 보존을 검사받는다' },
  },

  // ===== 한계 종류 (Limitation & Constraint Registry) =====
  // 모든 한계는 [Target | Type | Requirement] 로 등록한다. 새 종류는 사람이 검토해 추가한다.
  gapTypes: {
    Kinetic_Gap:       { label: '속도·친화도·시간 상수 공백', aliases: ['kinetic'], note: '반응 속도(kcat·Km), 결합 친화도(Kd), 반감기 같은 시간 정보가 없어 경쟁·지속·종료를 정할 수 없는 곳.' },
    Concentration_Gap: { label: '농도·부피·질량 수지 공백', aliases: ['concentration'], note: '몰 농도, 세포당 분자 수, 구획 부피, 질량 수지가 없어 시작량을 기본값·무한 풀로 둔 곳.' },
    Structural_Gap:    { label: '구조·위상·해상도 공백', aliases: ['structural'], note: '3차원 좌표, 잔기 번호, 화학량(구성 비), 막 위상을 모르거나 다른 분자에서 빌려 온 곳.' },
    Resource_Gap:      { label: '자원(저장소) 공백', aliases: ['resource'], note: '재생·공급 경로나 그 속도가 없어 저장소가 고갈되고 경로가 멈추는 곳 — 사후 분석(post-mortem)이 제한 요인으로 지목한 저장소. 공급 규칙의 속도·시작량이 들어오면 닫힌다.' },
    Identity_Gap:      { label: '정체성(외부 ID) 공백', aliases: ['identity', 'unmapped'], note: '필수 외부 ID(ChEBI·UniProt …)를 원본과 대조하지 못해 unmapped 에 사유만 둔 곳. 확인된 ID 가 들어오면 닫힌다.' },
  },

  // ===== 근거 수준 =====
  evidenceLevels: {
    curated:   { label: '문헌·큐레이션 근거', requires: 'source' },
    abstracted:{ label: '[Abstracted Logic: Derived from the inferred mechanistic flow]', requires: 'basis', aliases: ['abstracted logic', '추론'] },
    computed:  { label: '도구로 계산', requires: 'tool' },
    asserted:  { label: '출처 없이 적음' },
    predicted: { label: '예측 모델 출력', requires: 'confidence' },
  },

  // ===== 외부 ID =====
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
    PMID:     { pattern: '^[0-9]+$', url: 'https://pubmed.ncbi.nlm.nih.gov/{id}' },
    DOI:      { pattern: '^10\\.[0-9]{4,}/\\S+$', url: 'https://doi.org/{id}' },
  },
  xrefStatus: ['asserted', 'verified'],

  // ===== 구조 지문 =====
  fingerprints: {
    InChIKey:    { pattern: '^[A-Z]{14}-[A-Z]{10}-[A-Z]$', kinds: ['small_molecule', 'ion', 'macromolecule'] },
    SEQ_SHA256:  { pattern: '^[0-9a-f]{64}$', kinds: ['protein', 'nucleic_acid'] },
    COMPLEX:     { pattern: '^CPX\\(([0-9a-zA-Z_-]+x[0-9]+)(\\+[0-9a-zA-Z_-]+x[0-9]+)*\\)$', kinds: ['complex'] },
  },
  fingerprintStatus: ['computed', 'asserted', 'verified'],
});
