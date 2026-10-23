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
    // 형식 v9 — 세포 운명: 세포 상태·계통(분화 단계). 분자가 아니라 표지 서명(signature)·대사 프로그램(metabolome)·전이(transitions)로 정의되는 상태
    cell_state:     { label: '세포 상태·계통 (분화 단계 — 표지·대사 프로그램으로 정의)', aliases: ['cell state', 'cell type', '세포 유형', '계통', 'lineage'], participant: false, species: 'optional', xref: { allowed: ['CL'] } },
  },

  // ===== 관계의 종류 제약 (원천 kind → 대상 kind) =====
  relationRules: {
    is_a: {
      protein: ['molecule_class', '='], complex: ['molecule_class', '='], nucleic_acid: ['molecule_class', '='],
      small_molecule: ['molecule_class', '='], macromolecule: ['molecule_class', '='], ion: ['molecule_class', '='],
      molecule_class: ['molecule_class'],
      pathway: ['pathway', 'process'], process: ['process', 'concept'],
      structure_feature: ['structure_feature', 'concept'], principle: ['principle', 'concept'], concept: ['concept'],
      cell_state: ['cell_state', 'concept'],
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
  // 재활용 산물이 2D(막) 묶음에서 나올 때 돌아갈 기본 부피 위치 — 엔진 코드에 위치 이름을 두지 않으려고 여기에
  defaultVolumeLocation: 'cytosol',

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
    cd8_t_cell: { label: 'CD8 T 세포', aliases: ['CD8+ T cell', 'CD8 T cell', '세포독성 T 세포'] },
    dendritic_cell: { label: '수지상 세포', aliases: ['dendritic cell', 'DC', '수지상세포'] },
    fibroblast: { label: '섬유아세포', aliases: ['fibroblast', '섬유세포', 'HDF'] },
    hela_cell: { label: 'HeLa 세포 (배양 세포주)', aliases: ['HeLa', 'HeLa cell', '헬라 세포'] },
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
    Km:            { label: '미카엘리스 상수', value: 'number', unit: true, speciesRequired: true, dim: 'concentration' },
    kcat:          { label: '전환수', value: 'number', unit: true, speciesRequired: true, dim: 'per_time' },
    Kd:            { label: '해리 상수', value: 'number', unit: true, speciesRequired: true, dim: 'concentration' },
    concentration: { label: '농도', value: 'number', unit: true, speciesRequired: true, dim: 'concentration', observable: 'concentration' },
    half_life:     { label: '반감기', value: 'number', unit: true, speciesRequired: true, dim: 'time' },
    activity_level:{ label: '활성 정도', value: ['high', 'medium', 'low', 'none'], speciesRequired: true },
    ortholog_xref: { label: '다른 종의 대응 외부 ID', value: 'xref', speciesRequired: true },
    copy_number:   { label: '세포당 분자 수', value: 'number', unit: true, speciesRequired: true, dim: 'count', observable: 'amount' },
    compartment_volume: { label: '구획 부피 (세포 유형·위치별)', value: 'number', unit: true, speciesRequired: true, dim: 'volume', observable: 'volume' },
    sequence_length: { label: '서열 길이 (아미노산·뉴클레오타이드 수 — 재활용 화학량의 근거)', value: 'number', unit: true, speciesRequired: true, dim: 'residue' },
    // 형식 v8 — 3 층 엔진: 확산 계수(SI m^2/s)와 Tier 1 환경 장(pH·이온 세기·상대 유전율). 모두 위치(context.location) 필수
    diffusion_coefficient: { label: '확산 계수 (SI, m^2/s) — Tier 3 공간 동역학·Damköhler 수', value: 'number', unit: true, units: ['m^2/s'], speciesRequired: false, requiresLocation: true, dim: 'diffusion' },
    pH:                    { label: '구획 pH (Tier 1 환경 장)', value: 'number', speciesRequired: false, requiresLocation: true },
    ionic_strength:        { label: '이온 세기 (SI 정준 M, Tier 1 환경 장)', value: 'number', unit: true, units: ['M'], speciesRequired: false, requiresLocation: true, dim: 'concentration' },
    relative_permittivity: { label: '상대 유전율 ε_r (Tier 1 환경 장 — 극성)', value: 'number', speciesRequired: false, requiresLocation: true },
  },

  // ===== 반응 속도 법칙 (Kinetic) — 값은 SI 정준 단위: k_on M⁻¹s⁻¹, k_off·kcat s⁻¹, Kd·Km M, mass_action k 는 M^(1-order)·s⁻¹ =====
  // required: 'a|b' 는 둘 중 하나
  kineticLaws: {
    mass_action:      { label: '질량 작용', required: ['k', 'order'], aliases: ['mass action'] },
    binding:          { label: '가역 결합 (k_on·k_off·Kd)', required: ['k_on|Kd', 'k_off|Kd'], aliases: ['reversible binding'] },
    michaelis_menten: { label: '미카엘리스–멘텐', required: ['kcat', 'Km'], aliases: ['MM', 'michaelis-menten'] },
    zero_order:       { label: '0차 (일정한 공급 속도, k 는 M·s⁻¹)', required: ['k'], aliases: ['zero order', 'constant supply'] },
    // 형식 v9 — 조절 규칙 전용: 조절자 농도 s(M)에 대한 무차원 배율. 활성화 f = 1 + (fmax − 1)·sⁿ/(Kⁿ + sⁿ), 억제 f = fmin + (1 − fmin)·Kⁿ/(Kⁿ + sⁿ)
    hill:             { label: '힐 조절 배율 (K M, n, fmax | fmin — 조절 규칙에만)', required: ['K', 'n'], aliases: ['Hill'] },
  },

  // ===== 3 층 다중 규모 엔진 (형식 v8) — docs/design/hybrid-multiscale-engine.md =====
  // 종의 기본 층: T1 = 연속 장으로 다루는 고분자수 분자(대사물·이온), T2 = 부위 상태를 가진 규칙 행위자.
  // T3 은 종의 속성이 아니라 영역(domain)의 동적 상태 — 정의항의 tier 로는 쓰지 않는다.
  tiers: {
    T1: { label: 'Tier 1 열역학 퍼텐셜 장·연속 청산 (고분자수 대사물·환경 장, 확산·CLE)', aliases: ['tier1', 'field'] },
    T2: { label: 'Tier 2 이산 맥락 네트워크 (규칙 기반 행위자·DEVS — 부위 상태·복합체)', aliases: ['tier2', 'agent', 'rule'] },
    T3: { label: 'Tier 3 3차원 공간 동역학 영역 (대리 모델 + 유한 체적 대체) — 영역 상태 전용', aliases: ['tier3', 'spatial'] },
  },
  // 열역학 기준 (형식 v8): 전이 상태 이론 k = k0·exp(−(ΔG‡ + ΔG_env)/RT), 미시적 가역성 k_f/k_r = exp(−ΔG°/RT)
  thermo: { R: 8.314462618, T_ref: 310.15, unit_energy: 'J/mol', loop_tolerance: 100 },

  // ===== 합의 창 (추세 점검, judicial/trend.js) =====
  // 추세 도장은 상하지 않는 사실이 아니다 — 점검일이 이 창(일)보다 오래되면 다시 '점검하지 않음' 이 되어 등급 anchor 가 내려간다.
  // 창을 늘리면 오래된 점검이 기준값을 떠받치고, 줄이면 다시 받아야 한다. 권위 DB(UniProt·ChEBI)의 판 주기(8주)의 여유 배수로 둔다.
  consensus: { window_days: 365, label: '추세 점검이 유효한 기간 (일)' },

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
    degradation:{ label: '분해 규칙 (Degradation_Rule — 소유자의 묶음이 1차로 분해, lost | recycled)' },
    modulation: { label: '조절 규칙 (Signal-to-Metabolism / 유전자 조절 — 소유자(조절자) 농도가 다른 규칙의 속도를 힐 배율로 바꿈, 형식 v9)' },
  },
  // ===== 세포 운명 (형식 v9) — 세포 상태의 표지 서명·대사 프로그램·결정 기준 =====
  signatureLevels: {
    high: { label: '높음 (문턱 이상)', aliases: ['high', '고발현'] },
    low:  { label: '낮음 (문턱 이하)', aliases: ['low', '저발현', 'absent'] },
  },
  commitmentCriteria: {
    withdrawal: { label: '신호 철회 시험 — 그 시각에 모든 신호를 끊어도 목표 상태로 수렴하면 결정(비가역)된 것. 결정 시점 = 처음으로 이 시험을 통과한 시각' },
    threshold:  { label: '표지 문턱 — 목표 상태의 모든 표지가 문턱을 넘으면 도달 (가역일 수 있음)' },
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
    Regulatory_Gap:    { label: '조절 연결 공백 (신호 전달·유전자 조절)', aliases: ['regulatory', 'signaling'], note: '신호 → 대사, 대사 → 유전자 조절의 매개 단계(수용체·STAT·mTORC1·염색질)를 단계로 풀지 않고 조절 규칙 하나로 묶었거나, 조절 상수(K·n·fmax)를 모르는 곳 (형식 v9).' },
    Observation_Gap:   { label: '관찰 공백 (가를 수 없음)', aliases: ['observation'], note: '관찰의 오차 막대로 경쟁 가설(compare 의 Behavior-Changing 쌍)을 가를 수 없거나, 판정할 관찰이 없는 곳 (형식 v10). requirement 에 필요한 정밀도를 적는다.' },
    Identity_Gap:      { label: '정체성(외부 ID) 공백', aliases: ['identity', 'unmapped'], note: '필수 외부 ID(ChEBI·UniProt …)를 원본과 대조하지 못해 unmapped 에 사유만 둔 곳. 확인된 ID 가 들어오면 닫힌다.' },
    Consensus_Gap:     { label: '합의(추세) 공백', aliases: ['consensus', 'trend'], note: '저장된 값이 더 새 원본의 합의와 다르거나(추세 mismatch — 등급이 legacy 로 내려감), 추세를 점검할 새 원본이 없는 곳. 값을 지우지 않는다 — 왜 달라졌는지(원본의 개정·우리 쪽 오류)가 데이터다. judicial/trend.js 가 후보를 낸다 (형식 v10 확장 5).' },
  },

  // ===== 관찰 기록 (형식 v10, observations O…) — docs/design/observation-port.md =====
  // 측정한 것은 모델 표현이 아니라 "무엇을 쟀는가"로 저장한다. 값은 SI 정준 단위, 불확도·반복 수·조건·출처와 함께.
  //   target: 'bundle' 묶음 키 | 'cell_state' 세포 상태 정의항 | 'rule' D…/rule/키 (param 필수)
  // ===== 단위 환산표 (형식 v11) — 값 × 계수 = 정준 단위의 값 =====
  //   엔진(core.js 의 시작량·부피 환산)과 사법부(정의항 obs ↔ 관찰 기록 값 대조)가 **같은 표**를 읽는다.
  //   표가 둘이면 대조 검사가 자기 환산으로 틀린 판정을 낸다. 부피의 정준은 L 로 둔다 — 농도의 정준이 M(mol/L)이라
  //   m³ 로 두면 엔진이 환산을 한 번 더 해 기존 궤적의 마지막 비트가 달라진다.
  unitFactors: {
    concentration: { M: 1, mM: 1e-3, 'µM': 1e-6, uM: 1e-6, nM: 1e-9, pM: 1e-12 },
    volume:        { L: 1, mL: 1e-3, 'µL': 1e-6, uL: 1e-6, nL: 1e-9, pL: 1e-12, fL: 1e-15 },
    time:          { s: 1, min: 60, h: 3600, d: 86400 },
    per_time:      { 's^-1': 1, 'min^-1': 1 / 60 },
    count:         { molecule: 1, molecules: 1, copies: 1, 'copies/cell': 1 },
    residue:       { aa: 1, nt: 1, bp: 1 },
    energy_molar:  { 'J/mol': 1, 'kJ/mol': 1e3 },
    diffusion:     { 'm^2/s': 1 },
  },
  // 물리적 상한 (형식 v11) — 생물학적 범위가 아니라 **불가능**을 걸러내는 천장이다.
  //   818 µM 을 818 M 로 적는 실수를 잡는 것이 목적이고, 어떤 값이 생물학적으로 그럴듯한지는 판정하지 않는다.
  //   근거: 순수한 물이 55.5 M · 1 µL = 1e9 µm³(가장 큰 세포도 그 아래) · 1 몰 = 6.02e23 개 ·
  //   가장 빠른 효소 전환수 ~1e6 s⁻¹ · 확산 한계 결합 ~1e10 M⁻¹s⁻¹ · 물의 자기 확산 2.3e-9 m²/s.
  physicalBounds: {
    concentration: { min: 0, max: 1e2,  why: '순수한 물이 55.5 M — 그보다 큰 농도는 물리적으로 불가능' },
    volume:        { min: 0, max: 1e-6, why: '1 µL = 1e9 µm³ — 어떤 세포 구획도 그보다 크지 않다', exclusiveMin: true },
    count:         { min: 0, max: 1e20, why: '1 몰 = 6.02e23 개 — 한 세포가 그 규모를 담지 못한다' },
    residue:       { min: 1, max: 1e6, why: '가장 긴 사람 단백질 타이틴이 34,350 aa · 1 번 염색체가 2.5e8 bp 이지만 정의항의 서열은 그 아래', integer: true },
    time:          { min: 0, max: 1e12, why: '1e12 s ≈ 3만 년', exclusiveMin: true },
    per_time:      { min: 0, max: 1e9,  why: '가장 빠른 효소 전환수가 ~1e6 s⁻¹' },
    energy_molar:  { min: -1e7, max: 1e7, why: '±1e7 J/mol 은 공유 결합 에너지의 수십 배' },
    diffusion:     { min: 0, max: 1e-6, why: '물의 자기 확산 2.3e-9 m²/s', exclusiveMin: true },
  },
  observables: {
    amount:           { label: '분자 수 (세포·구획당)', target: 'bundle', unit: 'molecule', dim: 'count', qualitative: true, conservation: { class: 'conserved', reason: 'substance_count' } },
    concentration:    { label: '농도', target: 'bundle', unit: 'M', dim: 'concentration', qualitative: true, conservation: { class: 'non_conserved', reason: 'derived_scaled' } },
    fraction:         { label: '세포 상태에 있는 세포의 비율 (0–1)', target: 'cell_state', unit: '1', qualitative: true, conservation: { class: 'non_conserved', reason: 'derived_scaled' } },
    event_time:       { label: '세포 상태에 도달한 시각', target: 'cell_state', unit: 's', dim: 'time', qualitative: true, conservation: { class: 'non_conserved', reason: 'emergent_time' } },
    volume:           { label: '구획 부피 (대상 = 위치)', target: 'location', unit: 'L', dim: 'volume', conservation: { class: 'non_conserved', reason: 'measured_parameter' } },
    kinetic_constant: { label: '속도·조절 상수 (규칙의 kinetics 한 칸)', target: 'rule', unit: 'param', conservation: { class: 'non_conserved', reason: 'measured_parameter' } },
    ratio:            { label: '비 (두 형태·대상의 몫 — 정규화 밴드 강도·활성 분율·fold-change, 무차원)', target: 'bundle', unit: '1', conservation: { class: 'non_conserved', reason: 'derived_scaled' } },
    fraction_above:   { label: '문턱 넘은 비율 (%양성 — 게이팅 문턱 이상 실행의 비, 0–1)', target: 'bundle', unit: '1', conservation: { class: 'non_conserved', reason: 'derived_scaled' } },
  },
  // 보존 분류 (오차 3채널 doctrine 의 기저 — build-plan 20–25, 설계 conservation-classes.md). class 는 표현 독립:
  // 보존 법칙의 유무로 정의한다(정수 원장이 정확-0 이든 Rodas3 가 상대 1e-14 로 근사하든 같은 class).
  conservationClasses: {
    conserved:     { label: '보존 (보존 법칙 존재 — 대조 가능, 목표 오차 0)', note: '질량·부분구조 수지로 대조되는 양. 정수 원장(카운트·1e-9 고정소수점)으로 구조상 정확, 수치오차는 추적이 아니라 제거.' },
    non_conserved: { label: '비보존 (보존 법칙 없음 — 참조 없음, 예산으로만)', note: '정확한 참조가 없는 양. float 로 두고 오차를 예산으로 추적(0 으로 제거 불가). 보존 장부·생물 상수에 섞지 않는다. 정확한 척하려 고정소수점으로 밀지 않는다.' },
  },
  conservationReasons: {
    substance_count:     { label: '물질 카운트 (질량·부분구조 수지로 보존)', note: '분자·부분구조 개수. 반응이 만들고 없애도 수지(ΣIn=ΣOut)가 보존 법칙을 준다.' },
    rate_derivative:     { label: '속도·도함수 (보존 법칙 없음)', note: '단위 시간당 변화(1/s). 반응 속도 등 — 보존되는 실체가 아니다.' },
    intensive_potential: { label: '세기 변수 (ΔG·pH·온도 — 카운트 아님)', note: '크기에 무관한 열역학·환경 변수. 더해지지 않으므로 수지가 없다.' },
    derived_scaled:      { label: '유도·환산값 (카운트 × 스케일·비율)', note: '보존 카운트에서 유도(농도 = 카운트 × cinv, 비율). float 스케일을 실어 자체 보존 법칙이 없다.' },
    sensitivity:         { label: '민감도 (야코비안 ∂rate/∂N — 실체 아님)', note: '동역학의 도함수. 실체가 아니라 감도이므로 보존 대상이 아니다.' },
    emergent_time:       { label: '창발 시각 (event_time — 참조 없음)', note: '첫 도달 시각 같은 창발량. 참조 정답이 없어 예산으로만.' },
    measured_parameter:  { label: '측정 파라미터 (kcat·Km·Kd·반감기·부피 세팅)', note: '경험적으로 측정·설정된 입력. 불확도를 달고 들어오며 보존 법칙이 없다.' },
  },
  // 결함 채널 (judicial/fault.js 가 태그·확인에 쓰는 표 — 표는 여기, 로직은 거기). label·note(고치는 곳)·fix(고치는 층)
  faultChannels: {
    FINDING:         { label: '결과 (결함 아님)', note: '고치지 않는다 — 결과로 보고. 재생 경로가 없으면 한계(Resource_Gap 등)로 등록', fix: 'none' },
    DATA_GAP:        { label: '데이터 공백', note: '한계 등록부에 등록하고, 확인된 값만 패치로 채운다 (지어내지 않음)', fix: 'limitation' },
    DOMAIN_CONFLICT: { label: '데이터 모순 (규칙·화학량·상수·관찰 사이)', note: '근거와 함께 데이터 패치 (입법) — 모순의 어느 쪽이 틀렸는지 근거로 정함', fix: 'data' },
    NUMERICAL:       { label: '수치 문제', note: 'engine/coupling.js 결합점 또는 솔버 단계 제어 (행정) — 생물 상수(db.json)를 바꾸지 않는다', fix: 'numerics' },
    ENGINE_DEFECT:   { label: '엔진 결함', note: '엔진 코드 (행정) — 데이터·결합점을 바꿔 덮지 않는다', fix: 'engine' },
    COMPILER_DEFECT: { label: '컴파일러 결함', note: 'compiler/ (IR·기호 미분·테이프) — 엔진·데이터를 바꿔 덮지 않는다', fix: 'compiler' },
  },
  // ── 판결·보고의 통제 토큰 (16A: 토큰 → 사람말 표는 여기 — 토큰 → 동작·숫자·정책 표는 로직 곁에) ──
  // 기전 참여 역할 (model.js ROLE 보기 · core.js·viewer 표시)
  bundleRoles: {
    agent:     { label: '촉매/행위자' },
    input:     { label: '소비(입력)' },
    output:    { label: '생성(출력)' },
    regulator: { label: '조절자' },
  },
  // 개념 위계 축의 위·아래 이름 (model.js AXIS_UP·AXIS_DOWN 보기)
  hierarchyUp:   { kind: { label: '상위 범주' }, part: { label: '전체' }, instance: { label: '유형' } },
  hierarchyDown: { kind: { label: '하위 범주' }, part: { label: '구성요소' }, instance: { label: '사례' } },
  // 운명·기전 시나리오 context.role (judicial/process_report.js)
  contextRoles: {
    cause:       { label: '원인', note: '그 상태에 이르는 원인 — 전이 신호가 켜져 있고 그 상태에 도달' },
    requirement: { label: '필수성', note: '같은 신호에서 무엇을 끊으면 도달하지 못함' },
    baseline:    { label: '일반 상황', note: '시작 상태, 구동된 전이 없음' },
  },
  // 정성 그래프 0 층 판정 (judicial/qual_graph.js)
  qualGraphVerdicts: {
    supported:               { label: '구조 지지' },
    no_path:                 { label: '경로 없음 (Structural_Gap 후보)' },
    contradiction_candidate: { label: '모순 후보' },
    mixed:                   { label: '부호 섞임 (모의 판정 필요)' },
    tension:                 { label: '긴장 (경로 있음 · 효과 없음 주장)' },
    not_applicable:          { label: '0 층 판정 대상 아님' },
    undetermined:            { label: '판정 못 함 (탐색 상한)' },
  },
  // 정성 모의 판정 결과 (judicial/qual_compare.js)
  qualOutcomes: {
    match:     { label: '맞음' },
    mismatch:  { label: '틀림' },
    not_shown: { label: '보이지 못함' },
    invalid:   { label: '무효' },
  },
  // 추세 판정 (judicial/trend.js) — 키 집합은 추세 도장의 verdict 어휘이기도 하다
  trendVerdicts: {
    match:     { label: '합의와 같음' },
    mismatch:  { label: '합의와 다름 — 지난값' },
    unchecked: { label: '점검하지 않음' },
  },
  // 강성 프로파일 표지 (judicial/stiffness.js)
  stiffnessFlags: {
    h_min_floor:          { label: '최소 단계 바닥(정확도 타협)' },
    rejection_storm:      { label: '단계 거부 폭주' },
    timescale_separation: { label: '시간척도 분리(강성 흡수)' },
    lu_cost:              { label: '큰 활성 집합(LU 비용)' },
    well_conditioned:     { label: '양호' },
  },
  // 속도 상수 칸의 사람 이름 (judicial/evidence_report.js 값 표)
  kineticParams: {
    kcat: { label: '최대 회전수 kcat' }, Km: { label: '반포화 농도 Km' }, k: { label: '속도 상수 k' }, k_r: { label: '역반응 속도 k_r' },
    k_on: { label: '결합 속도 k_on' }, k_off: { label: '해리 속도 k_off' }, Kd: { label: '해리 상수 Kd' }, k0: { label: '전지수 인자 k0' },
    dG_act: { label: '활성화 에너지 ΔG‡' }, dG0: { label: '표준 반응 자유에너지 ΔG°′' }, half_life: { label: '반감기' },
    K: { label: '힐 반포화 K' }, n: { label: '힐 계수 n' }, fmax: { label: '최대 배율 fmax' }, fmin: { label: '최소 배율 fmin' },
  },
  // 신뢰 지표 척도·등급의 뜻 (judicial/reliability.js — 등급을 정하는 규칙과 그 설명 rule 은 로직 곁에 남는다)
  sourceScale: { 4: { label: '권위 DB + 사법부 도장' }, 3: { label: '동료 심사 문헌(DOI·PMID)' }, 2: { label: '출처 없음·추론·예측' }, 0: { label: '확인 불가' } },
  dataScale:   { 4: { label: '추적 가능한 실측·도구 계산' }, 3: { label: '요약 상수·정체성 사실' }, 2: { label: '추론·단순화·출처 없는 값' } },
  reliabilityGrades: {
    anchor:    { label: '기준값', note: '시뮬레이션의 고정점으로 쓸 수 있음' },
    parameter: { label: '매개변수', note: '주 매개변수로 쓸 수 있음 (추세 미점검이면 함께 보고)' },
    bounded:   { label: '구간값', note: '오차 막대와 함께만 쓸 수 있음' },
    legacy:    { label: '지난값', note: '비교 분석에만 (지우지 않는다)' },
    reference: { label: '참고', note: '계산에 쓰지 않음 — 서술에만' },
    blocked:   { label: '차단', note: '계산·인용 금지 — 한계로만 남긴다' },
  },
  // 닫는 방법 (설계 §13.2 B) — 실행에 쓰인 상수를 우리가 어떻게 아는가. 증거 보고서가 고리마다 붙인다 (judicial/evidence_report.js)
  closureMethods: {
    measure:     { label: '문헌 실측값', note: '이 종·이 반응에서 실제로 잰 값 — 결론의 단단한 바닥' },
    computed:    { label: '측정에서 도구로 계산', note: '측정에서 도구로 계산 — 측정만큼 믿되 도구 가정을 짊어짐' },
    abstraction: { label: '묶음·추상 (기전 경계)', note: '기전을 묶어 한 상수로 — 세부는 접혔고, 그 경계는 Structural_Gap 으로 등록' },
    assumed:     { label: '가정 (실측 아님)', note: '실측이 아닌 추정 — 결론은 여기에 조건부, 재면 바뀔 수 있음' },
    none:        { label: '속도 상수 없음', note: '속도 상수가 없다 — 경로 속도 실행에선 사건 기반(즉시), 운명 엔진에선 그 규칙이 꺼짐(Kinetic_Gap). 시간·병목·그 고리의 효과를 말할 수 없음' },
  },
  // 판정 수준 — 실행의 결론을 어디까지 말할 수 있나. 규약 선언이 아니라 사전 등록 확인에서 정한다 (judicial/protocol.protocolVerdict)
  judgmentLevels: {
    validated_registered:   { label: '검증 (사전 등록)', note: '등록된 모의 실험 규약 아래 — 일치 결론은 규약의 검증 세트로만' },
    protocol_violation:     { label: '탐색 (규약 위반 — 검증 결론 불가)', note: '규약을 선언했으나 등록되지 않았거나 등록 뒤 고침 — 검증 결론을 내지 않는다' },
    registration_unchecked: { label: '규약 선언됨 (등록 미확인)', note: '사전 등록부를 받지 않아 등록 여부를 확인하지 못함 — 확인 전에는 검증 결론으로 읽지 않는다' },
    hypothesis_generating:  { label: '가설 생성 / 탐색', note: '규약 없는 가상(hypothetical) 실행 — 관찰과의 일치를 주장하지 않는다 (설계 P6)' },
    exploratory:            { label: '탐색 (규약 없음)', note: '사전 등록 규약이 없어 관찰과의 일치 결론을 내지 않는다' },
  },
  // 속도 상수 칸의 SI 정준 단위. k·k0·k_r 은 차수에 따라 M^(1−order)·s⁻¹ (단위 문자열 'M^x s^-1', x = 1 − order)
  kineticUnits: { k_on: 'M^-1 s^-1', k_off: 's^-1', kcat: 's^-1', Kd: 'M', Km: 'M', K: 'M', half_life: 's', n: '1', fmax: '1', fmin: '1', dG_act: 'J/mol', dG0: 'J/mol' },
  uncertaintyKinds: {
    measurement: { label: '측정 잡음 (장비·분석)' },
    biological:  { label: '생물학적 변이 (개체·세포 간)' },
    combined:    { label: '둘을 가르지 않은 합산' },
  },
  noiseModels: {
    normal:    { label: '정규 (sd = 표준 편차, 같은 단위)' },
    lognormal: { label: '로그정규 (sd = ln 값의 표준 편차, 무차원) — 값 > 0', positive: true },
    poisson:   { label: '계수 (분자 수에만, sd 는 √값을 넘지 않는 추가 측정 잡음)', observables: ['amount'] },
  },
  calibrationKinds: {
    identity: { label: '보정 없음 (값 = 읽은 값)' },
    linear:   { label: '선형 (값 = a·raw + b)' },
    table:    { label: '보정 표 (raw 오름차순 점 사이 선형 보간)' },
  },
  // 형식 v12 §4 — 정성 관찰의 기대 (방향·유무·순서·단조). relative: 대조군(교란 없음)과 비교하므로 교란 선언 필수
  //   qualitative: true 인 측정량만 정성 관찰의 읽을 거리(readout)가 된다 — 부피·속도 상수는 정성으로 말하지 않는다
  //   chance: 우연 기준선(build-plan 8) — 결과 칸을 똑같이 고르는 영 가설에서 맞힐 확률. 방향·단조는 세 칸(늘어남·줄어듦·같음 / 증가·감소·그 밖),
  //   유무는 두 칸, 순서는 m 개 사건의 순열 1/m! (판정 모듈이 계산)
  qualitativeExpectations: {
    increase:          { label: '교란하면 대조군보다 늘어남', relative: true, chance: 1 / 3 },
    decrease:          { label: '교란하면 대조군보다 줄어듦', relative: true, chance: 1 / 3 },
    no_change:         { label: '교란해도 대조군과 같음', relative: true, chance: 1 / 3 },
    present:           { label: '있음 (검출됨 · 도달함)', chance: 1 / 2 },
    absent:            { label: '없음 (검출 안 됨 · 도달 안 함)', chance: 1 / 2 },
    monotone_increase: { label: '시간에 따라 단조 증가', chance: 1 / 3 },
    monotone_decrease: { label: '시간에 따라 단조 감소', chance: 1 / 3 },
    order:             { label: '사건 순서 — { order: [대상, 대상, …] } 앞의 것이 먼저 (대상은 읽을 거리 종류의 대상)' },
  },
  qualitativeSources: ['DOI', 'PMID'], // 정성 관찰은 1차 문헌만 — 교과서·추론은 정성 관찰이 될 수 없다 (한계·메모로)
  // 형식 v12 §5 — 값·관찰의 맥락 열쇠. 이 여섯만 열쇠에 들어가고(빈 칸 null, 키 정렬 JSON), 자유 문장은 scope(맥락 설명)·note 로
  contextKeys: {
    species:       { label: '종 (NCBI taxon, 어휘 taxa) — 필수 여부는 속성 어휘(obsProperties.speciesRequired)·관찰 조건(필수)이 정한다' },
    cell:          { label: '세포 유형 (어휘 cells)' },
    location:      { label: '위치 (어휘 locations)' },
    condition:     { label: '조건 — 정의항 번호 목록 (자극·약물 등)' },
    temperature_K: { label: '온도 (K)' },
    pH:            { label: 'pH' },
  },
  // 형식 v12 §6 — 번호 이동. 번호는 재사용하지 않는다
  moveKinds: {
    merge: { label: '다른 번호에 합쳐짐 (대상 하나)', targets: 1 },
    split: { label: '여러 번호로 나뉨 (대상 둘 이상)', targets: 2 },
  },
  obsUses: {
    estimation: { label: '상수 추정용 — kinetics.from 이 참조할 수 있음, 판정에 쓰지 않음' },
    validation: { label: '검증용 — 사법부 관찰 비교만, 상수 추정에 쓰지 않음' },
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
    CL:       { pattern: '^CL:[0-9]{7}$', url: 'https://www.ebi.ac.uk/ols4/ontologies/cl/classes?obo_id={id}' },
    InterPro: { pattern: '^IPR[0-9]{6}$', url: 'https://www.ebi.ac.uk/interpro/entry/InterPro/{id}' },
    PMID:     { pattern: '^[0-9]+$', url: 'https://pubmed.ncbi.nlm.nih.gov/{id}' },
    DOI:      { pattern: '^10\\.[0-9]{4,}/\\S+$', url: 'https://doi.org/{id}' },
  },
  // 외부 ID 의 역할 (ChEBI 실험, 2026-10-10): 같은 분자에 ChEBI 항목이 세 종류 있다 — 중성 모체·pH 7.3 우세 이온 종·이온화 상태를 묶은 분류.
  // 규약을 선언하지 않으면 셋이 섞여 화학식 대조가 조용히 건너뛰어진다(분류 항목은 화학식이 없다). 엔진·상호 운용이 읽는 것은 physiological 하나.
  xrefRoles: {
    physiological: { label: 'pH 7.3 우세 종 (반응 참여자 — 엔진·상호 운용이 읽는 번호)', note: '큐레이션된 반응 DB(Rhea)가 반응식에 쓰는 종. 중성 분자(포도당·CO₂)는 모체와 같은 번호다. 화학식이 있어야 한다 — 분류 항목은 쓸 수 없다.' },
    parent:        { label: '중성 모체 (화학 정체성)', note: '양성자가 다 붙은 전하 0 의 화합물. physiological 과 다를 때만 함께 적고, 둘은 ChEBI 의 conjugate acid/base 관계로 이어져 있어야 한다.' },
    class:         { label: '이온화·중합 상태를 묶은 분류', note: '단일 종이 없는 물질(중합체·불균일 물질 — 글리코겐·지질다당류)만. 화학식이 없으므로 셀 수 있는 저분자의 번호로는 쓸 수 없다.' },
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
