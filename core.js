// 맥락 보존형 생명과학 데이터베이스 — 공용 로직 (브라우저 viewer.html 과 Node dbtool.mjs 가 함께 사용). 형식 v4.
//
// 두 해상도 (DESIGN-v4.md)
//   지식 해상도 — 정의항(D, 원천): 가능한 가장 높은 구조적 진실. 구성 요소(소단위·보조인자), 막 위상, 부위(종별 잔기 번호, 막 면),
//                 규칙(상태 의미·전이), 설명, 관찰을 하위 번호로 소유한다. 모르는 값은 지어내지 않고 '모름'으로 명시한다.
//   시뮬레이션 해상도 — 묶음(B)·단계(S, 결과): 의미 있는 변화만 담는 최소 참조 집합.
//                 묶음 = "D|부위:특징|…|위치" 파생 키, 단계 = "이 규칙이 이 묶음들에 적용됨". 라벨·설명문을 갖지 않는다.
//   규칙 — 두 해상도의 다리. 원천의 부위·구조 능력으로부터 결과의 변화량을 정하고, 단계는 규칙에 맞는지 검사된다.
//
// 식별자: 개념 T000001, 정의항 D000001, 단계 S000001 (meta.next 로만 배정, 재사용 금지).
//   하위 번호: D…/site/키, D…/rule/키, D…/desc/n, D…/obs/n.  묶음 키: D000044|reg_phos:phosphorylated|cytosol
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vocab.js'));
  else root.DefDB = factory(root.DefDBVocab);
})(typeof self !== 'undefined' ? self : this, function (V) {
  'use strict';

  const FORMAT = 'definition-db', PATCH_FORMAT = 'definition-db-patch', VERSION = 9;

  const REL = {
    is_a:         { axis: 'kind',     dir: 'up',   label: '~의 일종' },
    has_kind:     { axis: 'kind',     dir: 'down', label: '하위 종류로 ~를 가짐' },
    part_of:      { axis: 'part',     dir: 'up',   label: '~의 구성요소' },
    has_part:     { axis: 'part',     dir: 'down', label: '구성요소로 ~를 가짐' },
    instance_of:  { axis: 'instance', dir: 'up',   label: '~의 사례' },
    has_instance: { axis: 'instance', dir: 'down', label: '사례로 ~를 가짐' },
    requires:     { axis: null, label: '조건/전제',  inverse: '이를 전제로 하는 정의' },
    contrasts:    { axis: null, label: '대비',       inverse: '대비' },
    refers:       { axis: null, label: '정의에 사용', inverse: '이 개념을 사용하는 정의' },
  };
  const UP_OF = { has_kind: 'is_a', has_part: 'part_of', has_instance: 'instance_of' };
  const AXIS_UP = { kind: '상위 범주', part: '전체', instance: '유형' };
  const AXIS_DOWN = { kind: '하위 범주', part: '구성요소', instance: '사례' };
  const ROLE = { agent: '촉매/행위자', input: '소비(입력)', output: '생성(출력)', regulator: '조절자' };
  const EFFECT_TYPES = ['modify', 'convert', 'dissociate', 'associate', 'transport', 'transfer', 'degrade'];
  // 동일성 보존을 검사하는 효과 (화학 변환이 없는 물리적 변화)
  const CONSERVING = new Set(['dissociate', 'associate', 'transport', 'transfer', 'degrade']);

  const ID_RE = { T: /^T\d{6}$/, D: /^D\d{6}$/, S: /^S\d{6}$/, L: /^L\d{6}$/ };
  const fmtId = (p, n) => p + String(n).padStart(6, '0');
  const isId = (p, id) => ID_RE[p].test(String(id));
  const isTemp = (p, id) => !id || new RegExp('^' + p + '\\+').test(String(id));
  const isStepId = (id) => isId('S', id);

  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const str = (s) => (s == null ? '' : String(s)).normalize('NFC').trim();
  const arr = (a) => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]);
  const uniq = (a) => [...new Set(a)];
  const RESERVED = /[#@|/]/;
  const RES_RE = new RegExp(V.residuePattern), SITE_RE = new RegExp(V.siteKeyPattern);
  const MOLECULAR = new Set(V.groups.molecular);
  const isParticipantKind = (k) => !!(V.kinds[k] && V.kinds[k].participant);

  // ===== 이름 정규화 =====
  const GREEK = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'κ': 'kappa', 'μ': 'mu' };
  function normName(s) {
    return String(s || '').normalize('NFKC').toLowerCase().replace(/[αβγδεκμ]/g, (c) => GREEK[c]).replace(/[\s\-_·•.,'’"()[\]{}/:]/g, '');
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function similar(query, names, n) {
    const q = normName(query);
    return names.map((x) => ({ x, s: q && (normName(x).includes(q) || q.includes(normName(x))) ? 0 : lev(q, normName(x)) }))
      .filter((o) => o.s <= 2).sort((a, b) => a.s - b.s).slice(0, n || 5).map((o) => o.x);
  }

  // ===== 통제 어휘 매핑 =====
  const VTABLES = ['kinds', 'fields', 'actions', 'activity', 'effects', 'locations', 'faces', 'associations', 'features', 'siteTypes',
    'tissues', 'cells', 'taxa', 'obsProperties', 'evidenceLevels', 'gapTypes', 'kineticLaws', 'lifecycleFates', 'tiers', 'signatureLevels', 'commitmentCriteria'];
  const VNAME = { kinds: 'kind', fields: '분야(field)', actions: '변화 종류(action)', activity: '활성(activity)', effects: '조절 효과(effect)',
    locations: '위치(location)', faces: '막 면(face)', associations: '막 결합 방식(association)', features: '특징(feature)', siteTypes: '부위 종류',
    tissues: '조직(tissue)', cells: '세포(cell)', taxa: '종(species/taxa)', obsProperties: '관찰 속성(property)', evidenceLevels: '근거 수준', gapTypes: '한계 종류', kineticLaws: '속도 법칙', lifecycleFates: '분해 산물의 운명(fate)', tiers: '층(tier)', signatureLevels: '표지 수준(level)', commitmentCriteria: '결정 기준(criterion)' };
  const VIX = {};
  for (const table of VTABLES) {
    const m = new Map();
    for (const [key, v] of Object.entries(V[table])) for (const n of [key, v.label, v.name, ...(v.aliases || [])]) if (n) m.set(normName(n), key);
    VIX[table] = m;
  }
  function mapVocab(table, value) {
    const v = str(value);
    if (!v) return { error: `${VNAME[table]} 없음` };
    if (V[table][v]) return { key: v };
    const key = VIX[table].get(normName(v));
    if (key) return { key, mapped: true };
    const sug = similar(v, Object.keys(V[table]));
    return { error: `${VNAME[table]} '${v}' 은(는) 어휘 목록에 없음 — 가능한 값: ${(sug.length ? sug : Object.keys(V[table])).join(', ')}` };
  }
  const vlabel = (table, k) => (V[table][k] && (V[table][k].label || k)) || k;
  function parseXref(x) {
    if (isObj(x)) return { db: str(x.db), id: str(x.id), status: str(x.status) || 'asserted', note: str(x.note) || undefined };
    const s = str(x);
    for (const [db, v] of Object.entries(V.xrefs)) if (!['NCBIGene', 'PMID'].includes(db) && new RegExp(v.pattern).test(s)) return { db, id: s, status: 'asserted' };
    const i = s.indexOf(':');
    return i > 0 ? { db: s.slice(0, i), id: s.slice(i + 1), status: 'asserted' } : { db: '', id: s, status: 'asserted' };
  }
  const xrefKey = (x) => `${x.db}:${x.id}`;
  const xrefLabel = (x) => (/^[A-Z]+[: ]/.test(x.id) ? x.id : `${x.db}:${x.id}`);
  const fpKey = (f) => `${f.scheme}:${f.value}`;

  // ===== 위치 계층 =====
  const locAncestors = (l) => { const out = []; let c = l; while (c && V.locations[c]) { out.push(c); c = V.locations[c].parent; } return out; };
  const locSides = (l) => { for (const a of locAncestors(l)) if (V.locations[a].sides) return V.locations[a].sides; return {}; };
  const sameFamily = (a, b) => locAncestors(a).includes(b) || locAncestors(b).includes(a);
  // 두 위치가 상호작용할 수 있는가. face: 2D 쪽 분자가 그 상호작용에 쓰는 막 면
  function locCompatible(a, b, face) {
    const A = V.locations[a], B = V.locations[b];
    if (!A || !B) return { ok: false, why: '위치 없음' };
    if (sameFamily(a, b)) return { ok: true };
    if (A.dim === '3D' && B.dim === '3D') return { ok: false, why: `${A.label}와(과) ${B.label}은(는) 막을 사이에 둔 다른 부피 — 직접 반응할 수 없음(수송 필요)` };
    if (A.dim === '2D' && B.dim === '2D') return { ok: false, why: `${A.label}와(과) ${B.label}은(는) 다른 막` };
    const [mem, vol] = A.dim === '2D' ? [a, b] : [b, a];
    const sides = locSides(mem), allowed = face ? (sides[face] ? [sides[face]] : []) : Object.values(sides);
    if (locAncestors(vol).some((x) => allowed.includes(x))) return { ok: true };
    return { ok: false, why: `${V.locations[vol].label}은(는) ${V.locations[mem].label}의 ${face ? vlabel('faces', face) : '어느 면'}과도 맞닿지 않음` };
  }
  const taxAncestors = (t) => { const out = []; let c = t; while (c && V.taxa[c]) { out.push(c); c = V.taxa[c].parent; } return out; };

  // ===== 묶음 키 =====
  function parseBundle(key) {
    const parts = String(key || '').split('|').map(str);
    if (parts.length < 2) return { error: `묶음 키 '${key}' 형식 틀림 — 'D…|부위:특징|위치'` };
    const base = parts[0], location = parts[parts.length - 1], features = [];
    for (const f of parts.slice(1, -1)) {
      const i = f.indexOf(':');
      if (i <= 0) return { error: `묶음 키 '${key}' 의 특징 '${f}' 형식 틀림 — '부위:특징'` };
      features.push({ site: f.slice(0, i), feature: f.slice(i + 1) });
    }
    return { base, features, location };
  }
  const bundleKey = (b) => [b.base, ...b.features.map((f) => `${f.site}:${f.feature}`).sort(), b.location].join('|');

  // ===== 정규화 =====
  function emptyDB() { return { format: FORMAT, version: VERSION, meta: { next: { T: 1, D: 1, S: 1, L: 1 } }, terms: {}, senses: {}, steps: {}, limitations: {} }; }
  function normalize(input) {
    const db = emptyDB();
    if (!isObj(input)) return db;
    if (input.version != null && Number(input.version) !== VERSION) Object.defineProperty(db, '_version', { value: Number(input.version) });
    const nx = isObj(input.meta) && isObj(input.meta.next) ? input.meta.next : {};
    for (const p of ['T', 'D', 'S', 'L']) db.meta.next[p] = Math.max(1, parseInt(nx[p], 10) || 1);
    for (const [id, t] of Object.entries(isObj(input.terms) ? input.terms : {})) if (isObj(t)) db.terms[id] = normTerm(t);
    for (const [id, d] of Object.entries(isObj(input.senses) ? input.senses : {})) if (isObj(d)) db.senses[id] = normSense(d);
    for (const [id, st] of Object.entries(isObj(input.steps) ? input.steps : {})) if (isObj(st)) db.steps[id] = normStep(st);
    for (const [id, l] of Object.entries(isObj(input.limitations) ? input.limitations : {})) if (isObj(l)) db.limitations[id] = normLimitation(l);
    return db;
  }
  function normTerm(t) {
    const n = isObj(t.names) ? t.names : { ko: t.names };
    const o = { names: { ko: str(n.ko) }, aliases: uniq(arr(t.aliases).map(str).filter(Boolean)) };
    if (str(n.en)) o.names.en = str(n.en);
    if (str(t.note)) o.note = str(t.note);
    return o;
  }
  const normEvidence = (e) => {
    if (!isObj(e)) return { level: str(e) || 'asserted' };
    const o = { level: str(e.level) || 'asserted' };
    // 출처: { db: DOI|PMID, id, citation: "저자, 연도" } 하나 또는 여러 개
    const src = arr(e.sources || e.source).filter(Boolean).map((x) => { const r = parseXref(x), c = isObj(x) ? str(x.citation) : ''; return c ? { db: r.db, id: r.id, citation: c } : { db: r.db, id: r.id }; });
    if (src.length) o.sources = src;
    if (str(e.basis)) o.basis = str(e.basis);
    if (str(e.note)) o.note = str(e.note);
    if (str(e.tool)) o.tool = str(e.tool);
    if (e.confidence != null && e.confidence !== '') o.confidence = Number(e.confidence);
    return o;
  };
  const normContext = (c) => {
    if (!isObj(c)) return { scope: str(c) };
    const o = { scope: str(c.scope) };
    for (const k of ['species', 'tissue', 'cell', 'location', 'condition']) if (str(c[k])) o[k] = str(c[k]);
    return o;
  };
  function normDesc(d) {
    const o = { text: str(d.text), field: str(d.field), context: normContext(d.context), links: [] };
    if (str(d.genus)) o.genus = str(d.genus);
    for (const l of arr(d.links)) {
      if (!isObj(l)) continue;
      const nl = { to: str(l.to), rel: str(l.rel) };
      if (str(l.span)) nl.span = str(l.span);
      if (str(l.note)) nl.note = str(l.note);
      o.links.push(nl);
    }
    o.examples = arr(d.examples).map(str).filter(Boolean);
    o.evidence = normEvidence(d.evidence);
    for (const k of ['note', 'source', 'by', 'at']) if (str(d[k])) o[k] = str(d[k]);
    return o;
  }
  function normSite(s) {
    const o = { type: str(s.type), features: uniq(arr(s.features).map(str).filter(Boolean)) };
    if (isObj(s.numbering)) { o.numbering = {}; for (const [t, r] of Object.entries(s.numbering)) if (str(r)) o.numbering[str(t)] = str(r); }
    if (s.residue_unknown) o.residue_unknown = true;
    for (const k of ['on', 'face', 'ligand', 'note']) if (str(s[k])) o[k] = str(s[k]);
    // 특징마다 다른 리간드 (예: Gs 뉴클레오타이드 부위 GDP_bound → GDP, GTP_bound → GTP) — 질량 감사가 리간드를 실체로 센다
    if (isObj(s.ligands)) { o.ligands = {}; for (const [f, x] of Object.entries(s.ligands)) if (str(x)) o.ligands[str(f)] = str(x); }
    if (arr(s.taxa).length) o.taxa = arr(s.taxa).map(str);
    // 고해상도 반응 중심: 3차원 구조 참조 (좌표는 저장하지 않고 구조 데이터베이스를 가리킨다)
    if (isObj(s.structure)) { o.structure = { db: str(s.structure.db) || 'PDB', id: str(s.structure.id) }; for (const k of ['chain', 'residues', 'note']) if (str(s.structure[k])) o.structure[k] = str(s.structure[k]); }
    return o;
  }
  function normRule(r) {
    const o = { id: str(r.id), type: str(r.type) || (r.effect ? 'transition' : 'meaning'), label: str(r.label) };
    const qty = (x) => (isObj(x) ? (() => { const q = { ref: str(x.ref), n: x.n === 'sequence_length' ? 'sequence_length' : Number(x.n == null ? 1 : x.n) }; if (str(x.location)) q.location = str(x.location); if (x.saturating) q.saturating = true; return q; })() : { ref: str(x), n: 1 });
    if (o.type === 'supply') {
      // 대사물 공급 규칙: 저장소의 consumes → produces (where 한 곳에서). source: 계 밖에서 들어오는 공급(부분 수지 불균형 허용)
      o.consumes = arr(r.consumes).map(qty).filter((q) => q.ref);
      o.produces = arr(r.produces).map(qty).filter((q) => q.ref);
      o.where = arr(r.where).map(str).filter(Boolean);
      if (r.source) o.source = true;
      if (str(r.text)) o.text = str(r.text);
    } else if (o.type === 'degradation') {
      // 분해 규칙: 소유 정의항의 묶음이 1차 속도(k_deg)로 분해된다. fate lost | recycled (recycle_to 의 구성 단위가 저장소로)
      o.fate = str(r.fate);
      o.recycle_to = arr(r.recycle_to).map(qty).filter((q) => q.ref);
      o.when = {};
      if (isObj(r.when)) for (const [s, f] of Object.entries(r.when)) o.when[str(s)] = str(f);
      if (arr(r.where).length) o.where = arr(r.where).map(str);
      if (str(r.text)) o.text = str(r.text);
    } else if (o.type === 'modulation') {
      // 조절 규칙 (v9): 소유자(조절자)의 묶음 '소유자|at' 농도가 대상 규칙(target)의 속도를 힐 배율로 바꾼다. via = 생략한 매개 분자(출처 기록)
      o.target = str(r.target);
      o.effect = str(r.effect) || 'activates';
      o.at = str(r.at);
      o.via = arr(r.via).map(str).filter(Boolean);
      if (str(r.text)) o.text = str(r.text);
    } else if (o.type === 'meaning') {
      o.when = {};
      if (isObj(r.when)) for (const [s, f] of Object.entries(r.when)) o.when[str(s)] = str(f);
      o.activity = str(r.activity);
    } else {
      o.action = str(r.action);
      o.agent = !!r.agent;
      if (str(r.via_site)) o.via_site = str(r.via_site);
      if (str(r.via_component)) o.via_component = str(r.via_component);
      const e = isObj(r.effect) ? r.effect : {};
      o.effect = { type: str(e.type) };
      for (const k of ['target', 'site', 'partner', 'from', 'to', 'complex', 'from_site', 'component']) if (str(e[k])) o.effect[k] = str(e[k]);
      for (const k of ['add', 'remove', 'consumes', 'produces']) if (arr(e[k]).length) o.effect[k] = arr(e[k]).map(str);
      // 전제 조건: 입력 묶음이 이 특징을 이미 가져야 함 (ref 생략 = 대상/복합체)
      if (arr(e.requires).length) o.effect.requires = arr(e.requires).filter(isObj).map((q) => { const x = { site: str(q.site), feature: str(q.feature) }; if (str(q.ref)) x.ref = str(q.ref); return x; });
      if (isObj(e.partner_site)) o.effect.partner_site = { component: str(e.partner_site.component), sites: uniq(arr(e.partner_site.sites || e.partner_site.site).map(str).filter(Boolean)) };
      if (isObj(r.with)) o.with = { consumes: arr(r.with.consumes).map(str), produces: arr(r.with.produces).map(str) };
      o.regulators = arr(r.regulators).filter(isObj).map((g) => { const x = { ref: str(g.ref), effect: str(g.effect) || 'activates' }; if (str(g.note)) x.note = str(g.note); return x; });
      if (arr(r.where).length) o.where = arr(r.where).map(str);
      if (str(r.text)) o.text = str(r.text);
    }
    if (arr(r.taxa).length) o.taxa = arr(r.taxa).map(str);
    if (isObj(r.kinetics)) o.kinetics = normKinetics(r.kinetics);
    o.evidence = normEvidence(r.evidence);
    return o;
  }
  // 반응 속도: 값은 SI 정준 단위로만 저장한다 (k_on M⁻¹s⁻¹, k_off·kcat s⁻¹, Kd·Km M, mass_action k 는 M^(1-order)·s⁻¹)
  function normKinetics(k) {
    const o = { law: str(k.law) };
    for (const f of KIN_FIELDS) if (k[f] != null && k[f] !== '') o[f] = Number(k[f]);
    if (k.reversible) o.reversible = true;
    // v8: 환경 보정 ΔG_env = dG_dpH·(pH − pH_ref) + dG_dinv_eps·(1/ε − 1/eps_ref)
    if (isObj(k.env)) { o.env = {}; for (const f of ENV_FIELDS) if (k.env[f] != null && k.env[f] !== '') o.env[f] = Number(k.env[f]); }
    if (isObj(k.context)) o.context = normContext(k.context);
    o.evidence = normEvidence(k.evidence);
    return o;
  }
  const KIN_FIELDS = ['k', 'k_r', 'order', 'k_on', 'k_off', 'Kd', 'kcat', 'Km', 'half_life', 'k0', 'dG_act', 'dG0', 'K', 'n', 'fmax', 'fmin'];
  const SIGNED_KIN = new Set(['dG_act', 'dG0', 'fmin']); // 자유 에너지(J/mol)는 음수일 수 있음 (dG_act 는 음수면 오류)
  const ENV_FIELDS = ['pH_ref', 'dG_dpH', 'eps_ref', 'dG_dinv_eps'];
  function normObs(b) {
    const o = { property: str(b.property), value: typeof b.value === 'number' ? b.value : str(b.value), context: normContext(b.context), evidence: normEvidence(b.evidence) };
    if (str(b.unit)) o.unit = str(b.unit);
    if (str(b.note)) o.note = str(b.note);
    return o;
  }
  const SENSE_FIELDS = ['kind', 'tier', 'reference_species', 'membrane', 'xrefs', 'unmapped', 'fingerprint', 'components', 'moieties', 'desc', 'site', 'rule', 'obs', 'motif', 'addresses', 'gap_review', 'distinction', 'note', 'signature', 'metabolome', 'transitions', 'elements'];
  function normSense(d) {
    const o = { term: str(d.term), n: parseInt(d.n, 10) || 0, kind: str(d.kind) };
    if (str(d.tier)) o.tier = str(d.tier);
    if (str(d.reference_species)) o.reference_species = str(d.reference_species);
    if (isObj(d.membrane)) { o.membrane = { association: str(d.membrane.association) }; for (const k of ['location', 'side']) if (str(d.membrane[k])) o.membrane[k] = str(d.membrane[k]); }
    o.xrefs = arr(d.xrefs).map(parseXref).map((x) => (x.note ? x : { db: x.db, id: x.id, status: x.status }));
    if (str(d.unmapped)) o.unmapped = str(d.unmapped);
    if (isObj(d.fingerprint) && str(d.fingerprint.value)) o.fingerprint = { scheme: str(d.fingerprint.scheme), value: str(d.fingerprint.value), status: str(d.fingerprint.status) || 'asserted' };
    o.components = arr(d.components).filter(isObj).map((c) => { const x = { ref: str(c.ref), n: parseInt(c.n, 10) || 1 }; if (str(c.role)) x.role = str(c.role); return x; });
    // 화학 부분 구조(moiety) 수: 질량 수지를 원자 대신 보존되는 부분 구조(아데노신·인산기 …)로 센다
    if (arr(d.moieties).length) o.moieties = arr(d.moieties).filter(isObj).map((m) => ({ ref: str(m.ref), n: Number(m.n == null ? 1 : m.n) }));
    o.desc = arr(d.desc).filter(isObj).map(normDesc);
    o.site = {};
    if (isObj(d.site)) for (const [k, s] of Object.entries(d.site)) if (isObj(s)) o.site[str(k)] = normSite(s);
    o.rule = arr(d.rule).filter(isObj).map(normRule);
    o.obs = arr(d.obs).filter(isObj).map(normObs);
    // 상위 개념: motif = 경로에서 자동으로 찾는 패턴(MOTIFS 의 키), addresses = 이 개념이 해결하려는 한계(L…)와 방법
    if (str(d.motif)) o.motif = str(d.motif);
    if (arr(d.addresses).length) o.addresses = arr(d.addresses).filter(isObj).map((a) => ({ limitation: str(a.limitation), how: str(a.how) }));
    for (const k of ['gap_review', 'distinction', 'note']) if (str(d[k])) o[k] = str(d[k]);
    // 부분 구조의 원자 수 (구조 요소 정의항): 화학식 대조용 — 엔진 코드가 아니라 데이터가 화학을 안다
    if (isObj(d.elements)) { o.elements = {}; for (const [e, n] of Object.entries(d.elements)) o.elements[str(e)] = Number(n); }
    // 세포 상태 (v9): 표지 서명 · 대사 프로그램(공급 규칙과 그 수준) · 다른 상태로의 전이(신호·결정 기준)
    if (arr(d.signature).length) o.signature = arr(d.signature).filter(isObj).map((m) => ({ ref: str(m.ref), level: str(m.level), location: str(m.location) }));
    if (arr(d.metabolome).length) o.metabolome = arr(d.metabolome).filter(isObj).map((m) => ({ ref: str(m.ref), level: str(m.level) }));
    if (arr(d.transitions).length) o.transitions = arr(d.transitions).filter(isObj).map((t) => {
      const x = { to: str(t.to), signals: arr(t.signals).map(str).filter(Boolean), commitment: { criterion: str(isObj(t.commitment) ? t.commitment.criterion : t.commitment) } };
      if (str(t.text)) x.text = str(t.text);
      x.evidence = normEvidence(t.evidence);
      return x;
    });
    Object.defineProperty(o, '_given', { value: Object.fromEntries(SENSE_FIELDS.map((k) => [k, k in d])) });
    return o;
  }
  // 단계 참여자: { b: 묶음 키, n, minor } — 패치에서는 { ref, features, location } 도 받는다(병합 때 키로 바뀜)
  function normPart(p) {
    if (typeof p === 'string') return { b: str(p) };
    if (!isObj(p)) return null;
    const o = {};
    if (str(p.b)) o.b = str(p.b);
    else { o.raw = { ref: str(p.ref), location: str(p.location), features: isObj(p.features) ? Object.entries(p.features).map(([s, f]) => `${s}:${f}`) : arr(p.features).map(str) }; }
    if (parseInt(p.n, 10) > 1) o.n = parseInt(p.n, 10);
    if (p.minor) o.minor = true;
    return o;
  }
  function normStep(st) {
    const o = { rule: isObj(st.rule) ? `${str(st.rule.owner)}/rule/${str(st.rule.id)}` : str(st.rule) };
    for (const k of ['agents', 'inputs', 'outputs', 'regulators']) o[k] = arr(st[k]).map(normPart).filter(Boolean);
    o.part_of = arr(st.part_of).map(str).filter(Boolean);
    return o;
  }

  // ===== 한계 등록부 (Limitation & Constraint Registry) =====
  // { target: D… | D…/site/키 | D…/rule/키 | S…, type: Kinetic_Gap|Concentration_Gap|Structural_Gap,
  //   requirement: { text, needs: [ {kind:'obs', property, on, cell?, location?} | {kind:'residue', site} | {kind:'xref', db, on} | {kind:'manual', text} ] },
  //   found_in, note, resolution: { note, evidence } (manual 해결), by, at }
  // 상태는 저장하지 않고 계산한다: 필요한 데이터가 모두 들어오면 resolved.
  function normNeed(n) {
    if (!isObj(n)) return { kind: 'manual', text: str(n) };
    const o = { kind: str(n.kind) || (n.property ? 'obs' : n.site ? 'residue' : n.db ? 'xref' : 'manual') };
    for (const k of ['property', 'on', 'cell', 'location', 'site', 'db', 'text', 'rule']) if (str(n[k])) o[k] = str(n[k]);
    if (arr(n.params).length) o.params = arr(n.params).map(str);
    return o;
  }
  function normLimitation(l) {
    const r = isObj(l.requirement) ? l.requirement : { text: str(l.requirement) };
    const o = { target: str(l.target), type: str(l.type), requirement: { text: str(r.text), needs: arr(r.needs).map(normNeed) } };
    for (const k of ['found_in', 'note', 'by', 'at']) if (str(l[k])) o[k] = str(l[k]);
    if (isObj(l.resolution)) o.resolution = { note: str(l.resolution.note), evidence: normEvidence(l.resolution.evidence) };
    return o;
  }
  // 대상 문자열 → { base: D/S 번호, sub: 'site'|'rule'|null, key }
  function parseTarget(t) {
    const m = String(t || '').match(/^([DS]\d{6})(?:\/(site|rule)\/(.+))?$/);
    return m ? { base: m[1], sub: m[2] || null, key: m[3] || null } : null;
  }
  function needMet(db, n) {
    if (n.kind === 'obs') {
      const d = db.senses[n.on];
      return !!d && d.obs.some((o) => o.property === n.property && (!n.cell || o.context.cell === n.cell) && (!n.location || o.context.location === n.location));
    }
    if (n.kind === 'residue') {
      const t = parseTarget(n.site), d = t && db.senses[t.base], st = d && d.site[t.key];
      return !!st && !st.residue_unknown && !!st.numbering && !!(st.numbering[d.reference_species || V.defaultReferenceSpecies] || Object.keys(st.numbering).length);
    }
    if (n.kind === 'xref') { const d = db.senses[n.on]; return !!d && d.xrefs.some((x) => x.db === n.db); }
    if (n.kind === 'kinetics') {
      const t = parseTarget(n.rule), d = t && db.senses[t.base], r = d && d.rule.find((x) => x.id === t.key);
      // 분해 규칙은 k(k_deg) 와 half_life 가 서로를 대신한다 (k = ln2 / t½)
      const alt = (f) => r.type === 'degradation' && (f === 'k' || f === 'half_life') ? r.kinetics.k > 0 || r.kinetics.half_life > 0 : false;
      return !!(r && r.kinetics && (n.params || []).every((f) => (SIGNED_KIN.has(f) ? Number.isFinite(r.kinetics[f]) : r.kinetics[f] > 0) || alt(f)));
    }
    return false; // manual: resolution 으로만 닫힘
  }
  function limitationStatus(db, l) {
    const met = l.requirement.needs.map((n) => needMet(db, n));
    const auto = met.length > 0 && met.every(Boolean);
    return { status: auto ? 'resolved' : l.resolution ? 'resolved_manual' : 'open', met, done: met.filter(Boolean).length, total: met.length };
  }

  // ===== 색인 =====
  function index(db) {
    const senses = new Map(), termSenses = new Map(), names = new Map(), xrefs = new Map(), fps = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const [tid, t] of Object.entries(db.terms)) {
      termSenses.set(tid, []);
      for (const n of uniq([t.names.ko, t.names.en, ...t.aliases].filter(Boolean))) push(names, normName(n), { term: tid, name: n });
    }
    for (const [id, d] of Object.entries(db.senses)) {
      senses.set(id, d);
      if (termSenses.has(d.term)) termSenses.get(d.term).push(id);
      for (const x of d.xrefs) push(xrefs, xrefKey(x), id);
      if (d.fingerprint) push(fps, fpKey(d.fingerprint), id);
    }
    for (const ids of termSenses.values()) ids.sort((a, b) => db.senses[a].n - db.senses[b].n);
    const termName = (tid) => (db.terms[tid] ? db.terms[tid].names.ko : tid);
    const label = (id) => {
      if (db.senses[id]) { const d = db.senses[id], many = (termSenses.get(d.term) || []).length > 1; return termName(d.term) + (many ? '#' + d.n : ''); }
      if (db.terms[id]) return termName(id);
      if (db.steps[id]) { const sr = ruleOf(db.steps[id].rule); return sr ? sr.label : id; }
      const r = ruleOf(id); if (r) return r.label;
      return id;
    };
    // 개념 연결: 모든 설명의 연결을 모은다
    const edges = [];
    for (const [id, d] of senses) d.desc.forEach((ds, di) => ds.links.forEach((link, i) => {
      const r = REL[link.rel] || {};
      const e = { from: id, desc: di, link, i, target: link.to, status: senses.has(link.to) ? 'ok' : 'missing', rel: link.rel, axis: r.axis || null };
      if (r.axis) { e.child = r.dir === 'up' ? id : link.to; e.parent = r.dir === 'up' ? link.to : id; }
      edges.push(e);
    }));
    // 구성 요소도 part 축의 위계로 본다 (복합체가 소유하는 구조 관계)
    for (const [id, d] of senses) for (const c of d.components) edges.push({ from: id, link: { rel: 'has_part', to: c.ref, note: `구성 요소 ×${c.n}${c.role ? ' · ' + c.role : ''}` }, target: c.ref, status: senses.has(c.ref) ? 'ok' : 'missing', rel: 'has_part', axis: 'part', child: c.ref, parent: id, component: true });
    const up = new Map(), down = new Map(), side = new Map();
    for (const e of edges) {
      if (e.axis) { push(up, e.child, e); push(down, e.parent, e); }
      else { push(side, e.from, e); if (e.target !== e.from) push(side, e.target, e); }
    }
    const children = (n) => down.get(n) || [];
    function ruleOf(ref) {
      const m = String(ref).match(/^(D\d{6})\/rule\/(.+)$/);
      if (!m || !db.senses[m[1]]) return null;
      return db.senses[m[1]].rule.find((r) => r.id === m[2]) || null;
    }
    const ruleOwner = (ref) => String(ref).split('/')[0];
    // 활성: 원천의 상태 의미 규칙을 차례로 적용 (첫 번째로 맞는 규칙, when 이 비면 기본값)
    function activityOf(key) {
      const b = parseBundle(key), d = db.senses[b.base];
      if (!d || b.error) return 'unknown';
      const has = new Map(b.features.map((f) => [f.site, f.feature]));
      for (const r of d.rule) if (r.type === 'meaning' && Object.entries(r.when).every(([s, f]) => has.get(s) === f)) return r.activity || 'unknown';
      return 'unknown';
    }
    const siteLabel = (base, s) => {
      const d = db.senses[base], st = d && d.site[s];
      const res = st && st.numbering && (st.numbering[d.reference_species || V.defaultReferenceSpecies] || Object.values(st.numbering)[0]);
      return s + (res ? `(${res})` : '');
    };
    const bundleLabel = (key) => {
      const b = parseBundle(key);
      if (b.error) return key;
      const fs = b.features.map((f) => `${siteLabel(b.base, f.site)}:${vlabel('features', f.feature)}`);
      return `${label(b.base)}${fs.length ? '[' + fs.join(', ') + ']' : ''}@${vlabel('locations', b.location)}`;
    };
    const limitsOf = new Map(), addressedBy = new Map();
    for (const [lid, l] of Object.entries(db.limitations || {})) { const t = parseTarget(l.target); if (t) push(limitsOf, t.base, lid); }
    for (const [id, d] of senses) for (const a of d.addresses || []) push(addressedBy, a.limitation, id);
    return Object.assign({ db, senses, termSenses, names, xrefs, fps, edges, label, termName, ruleOf, ruleOwner, activityOf, bundleLabel, siteLabel,
      limitsOf: (id) => limitsOf.get(id) || [], addressedBy: (lid) => addressedBy.get(lid) || [],
      parents: (n) => up.get(n) || [], children, sides: (n) => side.get(n) || [] }, mechIndex(db, children));
  }
  const lookupName = (ix, name) => uniq((ix.names.get(normName(name)) || []).map((h) => h.term));

  // ===== 기전 색인: 단계끼리는 묶음 키가 같을 때 이어진다 =====
  function mechIndex(db, children) {
    const steps = new Map(), byKey = new Map(), byBase = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const [id, st] of Object.entries(db.steps)) {
      const uses = [...st.agents.map((p) => ({ p, role: 'agent' })), ...st.inputs.map((p) => ({ p, role: 'input' })), ...st.regulators.map((p) => ({ p, role: 'regulator' }))];
      const makes = st.outputs.map((p) => ({ p, role: 'output' }));
      steps.set(id, { id, step: st, uses, makes });
      for (const u of [...uses, ...makes]) if (u.p.b) {
        push(byKey, u.p.b, { id, role: u.role, p: u.p });
        push(byBase, u.p.b.split('|')[0], { id, role: u.role, p: u.p });
      }
    }
    const next = (id) => {
      const r = steps.get(id); if (!r) return [];
      const out = [];
      for (const m of r.makes) if (!m.p.minor) for (const u of byKey.get(m.p.b) || []) if (u.id !== id && u.role !== 'output' && !u.p.minor) out.push({ id: u.id, via: m.p.b, role: u.role });
      return out;
    };
    const prev = (id) => {
      const r = steps.get(id); if (!r) return [];
      const out = [];
      for (const u of r.uses) if (!u.p.minor) for (const m of byKey.get(u.p.b) || []) if (m.id !== id && m.role === 'output' && !m.p.minor) out.push({ id: m.id, via: u.p.b, role: u.role });
      return out;
    };
    const order = (ids) => {
      const set = new Set(ids), indeg = new Map(ids.map((i) => [i, 0]));
      for (const i of ids) for (const n of new Set(next(i).map((x) => x.id))) if (set.has(n)) indeg.set(n, indeg.get(n) + 1);
      const out = [], done = new Set();
      let ready = ids.filter((i) => !indeg.get(i));
      while (out.length < ids.length) {
        if (!ready.length) ready = [ids.find((i) => !done.has(i))];
        const i = ready.shift();
        if (done.has(i)) continue;
        done.add(i); out.push(i);
        for (const n of new Set(next(i).map((x) => x.id))) if (set.has(n) && !done.has(n)) { indeg.set(n, indeg.get(n) - 1); if (indeg.get(n) <= 0 && !ready.includes(n)) ready.push(n); }
      }
      return out;
    };
    const stepsIn = (defId) => {
      const scope = new Set([defId]), queue = [defId];
      while (queue.length) for (const e of children(queue.shift())) if (e.axis === 'part' && !e.component && !scope.has(e.child)) { scope.add(e.child); queue.push(e.child); }
      return order([...steps.values()].filter((r) => r.step.part_of.some((p) => scope.has(p))).map((r) => r.id));
    };
    const roles = (defId) => byBase.get(defId) || [];
    const stepsOfRule = (ref) => [...steps.values()].filter((r) => r.step.rule === ref).map((r) => r.id);
    return { steps, next, prev, stepsIn, order, roles, stepsOfRule };
  }

  // ===== 검사 =====
  function kindAllowed(rel, srcKind, tgtKind) {
    let rules = V.relationRules[UP_OF[rel] || rel];
    if (typeof rules === 'string') rules = V.relationRules[rules.slice(1)];
    if (!rules) return true;
    const allowed = rules[srcKind];
    if (!allowed) return false;
    return allowed.some((a) => a === tgtKind || (a === '=' && srcKind === tgtKind) || (a.startsWith('@') && (V.groups[a.slice(1)] || []).includes(tgtKind)));
  }
  function checkEvidence(e, where, E) {
    const lv = V.evidenceLevels[e.level];
    if (!lv) { E(where, `근거 수준 '${e.level}' 은(는) 어휘에 없음 (${Object.keys(V.evidenceLevels).join(', ')})`); return; }
    const srcs = e.sources || [];
    if (lv.requires === 'source') {
      if (!srcs.length) E(where, `근거 수준 curated 는 출처(source: DOI 또는 PMID)가 필요함 — 출처가 없으면 asserted, 추론이면 abstracted`);
      for (const x of srcs) if (!x.citation) E(where, `출처 ${x.db}:${x.id} 에 citation("저자, 연도")이 없음`);
    }
    if (lv.requires === 'basis' && !e.basis) E(where, `${lv.label} 은(는) 무엇에서 추론했는지(basis)를 적어야 함`);
    if (lv.requires === 'tool' && !e.tool) E(where, `근거 수준 computed 는 도구(tool)가 필요함`);
    if (lv.requires === 'confidence' && !(e.confidence >= 0 && e.confidence <= 1)) E(where, `근거 수준 predicted 는 0–1 의 confidence 가 필요함`);
    if (e.confidence != null && e.level !== 'predicted') E(where, 'confidence 는 predicted 에만');
    for (const x of srcs) {
      if (!['DOI', 'PMID'].includes(x.db)) E(where, `출처 종류 '${x.db}' — 문헌 출처는 DOI 또는 PMID`);
      else if (!new RegExp(V.xrefs[x.db].pattern).test(x.id)) E(where, `출처 ${x.db} '${x.id}' 형식 틀림`);
    }
  }
  function checkContext(c, where, E) {
    if (c.species && !V.taxa[c.species]) E(where, `종 '${c.species}' 은(는) 종 어휘에 없음`);
    if (c.tissue && !V.tissues[c.tissue]) E(where, `조직 '${c.tissue}' 은(는) 어휘에 없음`);
    if (c.cell && !V.cells[c.cell]) E(where, `세포 '${c.cell}' 은(는) 어휘에 없음`);
    if (c.location && !V.locations[c.location]) E(where, `위치 '${c.location}' 은(는) 위치 어휘에 없음`);
  }
  function validate(db) {
    const errors = [], warnings = [];
    const E = (where, msg) => errors.push({ where, msg }), W = (where, msg) => warnings.push({ where, msg });
    if (db._version) E('데이터베이스', `형식 버전 ${db._version} — 버전 ${VERSION} 로 변환해야 함 (migrations/ 참고)`);
    const ix = index(db), L = ix.label;
    for (const [p, table] of [['T', db.terms], ['D', db.senses], ['S', db.steps], ['L', db.limitations]]) {
      const max = Math.max(0, ...Object.keys(table).map((id) => parseInt(id.slice(1), 10) || 0));
      if (db.meta.next[p] <= max) E('meta.next', `${p} 다음 번호(${db.meta.next[p]})가 이미 쓰인 번호(${max}) 이하 — 번호 재사용 위험`);
    }
    for (const hits of ix.names.values()) {
      const terms = uniq(hits.map((h) => h.term));
      if (terms.length > 1) E(terms.map((t) => `${t}(${ix.termName(t)})`).join(' / '), `이름 충돌 '${hits.map((h) => h.name).join("' ≈ '")}' — 같은 개념이면 합치고, 다른 개념이면 이름을 구별해야 함`);
    }
    for (const [k, ids] of ix.xrefs) if (uniq(ids).length > 1) E(uniq(ids).join(' / '), `외부 ID ${k.slice(k.indexOf(':') + 1)} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것`);
    for (const [k, ids] of ix.fps) if (uniq(ids).length > 1) E(uniq(ids).join(' / '), `구조 지문 ${k} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것`);
    for (const [tid, t] of Object.entries(db.terms)) {
      const w = `${tid}(${t.names.ko || '?'})`;
      if (!isId('T', tid)) E(tid, "개념 번호는 'T' + 숫자 6자리");
      if (!t.names.ko) E(w, '한국어 이름(names.ko) 없음');
      for (const n of [t.names.ko, t.names.en, ...t.aliases].filter(Boolean)) if (RESERVED.test(n)) E(w, `이름 '${n}' 에 # @ | / 를 쓸 수 없음`);
      if (!ix.termSenses.get(tid).length) E(w, '정의항(뜻)이 없는 개념');
    }
    for (const [id, d] of Object.entries(db.senses)) validateSense(db, ix, id, d, E, W);
    // 개념 위계 순환
    const parentsOf = new Map();
    for (const e of ix.edges) if (e.axis && e.status === 'ok') { if (!parentsOf.has(e.child)) parentsOf.set(e.child, []); parentsOf.get(e.child).push(e.parent); }
    const state = new Map();
    const dfs = (n, path) => {
      if (state.get(n) === 1) { E(n, '위계 순환: ' + [...path.slice(path.indexOf(n)), n].map(L).join(' → ')); return; }
      if (state.get(n) === 2) return;
      state.set(n, 1); path.push(n);
      for (const p of parentsOf.get(n) || []) dfs(p, path);
      path.pop(); state.set(n, 2);
    };
    for (const n of parentsOf.keys()) dfs(n, []);
    for (const [id, st] of Object.entries(db.steps)) validateStep(db, ix, id, st, E, W);
    for (const [id, l] of Object.entries(db.limitations)) validateLimitation(db, ix, id, l, E, W);
    return { errors, warnings };
  }

  function validateLimitation(db, ix, id, l, E, W) {
    const w = `${id}`;
    if (!isId('L', id)) E(id, "한계 번호는 'L' + 숫자 6자리");
    const t = parseTarget(l.target);
    if (!t) E(w, `대상 '${l.target}' 형식 — D…, D…/site/키, D…/rule/키, S…`);
    else if (t.base[0] === 'S' ? !db.steps[t.base] : !db.senses[t.base]) E(w, `대상 '${t.base}' 없음`);
    else if (t.sub === 'site' && !db.senses[t.base].site[t.key]) E(w, `대상 부위 '${l.target}' 없음`);
    else if (t.sub === 'rule' && !db.senses[t.base].rule.some((r) => r.id === t.key)) E(w, `대상 규칙 '${l.target}' 없음`);
    if (!V.gapTypes[l.type]) E(w, `한계 종류 '${l.type}' — ${Object.keys(V.gapTypes).join(' | ')}`);
    if (!l.requirement.text) E(w, '요구 사항(requirement.text) 없음 — 무엇이 있어야 해결되는지');
    if (!l.requirement.needs.length) E(w, '해결 경로(requirement.needs) 없음 — 필요한 데이터를 하나 이상');
    l.requirement.needs.forEach((n, i) => {
      const nw = `${id} 필요 ${i + 1}`;
      if (n.kind === 'obs') {
        if (!V.obsProperties[n.property]) E(nw, `관찰 속성 '${n.property}' 은(는) 어휘에 없음`);
        if (!db.senses[n.on]) E(nw, `관찰을 받을 정의항 '${n.on || ''}' 없음`);
        if (n.cell && !V.cells[n.cell]) E(nw, `세포 '${n.cell}' 은(는) 어휘에 없음`);
        if (n.location && !V.locations[n.location]) E(nw, `위치 '${n.location}' 은(는) 어휘에 없음`);
      } else if (n.kind === 'residue') {
        const s = parseTarget(n.site);
        if (!s || s.sub !== 'site' || !db.senses[s.base] || !db.senses[s.base].site[s.key]) E(nw, `잔기를 채울 부위 '${n.site || ''}' 없음 — D…/site/키`);
      } else if (n.kind === 'xref') {
        if (!V.xrefs[n.db]) E(nw, `외부 ID 종류 '${n.db}' 없음`);
        const d = db.senses[n.on];
        if (!d) E(nw, `외부 ID 를 받을 정의항 '${n.on || ''}' 없음`);
        else if (V.kinds[d.kind] && !V.kinds[d.kind].xref.allowed.includes(n.db)) E(nw, `kind '${d.kind}' 에는 ${n.db} ID 를 붙일 수 없어 이 경로로는 해결되지 않음`);
      } else if (n.kind === 'kinetics') {
        const t = parseTarget(n.rule);
        if (!t || t.sub !== 'rule' || !db.senses[t.base] || !db.senses[t.base].rule.some((r) => r.id === t.key)) E(nw, `속도 상수를 받을 규칙 '${n.rule || ''}' 없음 — D…/rule/키`);
        if (!(n.params || []).length) E(nw, '필요한 속도 상수(params) 없음');
        for (const f of n.params || []) if (!KIN_FIELDS.includes(f)) E(nw, `속도 상수 '${f}' — ${KIN_FIELDS.join(', ')}`);
      } else if (n.kind === 'manual') { if (!n.text) E(nw, 'manual 해결 경로에 설명(text) 없음'); }
      else E(nw, `해결 경로 종류 '${n.kind}' — obs | residue | xref | kinetics | manual`);
    });
    if (l.resolution) { if (!l.resolution.note) E(w, 'resolution 에 해결 설명(note) 없음'); checkEvidence(l.resolution.evidence, w, E); }
  }

  function validateSense(db, ix, id, d, E, W) {
    const L = ix.label, where = `${id}(${L(id)})`, K = V.kinds[d.kind];
    if (!isId('D', id)) E(id, "정의항 번호는 'D' + 숫자 6자리");
    if (!db.terms[d.term]) E(where, `소속 개념 '${d.term}' 없음`);
    if (!(d.n >= 1)) E(where, '뜻 번호(n) 없음');
    else if ((ix.termSenses.get(d.term) || []).filter((x) => db.senses[x].n === d.n).length > 1) E(where, `같은 개념 안에 뜻 번호 ${d.n} 이 겹침`);
    if (!K) E(where, `kind '${d.kind}' 은(는) 어휘 목록에 없음`);
    // 종
    if (K && K.species === 'required' && !d.reference_species) E(where, `kind '${d.kind}' 는 기준 종(reference_species)이 필요함 (기본 ${V.defaultReferenceSpecies})`);
    if (K && K.species === 'forbidden' && d.reference_species) E(where, `kind '${d.kind}' 는 종과 무관 — reference_species 를 두지 않음`);
    if (d.reference_species && !V.taxa[d.reference_species]) E(where, `기준 종 '${d.reference_species}' 은(는) 종 어휘에 없음`);
    // 외부 ID·지문
    const dbs = new Set();
    for (const x of d.xrefs) {
      const src = V.xrefs[x.db];
      if (!src) { E(where, `외부 ID 종류 '${x.db}' 없음`); continue; }
      if (!new RegExp(src.pattern).test(x.id)) E(where, `${x.db} ID '${x.id}' 형식이 틀림`);
      if (K && !K.xref.allowed.includes(x.db)) E(where, `kind '${d.kind}' 에는 ${x.db} ID 를 붙일 수 없음 (허용: ${K.xref.allowed.join(', ') || '없음'})`);
      if (!V.xrefStatus.includes(x.status)) E(where, `외부 ID 상태 '${x.status}' — ${V.xrefStatus.join(' | ')}`);
      dbs.add(x.db);
    }
    if (K) for (const req of K.xref.required || []) if (!dbs.has(req) && !d.unmapped) E(where, `kind '${d.kind}' 는 ${req} ID 가 필요함 — 확실한 ID 를 모르면 unmapped 에 사유를 적을 것 (추측 금지)`);
    if (d.fingerprint) {
      const f = d.fingerprint, sc = V.fingerprints[f.scheme];
      if (!sc) E(where, `지문 방식 '${f.scheme}' 없음`);
      else {
        if (!new RegExp(sc.pattern).test(f.value)) E(where, `${f.scheme} 지문 '${f.value}' 형식이 틀림`);
        if (!sc.kinds.includes(d.kind)) E(where, `kind '${d.kind}' 에는 ${f.scheme} 지문을 붙일 수 없음`);
      }
      if (!V.fingerprintStatus.includes(f.status)) E(where, `지문 상태 '${f.status}'`);
    }
    const participant = isParticipantKind(d.kind);
    // 층 (형식 v8): 분자 종류는 기본 층 T1(연속 장) | T2(규칙 행위자) 필수, 그 밖의 종류는 두지 않음. T3 은 영역 상태라 쓸 수 없음
    if (d.tier) {
      if (!V.tiers[d.tier]) E(where, `층 '${d.tier}' 은(는) 어휘에 없음 (T1 | T2)`);
      else if (d.tier === 'T3') E(where, 'T3(공간 영역)은 영역의 동적 상태 — 정의항의 기본 층은 T1 | T2');
      if (!participant) E(where, '층(tier)은 분자 종류 정의항만');
      if (d.tier === 'T1' && ['protein', 'complex', 'nucleic_acid'].includes(d.kind)) E(where, `kind '${d.kind}' 는 부위 상태를 가진 행위자 — T2`);
      if (d.tier === 'T1' && Object.keys(d.site).length) E(where, 'T1(연속 장) 분자는 부위 상태를 갖지 않음 — 부위가 있으면 T2');
    } else if (participant) E(where, '분자 종류는 기본 층(tier: T1 | T2)이 필요함 (형식 v8)');
    // 막 위상
    if (d.membrane) {
      const m = d.membrane;
      if (!participant) E(where, '막 위상은 분자 종류만 가질 수 있음');
      if (!V.associations[m.association]) E(where, `막 결합 방식 '${m.association}' 은(는) 어휘에 없음`);
      else if (m.association !== 'soluble') {
        if (!V.locations[m.location] || V.locations[m.location].dim !== '2D') E(where, `막 결합 분자는 막(2D 위치)을 membrane.location 으로 가져야 함`);
        if (['peripheral', 'lipid_anchored'].includes(m.association) && !(m.side && locSides(m.location)[m.side])) E(where, `${vlabel('associations', m.association)} 분자는 붙어 있는 막 면(membrane.side)이 필요함`);
      } else if (m.location || m.side) E(where, '수용성 분자에는 membrane.location/side 를 두지 않음');
    }
    // 구성 요소 (구조 계층)
    if (d.components.length) {
      if (d.kind !== 'complex') E(where, `구성 요소(components)는 kind complex 만 가질 수 있음 (현재 ${d.kind})`);
      for (const c of d.components) {
        const x = db.senses[c.ref];
        if (!x) E(where, `구성 요소 '${c.ref}' 없음`);
        else if (!isParticipantKind(x.kind)) E(where, `구성 요소 '${L(c.ref)}' 는 분자 종류가 아님`);
        if (c.ref === id) E(where, '자기 자신을 구성 요소로 가질 수 없음');
        if (!(c.n >= 1)) E(where, `구성 요소 개수 틀림`);
      }
    } else if (d.kind === 'complex') W(where, '복합체인데 구성 요소(components)가 없음 — 구조 계층을 채울 것');
    // 설명
    if (!d.desc.length) E(where, '설명(desc)이 하나도 없음');
    d.desc.forEach((ds, di) => {
      const dw = `${id}/desc/${di + 1}`;
      if (!ds.text) E(dw, '정의 문장(text) 없음');
      if (!V.fields[ds.field]) E(dw, `field '${ds.field}' 은(는) 어휘 목록에 없음`);
      if (!ds.context.scope) E(dw, '맥락 범위(context.scope) 없음');
      checkContext(ds.context, dw, E);
      checkEvidence(ds.evidence, dw, E);
      if (ds.genus && !ds.links.some((l) => l.rel === 'is_a' && l.to === ds.genus)) E(dw, `genus '${ds.genus}' 는 이 설명의 is_a 연결 대상이어야 함`);
      ds.links.forEach((l, i) => {
        const lw = `${dw} 연결 ${i + 1}`;
        if (!REL[l.rel]) { E(lw, `알 수 없는 관계 '${l.rel}'`); return; }
        if (l.to === id) E(lw, '자기 자신을 가리킴');
        const tg = db.senses[l.to];
        if (!tg) { E(lw, `대상 '${l.to}' 가 정의항 번호가 아니거나 없음`); return; }
        const down = !!UP_OF[l.rel];
        if (V.kinds[d.kind] && V.kinds[tg.kind] && !(down ? kindAllowed(l.rel, tg.kind, d.kind) : kindAllowed(l.rel, d.kind, tg.kind)))
          E(lw, `${l.rel}: kind '${d.kind}' → '${tg.kind}'(${L(l.to)}) 는 허용되지 않음`);
        if (l.span && !ds.text.includes(l.span)) E(lw, `근거 구절 '${l.span}' 이 정의 문장에 없음`);
        if (!l.span && !['contrasts', 'requires'].includes(l.rel)) W(lw, `(→${L(l.to)}) 근거 구절(span) 없음`);
      });
    });
    // 부위
    const sites = Object.entries(d.site);
    if (sites.length && !participant) E(where, '부위(site)는 분자 종류만 가질 수 있음');
    const memAssoc = d.membrane ? d.membrane.association : 'soluble';
    for (const [k, s] of sites) {
      const sw = `${id}/site/${k}`;
      if (!SITE_RE.test(k)) E(sw, '부위 키는 영문 소문자·숫자·_ (예: reg_phos)');
      if (!V.siteTypes[s.type]) E(sw, `부위 종류 '${s.type}' 은(는) 어휘에 없음`);
      if (!s.features.length) E(sw, '허용 특징(features)이 없음');
      for (const f of s.features) if (!V.features[f]) E(sw, `특징 '${f}' 은(는) 특징 어휘에 없음`);
      for (const [t, r] of Object.entries(s.numbering || {})) {
        if (!V.taxa[t]) E(sw, `잔기 번호의 종 '${t}' 은(는) 종 어휘에 없음`);
        if (!RES_RE.test(r)) E(sw, `잔기 '${r}' 형식 틀림 (예: Ser14)`);
      }
      if (s.type === 'modification_site' && ['protein', 'nucleic_acid'].includes(d.kind)) {
        const ref = d.reference_species;
        if (!(s.numbering && s.numbering[ref]) && !s.residue_unknown) E(sw, `기준 종(${ref}) 잔기 번호가 없음 — 모르면 residue_unknown: true 로 명시(지어내지 않음)`);
      }
      if (s.face) {
        if (!V.faces[s.face]) E(sw, `막 면 '${s.face}' 은(는) 어휘에 없음`);
        else if (memAssoc === 'soluble') E(sw, '막 면(face)은 막 결합 분자의 부위에만');
        else if (s.face !== 'transmembrane' && !locSides(d.membrane.location)[s.face]) E(sw, `${vlabel('locations', d.membrane.location)}에는 '${s.face}' 면이 없음`);
      }
      if (s.on && !d.components.some((c) => c.ref === s.on)) E(sw, `부위가 있는 구성 요소 '${s.on}' 는 이 복합체의 구성 요소가 아님`);
      if (s.ligand) { const x = db.senses[s.ligand]; if (!x) E(sw, `리간드 '${s.ligand}' 없음`); else if (!MOLECULAR.has(x.kind)) E(sw, `리간드 '${L(s.ligand)}' 는 분자 종류가 아님`); }
      for (const [f, g] of Object.entries(s.ligands || {})) {
        if (!s.features.includes(f)) E(sw, `ligands: 특징 '${f}' 는 이 부위의 특징이 아님`);
        const x = db.senses[g]; if (!x) E(sw, `ligands: 리간드 '${g}' 없음`); else if (!MOLECULAR.has(x.kind)) E(sw, `ligands: 리간드 '${L(g)}' 는 분자 종류가 아님`);
      }
      for (const t of s.taxa || []) if (!V.taxa[t]) E(sw, `종 조건 '${t}' 은(는) 종 어휘에 없음`);
      if (s.structure) {
        if (s.structure.db !== 'PDB' || !new RegExp(V.xrefs.PDB.pattern).test(s.structure.id)) E(sw, `구조 참조는 PDB ID 여야 함 ('${s.structure.db}:${s.structure.id}')`);
        else if (!d.xrefs.some((x) => x.db === 'PDB' && x.id === s.structure.id)) E(sw, `해상도 일관성: 부위의 구조 ${s.structure.id} 가 정의항의 PDB 외부 ID 에 없음 — 정의항 xrefs 에도 같은 구조를 둘 것`);
      }
    }
    // 규칙
    const ruleIds = new Set();
    for (const r of d.rule) {
      const rw = `${id}/rule/${r.id || '?'}`;
      if (!r.id || !SITE_RE.test(r.id)) E(rw, '규칙 id 는 영문 소문자·숫자·_');
      if (ruleIds.has(r.id)) E(rw, '규칙 id 중복');
      ruleIds.add(r.id);
      if (!r.label) E(rw, '규칙 이름(label) 없음');
      if (!participant && r.type !== 'supply') E(rw, '규칙은 분자 종류 정의항만 가질 수 있음 (경로·과정·원리는 공급 규칙 supply 만)');
      if (r.kinetics && (r.kinetics.law === 'hill') !== (r.type === 'modulation')) E(rw, r.type === 'modulation' ? `조절 규칙의 속도 법칙은 hill (지금 ${r.kinetics.law})` : 'hill 법칙은 조절 규칙(modulation)에만');
      checkEvidence(r.evidence, rw, E);
      for (const t of r.taxa || []) if (!V.taxa[t]) E(rw, `종 조건 '${t}' 은(는) 종 어휘에 없음`);
      if (r.kinetics) { for (const m of kineticIssues(r, null)) E(rw, m); checkEvidence(r.kinetics.evidence, rw + ' 속도', E); if (r.kinetics.context) checkContext(r.kinetics.context, rw, E); }
      if (r.type === 'supply') { validateSupply(db, ix, id, d, r, rw, E, W); continue; }
      if (r.type === 'degradation') { validateDegradation(db, ix, id, d, r, rw, E, W); continue; }
      if (r.type === 'modulation') { validateModulation(db, ix, id, d, r, rw, E, W); continue; }
      if (r.type === 'meaning') {
        if (!V.activity[r.activity]) E(rw, `활성 '${r.activity}' 은(는) 어휘에 없음`);
        for (const [s, f] of Object.entries(r.when)) {
          if (!d.site[s]) E(rw, `조건의 부위 '${s}' 가 이 정의항에 없음`);
          else if (!d.site[s].features.includes(f)) E(rw, `부위 '${s}' 는 특징 '${f}' 를 가질 수 없음`);
        }
        continue;
      }
      if (r.type !== 'transition') { E(rw, `규칙 종류 '${r.type}' — ${Object.keys(V.ruleTypes).join(' | ')}`); continue; }
      const A = V.actions[r.action], e = r.effect;
      if (!A) E(rw, `변화 종류 '${r.action}' 은(는) 어휘에 없음`);
      if (!EFFECT_TYPES.includes(e.type)) { E(rw, `효과 종류 '${e.type}' — ${EFFECT_TYPES.join(' | ')}`); continue; }
      if (A && !A.effects.includes(e.type)) E(rw, `변화 종류 '${r.action}' 에는 효과 '${e.type}' 를 쓸 수 없음 (허용: ${A.effects.join(', ')})`);
      if (r.via_site && !d.site[r.via_site]) E(rw, `행위 부위 '${r.via_site}' 가 이 정의항에 없음`);
      if (r.via_component && !d.components.some((c) => c.ref === r.via_component)) E(rw, `행위 구성 요소 '${r.via_component}' 는 구성 요소가 아님`);
      if (!r.agent && r.via_site) W(rw, 'agent 가 아닌 규칙에 via_site 가 있음');
      for (const l of r.where || []) if (!V.locations[l]) E(rw, `위치 조건 '${l}' 은(는) 위치 어휘에 없음`);
      for (const g of r.regulators) {
        if (!db.senses[g.ref]) E(rw, `조절자 '${g.ref}' 없음`);
        if (!V.effects[g.effect]) E(rw, `조절 효과 '${g.effect}' 은(는) 어휘에 없음`);
      }
      for (const x of [...(r.with ? [...r.with.consumes, ...r.with.produces] : [])]) if (!db.senses[x]) E(rw, `보조 기질 '${x}' 없음`);
      const need = (ref, what) => { const x = db.senses[ref]; if (!x) { E(rw, `${what} '${ref}' 없음`); return null; } if (!isParticipantKind(x.kind)) E(rw, `${what} '${L(ref)}' 는 분자 종류가 아님`); return x; };
      if (e.type === 'modify') {
        const T = need(e.target || id, '대상');
        if (T) {
          const s = T.site[e.site];
          if (!s) E(rw, `대상 '${L(e.target || id)}' 에 부위 '${e.site}' 가 없음`);
          else for (const f of [...(e.add || []), ...(e.remove || [])]) if (!s.features.includes(f)) E(rw, `부위 '${e.site}' 는 특징 '${f}' 를 가질 수 없음`);
          if ((e.add || []).length > 1 || (e.remove || []).length > 1) E(rw, '한 부위에는 특징이 하나 — add/remove 는 각각 하나까지');
          if (!(e.add || []).length && !(e.remove || []).length) E(rw, 'modify 효과에 add/remove 가 없음');
          if (A && A.adds && !(e.add || []).includes(A.adds)) E(rw, `'${r.action}' 은(는) 특징 '${A.adds}' 를 추가해야 함`);
          if (A && A.removes && !(e.remove || []).includes(A.removes)) E(rw, `'${r.action}' 은(는) 특징 '${A.removes}' 를 제거해야 함`);
          if (e.partner) { need(e.partner, '결합 상대'); if (s && s.ligand && s.ligand !== e.partner) E(rw, `부위 '${e.site}' 의 리간드(${L(s.ligand)})와 결합 상대가 다름`); }
        }
      } else if (e.type === 'convert') {
        if (!(e.consumes || []).length || !(e.produces || []).length) E(rw, 'convert 효과는 consumes 와 produces 가 필요함');
        for (const x of [...(e.consumes || []), ...(e.produces || [])]) need(x, '기질/생성물');
      } else if (e.type === 'dissociate' || e.type === 'associate') {
        const C = need(e.complex || id, '복합체');
        if (C && !C.components.length) E(rw, `'${L(e.complex || id)}' 는 구성 요소가 정의되지 않은 복합체`);
        if (e.partner) need(e.partner, '결합 상대');
        if (e.partner_site) {
          const comp = db.senses[e.partner_site.component];
          if (C && !C.components.some((c) => c.ref === e.partner_site.component)) E(rw, `partner_site 의 구성 요소는 복합체의 구성 요소여야 함`);
          if (!e.partner_site.sites.length) E(rw, 'partner_site 에 부위(sites)가 없음');
          for (const ps of e.partner_site.sites) if (comp && !(comp.site[ps] && comp.site[ps].features.includes('bound'))) E(rw, `구성 요소 '${L(e.partner_site.component)}' 에 'bound' 를 받는 부위 '${ps}' 가 없음`);
        }
      } else if (e.type === 'transport') {
        need(e.target || id, '대상');
        if (!V.locations[e.from] || !V.locations[e.to]) E(rw, '수송 효과는 위치 어휘의 from/to 가 필요함');
      } else if (e.type === 'transfer') {
        // 리간드(partner)를 소유자의 from_site 에서 대상의 site 로 넘긴다
        const fs = d.site[e.from_site];
        if (!fs || !fs.features.includes('bound')) E(rw, `넘겨줄 부위 from_site '${e.from_site || ''}' 가 이 정의항에 없거나 'bound' 를 받지 않음`);
        else if (fs.ligand && e.partner && fs.ligand !== e.partner) E(rw, `from_site '${e.from_site}' 의 리간드와 넘기는 상대(partner)가 다름`);
        if (!e.partner) E(rw, 'transfer 효과는 넘기는 리간드(partner)가 필요함'); else need(e.partner, '리간드');
        const T = e.target && need(e.target, '대상');
        if (!e.target) E(rw, 'transfer 효과는 받는 대상(target)이 필요함');
        if (T) { const ts = T.site[e.site]; if (!ts || !ts.features.includes('bound')) E(rw, `대상 '${L(e.target)}' 에 'bound' 를 받는 부위 '${e.site || ''}' 가 없음`); else if (ts.ligand && ts.ligand !== e.partner) E(rw, `대상 부위 '${e.site}' 의 리간드와 넘기는 상대가 다름`); }
      } else if (e.type === 'degrade') {
        const C = need(e.complex || id, '복합체');
        if (C && !C.components.some((c) => c.ref === e.component)) E(rw, `분해할 구성 요소 '${e.component || ''}' 는 '${L(e.complex || id)}' 의 구성 요소가 아님`);
        for (const x of e.produces || []) need(x, '분해 산물');
        if (!(e.produces || []).length) E(rw, 'degrade 효과는 분해 산물(produces)이 필요함 — 질량이 사라지지 않게');
      }
      // 부분 구조 수지: 화학 변환(convert)·분해(degrade)는 보조 기질까지 합쳐 부분 구조(moiety)가 보존되어야 함
      if (e.type === 'convert' || e.type === 'degrade') {
        const lhs = [...(e.consumes || []), ...(e.type === 'degrade' ? [e.component] : []), ...(r.with ? r.with.consumes : [])].map((x) => ({ ref: x, n: 1 }));
        const rhs = [...(e.produces || []), ...(r.with ? r.with.produces : [])].map((x) => ({ ref: x, n: 1 }));
        const bad = moietyImbalance(db, lhs, rhs);
        if (bad) E(rw, `부분 구조 수지가 맞지 않음 — ${bad} (빠진 산물·보조 기질을 정의하고 규칙에 적을 것)`);
      }
      for (const q of e.requires || []) {
        const ref = q.ref || e.target || e.complex || id, x = db.senses[ref];
        if (!x) { E(rw, `전제 조건의 대상 '${ref}' 없음`); continue; }
        if (!x.site[q.site]) E(rw, `전제 조건의 부위 '${q.site}' 가 '${L(ref)}' 에 없음`);
        else if (!x.site[q.site].features.includes(q.feature)) E(rw, `전제 조건: 부위 '${q.site}' 는 특징 '${q.feature}' 를 가질 수 없음`);
      }
    }
    // 상위 개념
    if (d.motif) {
      if (!MOTIFS[d.motif]) E(where, `motif '${d.motif}' — 가능한 값: ${Object.keys(MOTIFS).join(', ')}`);
      if (d.kind !== 'process') E(where, 'motif(경로에서 찾는 패턴)는 kind process 정의항만 가질 수 있음');
      // Gap-filling Loop: 상위 개념은 한계 등록부를 검토한 결과를 반드시 가진다
      if (!(d.addresses || []).length && !d.gap_review) E(where, '상위 개념(motif)은 한계 등록부를 검토해 addresses(해결하는 한계와 방법) 또는 gap_review(해결하지 않는 이유)를 적어야 함');
    }
    for (const a of d.addresses || []) {
      if (!db.limitations[a.limitation]) E(where, `addresses: 한계 '${a.limitation}' 없음`);
      if (!a.how) E(where, `addresses: 한계 ${a.limitation} 를 어떻게 해결하는지(how) 없음`);
    }
    validateCellState(db, ix, id, d, where, E, W);
    if (d.elements) {
      if (d.kind !== 'structure_feature') E(where, '원자 수(elements)는 부분 구조(kind structure_feature)만');
      for (const [e, n] of Object.entries(d.elements)) { if (!/^[A-Z][a-z]?$/.test(e)) E(where, `원소 기호 '${e}' 형식 틀림 (예: C, N, P, S)`); if (!(Number.isInteger(n) && n >= 0)) E(where, `원소 ${e} 의 개수는 0 이상의 정수`); }
    }
    // 부분 구조
    for (const m of d.moieties || []) {
      const x = db.senses[m.ref];
      if (!MOLECULAR.has(d.kind)) E(where, '부분 구조(moieties)는 분자 종류만 가질 수 있음');
      if (!x) E(where, `부분 구조 '${m.ref}' 없음`);
      else if (x.kind !== 'structure_feature') E(where, `부분 구조 '${L(m.ref)}' 는 kind structure_feature 여야 함`);
      if (!(Number.isInteger(m.n) && m.n >= 1)) E(where, `부분 구조 '${m.ref}' 의 개수는 1 이상의 정수`);
    }
    // 관찰
    d.obs.forEach((b, i) => {
      const ow = `${id}/obs/${i + 1}`, P = V.obsProperties[b.property];
      if (!P) { E(ow, `관찰 속성 '${b.property}' 은(는) 어휘에 없음`); return; }
      checkContext(b.context, ow, E);
      checkEvidence(b.evidence, ow, E);
      if (P.speciesRequired && !b.context.species) E(ow, `'${b.property}' 는 종에 따라 달라짐 — context.species 필수`);
      if (P.value === 'number' && typeof b.value !== 'number') E(ow, '값은 숫자여야 함');
      if (P.unit && !b.unit) E(ow, '단위(unit) 필요');
      if (P.units && b.unit && !P.units.includes(b.unit)) E(ow, `'${b.property}' 의 단위는 SI 정준 ${P.units.join(' | ')} 만 (지금 '${b.unit}')`);
      if (P.requiresLocation && !b.context.location) E(ow, `'${b.property}' 는 위치마다 다름 — context.location 필수`);
      if (b.property === 'pH' && typeof b.value === 'number' && !(b.value >= 0 && b.value <= 14)) E(ow, 'pH 는 0–14');
      if (['diffusion_coefficient', 'ionic_strength', 'relative_permittivity'].includes(b.property) && typeof b.value === 'number' && !(b.value > 0)) E(ow, `'${b.property}' 는 양수`);
      if (P.value === 'location' && !V.locations[b.value]) E(ow, `값 '${b.value}' 은(는) 위치 어휘에 없음`);
      if (Array.isArray(P.value) && !P.value.includes(b.value)) E(ow, `값은 ${P.value.join(' | ')} 중 하나`);
      if (P.value === 'xref') { const x = parseXref(b.value); if (!V.xrefs[x.db] || !new RegExp(V.xrefs[x.db].pattern).test(x.id)) E(ow, `외부 ID '${b.value}' 형식 틀림`); }
    });
  }

  // 기본 층 (형식 v8): 저분자·이온·고분자 물질 → T1, 단백질·복합체·핵산 → T2, 분자 부류는 명시해야 함(null)
  function defaultTier(d) {
    if (['small_molecule', 'ion', 'macromolecule'].includes(d.kind)) return 'T1';
    if (['protein', 'complex', 'nucleic_acid'].includes(d.kind)) return 'T2';
    return null;
  }
  // 부분 구조 계산: 정의항 → { moiety: 개수 } (복합체는 구성 요소를 펼쳐서)
  function moietyOf(db, ref, mult, out, depth) {
    const d = db.senses[ref];
    if (!d || (depth || 0) > 20) return out;
    for (const m of d.moieties || []) out[m.ref] = (out[m.ref] || 0) + m.n * mult;
    for (const c of d.components) moietyOf(db, c.ref, mult * c.n, out, (depth || 0) + 1);
    return out;
  }
  // lhs/rhs: [{ref, n}] → 불균형 설명 문자열 또는 null. 어느 쪽에도 부분 구조가 없으면 검사하지 않음(null)
  const MASS_REL_TOL = 1e-14;
  function moietyImbalance(db, lhs, rhs) {
    const a = {}, b = {};
    for (const q of lhs) if (typeof q.n === 'number') moietyOf(db, q.ref, q.n, a);
    for (const q of rhs) if (typeof q.n === 'number') moietyOf(db, q.ref, q.n, b);
    const keys = uniq([...Object.keys(a), ...Object.keys(b)]);
    const bad = keys.filter((k) => Math.abs((a[k] || 0) - (b[k] || 0)) > MASS_REL_TOL * Math.max(1, Math.abs(a[k] || 0), Math.abs(b[k] || 0))); // ΣIn = ΣOut, 상대 1e-14
    if (!bad.length) return null;
    const lab = (k) => { const x = db.senses[k]; return x && db.terms[x.term] ? (db.terms[x.term].names.ko || db.terms[x.term].names.en || k) : k; };
    return bad.map((k) => `${lab(k)} ${a[k] || 0} → ${b[k] || 0}`).join(', ');
  }
  // 대사물 공급 규칙 (Metabolic_Supply_Rule)
  function validateSupply(db, ix, id, d, r, rw, E, W) {
    const L = ix.label;
    if (!r.produces.length) E(rw, '공급 규칙은 생성물(produces)이 필요함');
    if (!r.consumes.length && !r.source) E(rw, '소비하는 것이 없는 공급은 계 밖에서 들어오는 것 — source: true 로 명시할 것');
    if (r.where.length !== 1) E(rw, '공급 규칙은 위치(where)가 정확히 하나 (저장소 묶음 = 정의항|위치)');
    for (const l of r.where) if (!V.locations[l]) E(rw, `위치 '${l}' 은(는) 위치 어휘에 없음`); else if (V.locations[l].dim !== '3D') E(rw, `공급 위치 '${vlabel('locations', l)}' 는 부피(3D) 구획이어야 함`);
    for (const q of [...r.consumes, ...r.produces]) {
      const x = db.senses[q.ref];
      if (!x) E(rw, `저장소 분자 '${q.ref}' 없음`);
      else if (!isParticipantKind(x.kind)) E(rw, `저장소 분자 '${L(q.ref)}' 는 분자 종류가 아님`);
      if (!(typeof q.n === 'number' && q.n > 0)) E(rw, `'${L(q.ref)}' 의 화학량 n 은 양수`);
    }
    if (r.kinetics && !['zero_order', 'mass_action'].includes(r.kinetics.law)) E(rw, `공급 규칙의 속도 법칙은 zero_order | mass_action (지금 ${r.kinetics.law})`);
    // 포화 보조 기질 (v9, saturating): 화학량대로 소비하지만 속도 법칙의 차수에서는 빠진다 (포화 가정, 바닥나면 c/(c + K_sat) 로 꺼짐)
    for (const q of r.produces) if (q.saturating) E(rw, `saturating 은 소비(consumes)에만 — 생성물 '${L(q.ref)}'`);
    const lawN = r.consumes.filter((q) => !q.saturating).reduce((t, q) => t + (typeof q.n === 'number' ? q.n : 0), 0);
    if (r.consumes.length && r.consumes.every((q) => q.saturating)) E(rw, '모든 소비가 saturating 이면 속도 법칙의 기질이 없음 — 하나 이상은 속도를 정하는 기질로');
    if (r.kinetics && r.kinetics.law === 'mass_action' && r.kinetics.order != null && lawN !== r.kinetics.order) E(rw, `질량 작용 차수 ${r.kinetics.order} 가 소비 분자 수(${lawN}${r.consumes.some((q) => q.saturating) ? ', saturating 제외' : ''})와 다름`);
    if (r.kinetics && r.kinetics.law === 'mass_action' && !r.consumes.length) E(rw, '소비하는 것이 없는 공급은 zero_order 로');
    const bad = moietyImbalance(db, r.consumes, r.produces);
    if (bad && !r.source) E(rw, `부분 구조 수지가 맞지 않음 — ${bad} (계 밖에서 들어오는 공급이면 source: true)`);
  }
  // 분해 규칙 (Degradation_Rule)
  function validateDegradation(db, ix, id, d, r, rw, E, W) {
    const L = ix.label;
    if (!V.lifecycleFates[r.fate]) E(rw, `분해 산물의 운명(fate) '${r.fate}' — ${Object.keys(V.lifecycleFates).join(' | ')}`);
    if (r.fate === 'recycled' && !r.recycle_to.length) E(rw, '재활용(recycled)이면 recycle_to 에 돌아갈 구성 단위가 필요함');
    if (r.fate === 'lost' && r.recycle_to.length) E(rw, '소실(lost)인데 recycle_to 가 있음');
    for (const q of r.recycle_to) {
      const x = db.senses[q.ref];
      if (!x) E(rw, `재활용 단위 '${q.ref}' 없음`); else if (!isParticipantKind(x.kind)) E(rw, `재활용 단위 '${L(q.ref)}' 는 분자 종류가 아님`);
      if (q.n === 'sequence_length') { /* 관찰이 없으면 detectGaps 가 Structural_Gap 후보로 잡는다 */ }
      else if (!(q.n > 0)) E(rw, `재활용 단위 '${L(q.ref)}' 의 화학량 n 은 양수 또는 'sequence_length'`);
      if (q.location && !V.locations[q.location]) E(rw, `위치 '${q.location}' 은(는) 위치 어휘에 없음`);
    }
    for (const [s, f] of Object.entries(r.when)) { if (!d.site[s]) E(rw, `조건의 부위 '${s}' 가 이 정의항에 없음`); else if (!d.site[s].features.includes(f)) E(rw, `부위 '${s}' 는 특징 '${f}' 를 가질 수 없음`); }
    for (const l of r.where || []) if (!V.locations[l]) E(rw, `위치 조건 '${l}' 은(는) 위치 어휘에 없음`);
  }

  // 조절 규칙 (v9): 조절자(소유자) → 대상 규칙의 속도 배율
  function validateModulation(db, ix, id, d, r, rw, E, W) {
    const L = ix.label, t = parseTarget(r.target), owner = t && db.senses[t.base], tr = owner && owner.rule.find((x) => x.id === t.key);
    if (!t || t.sub !== 'rule') E(rw, `조절 대상 '${r.target}' — 'D…/rule/키' 형식의 규칙이어야 함`);
    else if (!tr) E(rw, `조절 대상 규칙 '${r.target}' 없음`);
    else if (!['supply', 'transition', 'degradation'].includes(tr.type)) E(rw, `조절 대상은 속도가 있는 규칙(supply · transition · degradation) — '${L(t.base)}' 의 '${tr.id}' 는 ${tr.type}`);
    if (tr && t.base === id && tr.id === r.id) E(rw, '자기 자신을 조절할 수 없음');
    if (!V.effects[r.effect]) E(rw, `조절 효과 '${r.effect}' — ${Object.keys(V.effects).join(' | ')}`);
    if (!V.locations[r.at]) E(rw, `조절자 위치(at) '${r.at}' 은(는) 위치 어휘에 없음 — 조절자 묶음 = 소유자|at`);
    else if (V.locations[r.at].dim !== '3D') E(rw, `조절자 위치 '${vlabel('locations', r.at)}' 는 부피(3D) 구획이어야 함 (농도로 배율을 계산)`);
    for (const v of r.via) { const x = db.senses[v]; if (!x) E(rw, `매개 분자(via) '${v}' 없음`); else if (!isParticipantKind(x.kind)) E(rw, `매개 분자 '${L(v)}' 는 분자 종류가 아님`); }
    const k = r.kinetics;
    if (k && k.law === 'hill') {
      if (r.effect === 'activates' && !(k.fmax > 1)) E(rw, '활성화 조절은 fmax > 1 (최대 배율)이 필요함');
      if (r.effect === 'inhibits' && !(k.fmin >= 0 && k.fmin < 1)) E(rw, '억제 조절은 0 ≤ fmin < 1 (최소 배율)이 필요함');
      if (r.effect === 'activates' && k.fmin != null) E(rw, '활성화 조절에는 fmin 을 두지 않음');
      if (r.effect === 'inhibits' && k.fmax != null) E(rw, '억제 조절에는 fmax 를 두지 않음');
    }
  }
  // 세포 상태 (v9): signature · metabolome · transitions 는 kind cell_state 만, cell_state 는 분자 필드를 갖지 않음
  function validateCellState(db, ix, id, d, where, E, W) {
    const L = ix.label, has = (d.signature || []).length || (d.metabolome || []).length || (d.transitions || []).length;
    if (d.kind !== 'cell_state') { if (has) E(where, '표지 서명·대사 프로그램·전이(signature · metabolome · transitions)는 kind cell_state 만'); return; }
    if (!(d.signature || []).length) E(where, '세포 상태는 표지 서명(signature)이 필요함 — 어떤 분자가 높고 낮은지로 상태를 정의');
    if (d.rule.length || Object.keys(d.site).length || d.moieties || d.components.length) E(where, '세포 상태는 분자가 아님 — 규칙·부위·부분 구조·구성 요소를 두지 않음');
    const seen = new Set();
    for (const m of d.signature || []) {
      const x = db.senses[m.ref];
      if (!x) E(where, `표지 '${m.ref}' 없음`); else if (!isParticipantKind(x.kind)) E(where, `표지 '${L(m.ref)}' 는 분자 종류가 아님`);
      if (!V.signatureLevels[m.level]) E(where, `표지 '${L(m.ref)}' 의 수준 '${m.level}' — ${Object.keys(V.signatureLevels).join(' | ')}`);
      if (!V.locations[m.location] || V.locations[m.location].dim !== '3D') E(where, `표지 '${L(m.ref)}' 의 위치는 부피(3D) 위치 어휘여야 함 (지금 '${m.location}')`);
      const key = `${m.ref}|${m.location}`; if (seen.has(key)) E(where, `표지 '${L(m.ref)}' 가 같은 위치에 두 번`); seen.add(key);
    }
    for (const m of d.metabolome || []) {
      const t = parseTarget(m.ref), o = t && db.senses[t.base], r = o && o.rule.find((x) => x.id === t.key);
      if (!r) E(where, `대사 프로그램의 규칙 '${m.ref}' 없음 — 'D…/rule/키'`);
      else if (r.type !== 'supply') E(where, `대사 프로그램은 공급 규칙(supply)만 — '${m.ref}' 는 ${r.type}`);
      if (!V.signatureLevels[m.level]) E(where, `대사 프로그램 '${m.ref}' 의 수준 '${m.level}' — ${Object.keys(V.signatureLevels).join(' | ')}`);
    }
    for (const tr of d.transitions || []) {
      const x = db.senses[tr.to];
      if (!x) E(where, `전이 대상 상태 '${tr.to}' 없음`); else if (x.kind !== 'cell_state') E(where, `전이 대상 '${L(tr.to)}' 는 cell_state 가 아님`);
      if (tr.to === id) E(where, '자기 자신으로의 전이');
      if (!tr.signals.length) E(where, `'${L(tr.to)}' 로의 전이에 신호(signals)가 없음 — 무엇이 분화를 일으키는지`);
      for (const g of tr.signals) { const y = db.senses[g]; if (!y) E(where, `신호 '${g}' 없음`); else if (!isParticipantKind(y.kind)) E(where, `신호 '${L(g)}' 는 분자 종류가 아님`); }
      if (!V.commitmentCriteria[tr.commitment.criterion]) E(where, `결정 기준 '${tr.commitment.criterion}' — ${Object.keys(V.commitmentCriteria).join(' | ')}`);
      checkEvidence(tr.evidence, `${where} 전이 → ${tr.to}`, E);
    }
  }

  // 묶음 하나 검사: 바탕 정의항·부위·특징·위치·막 위상
  function checkBundle(db, ix, key, where, E) {
    const b = parseBundle(key);
    if (b.error) { E(where, b.error); return null; }
    if (bundleKey(b) !== key) E(where, `묶음 키 '${key}' 는 정렬된 표준 형식이 아님 (${bundleKey(b)})`);
    const d = db.senses[b.base];
    if (!d) { E(where, `묶음 바탕 '${b.base}' 없음`); return null; }
    if (!isParticipantKind(d.kind)) E(where, `'${ix.label(b.base)}'(${d.kind}) 는 기전에 참여할 수 없음`);
    const L = V.locations[b.location];
    if (!L) E(where, `위치 '${b.location}' 은(는) 위치 어휘에 없음`);
    else {
      const assoc = d.membrane ? d.membrane.association : 'soluble';
      if (assoc === 'soluble' && L.dim !== '3D') E(where, `${ix.label(b.base)} 은(는) 수용성 — 막(2D) 위치 '${L.label}' 에 있을 수 없음`);
      if (assoc !== 'soluble' && !(L.dim === '2D' && sameFamily(b.location, d.membrane.location))) E(where, `${ix.label(b.base)} 은(는) ${vlabel('locations', d.membrane.location)}에 박힌 분자 — '${L.label}' 에 있을 수 없음`);
    }
    const seen = new Set();
    for (const f of b.features) {
      const s = d.site[f.site];
      if (!s) E(where, `'${ix.label(b.base)}' 에 부위 '${f.site}' 가 없음`);
      else if (!s.features.includes(f.feature)) E(where, `부위 '${f.site}' 는 특징 '${f.feature}' 를 가질 수 없음 (허용: ${s.features.join(', ')})`);
      if (seen.has(f.site)) E(where, `부위 '${f.site}' 에 특징이 둘`);
      seen.add(f.site);
    }
    return { ...b, d };
  }

  // 묶음을 기본 실체로 펼친다: 복합체 → 구성 요소(재귀), 리간드가 정해진 부위가 채워져 있으면 그 리간드
  //   (부위가 구성 요소 위에 있으면 그 구성 요소의 개수만큼). skip: 분해되어 사라지는 구성 요소
  function entityTally(db, base, feats, mult, out, skip) {
    const d = db.senses[base];
    if (!d) return;
    if (base !== skip) {
      if (d.components.length) for (const c of d.components) entityTally(db, c.ref, new Map(), mult * c.n, out, skip);
      else out[base] = (out[base] || 0) + mult;
    }
    for (const [s, f] of feats) {
      const site = d.site[s];
      const lig = site && f ? (site.ligands && site.ligands[f]) || (f === 'bound' || !site.ligands ? site.ligand : null) : null;
      if (!lig) continue;
      const on = site.on ? d.components.find((c) => c.ref === site.on) : null;
      entityTally(db, lig, new Map(), mult * (on ? on.n : 1), out, null); // 리간드가 복합체면 그 구성 요소로
    }
  }

  // 단계 검사: 단계는 규칙의 한 번 적용이다. 변화량·위치·접촉·행위자 활성이 규칙과 맞아야 한다.
  function validateStep(db, ix, id, st, E, W) {
    const L = ix.label, where = `${id}`;
    if (!isStepId(id)) E(id, "단계 번호는 'S' + 숫자 6자리");
    const rule = ix.ruleOf(st.rule), owner = ix.ruleOwner(st.rule);
    if (!rule) { E(where, `규칙 '${st.rule}' 없음 — 'D…/rule/키' 로 원천의 전이 규칙을 가리킬 것`); return; }
    const w = `${id}(${rule.label})`;
    if (rule.type !== 'transition') { E(w, '단계는 전이(transition) 규칙만 적용할 수 있음'); return; }
    if (!st.part_of.length) E(w, 'part_of 없음 — 어느 경로에 속하는지 적어야 함');
    for (const p of st.part_of) { const x = db.senses[p]; if (!x) E(w, `소속 경로 '${p}' 없음`); else if (x.kind !== 'pathway') E(w, `소속 '${L(p)}' 의 kind 가 pathway 가 아님`); }
    const B = {};
    for (const role of ['agents', 'inputs', 'outputs', 'regulators']) B[role] = st[role].map((p) => {
      if (!p.b) { E(w, `${role} 참여자가 묶음 키가 아님`); return null; }
      const b = checkBundle(db, ix, p.b, w, E);
      return b ? { ...b, key: p.b, n: p.n || 1, minor: !!p.minor } : null;
    }).filter(Boolean);
    const e = rule.effect, major = (x) => !x.minor;
    const findOne = (list, base, what) => {
      const xs = list.filter((x) => x.base === base && major(x));
      if (xs.length !== 1) { E(w, `${what}에 '${L(base)}' 묶음이 ${xs.length}개 (정확히 1개여야 함)`); return null; }
      return xs[0];
    };
    // 행위자
    let center = null;
    if (rule.agent) {
      const ag = B.agents.find((x) => x.base === owner);
      if (!ag) E(w, `규칙 '${rule.label}' 의 행위자 '${L(owner)}' 묶음이 agents 에 없음`);
      else {
        const act = ix.activityOf(ag.key);
        if (act === 'inactive') E(w, `행위자 ${ix.bundleLabel(ag.key)} 은(는) 원천 규칙상 비활성 — 이 전이를 일으킬 수 없음`);
        center = { b: ag, face: rule.via_site ? (db.senses[owner].site[rule.via_site] || {}).face : null };
      }
    } else if (B.agents.length) E(w, '행위자가 없는 규칙인데 agents 가 있음');
    const inF = (x) => new Map(x.features.map((f) => [f.site, f.feature]));
    let targetIn = null, moved = null;
    if (e.type === 'modify') {
      const T = e.target || owner, tin = findOne(B.inputs, T, '입력'), tout = findOne(B.outputs, T, '출력');
      if (tin && tout) {
        targetIn = tin;
        const a = inF(tin), b = inF(tout);
        for (const s of uniq([...a.keys(), ...b.keys()])) if (s !== e.site && a.get(s) !== b.get(s)) E(w, `규칙이 바꾸지 않는 부위 '${s}' 가 바뀜`);
        const expIn = (e.remove || [])[0], expOut = (e.add || [])[0];
        if (a.get(e.site) !== expIn) E(w, `입력의 부위 '${e.site}' 는 ${expIn ? `'${expIn}'` : '빈 상태'} 여야 함 (실제 ${a.get(e.site) || '빈 상태'})`);
        if (b.get(e.site) !== expOut) E(w, `출력의 부위 '${e.site}' 는 ${expOut ? `'${expOut}'` : '빈 상태'} 여야 함 (실제 ${b.get(e.site) || '빈 상태'})`);
        if (tin.location !== tout.location) E(w, '수송이 아닌 단계에서 위치가 바뀜');
      }
      if (e.partner) {
        if (!B.inputs.some((x) => x.base === e.partner)) E(w, `결합 상대 '${L(e.partner)}' 묶음이 입력에 없음`);
        if (B.outputs.some((x) => x.base === e.partner && major(x))) E(w, `결합 상대 '${L(e.partner)}' 는 대상 부위에 흡수되므로 출력에 따로 남지 않음`);
      }
    } else if (e.type === 'convert') {
      for (const x of e.consumes || []) if (!B.inputs.some((y) => y.base === x)) E(w, `기질 '${L(x)}' 묶음이 입력에 없음`);
      for (const x of e.produces || []) if (!B.outputs.some((y) => y.base === x)) E(w, `생성물 '${L(x)}' 묶음이 출력에 없음`);
      targetIn = B.inputs.find((y) => (e.consumes || []).includes(y.base)) || null;
    } else if (e.type === 'dissociate' || e.type === 'associate') {
      const C = e.complex || owner, cd = db.senses[C];
      const [whole, parts, wName, pName] = e.type === 'dissociate' ? [B.inputs, B.outputs, '입력', '출력'] : [B.outputs, B.inputs, '출력', '입력'];
      const cx = findOne(whole, C, wName);
      if (cx && cd) {
        targetIn = cx;
        for (const c of cd.components) {
          const got = parts.filter((x) => x.base === c.ref && major(x)).reduce((s, x) => s + x.n, 0);
          if (got !== c.n * cx.n) E(w, `${pName}의 구성 요소 '${L(c.ref)}' 개수 ${got} — 복합체 정의상 ${c.n * cx.n}개`);
        }
        for (const x of parts.filter(major)) if (!cd.components.some((c) => c.ref === x.base) && x.base !== e.partner) E(w, `'${L(x.base)}' 는 '${L(C)}' 의 구성 요소가 아님`);
        for (const x of parts) if (x.location !== cx.location && major(x)) E(w, '해리·결합 단계에서 위치가 바뀜');
      }
      if (e.partner) {
        if (!B.inputs.some((x) => x.base === e.partner)) E(w, `결합 상대 '${L(e.partner)}' 묶음이 입력에 없음`);
        if (e.partner_site && B.outputs.some((x) => x.base === e.partner && major(x))) E(w, `결합 상대 '${L(e.partner)}' 는 구성 요소 '${L(e.partner_site.component)}' 의 부위에 흡수되므로 출력에 따로 남지 않음`);
        if (e.partner_site && e.type === 'dissociate') {
          const outs = B.outputs.filter((x) => x.base === e.partner_site.component);
          for (const ps of e.partner_site.sites) if (!outs.length || outs.some((x) => inF(x).get(ps) !== 'bound')) E(w, `구성 요소 '${L(e.partner_site.component)}' 의 부위 '${ps}' 가 'bound' 여야 함 (결합 상대가 흡수된 곳)`);
        }
      }
    } else if (e.type === 'transport') {
      const T = e.target || owner, tin = findOne(B.inputs, T, '입력'), tout = findOne(B.outputs, T, '출력');
      if (tin && tout) {
        targetIn = tin; moved = tout;
        if (tin.location !== e.from || tout.location !== e.to) E(w, `수송 규칙은 ${vlabel('locations', e.from)} → ${vlabel('locations', e.to)} (실제 ${vlabel('locations', tin.location)} → ${vlabel('locations', tout.location)})`);
        if (JSON.stringify([...inF(tin)].sort()) !== JSON.stringify([...inF(tout)].sort())) E(w, '수송 단계에서 특징이 바뀜');
      }
    } else if (e.type === 'transfer') {
      const din = findOne(B.inputs, owner, '입력'), dout = findOne(B.outputs, owner, '출력');
      const tin = findOne(B.inputs, e.target, '입력'), tout = findOne(B.outputs, e.target, '출력');
      const same = (a, b, skip, what) => { for (const k of uniq([...a.keys(), ...b.keys()])) if (k !== skip && a.get(k) !== b.get(k)) E(w, `${what}의 규칙이 바꾸지 않는 부위 '${k}' 가 바뀜`); };
      if (din && dout) {
        if (inF(din).get(e.from_site) !== 'bound') E(w, `넘겨주는 '${L(owner)}' 입력의 부위 '${e.from_site}' 는 'bound' 여야 함`);
        if (inF(dout).get(e.from_site)) E(w, `넘겨준 뒤 '${L(owner)}' 의 부위 '${e.from_site}' 는 빈 상태여야 함`);
        same(inF(din), inF(dout), e.from_site, '넘겨주는 쪽');
        if (din.location !== dout.location) E(w, '수송이 아닌 단계에서 위치가 바뀜');
        center = { b: din, face: (db.senses[owner].site[e.from_site] || {}).face };
      }
      if (tin && tout) {
        targetIn = tin;
        if (inF(tin).get(e.site)) E(w, `받는 '${L(e.target)}' 입력의 부위 '${e.site}' 는 빈 상태여야 함`);
        if (inF(tout).get(e.site) !== 'bound') E(w, `받은 뒤 '${L(e.target)}' 의 부위 '${e.site}' 는 'bound' 여야 함`);
        same(inF(tin), inF(tout), e.site, '받는 쪽');
        if (tin.location !== tout.location) E(w, '수송이 아닌 단계에서 위치가 바뀜');
      }
      if ([...B.inputs, ...B.outputs].some((x) => x.base === e.partner && major(x))) E(w, `리간드 '${L(e.partner)}' 는 부위 안에서 넘겨지므로 따로 입력·출력에 두지 않음`);
    } else if (e.type === 'degrade') {
      const C = e.complex || owner, cd = db.senses[C], cx = findOne(B.inputs, C, '입력');
      if (cx && cd) {
        targetIn = cx;
        for (const c of cd.components) {
          const got = B.outputs.filter((x) => x.base === c.ref && major(x)).reduce((t, x) => t + x.n, 0);
          const want = c.ref === e.component ? 0 : c.n * cx.n;
          if (got !== want) E(w, c.ref === e.component ? `분해된 구성 요소 '${L(c.ref)}' 가 출력에 남아 있음` : `출력의 구성 요소 '${L(c.ref)}' 개수 ${got} — 복합체 정의상 ${want}개`);
        }
        for (const x of B.outputs) if (x.location !== cx.location && major(x)) E(w, '분해 단계에서 위치가 바뀜');
      }
      for (const x of e.produces || []) if (!B.outputs.some((y) => y.base === x)) E(w, `분해 산물 '${L(x)}' 묶음이 출력에 없음`);
    }
    // 전제 조건: 대상(또는 지정한 정의항)의 입력 묶음이 이미 그 특징을 가져야 함
    for (const q of e.requires || []) {
      const ref = q.ref || e.target || e.complex || owner, xs = B.inputs.filter((x) => x.base === ref && major(x));
      if (!xs.length) E(w, `전제 조건의 대상 '${L(ref)}' 묶음이 입력에 없음`);
      for (const x of xs) if (inF(x).get(q.site) !== q.feature) E(w, `전제 조건 불충족: ${ix.bundleLabel(x.key)} 의 부위 '${q.site}' 는 '${vlabel('features', q.feature)}' 여야 함`);
    }
    if (rule.with) {
      for (const x of rule.with.consumes) if (!B.inputs.some((y) => y.base === x)) E(w, `보조 기질 '${L(x)}' 가 입력에 없음`);
      for (const x of rule.with.produces) if (!B.outputs.some((y) => y.base === x)) E(w, `보조 생성물 '${L(x)}' 가 출력에 없음`);
    }
    for (const g of B.regulators) if (!rule.regulators.some((r) => r.ref === g.base)) E(w, `'${L(g.base)}' 는 규칙 '${rule.label}' 에 정의된 조절자가 아님`);
    // 동일성 보존: 물리적 변화(결합·해리·전달·분해·수송)에서는 입력과 출력의 구성 실체가 같아야 한다
    if (CONSERVING.has(e.type) || (e.type === 'modify' && e.partner)) {
      const cos = new Set(rule.with ? [...rule.with.consumes, ...rule.with.produces] : []);
      const tIn = {}, tOut = {};
      for (const x of B.inputs) if (!cos.has(x.base)) entityTally(db, x.base, inF(x), x.n, tIn, e.type === 'degrade' ? e.component : null);
      for (const x of B.outputs) if (!cos.has(x.base) && !(e.type === 'degrade' && (e.produces || []).includes(x.base))) entityTally(db, x.base, inF(x), x.n, tOut, null);
      const diff = uniq([...Object.keys(tIn), ...Object.keys(tOut)]).filter((k) => (tIn[k] || 0) !== (tOut[k] || 0));
      if (diff.length) E(w, `동일성 보존 위반: ${diff.map((k) => `${L(k)} 입력 ${tIn[k] || 0} ≠ 출력 ${tOut[k] || 0}`).join(', ')}`);
    }
    // 위치 조건
    if (!center && targetIn) center = { b: targetIn, face: e.site ? (targetIn.d.site[e.site] || {}).face : null };
    if (center && rule.where && !rule.where.includes(center.b.location)) E(w, `규칙 '${rule.label}' 은(는) ${rule.where.map((l) => vlabel('locations', l)).join(', ')}에서만 작동 — 실제 ${vlabel('locations', center.b.location)}`);
    // 공간 접촉: 반응 중심(행위자 또는 대상)과 모든 참여자
    if (center) {
      const cb = center.b, cDim = (V.locations[cb.location] || {}).dim;
      for (const role of ['agents', 'inputs', 'outputs', 'regulators']) for (const x of B[role]) {
        if (x === cb || x === moved) continue; // 수송된 대상은 새 위치에 있는 것이 정상
        const xDim = (V.locations[x.location] || {}).dim;
        let face = null;
        if (cDim === '2D' && xDim === '3D') {
          face = center.face;
          if (x === targetIn || (e.partner && x.base === e.partner)) { const ts = e.site && cb.base === (e.target || owner) ? cb.d.site[e.site] : null; face = (ts && ts.face) || face; }
        } else if (cDim === '3D' && xDim === '2D') {
          const ts = x === targetIn && e.site ? x.d.site[e.site] : null;
          face = ts && ts.face;
        } else if (cDim === '2D' && xDim === '2D') {
          const cf = center.face, side = x.d.membrane && x.d.membrane.side;
          if (cf && side && cf !== 'transmembrane' && cf !== side) E(w, `${ix.bundleLabel(cb.key)} 의 작용 면(${vlabel('faces', cf)})과 ${ix.bundleLabel(x.key)} 가 붙은 면(${vlabel('faces', side)})이 다름`);
        }
        const c = locCompatible(cb.location, x.location, face && face !== 'transmembrane' ? face : null);
        if (!c.ok) E(w, `공간 접촉 불가: ${ix.bundleLabel(cb.key)} ↔ ${ix.bundleLabel(x.key)} — ${c.why}`);
      }
    }
    if (rule.kinetics) for (const m of kineticIssues(rule, st).filter((x) => /차수|두 분자/.test(x))) E(w, m);
  }

  // ===== 참조 매핑 =====
  function resolveRef(ix, ref) {
    const r = str(ref);
    if (!r) return { error: '참조가 비어 있음' };
    if (ix.senses.has(r)) return { id: r, via: 'id' };
    if (/^[TDS]\+/.test(r)) return { error: `임시 번호 '${r}' 가 이 패치 안에 없음` };
    if (isId('D', r)) return { error: `정의항 ${r} 없음` };
    const fromTerm = (tid, via) => {
      const ds = ix.termSenses.get(tid) || [];
      if (ds.length === 1) return { id: ds[0], via };
      return { error: `'${r}' 은(는) 뜻이 여러 개 — 하나를 지정할 것: ${ds.map((x) => `${x}(${ix.label(x)})`).join(', ')}` };
    };
    if (isId('T', r)) return ix.db.terms[r] ? fromTerm(r, `개념 ${r}`) : { error: `개념 ${r} 없음` };
    if (r.includes('#')) {
      const i = r.lastIndexOf('#'), name = r.slice(0, i), n = parseInt(r.slice(i + 1), 10);
      const hit = lookupName(ix, name);
      if (hit.length === 1) { const id = (ix.termSenses.get(hit[0]) || []).find((x) => ix.senses.get(x).n === n); if (id) return { id, via: `'${r}'` }; }
      return { error: `'${r}' 정의항 없음` + suggest(ix, name) };
    }
    const x = parseXref(r);
    if (x.db && ix.xrefs.has(xrefKey(x))) return { id: ix.xrefs.get(xrefKey(x))[0], via: `외부 ID ${xrefLabel(x)}` };
    for (const [scheme, v] of Object.entries(V.fingerprints)) if (new RegExp(v.pattern).test(r) && ix.fps.has(`${scheme}:${r}`)) return { id: ix.fps.get(`${scheme}:${r}`)[0], via: `지문 ${scheme}` };
    const hit = lookupName(ix, r);
    if (hit.length === 1) return fromTerm(hit[0], `이름 '${r}'`);
    return { error: `'${r}' 은(는) 데이터베이스에 없음` + suggest(ix, r) };
  }
  function suggest(ix, name) {
    const s = similar(name, uniq([...ix.names.values()].flat().map((h) => h.name)), 4);
    return s.length ? ` — 비슷한 이름: ${s.join(', ')}` : ' — 새 개념이면 같은 패치에서 만들고 임시 번호로 가리킬 것';
  }

  // ===== 병합 =====
  // 패치(v4): { terms:[…], senses:[{id?, term, kind, …정의항 필드…}], steps:[{id?, rule, agents, inputs, outputs, regulators, part_of}], remove:[…] }
  //   기존 정의항은 패치에 적힌 최상위 필드만 교체된다(적지 않은 필드는 유지).
  function merge(dbIn, patchIn) {
    const db = normalize(clone(dbIn));
    const report = { added: [], updated: [], removed: [], idmap: {}, mapped: [], errors: [] };
    const ERR = (where, msg) => report.errors.push({ where, msg });
    const MAP = (from, to, via) => report.mapped.push({ from, to, via });
    if (!isObj(patchIn)) { ERR('패치', 'JSON 객체가 아님'); return { db, report }; }
    if (isObj(patchIn.terms) || patchIn.definientia || isObj(patchIn.states) || isObj(patchIn.limitations)) { ERR('패치', '이전 형식 패치 — v4 는 terms·senses·steps 배열 (prompt 참고)'); return { db, report }; }
    const alloc = (p) => fmtId(p, db.meta.next[p]++);
    const ix0 = index(db);
    const preSenses = new Map([...ix0.termSenses].map(([k, v]) => [k, v.length]));
    const nameOwner = new Map();
    const findTerm = (name) => { const h = lookupName(ix0, name); return h.length ? h : nameOwner.has(normName(name)) ? [nameOwner.get(normName(name))] : []; };
    const claimNames = (tid, names) => {
      for (const n of names.filter(Boolean)) {
        const owner = findTerm(n).filter((x) => x !== tid);
        if (owner.length) ERR(`${tid}(${db.terms[tid] ? db.terms[tid].names.ko : n})`, `이름 '${n}' 은(는) 이미 ${owner.map((o) => `${o}(${db.terms[o].names.ko})`).join(', ')} 의 이름 — 같은 개념이면 그 개념을 쓸 것`);
        else nameOwner.set(normName(n), tid);
      }
    };
    // 1. 개념
    for (const raw of arr(patchIn.terms)) {
      if (!isObj(raw)) { ERR('terms', '개념 항목이 객체가 아님'); continue; }
      const pt = normTerm(raw), rid = str(raw.id);
      if (rid && !isTemp('T', rid)) {
        const t = db.terms[rid];
        if (!t) { ERR(rid, '없는 개념 번호 — 새 개념은 임시 번호(T+1)를 쓸 것'); continue; }
        if (pt.names.ko && pt.names.ko !== t.names.ko) t.aliases.push(t.names.ko);
        t.names = { ...t.names, ...Object.fromEntries(Object.entries(pt.names).filter(([, v]) => v)) };
        t.aliases = uniq([...t.aliases, ...pt.aliases]).filter((a) => a !== t.names.ko && a !== t.names.en);
        if (pt.note) t.note = pt.note;
        claimNames(rid, [t.names.ko, t.names.en, ...pt.aliases]);
        report.updated.push(rid);
        continue;
      }
      if (!pt.names.ko) { ERR(rid || 'terms', '새 개념에 names.ko 가 없음'); continue; }
      const same = uniq([pt.names.ko, pt.names.en].filter(Boolean).flatMap((n) => lookupName(ix0, n)));
      if (same.length === 1) {
        const tid = same[0], t = db.terms[tid];
        MAP(pt.names.ko, tid, '같은 이름의 기존 개념');
        if (rid) report.idmap[rid] = tid;
        if (pt.names.en && !t.names.en) t.names.en = pt.names.en;
        const extra = uniq([pt.names.ko, pt.names.en, ...pt.aliases].filter((n) => n && !lookupName(ix0, n).includes(tid)));
        claimNames(tid, extra);
        t.aliases = uniq([...t.aliases, ...extra]).filter((a) => a !== t.names.ko && a !== t.names.en);
        continue;
      }
      if (same.length > 1) { ERR(pt.names.ko, `이름이 여러 개념과 겹침: ${same.join(', ')}`); continue; }
      const tid = alloc('T');
      if (rid) report.idmap[rid] = tid;
      db.terms[tid] = pt;
      claimNames(tid, [pt.names.ko, pt.names.en, ...pt.aliases]);
      report.added.push(tid);
    }
    // 2. 정의항
    const touched = [];
    const termOf = (ref, where) => {
      const r = str(ref);
      if (report.idmap[r]) return report.idmap[r];
      if (db.terms[r]) return r;
      if (/^T(\+|\d)/.test(r)) { ERR(where, `개념 '${r}' 없음`); return null; }
      if (!r) { ERR(where, 'term 없음'); return null; }
      const h = findTerm(r);
      if (h.length === 1) { MAP(r, h[0], '이름'); return h[0]; }
      if (h.length > 1) { ERR(where, `이름 '${r}' 이 여러 개념과 겹침`); return null; }
      if (RESERVED.test(r)) { ERR(where, `이름 '${r}' 에 # @ | / 를 쓸 수 없음`); return null; }
      const tid = alloc('T');
      db.terms[tid] = { names: { ko: r }, aliases: [] };
      nameOwner.set(normName(r), tid);
      report.added.push(tid);
      return tid;
    };
    for (const raw of arr(patchIn.senses)) {
      if (!isObj(raw)) { ERR('senses', '정의항 항목이 객체가 아님'); continue; }
      const d = normSense(raw), rid = str(raw.id);
      if (rid && !isTemp('D', rid)) {
        const old = db.senses[rid];
        if (!old) { ERR(rid, '없는 정의항 번호 — 새 정의항은 임시 번호(D+1)를 쓸 것'); continue; }
        if (raw.term && termOf(raw.term, rid) !== old.term) { ERR(rid, '정의항을 다른 개념으로 옮길 수 없음'); continue; }
        const merged = clone(old);
        for (const k of SENSE_FIELDS) if (d._given[k]) { if (d[k] === undefined) delete merged[k]; else merged[k] = d[k]; }
        const nd = normSense({ ...merged, term: old.term, n: old.n });
        db.senses[rid] = nd; report.updated.push(rid); touched.push([rid, nd]);
        continue;
      }
      const tid = termOf(raw.term, rid || 'senses');
      if (!tid) continue;
      if (preSenses.get(tid) && !d.distinction) {
        ERR(rid || tid, `'${db.terms[tid].names.ko}'(${tid}) 에는 이미 뜻이 있음 (${ix0.termSenses.get(tid).join(', ')}) — 고치려면 기존 번호를, 새 뜻이면 distinction 에 차이를 적을 것`);
        continue;
      }
      d.term = tid;
      d.n = 1 + Math.max(0, ...Object.values(db.senses).filter((x) => x.term === tid).map((x) => x.n));
      const id = alloc('D');
      if (rid) report.idmap[rid] = id;
      db.senses[id] = d; report.added.push(id); touched.push([id, d]);
    }
    // 3. 단계
    const touchedSteps = [];
    for (const raw of arr(patchIn.steps)) {
      if (!isObj(raw)) { ERR('steps', '단계 항목이 객체가 아님'); continue; }
      const st = normStep(raw), rid = str(raw.id);
      let id;
      if (rid && !isTemp('S', rid)) {
        if (!db.steps[rid]) { ERR(rid, '없는 단계 번호 — 새 단계는 임시 번호(S+1)를 쓸 것'); continue; }
        id = rid; report.updated.push(id);
      } else { id = alloc('S'); if (rid) report.idmap[rid] = id; report.added.push(id); }
      db.steps[id] = st; touchedSteps.push([id, st]);
    }
    // 3b. 한계
    const touchedLimits = [];
    for (const raw of arr(patchIn.limitations)) {
      if (!isObj(raw)) { ERR('limitations', '한계 항목이 객체가 아님'); continue; }
      const l = normLimitation(raw), rid = str(raw.id);
      let id;
      if (rid && !isTemp('L', rid)) {
        if (!db.limitations[rid]) { ERR(rid, '없는 한계 번호 — 새 한계는 임시 번호(L+1)를 쓸 것'); continue; }
        id = rid; report.updated.push(id);
      } else { id = alloc('L'); if (rid) report.idmap[rid] = id; report.added.push(id); }
      db.limitations[id] = l; touchedLimits.push([id, l]);
    }
    // 4. 참조·어휘 매핑
    const ix = index(db);
    const ref = (r, where) => {
      if (!r) return r;
      if (report.idmap[r]) return report.idmap[r];
      const x = resolveRef(ix, r);
      if (x.error) { ERR(where, x.error); return r; }
      if (x.via !== 'id') MAP(r, x.id, x.via);
      return x.id;
    };
    const voc = (table, value, where) => {
      if (value == null || value === '') return value;
      const m = mapVocab(table, value);
      if (m.error) { ERR(where, m.error); return value; }
      if (m.mapped) MAP(value, m.key, VNAME[table]);
      return m.key;
    };
    const ctx = (c, w) => { for (const [k, t] of [['species', 'taxa'], ['tissue', 'tissues'], ['cell', 'cells'], ['location', 'locations']]) if (c[k]) c[k] = voc(t, c[k], w); };
    for (const [id, d] of new Map(touched)) {
      d.kind = voc('kinds', d.kind, id);
      if (d.tier) d.tier = voc('tiers', d.tier, id);
      else if (!d._given.tier && isParticipantKind(d.kind)) { const t = defaultTier(d); if (t) d.tier = t; }
      if (d.reference_species) d.reference_species = voc('taxa', d.reference_species, id);
      else if (V.kinds[d.kind] && V.kinds[d.kind].species === 'required' && !d._given.reference_species) d.reference_species = V.defaultReferenceSpecies;
      if (d.membrane) {
        d.membrane.association = voc('associations', d.membrane.association, id);
        if (d.membrane.location) d.membrane.location = voc('locations', d.membrane.location, id);
        if (d.membrane.side) d.membrane.side = voc('faces', d.membrane.side, id);
      }
      for (const c of d.components) c.ref = ref(c.ref, `${id} 구성 요소`);
      for (const m of d.moieties || []) m.ref = ref(m.ref, `${id} 부분 구조`);
      d.desc.forEach((ds, i) => {
        const w = `${id}/desc/${i + 1}`;
        ds.field = voc('fields', ds.field, w);
        ctx(ds.context, w);
        ds.links.forEach((l, j) => { l.to = ref(l.to, `${w} 연결 ${j + 1}`); });
        if (ds.genus) ds.genus = ref(ds.genus, `${w} genus`);
        ds.evidence.level = voc('evidenceLevels', ds.evidence.level, w);
      });
      for (const [k, s] of Object.entries(d.site)) {
        const w = `${id}/site/${k}`;
        s.type = voc('siteTypes', s.type, w);
        s.features = s.features.map((f) => voc('features', f, w));
        if (s.face) s.face = voc('faces', s.face, w);
        if (s.on) s.on = ref(s.on, `${w} on`);
        if (s.ligand) s.ligand = ref(s.ligand, `${w} ligand`);
        if (s.ligands) s.ligands = Object.fromEntries(Object.entries(s.ligands).map(([f, x]) => [voc('features', f, w), ref(x, `${w} ligands`)]));
        if (s.numbering) s.numbering = Object.fromEntries(Object.entries(s.numbering).map(([t, r]) => [voc('taxa', t, w), r]));
        if (s.taxa) s.taxa = s.taxa.map((t) => voc('taxa', t, w));
      }
      for (const r of d.rule) {
        const w = `${id}/rule/${r.id}`;
        r.evidence.level = voc('evidenceLevels', r.evidence.level, w);
        if (r.taxa) r.taxa = r.taxa.map((t) => voc('taxa', t, w));
        if (r.type === 'meaning') {
          r.activity = voc('activity', r.activity, w);
          r.when = Object.fromEntries(Object.entries(r.when).map(([s, f]) => [s, voc('features', f, w)]));
          continue;
        }
        if (r.type === 'modulation') {
          if (r.kinetics) { r.kinetics.law = voc('kineticLaws', r.kinetics.law, w); r.kinetics.evidence.level = voc('evidenceLevels', r.kinetics.evidence.level, w); if (r.kinetics.context) ctx(r.kinetics.context, w); }
          r.effect = voc('effects', r.effect, w);
          if (r.at) r.at = voc('locations', r.at, w);
          r.via = r.via.map((x) => ref(x, `${w} via`));
          continue; // target(규칙 참조)은 아래에서 — 임시 번호의 규칙도 풀린다
        }
        if (r.type === 'supply' || r.type === 'degradation') {
          if (r.kinetics) { r.kinetics.law = voc('kineticLaws', r.kinetics.law, w); r.kinetics.evidence.level = voc('evidenceLevels', r.kinetics.evidence.level, w); if (r.kinetics.context) ctx(r.kinetics.context, w); }
          for (const k of ['consumes', 'produces', 'recycle_to']) for (const q of r[k] || []) { q.ref = ref(q.ref, `${w} ${k}`); if (q.location) q.location = voc('locations', q.location, w); }
          if (r.where) r.where = r.where.map((l) => voc('locations', l, w));
          if (r.fate) r.fate = voc('lifecycleFates', r.fate, w);
          if (r.when) r.when = Object.fromEntries(Object.entries(r.when).map(([s, f]) => [s, voc('features', f, w)]));
          continue;
        }
        r.action = voc('actions', r.action, w);
        if (r.kinetics) { r.kinetics.law = voc('kineticLaws', r.kinetics.law, w); r.kinetics.evidence.level = voc('evidenceLevels', r.kinetics.evidence.level, w); if (r.kinetics.context) ctx(r.kinetics.context, w); }
        const e = r.effect;
        for (const k of ['target', 'partner', 'complex', 'component']) if (e[k]) e[k] = ref(e[k], `${w} ${k}`);
        for (const q of e.requires || []) { if (q.ref) q.ref = ref(q.ref, `${w} requires`); q.feature = voc('features', q.feature, w); }
        for (const k of ['consumes', 'produces']) if (e[k]) e[k] = e[k].map((x) => ref(x, `${w} ${k}`));
        for (const k of ['add', 'remove']) if (e[k]) e[k] = e[k].map((f) => voc('features', f, w));
        for (const k of ['from', 'to']) if (e[k]) e[k] = voc('locations', e[k], w);
        if (e.partner_site) e.partner_site.component = ref(e.partner_site.component, `${w} partner_site`);
        if (r.via_component) r.via_component = ref(r.via_component, `${w} via_component`);
        if (r.with) { r.with.consumes = r.with.consumes.map((x) => ref(x, w)); r.with.produces = r.with.produces.map((x) => ref(x, w)); }
        for (const g of r.regulators) { g.ref = ref(g.ref, `${w} 조절자`); g.effect = voc('effects', g.effect, w); }
        if (r.where) r.where = r.where.map((l) => voc('locations', l, w));
      }
      for (const m of d.signature || []) { m.ref = ref(m.ref, `${id} 표지`); m.level = voc('signatureLevels', m.level, id); if (m.location) m.location = voc('locations', m.location, id); }
      for (const m of d.metabolome || []) m.level = voc('signatureLevels', m.level, id);
      for (const t of d.transitions || []) { t.to = ref(t.to, `${id} 전이 대상`); t.signals = t.signals.map((x) => ref(x, `${id} 신호`)); t.commitment.criterion = voc('commitmentCriteria', t.commitment.criterion, id); t.evidence.level = voc('evidenceLevels', t.evidence.level, id); }
      d.obs.forEach((b, i) => {
        const w = `${id}/obs/${i + 1}`;
        b.property = voc('obsProperties', b.property, w);
        ctx(b.context, w);
        if (V.obsProperties[b.property] && V.obsProperties[b.property].value === 'location') b.value = voc('locations', b.value, w);
        b.evidence.level = voc('evidenceLevels', b.evidence.level, w);
      });
    }
    for (const [id, st] of touchedSteps) {
      const m = st.rule.match(/^(.*)\/rule\/(.+)$/);
      if (!m) ERR(id, `규칙 참조 '${st.rule}' 형식 — 'D…/rule/키' 또는 { owner, id }`);
      else st.rule = `${ref(m[1], `${id} 규칙 소유자`)}/rule/${m[2]}`;
      for (const k of ['agents', 'inputs', 'outputs', 'regulators']) for (const p of st[k]) {
        if (p.b) {
          const b = parseBundle(p.b);
          if (!b.error) { b.base = ref(b.base, `${id} 묶음`); b.location = voc('locations', b.location, id); b.features = b.features.map((f) => ({ site: f.site, feature: voc('features', f.feature, id) })); p.b = bundleKey(b); }
          continue;
        }
        const raw = p.raw; delete p.raw;
        const feats = raw.features.map((f) => { const i = f.indexOf(':'); return i > 0 ? { site: f.slice(0, i), feature: voc('features', f.slice(i + 1), id) } : (ERR(id, `특징 '${f}' 형식 — '부위:특징'`), null); }).filter(Boolean);
        p.b = bundleKey({ base: ref(raw.ref, `${id} 참여자`), features: feats, location: voc('locations', raw.location, id) });
      }
      st.part_of = st.part_of.map((p) => ref(p, `${id} 소속 경로`));
    }
    const target = (t, w) => {
      if (!t) return t;
      if (report.idmap[t]) return report.idmap[t];
      const i = t.indexOf('/');
      const head = i < 0 ? t : t.slice(0, i), tail = i < 0 ? '' : t.slice(i);
      if (isStepId(head)) return t;
      const h = report.idmap[head] || (isTemp('S', head) ? head : ref(head, w));
      return h + tail;
    };
    for (const [id, l] of touchedLimits) {
      l.target = target(l.target, `${id} 대상`);
      l.type = l.type ? (V.gapTypes[l.type] ? l.type : (mapVocab('gapTypes', l.type).key || l.type)) : l.type;
      for (const n of l.requirement.needs) {
        if (n.on) n.on = ref(n.on, `${id} 필요`);
        if (n.site) n.site = target(n.site, `${id} 필요`);
        if (n.rule) n.rule = target(n.rule, `${id} 필요`);
        if (n.cell) n.cell = voc('cells', n.cell, id);
        if (n.location) n.location = voc('locations', n.location, id);
        if (n.property) n.property = voc('obsProperties', n.property, id);
      }
    }
    for (const [id, d] of new Map(touched)) for (const a of d.addresses || []) if (report.idmap[a.limitation]) a.limitation = report.idmap[a.limitation];
    // 규칙 참조 (v9): 조절 대상, 세포 상태의 대사 프로그램 — 'D…/rule/키' (임시 번호·이름 머리도 풀림)
    for (const [id, d] of new Map(touched)) {
      for (const r of d.rule) if (r.type === 'modulation' && r.target) r.target = target(r.target, `${id}/rule/${r.id} 조절 대상`);
      for (const m of d.metabolome || []) m.ref = target(m.ref, `${id} 대사 프로그램`);
    }
    // 5. 삭제 (번호 재사용 금지)
    const gone = new Set();
    for (const r of arr(patchIn.remove).map(str)) {
      if (db.steps[r]) { delete db.steps[r]; report.removed.push(r); continue; }
      if (db.limitations[r]) { delete db.limitations[r]; report.removed.push(r); continue; }
      if (db.terms[r]) {
        for (const [sid, s] of Object.entries(db.senses)) if (s.term === r) { delete db.senses[sid]; gone.add(sid); report.removed.push(sid); }
        delete db.terms[r]; report.removed.push(r); continue;
      }
      if (db.senses[r]) {
        const tid = db.senses[r].term;
        delete db.senses[r]; gone.add(r); report.removed.push(r);
        if (!Object.values(db.senses).some((s) => s.term === tid)) { delete db.terms[tid]; report.removed.push(tid); }
        continue;
      }
      ERR(r, '삭제 대상 없음 (번호로 지정할 것)');
    }
    if (gone.size) for (const d of Object.values(db.senses)) for (const ds of d.desc) ds.links = ds.links.filter((l) => !gone.has(l.to));
    return { db, report };
  }

  function gate(dbBefore, result, opt) {
    const before = validate(normalize(dbBefore)), after = validate(result.db);
    const key = (i) => i.where + '|' + i.msg, old = new Set([...before.errors, ...before.warnings].map(key));
    const errors = [...result.report.errors, ...after.errors.filter((i) => !old.has(key(i)))];
    const warnings = after.warnings.filter((i) => !old.has(key(i)));
    const r = result.report;
    const changed = r.added.length + r.updated.length + r.removed.length > 0;
    const ok = changed && !errors.length && (!warnings.length || !!(opt && opt.allowWarnings));
    return { ok, changed, errors, warnings, preexisting: before.errors.length };
  }

  // ===== 패치 보고서 (Patch Report: Scope · Why · Impact · Verification) =====
  // 병합 하나의 기술 기록. 사람이 쓰는 것은 patch.why 하나뿐이고 나머지는 이전·이후 db 를 비교해 계산한다.
  function refsOfRule(r) {
    const e = r.effect || {}, out = [];
    for (const k of ['target', 'partner', 'complex', 'component']) if (e[k]) out.push(e[k]);
    out.push(...(e.consumes || []), ...(e.produces || []), ...(e.requires || []).map((q) => q.ref).filter(Boolean));
    if (e.partner_site) out.push(e.partner_site.component);
    if (r.with) out.push(...r.with.consumes, ...r.with.produces);
    for (const g of r.regulators || []) out.push(g.ref);
    if (r.via_component) out.push(r.via_component);
    for (const k of ['consumes', 'produces', 'recycle_to']) for (const q of r[k] || []) out.push(q.ref);
    if (r.type === 'modulation') { out.push(String(r.target || '').split('/')[0], ...(r.via || [])); }
    return out;
  }
  function patchReport(dbBefore, result, patch, gateResult) {
    const before = normalize(dbBefore), after = result.db, r = result.report, ix = index(after);
    const kindOf = (id) => ({ T: 'terms', D: 'senses', S: 'steps', L: 'limitations' })[String(id)[0]];
    const group = (ids) => { const o = {}; for (const id of ids) (o[kindOf(id)] = o[kindOf(id)] || []).push(id); return o; };
    // 수정된 정의항의 바뀐 최상위 필드
    const fields = {};
    for (const id of r.updated) {
      const t = kindOf(id), a = before[t][id], b = after[t][id];
      if (!a || !b) continue;
      fields[id] = uniq([...Object.keys(a), ...Object.keys(b)]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    }
    const changed = new Set([...r.added, ...r.updated, ...r.removed]);
    const changedD = [...changed].filter((x) => /^D/.test(x)), cd = new Set(changedD);
    // 하류: 바뀐 정의항을 참조하는 규칙·정의항·단계·경로·한계
    const rules = [], senses = [];
    for (const [id, d] of Object.entries(after.senses)) {
      if (cd.has(id)) continue;
      for (const x of d.rule) if (refsOfRule(x).some((y) => cd.has(y))) rules.push(`${id}/rule/${x.id}`);
      const refs = [...d.components.map((c) => c.ref), ...(d.moieties || []).map((m) => m.ref), ...d.desc.flatMap((ds) => ds.links.map((l) => l.to)),
        ...Object.values(d.site).flatMap((x) => [x.ligand, x.on, ...Object.values(x.ligands || {})]).filter(Boolean)];
      if (refs.some((y) => cd.has(y))) senses.push(id);
    }
    const ruleSet = new Set(rules);
    // 바뀐 정의항의 공급 규칙이 닿는 저장소 묶음(정의항|위치) — 그 묶음을 쓰는 단계는 시뮬레이션에서 그 공급을 켠다
    const supplyKeys = new Set(changedD.flatMap((id) => (after.senses[id] ? after.senses[id].rule : []).filter((x) => x.type === 'supply').flatMap((x) => [...x.consumes, ...x.produces].map((q) => `${q.ref}|${x.where[0]}`))));
    const steps = Object.entries(after.steps).filter(([sid, st]) => changed.has(sid) || cd.has(st.rule.split('/')[0]) || ruleSet.has(st.rule)
      || [...st.agents, ...st.inputs, ...st.outputs, ...st.regulators].some((p) => cd.has(p.b.split('|')[0]) || supplyKeys.has(p.b))).map(([sid]) => sid);
    // 경로는 상위 경로(part_of 연결)까지 — 하위 경로의 변화는 그것을 품은 경로의 시뮬레이션도 바꾼다
    const pathways = uniq(steps.flatMap((sid) => after.steps[sid].part_of));
    const parentsOf = (p) => { const out = []; const d = after.senses[p]; if (d) for (const ds of d.desc) for (const l of ds.links) if (l.rel === 'part_of') out.push(l.to);
      for (const [q, x] of Object.entries(after.senses)) if (x.kind === 'pathway') for (const ds of x.desc) for (const l of ds.links) if (l.rel === 'has_part' && l.to === p) out.push(q); return out; };
    for (let i = 0; i < pathways.length; i++) for (const q of parentsOf(pathways[i])) if (after.senses[q] && after.senses[q].kind === 'pathway' && !pathways.includes(q)) pathways.push(q);
    const status = (db, id) => (db.limitations[id] ? limitationStatus(db, db.limitations[id]).status : null);
    const limits = Object.entries(after.limitations).filter(([lid, l]) => changed.has(lid) || cd.has((parseTarget(l.target) || {}).base) || l.requirement.needs.some((n) => cd.has(n.on) || cd.has((parseTarget(n.rule || n.site || '') || {}).base)))
      .map(([lid]) => ({ id: lid, before: status(before, lid), after: status(after, lid) }));
    const statusChanged = Object.keys(after.limitations).filter((lid) => status(before, lid) !== status(after, lid)).map((lid) => ({ id: lid, before: status(before, lid), after: status(after, lid) }));
    const v = validate(after), gaps = detectGaps(after);
    const regenerate = ['docs/textbook/90-부록-자동생성.md'];
    if (statusChanged.length || r.added.concat(r.updated, r.removed).some((x) => /^L/.test(x)) || limits.length) regenerate.unshift('limitations.md');
    return {
      scope: { files: ['data/db.json', 'data/patches/'], added: group(r.added), updated: group(r.updated), removed: group(r.removed), fields },
      why: str(patch && patch.why),
      impact: { rules: uniq(rules), senses: uniq(senses), steps, pathways, limitations: limits, limitation_status_changed: statusChanged, regenerate },
      verification: { gate: gateResult ? (gateResult.ok ? 'pass' : 'reject') : null, errors: v.errors.length, warnings: v.warnings.length, new_errors: gateResult ? gateResult.errors.length : null, new_warnings: gateResult ? gateResult.warnings.length : null, undetected_gaps: gaps.length, augment_candidates: augmentCandidates(after) },
    };
  }
  // ===== 정제 점검 (Continuous Refinement, 형식 v9 확장) — 더 효율적인 표현·화학량 모순을 찾는다 =====
  //   duplicate_rule: 같은 화학량·위치의 공급 규칙, 같은 소유자·대상·효과·위치의 조절 규칙 (중복 복잡도)
  //   lumped_contradiction: 경로가 가진 공급 규칙(순 반응)과 그 경로 단계들의 화학량 합이 다름 — 그 규칙을 대상으로 한 열린 한계가 있으면 known
  function refineCheck(db) {
    db = normalize(db);
    const issues = [], sig = new Map(), ix = index(db);
    const qs = (xs) => xs.map((q) => `${q.ref}:${q.n}`).sort().join('+');
    const refCount = (ref) => Object.values(db.steps).filter((st) => st.rule === ref).length + Object.values(db.senses).reduce((t, d) => t + (d.metabolome || []).filter((m) => m.ref === ref).length + d.rule.filter((r) => r.type === 'modulation' && r.target === ref).length, 0);
    const knownFor = (ref) => Object.entries(db.limitations).filter(([, l]) => l.type === 'Structural_Gap' && (l.target === ref || l.requirement.needs.some((n) => n.rule === ref)) && limitationStatus(db, l).status !== 'resolved').map(([lid]) => lid);
    for (const [id, d] of Object.entries(db.senses)) for (const r of d.rule) {
      const key = r.type === 'supply' ? `S|${r.where.join()}|${qs(r.consumes)}>${qs(r.produces)}` : r.type === 'modulation' ? `M|${id}|${r.target}|${r.effect}|${r.at}` : null;
      if (!key) continue;
      const ref = `${id}/rule/${r.id}`;
      if (sig.has(key)) issues.push({ type: 'duplicate_rule', where: ref, same_as: sig.get(key), msg: `${ref} 는 ${sig.get(key)} 와 같은 ${r.type === 'supply' ? '화학량·위치의 공급' : '조절자·대상·효과·위치의 조절'} — 중복 복잡도`, removable: refCount(ref) === 0 });
      else sig.set(key, ref);
    }
    // 경로의 순 반응 공급 규칙 ↔ 단계 화학량 합 (부피 위치 하나에서)
    for (const [pid, d] of Object.entries(db.senses)) {
      if (d.kind !== 'pathway') continue;
      const steps = Object.values(db.steps).filter((st) => st.part_of.includes(pid));
      if (!steps.length) continue;
      for (const r of d.rule.filter((x) => x.type === 'supply')) {
        const loc = r.where[0], net = {};
        for (const st of steps) { for (const p of st.outputs) { const b = parseBundle(p.b); if (b.location === loc) net[b.base] = (net[b.base] || 0) + (p.n || 1); } for (const p of st.inputs) { const b = parseBundle(p.b); if (b.location === loc) net[b.base] = (net[b.base] || 0) - (p.n || 1); } }
        const lump = {}; for (const q of r.produces) lump[q.ref] = (lump[q.ref] || 0) + q.n; for (const q of r.consumes) lump[q.ref] = (lump[q.ref] || 0) - q.n;
        const diff = uniq([...Object.keys(net), ...Object.keys(lump)]).filter((k) => Math.abs((net[k] || 0) - (lump[k] || 0)) > 1e-12).map((k) => ({ ref: k, steps: net[k] || 0, rule: lump[k] || 0 }));
        if (!diff.length) continue;
        const ref = `${pid}/rule/${r.id}`, known = knownFor(ref);
        issues.push({ type: 'lumped_contradiction', where: ref, known, diff, msg: `${ref} (순 반응) ↔ ${ix.label(pid)} 단계 ${steps.length}개의 화학량 합: ${diff.map((x) => `${ix.label(x.ref)} 단계 ${x.steps > 0 ? '+' : ''}${x.steps} / 규칙 ${x.rule > 0 ? '+' : ''}${x.rule}`).join(', ')}${known.length ? ` — 알려진 단순화 (${known.join(', ')})` : ' — 등록되지 않은 모순'}` });
      }
    }
    // 리팩터링 패치 제안: 참조되지 않는 중복 규칙 제거
    const rm = issues.filter((x) => x.type === 'duplicate_rule' && x.removable);
    const byOwner = new Map(); for (const x of rm) { const [o, , k] = x.where.split('/'); if (!byOwner.has(o)) byOwner.set(o, new Set()); byOwner.get(o).add(k); }
    const refactor = byOwner.size ? { format: PATCH_FORMAT, version: VERSION, why: `리팩터링 패치 (정제 점검): 참조되지 않는 중복 규칙 ${rm.length}개 제거 — ${rm.map((x) => `${x.where} = ${x.same_as}`).join(', ')}`, senses: [...byOwner].map(([o, ks]) => ({ id: o, rule: db.senses[o].rule.filter((r) => !ks.has(r.id)) })) } : null;
    return { issues, refactor, unresolved: issues.filter((x) => x.type === 'duplicate_rule' || (x.type === 'lumped_contradiction' && !x.known.length)).length };
  }
  function refineText(db) {
    const r = refineCheck(db);
    if (!r.issues.length) return { text: '정제 점검: 중복 규칙·화학량 모순 없음', result: r };
    return { text: ['정제 점검 (Continuous Refinement):', ...r.issues.map((x) => `  ${x.type === 'lumped_contradiction' && x.known.length ? '○' : '△'} [${x.type}] ${x.msg}`), ...(r.refactor ? [`  → 리팩터링 패치 제안: ${r.refactor.why}`] : [])].join('\n'), result: r };
  }
  // 자동 보강 후보 (원본 대조 대상): unmapped 필수 외부 ID, 또는 대조 안 된(asserted) UniProt·ChEBI — engine/augment.js 의 plan 과 같은 기준
  function augmentCandidates(db) {
    let n = 0;
    for (const d of Object.values(db.senses)) { const K = V.kinds[d.kind]; if (!K) continue; if (d.xrefs.some((x) => ['UniProt', 'ChEBI'].includes(x.db) && x.status !== 'verified') || (d.unmapped && (K.xref.required || []).some((r) => ['UniProt', 'ChEBI'].includes(r)))) n++; }
    return n;
  }
  function patchReportText(rep, ix) {
    const L = (id) => (ix ? `${id} ${ix.label(id)}` : id), list = (xs) => (xs && xs.length ? xs.map(L).join(', ') : '—');
    const g = (o) => Object.entries(o).map(([k, xs]) => `${k} ${xs.length}: ${xs.join(' ')}`).join(' · ') || '—';
    const out = ['## Patch Report', '', '| 항목 | 내용 |', '|---|---|',
      `| Scope · 파일 | ${rep.scope.files.join(', ')} |`,
      `| Scope · 추가 | ${g(rep.scope.added)} |`, `| Scope · 수정 | ${g(rep.scope.updated)} |`, `| Scope · 삭제 | ${g(rep.scope.removed)} |`,
      `| Scope · 바뀐 필드 | ${Object.entries(rep.scope.fields).map(([id, fs]) => `${id}{${fs.join(',')}}`).join(' ') || '—'} |`,
      `| Why | ${rep.why || '✗ 없음 (patch.why 필수)'} |`,
      `| Impact · 참조하는 규칙 | ${list(rep.impact.rules)} |`, `| Impact · 참조하는 정의항 | ${list(rep.impact.senses)} |`,
      `| Impact · 단계 | ${rep.impact.steps.join(', ') || '—'} |`, `| Impact · 경로 (simulate·audit-run 대상) | ${list(rep.impact.pathways)} |`,
      `| Impact · 관련 한계 | ${rep.impact.limitations.map((l) => `${l.id}(${l.before || 'new'}→${l.after})`).join(', ') || '—'} |`,
      `| Impact · 상태가 바뀐 한계 | ${rep.impact.limitation_status_changed.map((l) => `${l.id}(${l.before || 'new'}→${l.after || 'removed'})`).join(', ') || '—'} |`,
      `| Impact · 다시 만들 생성물 | ${rep.impact.regenerate.join(', ')} |`,
      `| Verification | 관문 ${rep.verification.gate} · 새 오류 ${rep.verification.new_errors} · 새 경고 ${rep.verification.new_warnings} · 전체 오류 ${rep.verification.errors} · 경고 ${rep.verification.warnings} · 미등록 한계 후보 ${rep.verification.undetected_gaps}${rep.verification.augment_candidates != null ? ` · 자동 보강 후보 ${rep.verification.augment_candidates} (augment plan)` : ''} |`];
    return out.join('\n');
  }

  // ===== 매핑·채움 현황 =====
  function audit(db) {
    db = normalize(db);
    const ix = index(db);
    const a = { byKind: {}, unmapped: [], asserted: [], verified: [], noFingerprint: [], unknownResidues: [], complexNoComponents: [], evidence: {} };
    for (const [id, d] of ix.senses) {
      a.byKind[d.kind] = (a.byKind[d.kind] || 0) + 1;
      if (d.unmapped) a.unmapped.push(`${id} ${ix.label(id)} [${d.kind}]: ${d.unmapped}`);
      for (const x of d.xrefs) (x.status === 'verified' ? a.verified : a.asserted).push(`${id} ${ix.label(id)} — ${xrefLabel(x)}`);
      if (!d.fingerprint && Object.values(V.fingerprints).some((f) => f.kinds.includes(d.kind))) a.noFingerprint.push(`${id} ${ix.label(id)}`);
      for (const [k, s] of Object.entries(d.site)) if (s.residue_unknown) a.unknownResidues.push(`${id}/site/${k} ${ix.label(id)}`);
      if (d.kind === 'complex' && !d.components.length) a.complexNoComponents.push(`${id} ${ix.label(id)}`);
      for (const x of [...d.desc, ...d.rule, ...d.obs]) a.evidence[x.evidence.level] = (a.evidence[x.evidence.level] || 0) + 1;
    }
    return a;
  }
  function auditText(db) {
    const a = audit(db), list = (t, xs) => [`${t} ${xs.length}`, ...xs.map((x) => '  - ' + x)];
    return [
      '종류별 정의항: ' + Object.entries(a.byKind).sort().map(([k, n]) => `${k} ${n}`).join(', '),
      '근거 수준(설명·규칙·관찰): ' + Object.entries(a.evidence).map(([k, n]) => `${k} ${n}`).join(', '),
      `외부 ID: 원본과 대조됨 ${a.verified.length}, 대조 안 됨(asserted) ${a.asserted.length}`,
      ...a.asserted.map((x) => '  ? ' + x),
      ...list('미매핑(unmapped)', a.unmapped),
      ...list('잔기 번호 모름(residue_unknown)', a.unknownResidues),
      ...list('구성 요소 없는 복합체', a.complexNoComponents),
      `구조 지문이 비어 있는 분자 ${a.noFingerprint.length}` + (a.noFingerprint.length ? ` (도구로 계산해 채울 것)` : ''),
    ].join('\n');
  }
  function mapText(db, query) {
    db = normalize(db);
    const ix = index(db), r = resolveRef(ix, query);
    if (r.error) return r.error;
    const d = ix.senses.get(r.id), t = db.terms[d.term];
    return [`${query} → ${r.id}  (${r.via})`,
      `  ${ix.label(r.id)}  개념 ${d.term} · 뜻 ${d.n} [${d.kind}${d.reference_species ? ' · 기준 종 ' + vlabel('taxa', d.reference_species) : ''}] ${d.desc[0] ? d.desc[0].text : ''}`,
      `  이름: ${t.names.ko}${t.names.en ? ' / ' + t.names.en : ''}${t.aliases.length ? ' · 별칭 ' + t.aliases.join(', ') : ''}`,
      d.xrefs.length ? '  외부 ID: ' + d.xrefs.map((y) => `${xrefLabel(y)}(${y.status})`).join(', ') : '',
      d.unmapped ? '  미매핑: ' + d.unmapped : '',
      Object.keys(d.site).length ? '  부위: ' + Object.entries(d.site).map(([k, s]) => `${ix.siteLabel(r.id, k)}[${s.features.join('/')}]`).join(', ') : '',
      d.rule.length ? '  규칙: ' + d.rule.map((x) => `${x.id}(${x.label})`).join(', ') : ''].filter(Boolean).join('\n');
  }

  // ===== 사람/AI 가 읽는 텍스트 =====
  function line(ix, id) {
    const d = ix.senses.get(id);
    if (!d) return `[${id}] (없음)`;
    const ds = d.desc[0] || { text: '', field: '', context: {} };
    return `[${id} ${ix.label(id)}] ${ds.text} 〈${ds.field}${ds.context.scope && ds.context.scope !== ds.field ? ' · ' + ds.context.scope : ''}〉 {${d.kind}}`;
  }
  function ruleLine(ix, owner, r) {
    const kn = r.kinetics ? ` 〈${r.kinetics.law} ${KIN_FIELDS.filter((f) => r.kinetics[f] != null).map((f) => `${f}=${r.kinetics[f]}`).join(' ')}〉` : ' 〈속도 상수 없음〉';
    const qs = (xs) => xs.map((q) => `${q.n === 1 ? '' : q.n + ' '}${ix.label(q.ref)}`).join(' + ') || '∅';
    if (r.type === 'supply') return `${owner}/rule/${r.id} 「${r.label}」 공급${r.source ? '(계 밖)' : ''}: ${qs(r.consumes)} → ${qs(r.produces)} @${r.where.map((l) => vlabel('locations', l)).join('·')}${kn}`;
    if (r.type === 'degradation') return `${owner}/rule/${r.id} 「${r.label}」 분해: ${ix.label(owner)}${Object.keys(r.when).length ? '[' + Object.entries(r.when).map(([s, f]) => `${s}:${vlabel('features', f)}`).join(',') + ']' : ''} → ${r.fate === 'recycled' ? '재활용 ' + qs(r.recycle_to) : '소실'}${kn}`;
    if (r.type === 'modulation') return `${owner}/rule/${r.id} 「${r.label}」 조절: ${ix.label(owner)}@${vlabel('locations', r.at)} ${r.effect === 'inhibits' ? '⊣' : '→'} ${r.target}${(r.via || []).length ? ` (매개 ${r.via.map(ix.label).join('·')})` : ''}${r.kinetics ? ` 〈hill ${['K', 'n', 'fmax', 'fmin'].filter((f) => r.kinetics[f] != null).map((f) => `${f}=${r.kinetics[f]}`).join(' ')}〉` : ' 〈힐 상수 없음〉'}`;
    if (r.type === 'meaning') return `${owner}/rule/${r.id} 「${r.label}」 상태 의미: ${Object.entries(r.when).map(([s, f]) => `${ix.siteLabel(owner, s)}:${vlabel('features', f)}`).join(' ∧ ') || '(기본)'} → ${vlabel('activity', r.activity)}`;
    const e = r.effect, L = ix.label;
    let eff = '';
    if (e.type === 'modify') eff = `${L(e.target || owner)}.${ix.siteLabel(e.target || owner, e.site)} ${(e.remove || []).map((f) => '−' + vlabel('features', f)).join(' ')} ${(e.add || []).map((f) => '+' + vlabel('features', f)).join(' ')}${e.partner ? ` (상대 ${L(e.partner)} 흡수)` : ''}`;
    if (e.type === 'convert') eff = `${(e.consumes || []).map(L).join(' + ')} → ${(e.produces || []).map(L).join(' + ')}`;
    if (e.type === 'dissociate') eff = `${L(e.complex || owner)} → 구성 요소로 해리${e.partner ? ` (${L(e.partner)} 결합)` : ''}`;
    if (e.type === 'associate') eff = `구성 요소 → ${L(e.complex || owner)}`;
    if (e.type === 'transport') eff = `${L(e.target || owner)}: ${vlabel('locations', e.from)} → ${vlabel('locations', e.to)}`;
    if (e.type === 'transfer') eff = `${L(e.partner)}: ${L(owner)}.${e.from_site} → ${L(e.target)}.${e.site}`;
    if (e.type === 'degrade') eff = `${L(e.complex || owner)} 의 ${L(e.component)} 분해 → ${(e.produces || []).map(L).join(' + ')}, 나머지 구성 요소 방출`;
    if ((e.requires || []).length) eff += ` 〔전제: ${e.requires.map((q) => `${q.ref ? L(q.ref) + '.' : ''}${q.site}:${vlabel('features', q.feature)}`).join(' ∧ ')}〕`;
    return `${owner}/rule/${r.id} 「${r.label}」 [${r.action}${r.agent ? ', 행위자 ' + L(owner) + (r.via_site ? '.' + r.via_site : '') : ''}] ${eff.trim()}`
      + (r.where ? ` 〈${r.where.map((l) => vlabel('locations', l)).join('·')}에서만〉` : '')
      + (r.regulators.length ? ` | 조절: ${r.regulators.map((g) => `${vlabel('effects', g.effect)} ${L(g.ref)}`).join(', ')}` : '');
  }
  function stepLine(ix, id) {
    const r = ix.steps.get(id);
    if (!r) return `${id} (없음)`;
    const st = r.step, rule = ix.ruleOf(st.rule) || { label: st.rule, action: '?' };
    const P = (p) => (p.n > 1 ? p.n + '× ' : '') + ix.bundleLabel(p.b) + (p.minor ? '*' : '');
    return `${id} 「${rule.label}」 [${rule.action}]${st.agents.length ? ` 행위자 ${st.agents.map(P).join(', ')} |` : ''} ${st.inputs.map(P).join(' + ') || '∅'} → ${st.outputs.map(P).join(' + ') || '∅'}`
      + (st.regulators.length ? ` | 조절: ${st.regulators.map(P).join(', ')}` : '');
  }
  function targets(ix, target) {
    if (ix.senses.has(target)) return { ids: [target] };
    if (ix.db.terms[target]) return { ids: ix.termSenses.get(target) };
    const hit = lookupName(ix, target);
    if (hit.length === 1 && !target.includes('#')) return { ids: ix.termSenses.get(hit[0]) };
    const r = resolveRef(ix, target);
    return r.error ? { error: r.error } : { ids: [r.id] };
  }
  function contextText(db, target, opt) {
    opt = Object.assign({ up: 4, down: 1 }, opt || {});
    db = normalize(db);
    const ix = index(db), tg = targets(ix, target);
    if (tg.error) return tg.error;
    const out = [], L = ix.label;
    for (const id of tg.ids) {
      const d = ix.senses.get(id), t = db.terms[d.term];
      out.push(line(ix, id));
      out.push(`  개념 ${d.term}: ${t.names.ko}${t.names.en ? ' / ' + t.names.en : ''}${t.aliases.length ? ' · 별칭 ' + t.aliases.join(', ') : ''}${d.reference_species ? ` · 기준 종 ${vlabel('taxa', d.reference_species)}` : ''}`);
      if (d.xrefs.length) out.push('  외부 ID: ' + d.xrefs.map((y) => `${xrefLabel(y)}${y.status === 'verified' ? '' : '(미대조)'}`).join(', '));
      if (d.fingerprint) out.push(`  지문: ${d.fingerprint.scheme} ${d.fingerprint.value}`);
      if (d.unmapped) out.push('  미매핑: ' + d.unmapped);
      // 구조 (지식 해상도)
      if (d.membrane) out.push(`  ▣ 막 위상: ${vlabel('associations', d.membrane.association)}${d.membrane.location ? ' · ' + vlabel('locations', d.membrane.location) : ''}${d.membrane.side ? ' · ' + vlabel('faces', d.membrane.side) : ''}`);
      for (const c of d.components) out.push(`  ▣ 구성 요소: ${L(c.ref)} (${c.ref}) ×${c.n}${c.role ? ' · ' + c.role : ''}`);
      for (const [k, s] of Object.entries(d.site)) out.push(`  ◇ 부위 ${id}/site/${k}: ${vlabel('siteTypes', s.type)}${s.numbering ? ' ' + Object.entries(s.numbering).map(([tx, r]) => `${vlabel('taxa', tx)} ${r}`).join(', ') : ''}${s.residue_unknown ? ' (잔기 모름)' : ''}${s.on ? ' · 구성 요소 ' + L(s.on) : ''}${s.face ? ' · ' + vlabel('faces', s.face) : ''}${s.ligand ? ' · 리간드 ' + L(s.ligand) : ''} · 특징 ${s.features.map((f) => vlabel('features', f)).join('/')}`);
      for (const r of d.rule) out.push('  ⚖ ' + ruleLine(ix, id, r));
      // 세포 상태 (v9)
      if ((d.signature || []).length) out.push('  ◎ 표지 서명: ' + d.signature.map((m) => `${L(m.ref)}@${vlabel('locations', m.location)} ${m.level === 'high' ? '높음' : '낮음'}`).join(' · '));
      for (const m of d.metabolome || []) out.push(`  ◎ 대사 프로그램 ${m.level === 'high' ? '높음' : '낮음'}: ${m.ref} ${L(m.ref.split('/')[0])}`);
      for (const tr of d.transitions || []) out.push(`  ⇒ 전이 → ${L(tr.to)} (${tr.to}) · 신호 ${tr.signals.map(L).join(', ')} · 결정 기준 ${tr.commitment.criterion}${tr.text ? ' — ' + tr.text : ''} [${tr.evidence.level}]`);
      for (const [mid, md] of ix.senses) for (const r of md.rule) if (r.type === 'modulation' && String(r.target).startsWith(id + '/rule/')) out.push(`  ⇐ 조절받음 ${r.target.split('/').pop()}: ${L(mid)} ${r.effect === 'inhibits' ? '⊣' : '→'} (${mid}/rule/${r.id})`);
      d.desc.forEach((ds, i) => { if (i > 0) out.push(`  ✎ 설명 ${i + 1}: ${ds.text} 〈${ds.field} · ${ds.context.scope}〉`); });
      for (const b of d.obs) out.push(`  ☉ 관찰 ${vlabel('obsProperties', b.property)} = ${b.value}${b.unit ? ' ' + b.unit : ''} 〈${[b.context.species && vlabel('taxa', b.context.species), b.context.tissue && vlabel('tissues', b.context.tissue), b.context.cell && vlabel('cells', b.context.cell), b.context.condition].filter(Boolean).join(' · ')}〉 [${b.evidence.level}]`);
      const climb = (n, depth, pad, seen) => {
        if (depth >= opt.up) return;
        for (const e of ix.parents(n)) {
          out.push(`${pad}↑ ${AXIS_UP[e.axis]}${e.link.span ? ` ("${e.link.span}")` : ''}: ${line(ix, e.parent)}`);
          if (seen.has(e.parent)) { out.push(pad + '   (순환)'); continue; }
          climb(e.parent, depth + 1, pad + '   ', new Set([...seen, e.parent]));
        }
      };
      climb(id, 0, '  ', new Set([id]));
      const sink = (n, depth, pad) => {
        if (depth >= opt.down) return;
        for (const e of ix.children(n)) { out.push(`${pad}↓ ${AXIS_DOWN[e.axis]}: ${line(ix, e.child)}`); sink(e.child, depth + 1, pad + '   '); }
      };
      sink(id, 0, '  ');
      for (const e of ix.sides(id)) {
        const rr = REL[e.rel] || {};
        if (e.from === id) out.push(`  ↔ ${rr.label || e.rel}${e.link.span ? ` ("${e.link.span}")` : ''}: ${line(ix, e.target)}`);
        else out.push(`  ↔ ${rr.inverse || e.rel}: ${line(ix, e.from)}`);
      }
      for (const ro of ix.roles(id)) out.push(`  ⚙ ${ROLE[ro.role]} [${ix.bundleLabel(ro.p.b)}]: ${stepLine(ix, ro.id)}`);
      const inPath = ix.stepsIn(id);
      if (inPath.length) out.push(`  ⚙ 이 경로에 속한 기전 단계 ${inPath.length}개 — mechanism 으로 순서대로 보기`);
      out.push('');
    }
    return out.join('\n').trimEnd();
  }
  function mechanismText(db, target, opt) {
    opt = Object.assign({ up: 3, down: 3 }, opt || {});
    db = normalize(db);
    const ix = index(db);
    if (isStepId(target)) {
      if (!ix.steps.has(target)) return `'${target}' 단계가 없습니다.`;
      const out = [], st = ix.steps.get(target).step, rule = ix.ruleOf(st.rule);
      const walk = (id, depth, pad, dir, seen) => {
        if (depth >= (dir === 'next' ? opt.down : opt.up)) return;
        for (const n of ix[dir](id)) {
          out.push(`${pad}${dir === 'next' ? '↓' : '↑'} (${ix.bundleLabel(n.via)}) ${stepLine(ix, n.id)}`);
          if (!seen.has(n.id)) walk(n.id, depth + 1, pad + '   ', dir, new Set([...seen, n.id]));
        }
      };
      walk(target, 0, '  ', 'prev', new Set([target]));
      const ups = out.splice(0);
      walk(target, 0, '  ', 'next', new Set([target]));
      return [...(ups.length ? ['앞 단계:', ...ups] : []), '▶ ' + stepLine(ix, target),
        ...(rule ? ['  규칙: ' + ruleLine(ix, ix.ruleOwner(st.rule), rule), ...(rule.text ? ['  ' + rule.text] : [])] : []),
        '  소속: ' + st.part_of.map((p) => `${p} ${ix.label(p)}`).join(', '), ...(out.length ? ['다음 단계:', ...out] : [])].join('\n');
    }
    const tg = targets(ix, target);
    if (tg.error) return tg.error;
    const out = [];
    for (const id of tg.ids) {
      const list = ix.stepsIn(id);
      if (!list.length) continue;
      out.push(line(ix, id));
      list.forEach((sid, i) => {
        out.push(`  ${i + 1}. ${stepLine(ix, sid)}`);
        const nx = ix.next(sid);
        if (nx.length) out.push(`       → ${uniq(nx.map((n) => n.id)).join(', ')}`);
      });
      out.push('');
    }
    return out.length ? out.join('\n').trimEnd() : `'${target}' 에 속한 기전 단계가 없습니다.`;
  }

  // ===== AI 에게 줄 작성 지침 =====
  const vlist = (table, withLabel) => Object.entries(V[table]).map(([k, v]) => (withLabel && v.label ? `${k}(${v.label})` : k)).join(', ');
  function promptText(db, opt) {
    db = normalize(db);
    opt = opt || {};
    const ix = index(db);
    const idx = [];
    for (const [tid, t] of Object.entries(db.terms).sort((a, b) => a[1].names.ko.localeCompare(b[1].names.ko))) {
      const nm = `${t.names.en ? ' / ' + t.names.en : ''}${t.aliases.length ? ' (별칭: ' + t.aliases.join(', ') + ')' : ''}`;
      for (const id of ix.termSenses.get(tid)) {
        const d = ix.senses.get(id), ds = d.desc[0] || { text: '', field: '', context: {} };
        const extra = [Object.keys(d.site).length && '부위 ' + Object.entries(d.site).map(([k, s]) => `${k}[${s.features.join('/')}]`).join(', '),
          d.rule.length && '규칙 ' + d.rule.map((r) => r.id).join(', '), d.membrane && d.membrane.association !== 'soluble' && '막 ' + d.membrane.location,
          d.components.length && '구성 ' + d.components.map((c) => `${c.ref}×${c.n}`).join('+')].filter(Boolean).join(' | ');
        idx.push(`${id} ${ix.label(id)}${nm} | ${d.kind} | ${ds.field} · ${ds.context.scope} | ${ds.text.length > 40 ? ds.text.slice(0, 40) + '…' : ds.text}${extra ? ' | ' + extra : ''}`);
      }
    }
    const kinds = Object.entries(V.kinds).map(([k, v]) => `  - ${k}: ${v.label}${v.participant ? ' [기전 참여]' : ''}${v.species === 'required' ? ' [기준 종 필수]' : v.species === 'forbidden' ? ' [종 없음]' : ''}${(v.xref.required || []).length ? ` [필수 ID: ${v.xref.required.join(', ')}]` : ''}`).join('\n');
    const actions = Object.entries(V.actions).map(([k, v]) => `${k}→${v.effects.join('/')}${v.adds ? ` +${v.adds}` : ''}${v.removes ? ` −${v.removes}` : ''}`).join('; ');
    const locs = Object.entries(V.locations).map(([k, v]) => `${k}(${v.label}, ${v.dim}${v.parent ? ', ⊂' + v.parent : ''})`).join(', ');
    return `너는 "맥락 보존형 생명과학 데이터베이스"(형식 v${VERSION})에 항목을 추가하는 작성자다. 아래 자료를 읽고 패치 JSON 하나만 출력하라.
규칙은 엄격하게 검사되며, 하나라도 어기면 패치 전체가 거부된다.

## 두 해상도
- 정의항(D, 원천): 가능한 가장 높은 구조적 진실. 구성 요소(소단위·보조인자)를 빠뜨리지 말고, 막 위상·부위·규칙을 정의항이 소유한다.
  모르는 값(잔기 번호, 외부 ID, 서열)은 지어내지 말고 residue_unknown / unmapped 로 명시한다.
- 묶음·단계(결과): 의미 있는 변화만. 묶음 = "D번호|부위:특징|…|위치", 단계 = "원천의 전이 규칙이 이 묶음들에 적용됨". 라벨·설명을 넣지 않는다.

## 식별자
- 개념 T…, 정의항 D…, 단계 S…. 새 항목은 임시 번호("T+1", "D+pka_c", "S+1"). 패치 안의 임시 번호 참조는 함께 바뀐다.
- 참조(term, to, ref, target, partner, consumes, produces, on, ligand, part_of)는 번호가 원칙. 이름·"이름#뜻번호"·외부 ID 도 매핑되지만 뜻이 여러 개면 거부.

## 정의항 필드 (senses 항목)
- kind, reference_species(단백질·핵산 필수, 기본 9606), xrefs, unmapped, fingerprint(도구로 계산한 값만)
- membrane: { association: ${vlist('associations')}, location: 막(2D 위치), side: 막 면(peripheral·lipid_anchored) }
- components: [{ ref, n, role }] — 복합체(complex)의 구성 요소 전부
- desc: [{ text, field, context:{ scope, species, tissue, cell, condition }, genus, links:[{ to, rel, span, note }], evidence, examples }]
- site: { 키: { type, features:[…], numbering:{ "9606": "Ser14" } 또는 residue_unknown: true, on: 구성 요소, face, ligand, taxa } }
- rule: [ 상태 의미 { id, type:"meaning", label, when:{ 부위: 특징 }, activity } — 위에서부터 첫 번째로 맞는 규칙, when 이 비면 기본값
          전이 { id, type:"transition", label, action, agent: true|false, via_site, via_component, effect, with:{consumes,produces}, regulators:[{ref, effect, note}], where:[위치], taxa, text, evidence } ]
  - effect: { type:"modify", target, site, add:[특징], remove:[특징], partner } | { type:"convert", consumes:[D], produces:[D] }
            | { type:"dissociate"|"associate", complex, partner, partner_site:{component, sites:[부위]} } | { type:"transport", target, from, to }
            | { type:"transfer", partner: 리간드, from_site: 소유자 부위, target, site } | { type:"degrade", complex, component, produces:[분해 산물] }
  - effect.requires: [{ ref, site, feature }] — 입력 묶음이 이미 가져야 하는 특징 (ref 생략 = 대상/복합체)
  - 결합·해리·전달·분해·수송 단계는 동일성 보존 검사: 복합체는 구성 요소로, 채워진 부위는 그 리간드로 펼쳐 입력과 출력이 같아야 함
- obs: [{ property, value, unit, context:{ species …}, evidence }] — 종에 따라 달라지는 값은 context.species 필수
- evidence: { level: curated|abstracted|computed|asserted|predicted, sources:[{ db:"DOI"|"PMID", id, citation:"저자, 연도" }], basis, tool, confidence, note }
  - curated: 실제로 확인한 문헌만(DOI/PMID + 저자·연도). 인용을 지어내지 않는다.
  - abstracted: 문헌이 아니라 기전 흐름에서 추론한 주장 → "[Abstracted Logic: Derived from the inferred mechanistic flow]", basis 에 무엇에서 추론했는지 적음
- 기존 정의항을 고칠 때는 고칠 최상위 필드만 적는다(적지 않은 필드는 유지).

## 단계 (steps 항목)
{ id, rule: "D…/rule/키", agents:[묶음], inputs:[묶음], outputs:[묶음], regulators:[묶음], part_of:[경로 정의항] }
- 묶음: "D000044|reg_phos:phosphorylated|cytosol" 또는 { ref, features:["부위:특징"], location, n, minor }
- 검사: 행위자 활성(원천 상태 의미 규칙), 변화량 = 규칙 효과, 위치 조건(where), 공간 접촉(막 면·인접), 수송 외 위치 변화 금지, 해리 시 구성 요소 개수.

## 어휘
- kind:
${kinds}
- field: ${vlist('fields')}
- 위치: ${locs}
- 막 면: ${vlist('faces')}
- 특징: ${vlist('features')}
- 부위 종류: ${vlist('siteTypes')}
- action→허용 효과: ${actions}
- 활성: ${vlist('activity')} · 조절 효과: ${vlist('effects')}
- 종: ${Object.entries(V.taxa).map(([k, v]) => `${k}(${v.label})`).join(', ')}
- 조직: ${vlist('tissues', true)} · 세포: ${vlist('cells', true)}
- 관찰 속성: ${vlist('obsProperties')}
- 관계 rel: ${Object.keys(REL).join(', ')}

## 엄격 규칙
1. 색인에 있는 개념은 새로 만들지 말고 그 번호를 쓴다. 이름이 겹치면 합쳐지거나 거부된다.
2. 인산화형·활성형 같은 변화는 새 개념이 아니라 묶음의 부위:특징으로, 활성은 원천의 상태 의미 규칙으로 표현한다.
3. 외부 ID·잔기 번호·서열은 확실한 것만. 추측 금지.
4. 출력은 JSON 하나만.

## 출력 형식
{ "format": "definition-db-patch", "version": ${VERSION}, "terms": [], "senses": [], "steps": [], "remove": [] }

## 현재 색인 (정의항 꼬리표 / 영문 (별칭) | kind | 분야·범위 | 정의 앞부분 | 구조)
${idx.length ? idx.join('\n') : '(비어 있음)'}

## 기존 기전 단계 (* = 부산물)
${[...ix.steps.keys()].map((id) => stepLine(ix, id)).join('\n') || '(없음)'}

## 자료
${opt.material || '(여기에 정리할 자료를 붙여 넣으세요)'}
`;
  }

  // ===== 상위 패턴 (Bottom-up Abstraction) =====
  // 경로의 단계·규칙·묶음에서 반복되는 구조를 찾는 검출기. kind process 정의항의 motif 필드가 이 키를 가리키면
  // 그 정의항은 "실행 가능한 상위 개념"이 된다 — 사례(경로)는 저장하지 않고 매번 계산한다(새 경로도 자동으로 잡힘).
  function motifCtx(db, ix, ids) {
    const st = (sid) => db.steps[sid], rule = (sid) => ix.ruleOf(db.steps[sid].rule) || { effect: {} };
    const major = (ps) => ps.filter((p) => !p.minor).map((p) => p.b);
    const uses = (sid) => [...major(st(sid).agents), ...major(st(sid).inputs)];
    const feeds = (a, b) => major(st(a).outputs).some((x) => uses(b).includes(x));
    const kindOf = (b) => (db.senses[b.split('|')[0]] || {}).kind;
    return { db, ix, ids, st, rule, major, uses, feeds, kindOf, act: (sid) => rule(sid).action, eff: (sid) => rule(sid).effect.type };
  }
  const chains = (c, pick, link) => {
    const sel = c.ids.filter(pick), out = [];
    const nexts = (a) => sel.filter((b) => b !== a && link(a, b));
    // 순환(예: 빈 CD14 가 다시 첫 전달로 돌아감)이 있어도 찾도록 모든 단계에서 출발하고, 다른 사슬에 포함되는 사슬은 버린다
    const walk = (path) => { const n = nexts(path[path.length - 1]).filter((x) => !path.includes(x)); if (!n.length) { if (path.length >= 2) out.push(path); return; } for (const x of n) walk([...path, x]); };
    for (const s0 of sel) walk([s0]);
    const key = (p) => ',' + p.join(',') + ',';
    const set = (p) => [...p].sort().join(',');
    const max = out.filter((p, i) => !out.some((q, j) => j !== i && q.length > p.length && key(q).includes(key(p))));
    return max.filter((p, i) => max.findIndex((q) => set(q) === set(p)) === i); // 같은 순환을 다른 곳에서 시작한 것은 하나로
  };
  const MOTIFS = {
    receptor_signaling: { label: '세포 밖 신호의 막 수용체 인식', detect: (c) => c.ids.filter((sid) => c.st(sid).inputs.some((p) => p.b.endsWith('|extracellular')) && c.st(sid).outputs.some((p) => p.b.endsWith('|plasma_membrane'))).map((sid) => ({ steps: [sid] })) },
    ligand_relay: { label: '리간드 전달 릴레이', detect: (c) => chains(c, (sid) => c.eff(sid) === 'transfer', (a, b) => c.feeds(a, b)).map((steps) => ({ steps })) },
    receptor_clustering: { label: '리간드 유도 수용체 다량체화', detect: (c) => c.ids.filter((sid) => c.eff(sid) === 'associate' && (c.rule(sid).effect.requires || []).length && !c.rule(sid).agent).map((sid) => ({ steps: [sid] })) },
    scaffold_assembly: { label: '활성 수용체가 핵을 이루는 신호 발판 조립', detect: (c) => c.ids.filter((sid) => c.eff(sid) === 'associate' && c.rule(sid).agent).map((sid) => ({ steps: [sid] })) },
    second_messenger: { label: '2차 전령 증폭', detect: (c) => c.ids.filter((a) => c.eff(a) === 'convert' && c.rule(a).agent && c.major(c.st(a).outputs).some((x) => c.kindOf(x) === 'small_molecule' && c.ids.some((b) => b !== a && c.eff(b) !== 'convert' && c.uses(b).includes(x)))).map((sid) => ({ steps: [sid] })) },
    kinase_cascade: { label: '키네이스 연쇄', detect: (c) => chains(c, (sid) => c.act(sid) === '인산화' && c.rule(sid).agent, (a, b) => c.major(c.st(a).outputs).some((x) => c.major(c.st(b).agents).includes(x))).map((steps) => ({ steps })) },
    gtpase_timer: { label: 'GTPase 타이머 (스스로 꺼지는 스위치)', detect: (c) => c.ids.filter((b) => c.act(b) === '가수분해' && c.eff(b) === 'modify').filter((b) => c.ids.some((a) => a !== b && c.feeds(a, b) && c.feeds(b, a))).map((sid) => ({ steps: [sid] })) },
    inhibitor_degradation_release: { label: '억제자 분해에 의한 전사 인자 방출', detect: (c) => c.ids.filter((a) => c.eff(a) === 'degrade' && c.ids.some((b) => c.eff(b) === 'transport' && c.feeds(a, b))).map((sid) => ({ steps: [sid, ...c.ids.filter((b) => c.eff(b) === 'transport' && c.feeds(sid, b))] })) },
    nuclear_translocation_transcription: { label: '핵 이동 후 전사 활성화', detect: (c) => {
      const out = [];
      for (const t of c.ids.filter((sid) => c.eff(sid) === 'transport' && (c.rule(sid).effect.to === 'nucleoplasm'))) {
        const seen = [t]; let frontier = [t];
        for (let k = 0; k < 3 && frontier.length; k++) { frontier = c.ids.filter((b) => !seen.includes(b) && frontier.some((a) => c.feeds(a, b))); seen.push(...frontier); const hit = frontier.find((b) => c.act(b) === '전사'); if (hit) { out.push({ steps: seen.slice(0, seen.indexOf(hit) + 1) }); break; } }
      }
      return out;
    } },
    membrane_to_nucleus: { label: '막–핵 신호 연쇄', detect: (c) => { const tr = trajectory(c); return tr.includes('nucleoplasm') && (tr.includes('extracellular') || tr.includes('plasma_membrane')) && c.ids.some((sid) => c.eff(sid) === 'transport') ? [{ steps: c.ids.slice(), note: tr.join(' → ') }] : []; } },
  };
  // 신호가 지나간 위치의 순서 (단계 순서대로 처음 나타나는 위치)
  function trajectory(c) { const out = []; for (const sid of c.ids) for (const b of [...c.major(c.st(sid).inputs), ...c.major(c.st(sid).agents), ...c.major(c.st(sid).outputs)]) { const l = b.split('|').pop(); if (!out.includes(l)) out.push(l); } return out; }
  function findMotifs(db, pathwayId, ix) {
    ix = ix || index(db);
    const c = motifCtx(db, ix, ix.stepsIn(pathwayId));
    const found = {};
    for (const [k, m] of Object.entries(MOTIFS)) { const hits = m.detect(c); if (hits.length) found[k] = hits; }
    return { trajectory: trajectory(c), found, steps: c.ids };
  }
  function patternText(db, target) {
    db = normalize(db);
    const ix = index(db), tg = targets(ix, target);
    if (tg.error) return tg.error;
    const concepts = [...ix.senses].filter(([, d]) => d.motif);
    const conceptOf = (k) => concepts.filter(([, d]) => d.motif === k).map(([id]) => `${id} ${ix.label(id)}`);
    const out = [];
    for (const id of tg.ids) {
      const d = ix.senses.get(id);
      if (d.motif) {
        out.push(`[${id} ${ix.label(id)}] 상위 개념 — 패턴 '${d.motif}' (${(MOTIFS[d.motif] || {}).label || '?'})`, '  이 패턴이 나타나는 경로:');
        for (const [pid, pd] of ix.senses) if (pd.kind === 'pathway') { const f = findMotifs(db, pid, ix).found[d.motif]; if (f) out.push(`    ${pid} ${ix.label(pid)} — ${f.length}곳: ${f.map((h) => h.steps.join('→')).join(' | ')}`); }
        for (const a of d.addresses || []) out.push(`  해결하려는 한계 ${a.limitation}: ${a.how}`);
        continue;
      }
      const r = findMotifs(db, id, ix);
      if (!r.steps.length) { out.push(`${id} ${ix.label(id)}: 단계가 없음`); continue; }
      out.push(`[${id} ${ix.label(id)}] 단계 ${r.steps.length}개`, `  위치 궤적: ${r.trajectory.map((l) => vlabel('locations', l)).join(' → ')}`, '  찾은 패턴:');
      for (const [k, hits] of Object.entries(r.found)) out.push(`    · ${MOTIFS[k].label} (${k}) ×${hits.length} — ${hits.map((h) => h.steps.map((s) => `${s} ${ix.label(s)}`).join(' → ')).join(' | ')}` + (conceptOf(k).length ? `\n        상위 개념: ${conceptOf(k).join(', ')}` : '\n        상위 개념 없음 — 반복되면 kind process + motif 로 정의항을 만들 것'));
    }
    return out.join('\n');
  }

  // ===== 한계 등록부 출력 =====
  function limitationRows(db, ix) {
    return Object.entries(db.limitations).map(([id, l]) => {
      const t = parseTarget(l.target), st = limitationStatus(db, l);
      const tl = t ? `${l.target} (${ix.label(t.base)}${t.sub ? ' · ' + t.key : ''})` : l.target;
      const needs = l.requirement.needs.map((n, i) => `${st.met[i] ? '✓' : '✗'} ` + (n.kind === 'obs' ? `관찰 ${n.property} @ ${n.on} ${ix.label(n.on)}${n.cell ? ' · ' + vlabel('cells', n.cell) : ''}${n.location ? ' · ' + vlabel('locations', n.location) : ''}`
        : n.kind === 'residue' ? `잔기 번호 @ ${n.site}` : n.kind === 'xref' ? `${n.db} ID @ ${n.on} ${ix.label(n.on)}` : n.kind === 'kinetics' ? `속도 상수 ${(n.params || []).join('·')} @ ${n.rule}` : `수동: ${n.text}`));
      return { id, l, st, tl, needs, by: ix.addressedBy(id) };
    });
  }
  function limitationsText(db, opt) {
    db = normalize(db);
    const ix = index(db), rows = limitationRows(db, ix).filter((r) => !(opt && opt.open) || r.st.status === 'open');
    const out = [];
    for (const type of Object.keys(V.gapTypes)) {
      const rs = rows.filter((r) => r.l.type === type);
      if (!rs.length) continue;
      out.push(`## ${type} — ${V.gapTypes[type].label} (${rs.filter((r) => r.st.status === 'open').length} 열림 / ${rs.length})`);
      for (const r of rs) out.push(`[${r.id} | ${r.tl} | ${type}] ${r.st.status} ${r.st.done}/${r.st.total}`, `  요구: ${r.l.requirement.text}`, ...r.needs.map((x) => '    ' + x), ...(r.by.length ? [`  다루는 개념: ${r.by.map((d) => `${d} ${ix.label(d)}`).join(', ')}`] : []));
    }
    return out.join('\n') || '등록된 한계 없음';
  }
  function limitationsMarkdown(db) {
    db = normalize(db);
    const ix = index(db), rows = limitationRows(db, ix), cell = (x) => String(x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const out = ['# 한계 등록부 (Limitation & Constraint Registry)', '',
      '> 이 파일은 `data/db.json` 의 `limitations` 에서 생성된다 — 직접 고치지 말고 패치(`limitations: [...]`)로 등록한 뒤 `node dbtool.mjs limitations --write`.',
      '> 새 개념(정의항)을 설계하기 전에 반드시 이 파일을 읽고, 그 개념이 어떤 한계를 어떻게 해결하는지 정의항의 `addresses` 에 적는다.',
      '> 상태는 계산된다: 해결 경로(needs)의 데이터가 모두 들어오면 resolved. ✓ = 이미 채워진 데이터, ✗ = 아직 없는 데이터.', '',
      '| 종류 | 열림 | 해결 | 합계 |', '|---|---|---|---|'];
    for (const type of Object.keys(V.gapTypes)) { const rs = rows.filter((r) => r.l.type === type); out.push(`| ${type} | ${rs.filter((r) => r.st.status === 'open').length} | ${rs.filter((r) => r.st.status !== 'open').length} | ${rs.length} |`); }
    for (const type of Object.keys(V.gapTypes)) {
      const rs = rows.filter((r) => r.l.type === type);
      if (!rs.length) continue;
      out.push('', `## ${type} — ${V.gapTypes[type].label}`, '', V.gapTypes[type].note || '', '', '| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |', '|---|---|---|---|---|---|---|');
      for (const r of rs) out.push(`| ${r.id} | ${cell(r.tl)} | ${type} | ${cell(r.l.requirement.text)}${r.l.found_in ? `<br>발견: ${cell(r.l.found_in)}` : ''} | ${r.needs.map(cell).join('<br>')} | ${r.st.status} (${r.st.done}/${r.st.total}) | ${r.by.map((d) => `${d} ${cell(ix.label(d))}`).join('<br>') || '—'} |`);
    }
    return out.join('\n') + '\n';
  }
  // 등록되지 않은 한계 후보 — 잔기 모름 부위 중 어떤 한계도 가리키지 않는 것
  function detectGaps(db) {
    db = normalize(db);
    const ix = index(db), covered = new Set();
    for (const l of Object.values(db.limitations)) { covered.add(l.target); for (const n of l.requirement.needs) { if (n.site) covered.add(n.site); if (n.rule) covered.add(n.rule); if (n.kind === 'obs' && n.on) covered.add(`${n.on}#${n.property}`); } }
    const out = [];
    for (const [id, d] of ix.senses) for (const [k, st] of Object.entries(d.site)) if (st.residue_unknown && !covered.has(`${id}/site/${k}`)) out.push({ target: `${id}/site/${k}`, type: 'Structural_Gap', why: `${ix.label(id)} 의 부위 ${k} 잔기 번호 모름` });
    // 정체성: unmapped(필수 외부 ID 를 확인 못 함) 정의항 중 그 ID 를 요구하는 한계(xref need 또는 Identity_Gap 대상)가 없는 것
    const idCovered = new Set();
    for (const l of Object.values(db.limitations)) { if (l.type === 'Identity_Gap') idCovered.add(l.target); for (const n of l.requirement.needs) if (n.kind === 'xref' && n.on) idCovered.add(n.on); }
    for (const [id, d] of ix.senses) if (d.unmapped && !idCovered.has(id)) out.push({ target: id, type: 'Identity_Gap', why: `${ix.label(id)}: ${d.unmapped}` });
    // 생애 주기·저장소: 속도 상수가 없는 공급·분해 규칙, 서열 길이를 모르는 재활용 화학량
    for (const [id, d] of ix.senses) for (const r of d.rule) {
      const ref = `${id}/rule/${r.id}`;
      if (r.type === 'modulation' && !r.kinetics && !covered.has(ref)) out.push({ target: ref, type: 'Regulatory_Gap', why: `${ix.label(id)} 의 조절 규칙 '${r.label}' 에 힐 상수(K·n·fmax|fmin)가 없어 시뮬레이터가 배율 1 로 둠` });
      if ((r.type === 'supply' || r.type === 'degradation') && !r.kinetics && !covered.has(ref)) out.push({ target: ref, type: 'Kinetic_Gap', why: `${ix.label(id)} 의 ${r.type === 'supply' ? '공급' : '분해'} 규칙 '${r.label}' 에 속도 상수가 없어 시뮬레이터가 적용하지 않음` });
      if (r.type === 'degradation' && r.recycle_to.some((q) => q.n === 'sequence_length') && !d.obs.some((o) => o.property === 'sequence_length') && !covered.has(`${id}#sequence_length`)) out.push({ target: id, type: 'Structural_Gap', why: `${ix.label(id)} 의 서열 길이(sequence_length)를 몰라 재활용 화학량을 정할 수 없음` });
    }
    return out;
  }

  // ===== 시뮬레이션: 단계를 규칙대로 실제로 발화시켜 묶음 풀(pool)이 어떻게 바뀌는지 본다 =====
  // 시작 풀 = 경로 안에서 어떤 단계도 만들지 않는 묶음(원천 묶음). 보조 기질(부산물·with)은 넉넉히(bulk), 나머지는 amount 개.
  // 한 라운드에 단계 순서대로 각 단계를 최대 한 번 발화: 행위자 ≥1, 입력이 n 개 이상 있으면 입력을 소비하고 출력을 만든다.
  function simulate(db, target, opt) {
    db = normalize(db);
    opt = Object.assign({ amount: 10, bulk: 1000, rounds: 60, init: {}, maxFire: 1e12 }, opt || {});
    const ix = index(db), tg = targets(ix, target);
    if (tg.error) return { error: tg.error };
    const ids = uniq(tg.ids.flatMap((d) => ix.stepsIn(d)));
    if (!ids.length) return { error: `'${target}' 에 속한 단계가 없음` };
    const made = new Set(ids.flatMap((sid) => db.steps[sid].outputs.map((p) => p.b)));
    const pool = new Map(), origin = new Map(), producer = new Map(), trace = [];
    const seed = (b, n) => { origin.set(b, n); pool.set(b, n); };
    // 구획 농도 모델: 시작량을 데이터에서 — 분자 수(copy_number) 또는 농도 × 구획 부피(compartment_volume)
    const cell = opt.cell || (tg.ids.map((d) => (db.senses[d].desc[0] || { context: {} }).context.cell).find(Boolean));
    const source = {};
    const fromData = (b) => {
      const [base, ...rest] = b.split('|'), loc = rest[rest.length - 1], d = db.senses[base];
      if (!d) return null;
      const okCtx = (o) => (!o.context.cell || !cell || o.context.cell === cell) && (!o.context.location || o.context.location === loc);
      const cn = d.obs.find((o) => o.property === 'copy_number' && okCtx(o));
      if (cn) return { n: Math.round(cn.value), how: `copy_number ${cn.value} (${d.obs.indexOf(cn) + 1}번 관찰)` };
      const cc = d.obs.find((o) => o.property === 'concentration' && okCtx(o));
      if (!cc) return null;
      const vol = Object.values(db.senses).flatMap((x) => x.obs).find((o) => o.property === 'compartment_volume' && o.context.location === loc && (!cell || !o.context.cell || o.context.cell === cell));
      if (!vol) return null;
      const M = { pM: 1e-12, nM: 1e-9, 'µM': 1e-6, uM: 1e-6, mM: 1e-3, M: 1 }[cc.unit], L = { fL: 1e-15, pL: 1e-12, nL: 1e-9 }[vol.unit];
      if (!M || !L) return null;
      return { n: Math.round(cc.value * M * vol.value * L * 6.02214076e23), how: `concentration ${cc.value} ${cc.unit} × volume ${vol.value} ${vol.unit}` };
    };
    const amountFor = (b) => {
      if (opt.init[b] != null) { source[b] = 'init'; return opt.init[b]; }
      const x = fromData(b);
      if (x) { source[b] = 'data: ' + x.how; return x.n; }
      source[b] = 'default'; return opt.amount;
    };
    // 어느 단계에서든 부산물(minor)이거나 보조 기질(with)인 묶음은 대사물 풀로 보고 넉넉히 둔다 (ATP 등)
    const bulkSet = new Set();
    for (const sid of ids) {
      const st = db.steps[sid], rule = ix.ruleOf(st.rule) || {}, cos = new Set(rule.with ? [...rule.with.consumes, ...rule.with.produces] : []);
      for (const p of [...st.agents, ...st.inputs, ...st.outputs]) if (p.minor || cos.has(p.b.split('|')[0])) bulkSet.add(p.b);
      // 변환 규칙의 기질 중 어떤 단계도 만들지 않는 것(뉴클레오타이드·ATP 등 대사물 풀)도 넉넉히 — 만들어지는 것(cAMP 등)은 제외
      const cons = new Set(rule.effect && rule.effect.type === 'convert' ? rule.effect.consumes || [] : []);
      for (const p of st.inputs) if (cons.has(p.b.split('|')[0]) && !made.has(p.b)) bulkSet.add(p.b);
    }
    for (const sid of ids) {
      const st = db.steps[sid];
      for (const p of [...st.agents, ...st.inputs]) {
        if (origin.has(p.b)) continue;
        const bulk = bulkSet.has(p.b);
        if (bulk) {
          // 대사물 저장소: 시작량은 지정값 → 데이터(copy_number·농도×부피) → 기본값(bulk, 농도 공백)
          const x = opt.init[p.b] == null ? fromData(p.b) : null;
          seed(p.b, opt.init[p.b] != null ? opt.init[p.b] : x ? x.n : opt.bulk);
          source[p.b] = opt.init[p.b] != null ? 'init' : x ? 'data: ' + x.how : 'bulk';
        }
        else if (!made.has(p.b)) seed(p.b, amountFor(p.b));
      }
    }
    // 순환 안에서만 만들어지는 휴지 상태(예: Gs[GDP] 는 자체 비활성화 단계의 출력)는 순환을 시작할 수 없다.
    // 묶음 의존 그래프(입력·행위자 → 출력)의 순환마다, 막힌 단계가 필요로 하는 묶음 중 특징이 가장 적은 것 하나만 보충한다.
    const succ = new Map();
    for (const sid of ids) { const st = db.steps[sid]; for (const p of [...st.agents, ...st.inputs]) for (const o of st.outputs) { if (!succ.has(p.b)) succ.set(p.b, new Set()); succ.get(p.b).add(o.b); } }
    const comp = new Map(), compRank = new Map(); { let idx = 0, done = 0; const ind = new Map(), low = new Map(), stk = [], on = new Set();
      const dfs = (v) => { ind.set(v, idx); low.set(v, idx); idx++; stk.push(v); on.add(v);
        for (const w of succ.get(v) || []) { if (!ind.has(w)) { dfs(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), ind.get(w))); }
        if (low.get(v) === ind.get(v)) { const c = []; let w; do { w = stk.pop(); on.delete(w); c.push(w); } while (w !== v); const cyc = c.length > 1 || (succ.get(v) || new Set()).has(v); for (const x of c) comp.set(x, cyc ? v : null); compRank.set(v, done++); } };
      for (const v of succ.keys()) if (!ind.has(v)) dfs(v); }
    const cycleSeeds = [];
    for (;;) {
      const avail = new Set(origin.keys()), live = new Set();
      for (let grew = true; grew;) {
        grew = false;
        for (const sid of ids) if (!live.has(sid)) {
          const st = db.steps[sid];
          if ([...st.agents, ...st.inputs].every((p) => avail.has(p.b))) { live.add(sid); grew = true; for (const p of st.outputs) avail.add(p.b); }
        }
      }
      const missing = uniq(ids.filter((sid) => !live.has(sid)).flatMap((sid) => [...db.steps[sid].agents, ...db.steps[sid].inputs].map((p) => p.b)).filter((b) => !avail.has(b) && comp.get(b)));
      if (!missing.length) break;
      // 가장 상류의 순환 하나만 (Tarjan 은 하류부터 끝내므로 완료 순번이 클수록 상류) — 보충 뒤 다시 계산
      const top = Math.max(...missing.map((b) => compRank.get(comp.get(b))));
      const pick = missing.filter((b) => compRank.get(comp.get(b)) === top).sort((a, b) => parseBundle(a).features.length - parseBundle(b).features.length)[0];
      seed(pick, amountFor(pick)); cycleSeeds.push(pick);
    }
    for (const [k, n] of Object.entries(opt.init)) if (!origin.has(k)) { origin.set(k, n); pool.set(k, n); }
    const has = (b) => pool.get(b) || 0, reachedBy = () => opt.until ? [...pool].find(([k, n]) => n > 0 && k.split('|')[0] === opt.until) : null;
    let round = 0, reached = null;
    while (round < opt.rounds && !(reached = reachedBy())) {
      round++;
      let fired = false;
      for (const sid of ids) {
        const st = db.steps[sid];
        const need = new Map();
        for (const p of st.inputs) need.set(p.b, (need.get(p.b) || 0) + (p.n || 1));
        // 한 라운드에 행위자(촉매) 수만큼, 입력이 허락하는 만큼 발화
        let k = st.agents.length ? Math.min(...st.agents.map((p) => has(p.b))) : opt.maxFire;
        for (const [b, n] of need) k = Math.min(k, Math.floor(has(b) / n));
        k = Math.min(k, opt.maxFire);
        if (!(k >= 1)) continue;
        for (const [b, n] of need) pool.set(b, has(b) - n * k);
        for (const p of st.outputs) { pool.set(p.b, has(p.b) + (p.n || 1) * k); if (!producer.has(p.b)) producer.set(p.b, sid); }
        trace.push({ round, step: sid, times: k });
        fired = true;
        if ((reached = reachedBy())) break;
      }
      if (!fired) break;
    }
    // 유도 경로: 목표 묶음을 처음 만든 단계에서 거꾸로, 그 단계가 쓴 묶음을 만든 단계를 따라간다
    let derivation = null;
    if (reached) {
      const steps = new Set(), roots = new Set(), seen = new Set(), stack = [reached[0]];
      while (stack.length) {
        const b = stack.pop();
        if (seen.has(b)) continue;
        seen.add(b);
        const sid = producer.get(b);
        if (!sid) { roots.add(b); continue; }
        steps.add(sid);
        const st = db.steps[sid];
        for (const p of [...st.agents, ...st.inputs]) if (!p.minor) stack.push(p.b);
      }
      derivation = { target: reached[0], steps: ix.order([...steps]), roots: [...roots] };
    }
    return { ids, scope: tg.ids, cell, source, bulkSet: [...bulkSet], origin: Object.fromEntries(origin), cycleSeeds, pool: Object.fromEntries(pool), trace, rounds: round, reached: reached ? reached[0] : null, derivation, ix };
  }
  function simulateText(db, target, opt) {
    const r = simulate(db, target, opt);
    if (r.error) return r.error;
    const ix = r.ix, out = [`시뮬레이션: ${target} — 단계 ${r.ids.length}개, ${r.rounds} 라운드, 발화 ${r.trace.length}회`];
    out.push(`시작 풀(원천 묶음)${r.cell ? ' — 세포 ' + vlabel('cells', r.cell) : ''}:`, ...Object.entries(r.origin).filter(([k]) => r.source[k] !== 'bulk').map(([k, n]) => `  ${n}× ${ix.bundleLabel(k)}  [${r.source[k] === 'default' ? '기본값 — 농도 공백' : r.source[k]}]`));
    const defaulted = Object.keys(r.origin).filter((k) => r.source[k] === 'default'), bulk = Object.keys(r.origin).filter((k) => r.source[k] === 'bulk');
    const inScope = new Set([...r.scope, ...r.ids, ...r.ids.flatMap((sid) => { const st = r.ix.db.steps[sid]; return [st.rule.split('/')[0], ...[...st.agents, ...st.inputs, ...st.outputs].map((p) => p.b.split('|')[0])]; })]);
    const gaps = Object.entries(r.ix.db.limitations).filter(([, l]) => l.type === 'Concentration_Gap' && limitationStatus(r.ix.db, l).status === 'open' && inScope.has((parseTarget(l.target) || {}).base)).map(([id]) => id);
    if (defaulted.length || bulk.length) out.push(`  ⚠ 농도 공백: 시작량 ${defaulted.length}개가 기본값, ${bulk.length}개가 무한 풀 — 결과는 질적(도달 여부)으로만 읽을 것${gaps.length ? ` (등록된 한계: ${gaps.join(', ')})` : ' — 한계 등록부에 Concentration_Gap 으로 등록할 것'}`);
    if (r.cycleSeeds.length) out.push('  (순환의 휴지 상태라 자동 보충: ' + r.cycleSeeds.map((b) => ix.bundleLabel(b)).join(', ') + ')');
    out.push('발화 순서:');
    let last = 0;
    for (const t of r.trace) { if (t.round !== last) { out.push(`  [라운드 ${t.round}]`); last = t.round; } out.push(`    ${t.times > 1 ? '×' + t.times + ' ' : ''}` + stepLine(ix, t.step)); }
    if (opt && opt.until) {
      if (!r.reached) out.push(`✗ 목표 '${ix.label(opt.until)}' 에 도달하지 못함`);
      else {
        const d = r.derivation;
        out.push(`✓ 목표 도달: ${ix.bundleLabel(d.target)} (라운드 ${r.rounds})`, `유도 경로 (${d.steps.length}단계):`, ...d.steps.map((sid, i) => `  ${i + 1}. ${stepLine(ix, sid)}`));
        out.push('유도의 뿌리(원천 묶음):', ...d.roots.map((b) => `  ${ix.bundleLabel(b)}`));
        if (opt.from) out.push(d.roots.some((b) => b.split('|')[0] === opt.from) ? `✓ 출력이 입력 '${ix.label(opt.from)}' 에서 유도됨` : `✗ 출력의 유도 경로에 '${ix.label(opt.from)}' 이(가) 없음`);
      }
    }
    out.push('끝 풀(0 이 아닌 묶음, 보조 기질 제외):', ...Object.entries(r.pool).filter(([k, n]) => n > 0 && n < 900).map(([k, n]) => `  ${n}× ${ix.bundleLabel(k)}`));
    return out.join('\n');
  }

  // ===== 열역학 일관성 (형식 v8) =====
  // 전이 상태 이론: k(r) = k0·exp(−(ΔG‡ + ΔG_env(r))/RT). 미시적 가역성: k_f/k_r = exp(−ΔG°/RT) — 환경이 장벽을 옮겨도 이 비는 유지.
  const RT = () => V.thermo.R * V.thermo.T_ref;
  function envShift(env, local) {
    if (!env || !local) return 0;
    let g = 0;
    if (env.dG_dpH != null && local.pH != null) g += env.dG_dpH * (local.pH - (env.pH_ref != null ? env.pH_ref : 7));
    if (env.dG_dinv_eps != null && local.eps != null && local.eps > 0) g += env.dG_dinv_eps * (1 / local.eps - 1 / (env.eps_ref || 80));
    return g;
  }
  // 국소 환경에서의 정·역 속도 상수 쌍 — 역 상수는 언제나 k_f·exp(ΔG°/RT) 로 계산되어 상세 균형을 깨지 않는다
  function rateAt(kin, local) {
    const g = envShift(kin.env, local);
    const kf = kin.k0 > 0 && Number.isFinite(kin.dG_act) ? kin.k0 * Math.exp(-(kin.dG_act + g) / RT()) : (kin.k || 0) * Math.exp(-g / RT());
    const kr = Number.isFinite(kin.dG0) ? kf * Math.exp(kin.dG0 / RT()) : kin.k_r != null ? kin.k_r * Math.exp(-g / RT()) : 0;
    return { kf, kr, dG_env: g };
  }
  function thermoIssues(k) {
    const out = [], close = (a, b) => a > 0 && b > 0 && Math.abs(Math.log(a / b)) <= Math.log(1.1);
    if (k.dG_act != null && !(Number.isFinite(k.dG_act) && k.dG_act >= 0)) out.push('dG_act(활성화 자유 에너지, J/mol)는 0 이상');
    if (k.dG0 != null && !Number.isFinite(k.dG0)) out.push('dG0(표준 반응 자유 에너지, J/mol)가 수가 아님');
    if ((k.k0 != null) !== (k.dG_act != null)) out.push('전이 상태 이론은 k0 와 dG_act 를 함께 적어야 함');
    if (k.k0 > 0 && k.dG_act >= 0 && k.k > 0 && !close(k.k, k.k0 * Math.exp(-k.dG_act / RT()))) out.push(`k ${k.k} 와 k0·exp(−dG_act/RT) = ${(k.k0 * Math.exp(-k.dG_act / RT())).toExponential(3)} 가 10% 안에서 맞지 않음 (T_ref ${V.thermo.T_ref} K)`);
    if (k.env && k.dG_act == null && k.k == null) out.push('env(환경 보정)는 기준 속도(k 또는 k0·dG_act)가 있을 때만');
    if (k.env) for (const f of Object.keys(k.env)) if (!Number.isFinite(k.env[f])) out.push(`env.${f} 가 수가 아님`);
    if (k.env && k.env.eps_ref != null && !(k.env.eps_ref > 0)) out.push('env.eps_ref 는 양수');
    if (Number.isFinite(k.dG0) && k.reversible && k.k > 0 && k.k_r > 0 && !close(k.k / k.k_r, Math.exp(-k.dG0 / RT()))) out.push(`미시적 가역성 위반: k/k_r = ${(k.k / k.k_r).toExponential(3)} 인데 exp(−dG0/RT) = ${Math.exp(-k.dG0 / RT()).toExponential(3)} (10% 밖)`);
    return out;
  }
  // 닫힌 고리의 ΣΔG° = 0 (Wegscheider): 경로의 단계 순환 중 순 화학량이 0 인 고리에서 모든 단계가 dG0 를 가지면 합이 0 이어야 함
  function thermoLoops(db, target) {
    db = normalize(db);
    const ix = index(db), tg = targets(ix, target);
    if (tg.error) return { error: tg.error };
    const ids = uniq(tg.ids.flatMap((d) => ix.stepsIn(d)));
    const G = new Map();
    for (const a of ids) for (const b of ids) if (a !== b && db.steps[a].outputs.some((p) => !p.minor && db.steps[b].inputs.some((q) => !q.minor && q.b === p.b))) { if (!G.has(a)) G.set(a, new Set()); G.get(a).add(b); }
    const out = [];
    for (const c of sccs(G).filter((x) => x.length > 1)) {
      const net = {};
      for (const sid of c) { for (const p of db.steps[sid].inputs) net[p.b] = (net[p.b] || 0) - (p.n || 1); for (const p of db.steps[sid].outputs) net[p.b] = (net[p.b] || 0) + (p.n || 1); }
      const closed = Object.values(net).every((v) => v === 0);
      const dG = c.map((sid) => (ix.ruleOf(db.steps[sid].rule).kinetics || {}).dG0);
      const known = dG.every(Number.isFinite), sum = known ? dG.reduce((a, b) => a + b, 0) : null;
      out.push({ steps: c, closed, known, sum, ok: !closed || !known || Math.abs(sum) <= V.thermo.loop_tolerance, net: Object.fromEntries(Object.entries(net).filter(([, v]) => v)) });
    }
    return { loops: out, ix };
  }

  // ===== 반응 속도 무결성 (Kinetic Integrity) =====
  // r: 규칙, st: 단계(있으면 화학량까지 검사). 문제 목록(문자열)을 돌려준다.
  function kineticIssues(r, st, kin) {
    const k = kin || r.kinetics, out = [], L = V.kineticLaws[k.law];
    if (!L) return [`반응 속도 법칙 '${k.law}' — ${Object.keys(V.kineticLaws).join(' | ')}`];
    if (r.type === 'degradation') {
      // 분해는 1차: k = k_deg (s⁻¹) 또는 half_life (s). 둘 다 있으면 k = ln2 / half_life 가 10% 안에서 맞아야 함
      if (k.law !== 'mass_action') out.push(`분해 규칙의 속도 법칙은 mass_action (1차, k = k_deg) — 지금 ${k.law}`);
      if (k.order != null && k.order !== 1) out.push(`분해 규칙은 1차 (order 1) — 지금 ${k.order}`);
      if (!(k.k > 0) && !(k.half_life > 0)) out.push('분해 규칙은 k(k_deg, s⁻¹) 또는 half_life(s) 가 필요함');
      if (k.k > 0 && k.half_life > 0) { const ratio = k.k * k.half_life / Math.LN2; if (ratio < 0.9 || ratio > 1.1) out.push(`k_deg ${k.k} s⁻¹ 와 반감기 ${k.half_life} s 가 맞지 않음 (ln2/t½ = ${(Math.LN2 / k.half_life).toExponential(3)})`); }
      for (const f of KIN_FIELDS) if (k[f] != null && !SIGNED_KIN.has(f) && !(Number.isFinite(k[f]) && k[f] > 0)) out.push(`${f} 값이 양수가 아님`);
      out.push(...thermoIssues(k));
      return out;
    }
    if (k.law === 'hill' || r.type === 'modulation') {
      // 조절 배율: K (M) > 0, n > 0, 활성화 fmax > 1 · 억제 0 ≤ fmin < 1 (validateModulation 이 효과와 대조)
      if (k.law !== 'hill') return [`조절 규칙의 속도 법칙은 hill — 지금 ${k.law}`];
      for (const f of ['K', 'n']) if (!(Number.isFinite(k[f]) && k[f] > 0)) out.push(`hill 은 ${f} 가 필요함 (양수${f === 'K' ? ', M' : ''})`);
      if (k.fmax != null && !(k.fmax > 1)) out.push('fmax 는 1 보다 커야 함');
      if (k.fmin != null && !(k.fmin >= 0 && k.fmin < 1)) out.push('fmin 은 0 ≤ fmin < 1');
      for (const f of ['k', 'order', 'k_on', 'k_off', 'Kd', 'kcat', 'Km', 'half_life']) if (k[f] != null) out.push(`hill 배율에는 ${f} 를 두지 않음`);
      return out;
    }
    if (k.law === 'zero_order' && r.type !== 'supply') out.push('zero_order 는 공급 규칙(supply)에만');
    for (const f of L.required) if (!(f.split('|').some((g) => k[g] > 0))) out.push(`${k.law} 는 ${f.split('|').join(' 또는 ')} 가 필요함 (양수, SI 정준 단위)`);
    for (const f of KIN_FIELDS) if (k[f] != null && !SIGNED_KIN.has(f) && !(Number.isFinite(k[f]) && (f === 'order' ? k[f] >= 0 : k[f] > 0))) out.push(`${f} 값이 양수가 아님`);
    out.push(...thermoIssues(k));
    if (k.law === 'binding' && k.Kd > 0 && k.k_on > 0 && k.k_off > 0) {
      const ratio = k.k_off / k.k_on / k.Kd;
      if (ratio < 0.9 || ratio > 1.1) out.push(`Kd 와 k_off/k_on 이 맞지 않음 (Kd ${k.Kd} M, k_off/k_on ${(k.k_off / k.k_on).toExponential(3)} M)`);
    }
    if (k.law === 'michaelis_menten' && !r.agent) out.push('michaelis_menten 은 행위자(효소)가 있는 규칙에만');
    if (k.law === 'binding' && !['modify', 'associate', 'dissociate', 'transfer'].includes((r.effect || {}).type)) out.push('binding 법칙은 결합·해리·전달 효과에만');
    if (k.law === 'binding' && (r.effect || {}).type === 'modify' && !r.effect.partner) out.push('binding 법칙의 modify 효과에는 결합 상대(partner)가 필요');
    if (st && k.law === 'binding') {
      const n = st.inputs.filter((p) => !p.minor).reduce((t, p) => t + (p.n || 1), 0);
      if (n !== 2) out.push(`binding 법칙은 두 분자 결합(k_on 단위 M⁻¹s⁻¹) — 이 단계의 반응물은 ${n}분자. 협동 결합은 mass_action 에 차수를 적을 것`);
    }
    if (st && k.law === 'mass_action' && k.order != null) {
      const n = st.inputs.filter((p) => !p.minor).reduce((t, p) => t + (p.n || 1), 0) + st.agents.length;
      if (n !== k.order) out.push(`질량 작용 차수 ${k.order} 가 단계의 반응물 수(${n}, 행위자 포함)와 다름`);
    }
    return out;
  }

  // ===== 혼합 해상도 (Hybrid-Resolution) =====
  // R0 위상 해상도: 위치·상태만 (풀 안의 분자, 수송, 변환)
  // R1 부위 해상도: 이름 붙은 부위·특징·잔기 번호 (결합·수식·전달 같은 부위 사건)
  // R2 구조 해상도: 반응 중심 부위의 3차원 구조 참조 (경쟁·특이성을 속도 상수로 못 가를 때만)
  // 전환 문턱(V.resolutionThresholds): 단계마다 필요한 해상도를 계산하고, 갖춘 해상도와 비교한다.
  function siteRefsOf(db, ix, sid) {
    const st = db.steps[sid], rule = ix.ruleOf(st.rule), owner = ix.ruleOwner(st.rule), e = rule.effect || {}, out = [];
    const add = (base, key) => { if (base && key && db.senses[base] && db.senses[base].site[key]) out.push(`${base}/site/${key}`); };
    if (e.site) add(e.target || (e.type === 'transfer' ? e.target : owner), e.site);
    if (e.from_site) add(owner, e.from_site);
    if (e.partner_site) for (const k of e.partner_site.sites) add(e.partner_site.component, k);
    if (rule.via_site) add(owner, rule.via_site);
    for (const q of e.requires || []) add(q.ref || e.target || e.complex || owner, q.site);
    return uniq(out);
  }
  function resolutionPlan(db, target) {
    db = normalize(db);
    const ix = index(db), tg = targets(ix, target);
    if (tg.error) return { error: tg.error };
    const ids = uniq(tg.ids.flatMap((d) => ix.stepsIn(d)));
    const sim = ids.length ? simulate(db, target, { rounds: 0 }) : { source: {} };
    const bulk = new Set(Object.keys(sim.source || {}).filter((k) => sim.source[k] === 'bulk'));
    // T3 경쟁: 같은 묶음을 두 단계 이상이 소비 (넉넉한 대사물 풀은 제외)
    const consumers = new Map();
    for (const sid of ids) for (const p of db.steps[sid].inputs) if (!p.minor && !bulk.has(p.b)) { if (!consumers.has(p.b)) consumers.set(p.b, []); consumers.get(p.b).push(sid); }
    const competitions = [...consumers].filter(([, xs]) => uniq(xs).length > 1).map(([b, xs]) => ({ bundle: b, steps: uniq(xs) }));
    const rows = ids.map((sid) => {
      const st = db.steps[sid], rule = ix.ruleOf(st.rule), e = rule.effect || {}, sites = siteRefsOf(db, ix, sid), hits = [];
      let need = 0;
      if (sites.length) { need = 1; hits.push('T1 부위 사건'); }
      if (['associate', 'dissociate', 'degrade'].includes(e.type)) { need = Math.max(need, 1); hits.push('T2 구성 요소 화학량'); }
      const comp = competitions.filter((c) => c.steps.includes(sid));
      const kinOK = !!rule.kinetics;
      if (comp.length) hits.push('T3 경쟁' + (kinOK ? ' (속도 상수로 해결)' : ''));
      if (comp.length && !kinOK) need = 2;
      const siteObjs = sites.map((ref) => { const t = parseTarget(ref); return db.senses[t.base].site[t.key]; });
      const have = sites.length && siteObjs.every((x) => x.structure) ? 2 : (sites.length || ['associate', 'dissociate', 'degrade'].includes(e.type)) ? 1 : 0;
      return { sid, need, have, sites, hits, comp, kinetics: kinOK, ok: have >= need || (need === 2 && kinOK) };
    });
    return { ids, rows, competitions, ix };
  }
  function resolutionText(db, target) {
    const p = resolutionPlan(db, target);
    if (p.error) return p.error;
    const ix = p.ix, lv = (n) => ['R0', 'R1', 'R2'][n], out = [`해상도 계획: ${target} — 단계 ${p.ids.length}개`];
    const cnt = [0, 1, 2].map((n) => p.rows.filter((r) => r.need === n).length);
    out.push(`  필요 해상도: R0(위상) ${cnt[0]} · R1(부위) ${cnt[1]} · R2(구조) ${cnt[2]} — 3차원이 필요한 단계 ${cnt[2]}/${p.ids.length}`);
    for (const r of p.rows) out.push(`  ${r.ok ? '✓' : '✗'} ${r.sid} ${ix.label(r.sid)}: 필요 ${lv(r.need)} / 갖춤 ${lv(r.have)}${r.hits.length ? ' — ' + r.hits.join(', ') : ''}${r.sites.length ? ' · 반응 중심 ' + r.sites.join(', ') : ''}`);
    if (p.competitions.length) out.push('  경쟁(T3):', ...p.competitions.map((c) => `    ${ix.bundleLabel(c.bundle)} ← ${c.steps.map((s) => `${s} ${ix.label(s)}`).join(' / ')}`));
    return out.join('\n');
  }

  // ===== 속도 기반 시뮬레이션 (Rate-based) + 생애 주기·대사물 저장소 (형식 v7) =====
  // 농도 = 분자 수 / (N_A × 반응 부피). 속도 법칙: mass_action · binding(가역) · michaelis_menten · zero_order(공급).
  // 속도 상수가 없는 단계는 '즉시'(사건 기반)로 처리하고 Kinetic_Gap 으로 표시한다.
  // 대사물 저장소(Metabolic Reservoir): 보조 기질·부산물·만들어지지 않는 변환 기질 = 위치마다 하나의 유한한 전역 풀(기본, reservoirs 'finite').
  //   단계가 소비하면 줄고, 공급 규칙(supply)·분해 규칙의 재활용(recycled)이 채운다. 바닥나면 그 단계는 멈춘다(고갈) — 오류가 아니라 결과.
  // 분해 규칙(degradation): 소유 정의항의 묶음이 1차(k_deg)로 분해 — 결정론 N(1−e^{−kΔt}) 또는 확률적(이항, seed 고정).
  // 매 Δt 질량 감사: ① 단계가 일어날 때마다 국소 수지(실체·부분 구조) ② 전역 합계 = 시작 + 원장(분해·재활용·공급·교환).
  // scenario: { name, hypothetical, cell, volumes, amounts, reservoirs: { 'D…|위치': 수 }, kinetics: { 'D…/rule/키': {…} }, reservoir_mode, stochastic, seed }
  const NA = 6.02214076e23, VOL = { fL: 1e-15, pL: 1e-12, nL: 1e-9, 'µL': 1e-6, uL: 1e-6, L: 1 };
  function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function binomial(rand, n, p) {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    if (n <= 60) { let x = 0; for (let i = 0; i < n; i++) if (rand() < p) x++; return x; }
    const m = n * p, sd = Math.sqrt(m * (1 - p)), u = Math.max(rand(), 1e-12), g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    return Math.max(0, Math.min(n, Math.round(m + sd * g)));
  }
  function supplyRules(db) {
    const out = [];
    for (const [id, d] of Object.entries(db.senses)) for (const r of d.rule) if (r.type === 'supply') out.push({ ref: `${id}/rule/${r.id}`, owner: id, rule: r });
    return out;
  }
  // 조절 규칙 색인 (v9): 대상 규칙 참조 → [{ owner, rule, ref }]
  function modulationIndex(db) {
    const m = new Map();
    for (const [id, d] of Object.entries(db.senses)) for (const r of d.rule) if (r.type === 'modulation' && r.target) { if (!m.has(r.target)) m.set(r.target, []); m.get(r.target).push({ owner: id, rule: r, ref: `${id}/rule/${r.id}` }); }
    return m;
  }
  // 힐 배율: 활성화 1 + (fmax − 1)·sⁿ/(Kⁿ + sⁿ), 억제 fmin + (1 − fmin)·Kⁿ/(Kⁿ + sⁿ). s = 조절자 농도 (M)
  const SAT_K = 1e-6; // 포화 보조 기질의 수치 포화 상수 (M) — 생물 상수가 아니라 바닥날 때 속도를 매끄럽게 끄는 정칙화 (시나리오 saturation_K 로 바꿈)
  function hillFactor(effect, k, s) {
    const x = s > 0 ? Math.pow(s / k.K, k.n) : 0, occ = x / (1 + x);
    return effect === 'inhibits' ? (k.fmin || 0) + (1 - (k.fmin || 0)) * (1 - occ) : 1 + ((k.fmax || 1) - 1) * occ;
  }
  function simulateRate(db, target, opt) {
    db = normalize(db);
    opt = Object.assign({ t_end: 60, dt: 1e-3, scenario: null, amount: 10, bulk: 1000 }, opt || {});
    const sc = opt.scenario || {}, ix = index(db), tg = targets(ix, target);
    if (tg.error) return { error: tg.error };
    const mode = opt.reservoirs || sc.reservoir_mode || 'finite';
    if (!V.reservoirModes[mode]) return { error: `저장소 방식 '${mode}' — ${Object.keys(V.reservoirModes).join(' | ')}` };
    const finite = mode === 'finite', stochastic = opt.stochastic != null ? !!opt.stochastic : !!sc.stochastic, rand = rngOf(opt.seed != null ? opt.seed : sc.seed != null ? sc.seed : 1);
    const base = simulate(db, target, { rounds: 0, init: Object.assign({}, sc.reservoirs || {}, sc.amounts || {}), cell: sc.cell, amount: opt.amount, bulk: opt.bulk });
    if (base.error) return base;
    const ids = base.ids, cell = base.cell, audit = [], kineticGaps = [], approx = new Set(), events = [], seen = new Set();
    const AE = (code, where, msg, sug) => audit.push({ code, where, msg, suggestion: sug });
    const once = (key, f) => { if (!seen.has(key)) { seen.add(key); f(); } };
    // 부피: 시나리오 → 구획 농도 모델 관찰 → 없음
    const volOf = (loc) => {
      const v = (sc.volumes || {})[loc];
      if (v && VOL[v.unit]) return { L: v.value * VOL[v.unit], src: 'scenario' };
      const o = Object.values(db.senses).flatMap((x) => x.obs).find((b) => b.property === 'compartment_volume' && b.context.location === loc && (!cell || !b.context.cell || b.context.cell === cell));
      return o && VOL[o.unit] ? { L: o.value * VOL[o.unit], src: 'data' } : null;
    };
    const N = new Map(Object.entries(base.origin)), res = new Set(base.bulkSet), srcOf = Object.assign({}, base.source);
    // Tier 1 환경 장 (v8): 시나리오 environment[위치] → 관찰(pH·relative_permittivity, context.location)
    const envOf = (loc) => { if (!loc) return null; const e = (sc.environment || {})[loc]; if (e) return { pH: e.pH, eps: e.relative_permittivity }; const ob = (p) => { const o = Object.values(db.senses).flatMap((x) => x.obs).find((b) => b.property === p && b.context.location === loc); return o ? o.value : undefined; }; const pH = ob('pH'), eps = ob('relative_permittivity'); return pH == null && eps == null ? null : { pH, eps }; };
    const resAmount = (b) => { const v = (sc.reservoirs || {})[b] != null ? sc.reservoirs[b] : (sc.amounts || {})[b]; if (v != null) { srcOf[b] = 'init'; return v; } srcOf[b] = 'bulk'; return opt.bulk; };
    const addRes = (b) => { if (!N.has(b)) { N.set(b, resAmount(b)); res.add(b); } };
    for (const sid of ids) for (const p of db.steps[sid].outputs) if (!N.has(p.b)) { if (res.has(p.b)) addRes(p.b); else N.set(p.b, 0); }
    for (const b of res) { const v = (sc.reservoirs || {})[b] != null ? sc.reservoirs[b] : (sc.amounts || {})[b]; if (v != null) { N.set(b, v); srcOf[b] = 'init'; } else if (!srcOf[b] || srcOf[b] === 'default') srcOf[b] = 'bulk'; }
    const kinOf = (ref) => (sc.kinetics || {})[ref] ? { ...normKinetics(sc.kinetics[ref]), src: 'scenario' } : ix.ruleOf(ref) && ix.ruleOf(ref).kinetics ? { ...ix.ruleOf(ref).kinetics, src: 'data' } : null;
    const locOf = (b) => b.split('|').pop();
    const featsOf = (b) => new Map(parseBundle(b).features.map((f) => [f.site, f.feature]));
    // --- 조절 규칙 (v9): 대상 규칙 → 조절자 묶음(소유자|at) 농도의 힐 배율. 속도 상수가 없으면 배율 1 (보고)
    const modIndex = modulationIndex(db), modGaps = new Set();
    for (const list of modIndex.values()) for (const m of list) {
      const b = `${m.owner}|${m.rule.at}`, v = (sc.amounts || {})[b] != null ? sc.amounts[b] : (sc.reservoirs || {})[b];
      if (!N.has(b) && v != null) { N.set(b, v); srcOf[b] = 'init'; }
    }
    const modFactor = (ref) => {
      let f = 1;
      for (const m of modIndex.get(ref) || []) {
        const k = kinOf(m.ref); if (!k) { modGaps.add(m.ref); continue; }
        const vol = volOf(m.rule.at), n = N.get(`${m.owner}|${m.rule.at}`) || 0;
        f *= hillFactor(m.rule.effect, k, vol ? Math.max(0, n) / (NA * vol.L) : 0);
      }
      return f;
    };
    // --- 분해 규칙: 범위 안 묶음마다 (부위 조건·위치 조건이 맞는 것)
    const degr = [];
    for (const b of [...N.keys()]) {
      const bd = db.senses[b.split('|')[0]];
      if (!bd) continue;
      const fs = featsOf(b);
      for (const r of bd.rule) {
        if (r.type !== 'degradation' || !Object.entries(r.when).every(([s, f]) => fs.get(s) === f) || (r.where && !r.where.includes(locOf(b)))) continue;
        const ref = `${b.split('|')[0]}/rule/${r.id}`, k = kinOf(ref), kd = k ? (k.k > 0 ? k.k : k.half_life > 0 ? Math.LN2 / k.half_life : 0) : 0;
        const loc3 = V.locations[locOf(b)] && V.locations[locOf(b)].dim === '3D' ? locOf(b) : V.defaultVolumeLocation;
        const rec = [];
        for (const q of r.recycle_to) {
          let n = q.n;
          if (n === 'sequence_length') { const o = bd.obs.find((x) => x.property === 'sequence_length'); n = o ? o.value : null; }
          const rb = `${q.ref}|${q.location || loc3}`;
          if (n == null) { once('seqlen' + ref, () => AE('AUDIT_RESOURCE', ref, `${ix.label(b.split('|')[0])} 재활용 화학량(서열 길이)을 모름 — 이 단위는 소실로 처리함`, gapSuggest(db, ix, b.split('|')[0], 'Structural_Gap', /서열 길이|sequence_length|재활용/))); continue; }
          addRes(rb); rec.push({ b: rb, n });
        }
        if (!k) kineticGaps.push(ref);
        else for (const m of kineticIssues(r, null, k)) AE('AUDIT_KINETIC', ref, m, gapSuggest(db, ix, b.split('|')[0], 'Kinetic_Gap'));
        degr.push({ b, ref, rule: r, k: kd, kin: k, rec });
      }
    }
    // --- 공급 규칙: 시뮬레이션 안의 묶음(저장소 포함)에 닿는 것을 닫힌 집합이 될 때까지 켠다
    const sup = [], supAll = supplyRules(db), keysOf = (s) => [...s.rule.consumes, ...s.rule.produces].map((q) => `${q.ref}|${s.rule.where[0]}`);
    for (let grew = true; grew;) {
      grew = false;
      for (const s of supAll) {
        if (sup.includes(s) || !s.rule.where.length || !keysOf(s).some((b) => N.has(b))) continue;
        if (tg.ids.includes(s.owner)) continue; // 시뮬레이션하는 경로 자신의 순 반응 공급 규칙(다중 규모 층용)은 단계와 이중으로 세지 않음
        sup.push(s); grew = true;
        for (const b of keysOf(s)) addRes(b);
      }
    }
    for (const s of sup) {
      const k = kinOf(s.ref), vol = volOf(s.rule.where[0]);
      s.k = k; s.V = vol ? vol.L : null; s.loc = s.rule.where[0];
      if (!k) kineticGaps.push(s.ref);
      else { for (const m of kineticIssues(s.rule, null, k)) AE('AUDIT_KINETIC', s.ref, m, gapSuggest(db, ix, s.owner, 'Kinetic_Gap')); if (!vol) AE('AUDIT_CONCENTRATION', s.ref, `공급 위치(${vlabel('locations', s.loc)}) 부피를 모름 — 공급을 적용하지 못함`, gapSuggest(db, ix, tg.ids[0], 'Concentration_Gap')); }
    }
    // --- 반응 단계
    const react = new Map();
    for (const sid of ids) {
      const st = db.steps[sid], rule = ix.ruleOf(st.rule), k = kinOf(st.rule);
      const parts = [...st.agents, ...st.inputs, ...st.outputs].filter((p) => !p.minor);
      const loc3 = parts.map((p) => locOf(p.b)).find((l) => V.locations[l] && V.locations[l].dim === '3D');
      if (parts.some((p) => V.locations[locOf(p.b)] && V.locations[locOf(p.b)].dim === '2D')) approx.add(sid);
      const vol = loc3 ? volOf(loc3) : null;
      if (k) { for (const m of kineticIssues(rule, st, k)) AE('AUDIT_KINETIC', `${sid} ${rule.label}`, m, gapSuggest(db, ix, st.rule.split('/')[0], 'Kinetic_Gap')); }
      else kineticGaps.push(sid);
      // Tier 1 (v8): 구획 환경(pH·ε)과 전이 상태 이론·ΔG° 로 국소 k, k_r — 역 상수는 상세 균형으로 정해진다
      if (k && k.law === 'mass_action' && (k.k0 > 0 || Number.isFinite(k.dG0) || k.env)) { const r2 = rateAt(k, envOf(loc3)); k.k = r2.kf; if (Number.isFinite(k.dG0)) { k.k_r = r2.kr; k.reversible = true; } k.dG_env = r2.dG_env; }
      if (k && !vol) AE('AUDIT_CONCENTRATION', `${sid} ${rule.label}`, `반응 부피(${loc3 ? vlabel('locations', loc3) : '3D 위치 없음'})를 모름 — 속도 법칙을 농도로 계산할 수 없어 즉시 처리함`, gapSuggest(db, ix, tg.ids[0], 'Concentration_Gap'));
      // 유한 저장소면 저장소도 입력·출력으로 센다(소비하면 준다). 무한 풀이면 v6 처럼 빼고 교환 원장에 적는다.
      const inc = (p) => finite || !res.has(p.b);
      const ins = new Map(), outs = new Map();
      for (const p of st.inputs) if (inc(p)) ins.set(p.b, (ins.get(p.b) || 0) + (p.n || 1));
      for (const p of st.outputs) if (inc(p)) outs.set(p.b, (outs.get(p.b) || 0) + (p.n || 1));
      const lawIns = new Map([...ins].filter(([b]) => st.inputs.some((p) => p.b === b && !p.minor)));
      const lawOuts = new Map([...outs].filter(([b]) => st.outputs.some((p) => p.b === b && !p.minor)));
      const own = new Map([...ins].filter(([b]) => !res.has(b)));
      react.set(sid, { st, rule, k: k && vol ? k : null, V: vol ? vol.L : null, loc: loc3, ins, outs, lawIns, lawOuts, own });
    }
    const conc = (b, Vr) => Math.max(0, N.get(b) || 0) / (NA * Vr);
    // --- 질량 감사 준비: 묶음 → 기본 실체 벡터, 실체 → 부분 구조
    const vecCache = new Map();
    const vec = (b) => { if (!vecCache.has(b)) { const t = {}; entityTally(db, b.split('|')[0], featsOf(b), 1, t, null); vecCache.set(b, t); } return vecCache.get(b); };
    const moiCache = new Map();
    const moiOfEntity = (e) => { if (!moiCache.has(e)) moiCache.set(e, moietyOf(db, e, 1, {})); return moiCache.get(e); };
    const addVec = (into, b, n) => { for (const [e, c] of Object.entries(vec(b))) into[e] = (into[e] || 0) + c * n; };
    const toMoi = (ent) => { const m = {}; for (const [e, c] of Object.entries(ent)) for (const [x, k] of Object.entries(moiOfEntity(e))) m[x] = (m[x] || 0) + c * k; return m; };
    // 화학 실체: 변환 기질·산물, 분해 구성 요소, 보조 기질, 그리고 수식 부위에서 특징과 함께 바뀌는 리간드(예: Gs 의 GTP → GDP)
    const ligSwitch = (rule, owner) => { const e = rule.effect || {}; if (e.type !== 'modify') return []; const T = db.senses[e.target || owner], site = T && T.site[e.site]; if (!site || !site.ligands) return []; const a = (e.add || []).map((f) => site.ligands[f]), r = (e.remove || []).map((f) => site.ligands[f]); return a.join() === r.join() ? [] : [...a, ...r].filter(Boolean); };
    const chemOf = (rule, owner) => { const e = rule.effect || {}, out = new Set(); for (const x of [...(e.consumes || []), ...(e.produces || []), ...(e.component ? [e.component] : []), ...(rule.with ? [...rule.with.consumes, ...rule.with.produces] : []), ...ligSwitch(rule, owner)]) { const t = {}; entityTally(db, x, new Map(), 1, t, null); for (const y of Object.keys(t)) out.add(y); out.add(x); } return out; };
    const changing = new Set();
    for (const sid of ids) for (const x of chemOf(react.get(sid).rule, ix.ruleOwner(db.steps[sid].rule))) changing.add(x);
    for (const s of sup) for (const q of [...s.rule.consumes, ...s.rule.produces]) { const t = {}; entityTally(db, q.ref, new Map(), 1, t, null); for (const y of Object.keys(t)) changing.add(y); changing.add(q.ref); }
    // 국소 수지(단계 한 번): 실체 Δ (그 규칙의 화학 실체 제외) · 부분 구조 Δ (공유 결합 수식이면 '공유 결합' 경로로 기록)
    for (const sid of ids) {
      const x = react.get(sid), st = x.st, rule = x.rule, e = rule.effect || {}, chem = chemOf(rule, ix.ruleOwner(st.rule));
      const dE = {};
      for (const p of st.outputs) addVec(dE, p.b, p.n || 1);
      for (const p of st.inputs) addVec(dE, p.b, -(p.n || 1));
      x.unitEnt = Object.fromEntries(Object.entries(dE).filter(([en, v]) => Math.abs(v) > 1e-9 && !chem.has(en)));
      x.unitMoi = Object.fromEntries(Object.entries(toMoi(dE)).filter(([, v]) => Math.abs(v) > 1e-9));
      const T = e.type === 'modify' ? db.senses[e.target || ix.ruleOwner(st.rule)] : null, site = T && T.site[e.site];
      x.covalent = e.type === 'modify' && !(site && (site.ligand || site.ligands));
    }
    const ent0 = {}, moi0 = {};
    const totals = () => { const t = {}; for (const [b, n] of N) if (n && (finite || !res.has(b))) addVec(t, b, n); return t; };
    Object.assign(ent0, totals()); Object.assign(moi0, toMoi(ent0));
    // 원장: 묶음별 Δ (반응·공급·분해·재활용), 실체별 생성·소멸(분해·재활용·교환), 부분 구조 경로(공유 결합·계 밖 공급·소실·재활용)
    const ledger = {}, created = {}, destroyed = {}, chan = { covalent: {}, source: {}, lost: {}, recycle: {}, violation: {} };
    const L1 = (b, k, v) => { const l = ledger[b] || (ledger[b] = { reaction: 0, supply: 0, degradation: 0, recycle: 0 }); l[k] += v; };
    const addTo = (o, src, f) => { for (const [k, v] of Object.entries(src)) o[k] = (o[k] || 0) + v * f; };
    const exIn = {}, exOut = {};
    const series = [], firstReach = {}, resStat = {};
    for (const b of res) if (N.has(b)) resStat[b] = { start: N.get(b), min: N.get(b), max: N.get(b), state: (N.get(b) || 0) >= 1 ? 'ok' : 'empty', source: srcOf[b] || 'bulk', consumers: [], producers: [] };
    const record = (t) => series.push({ t, N: Object.fromEntries([...N].filter(([b]) => finite || !res.has(b))) });
    const ev = (e) => { if (events.length < 200) events.push(e); };
    const stalls = {}, stiff = {};
    record(0);
    const steps = Math.ceil(opt.t_end / opt.dt), every = Math.max(1, Math.floor(steps / 200)), TOL = 1e-6;
    let massFirst = null, moiFirst = null;
    // 단계 순환(예: 시트르산 회로): 저장소가 아닌 비가산 묶음으로 한 단계의 출력이 다음 단계의 입력이 되는 고리 — 강하게 연결된 성분
    const SG = new Map();
    for (const a of ids) for (const b of ids) if (a !== b && react.get(a).st.outputs.some((p) => !p.minor && !res.has(p.b) && react.get(b).st.inputs.some((q) => !q.minor && q.b === p.b))) { if (!SG.has(a)) SG.set(a, new Set()); SG.get(a).add(b); }
    const stepCycles = sccs(SG).filter((c) => c.length > 1).map((c) => ids.filter((x) => c.includes(x)));
    const cum = {}; // 단계별 누적 진행량 (정방향 − 역방향)
    const turns = (c) => Math.min(...c.map((sid) => cum[sid] || 0)); // 회로 한 바퀴 = 모든 단계가 한 번씩
    const cycleSteps = new Set(stepCycles.flat()), watch = cycleSteps.size ? cycleSteps : new Set(ids);
    // 소멸(정지) 감지: 창(window) 동안 회로가 1 바퀴도(회로가 없으면 단계 진행량 합이 1 분자도) 돌지 못하면 정지. until_death 면 그때 멈춘다.
    const untilDeath = opt.until_death != null ? !!opt.until_death : !!sc.until_death;
    const winN = Math.max(1, Math.round((opt.window || sc.window || 1) / opt.dt));
    const progress = () => (stepCycles.length ? Math.max(...stepCycles.map(turns)) : [...watch].reduce((a, sid) => a + Math.abs(cum[sid] || 0), 0));
    const hist = [], peak = { rate: 0 }, zeroAt = {}, seenOK = new Set();
    const deathFrac = opt.death_frac != null ? +opt.death_frac : +(sc.death_frac || 0); // 0 이면 '창 동안 1 바퀴 미만'만, >0 이면 '최고 속도의 그 비율 미만'도 정지
    let lastTurn = { n: 0, t: 0 }; // 마지막으로 바퀴(또는 분자) 수가 정수로 늘어난 시각 = 정지 시각의 정밀 값
    let death = null;
    for (let i = 1; i <= steps; i++) {
      const t = +(i * opt.dt).toFixed(9);
      // ① 반응 단계
      for (const sid of ids) {
        const x = react.get(sid), { st, k, V: Vr, ins, outs, lawIns, lawOuts, own } = x;
        if (!st.agents.every((p) => (N.get(p.b) || 0) > 0)) continue;
        let xi; // 이번 Δt 의 반응 진행량 (분자 사건 수)
        if (!k) {
          // 즉시: 자기 입력(저장소 아닌 것)이 허락하는 만큼. 그것이 없으면 행위자 수만큼(0차). 저장소는 아래에서 한도로만.
          xi = own.size ? Math.min(...[...own].map(([b, n]) => (N.get(b) || 0) / n)) : st.agents.length ? Math.min(...st.agents.map((p) => N.get(p.b) || 0)) : 0;
          if (!finite && !own.size && ins.size) xi = Math.min(...[...ins].map(([b, n]) => (N.get(b) || 0) / n));
        } else {
          const prodIn = [...lawIns].reduce((a, [b, n]) => a * conc(b, Vr) ** n, 1), prodOut = [...lawOuts].reduce((a, [b, n]) => a * conc(b, Vr) ** n, 1);
          const agentC = st.agents.reduce((a, p) => a * conc(p.b, Vr), 1);
          let v = 0; // M/s
          if (k.law === 'mass_action') v = k.k * prodIn * agentC - (k.reversible && k.k_r ? k.k_r * prodOut : 0);
          else if (k.law === 'binding') { const kon = k.k_on || (k.k_off && k.Kd ? k.k_off / k.Kd : 0), koff = k.k_off || (k.k_on && k.Kd ? k.k_on * k.Kd : 0); v = kon * prodIn - koff * prodOut; }
          else if (k.law === 'michaelis_menten') { const S = [...lawIns][0]; const s0 = S ? conc(S[0], Vr) : 1; v = k.kcat * agentC * s0 / (k.Km + s0); }
          xi = v * modFactor(st.rule) * NA * Vr * opt.dt;
        }
        const want = xi;
        // 적분 안정성: 속도 법칙 단계가 한 Δt 에 소비하려 한 입력의 비율 (오일러 적분은 이 비율이 작아야 믿을 수 있음)
        if (k && xi > 0 && ins.size) { const f = Math.max(...[...ins].map(([b, n]) => (n * xi) / Math.max(N.get(b) || 0, 1e-12))); if (f > (stiff[sid] || 0)) stiff[sid] = f; }
        if (xi > 0) xi = Math.min(xi, ...[...ins].map(([b, n]) => Math.max(0, N.get(b) || 0) / n));
        else if (xi < 0) xi = -Math.min(-xi, ...[...outs].map(([b, n]) => Math.max(0, N.get(b) || 0) / n));
        // 고갈: 하고 싶었지만 저장소가 모자라 못 한 것
        if (finite && want > 0 && xi < want * (1 - 1e-9)) {
          const by = [...ins].filter(([b, n]) => res.has(b) && (N.get(b) || 0) / n <= xi + 1e-12).map(([b]) => b);
          if (by.length) { if (!stalls[sid]) stalls[sid] = { t, by }; once(`stall:${sid}:${by.join()}:${resStat[by[0]] ? resStat[by[0]].episodes || 0 : 0}`, () => ev({ t, type: 'stalled', step: sid, by })); }
        }
        if (!xi) continue;
        if (!finite) {
          for (const p of st.inputs) if (res.has(p.b)) addVec(xi > 0 ? exIn : exOut, p.b, (p.n || 1) * Math.abs(xi));
          for (const p of st.outputs) if (res.has(p.b)) addVec(xi > 0 ? exOut : exIn, p.b, (p.n || 1) * Math.abs(xi));
        }
        for (const [b, n] of ins) { N.set(b, (N.get(b) || 0) - n * xi); L1(b, 'reaction', -n * xi); }
        for (const [b, n] of outs) { N.set(b, (N.get(b) || 0) + n * xi); L1(b, 'reaction', n * xi); if (xi > 0 && N.get(b) >= 1 && firstReach[b] == null) firstReach[b] = t; }
        cum[sid] = (cum[sid] || 0) + xi;
        // 국소 질량 감사 (단계가 일어날 때마다)
        if (Object.keys(x.unitEnt).length) once('loc:' + sid, () => AE('AUDIT_MASS', `${sid} ${x.rule.label}`, `t=${t} s 첫 발화에서 국소 수지 위반 — 한 번 일어날 때마다 ${Object.entries(x.unitEnt).map(([en, v]) => `${ix.label(en)} ${v > 0 ? '+' : ''}${+v.toFixed(6)}`).join(', ')} (보존되어야 할 실체가 생기거나 사라짐)`, massSuggest(db, ix, Object.keys(x.unitEnt)[0])));
        if (finite && Object.keys(x.unitMoi).length) {
          if (x.covalent) addTo(chan.covalent, x.unitMoi, xi);
          else { addTo(chan.violation, x.unitMoi, xi); once('moi:' + sid, () => AE('AUDIT_MASS', `${sid} ${x.rule.label}`, `t=${t} s 첫 발화에서 부분 구조 수지 위반 — 한 번에 ${Object.entries(x.unitMoi).map(([m, v]) => `${ix.label(m)} ${v > 0 ? '+' : ''}${+v.toFixed(6)}`).join(', ')} (단계의 부산물·보조 기질 묶음이 빠졌거나 규칙이 불완전)`, `단계 ${sid} 의 입력·출력에 빠진 부산물(minor)을 넣거나 규칙 ${x.st.rule} 의 효과·with 를 고칠 것`)); }
        }
      }
      // ② 공급 규칙 (대사물 저장소 재생·합성)
      for (const s of sup) {
        if (!s.k || !s.V) continue;
        const cons = s.rule.consumes.map((q) => [`${q.ref}|${s.loc}`, q.n]), prods = s.rule.produces.map((q) => [`${q.ref}|${s.loc}`, q.n]);
        const Ksat = sc.saturation_K || SAT_K;
        let v = s.k.law === 'zero_order' ? s.k.k : s.k.law === 'mass_action' ? s.k.k * s.rule.consumes.reduce((a, q) => { const c = conc(`${q.ref}|${s.loc}`, s.V); return a * (q.saturating ? c / (c + Ksat) : c ** q.n); }, 1) : 0;
        let xi = v * modFactor(s.ref) * NA * s.V * opt.dt;
        if (cons.length) xi = Math.min(xi, ...cons.map(([b, n]) => Math.max(0, N.get(b) || 0) / n));
        if (!(xi > 0)) continue;
        for (const [b, n] of cons) { N.set(b, N.get(b) - n * xi); L1(b, 'supply', -n * xi); }
        for (const [b, n] of prods) { N.set(b, (N.get(b) || 0) + n * xi); L1(b, 'supply', n * xi); if (N.get(b) >= 1 && firstReach[b] == null && !res.has(b)) firstReach[b] = t; }
        // 실체: 공급의 화학 실체는 changing. 공급이 만든 비화학 실체(합성된 단백질 등)는 생성 원장에
        const dE = {}; for (const [b, n] of prods) addVec(dE, b, n * xi); for (const [b, n] of cons) addVec(dE, b, -n * xi);
        for (const [en, val] of Object.entries(dE)) if (!changing.has(en)) { if (val > 0) created[en] = (created[en] || 0) + val; else destroyed[en] = (destroyed[en] || 0) - val; }
        if (s.rule.source && finite) addTo(chan.source, toMoi(dE), 1);
      }
      // ③ 분해 규칙 (1차, 결정론 또는 확률적)
      for (const g of degr) {
        if (!(g.k > 0)) continue;
        const n = Math.max(0, N.get(g.b) || 0), p = 1 - Math.exp(-g.k * modFactor(g.ref) * opt.dt);
        if (!n) continue;
        const whole = Math.floor(n), frac = n - whole;
        const x = stochastic ? binomial(rand, whole, p) + (frac > 0 && rand() < p ? frac : 0) : n * p;
        if (!(x > 0)) continue;
        N.set(g.b, n - x); L1(g.b, 'degradation', -x);
        const gone = {}; addVec(gone, g.b, x); addTo(destroyed, gone, 1);
        const back = {};
        for (const q of g.rec) { N.set(q.b, (N.get(q.b) || 0) + q.n * x); L1(q.b, 'recycle', q.n * x); addVec(back, q.b, q.n * x); }
        addTo(created, back, 1);
        if (finite) { if (g.rule.fate === 'lost') addTo(chan.lost, toMoi(gone), -1); else { addTo(chan.recycle, toMoi(back), 1); addTo(chan.recycle, toMoi(gone), -1); } }
      }
      // ④ 매 Δt 전역 질량 감사: 실체(화학 변환 실체 제외) · 부분 구조
      const now = totals();
      if (!massFirst) for (const en of uniq([...Object.keys(ent0), ...Object.keys(now), ...Object.keys(created), ...Object.keys(destroyed), ...Object.keys(exIn), ...Object.keys(exOut)])) {
        if (changing.has(en)) continue;
        const want = (ent0[en] || 0) + (created[en] || 0) - (destroyed[en] || 0) + (exIn[en] || 0) - (exOut[en] || 0), got = now[en] || 0;
        if (Math.abs(want - got) > TOL * Math.max(1, Math.abs(want))) { massFirst = { t, en, want, got }; break; }
      }
      if (finite && !moiFirst) {
        const m = toMoi(now);
        for (const k of uniq([...Object.keys(moi0), ...Object.keys(m)])) {
          const want = (moi0[k] || 0) + ['covalent', 'source', 'lost', 'recycle'].reduce((a, c) => a + (chan[c][k] || 0), 0), got = m[k] || 0;
          if (Math.abs(want - got) > TOL * Math.max(1, Math.abs(want))) { moiFirst = { t, k, want, got, viol: chan.violation[k] || 0 }; break; }
        }
      }
      // ⑤ 고갈·재생 사건 (유한 저장소)
      if (finite) for (const [b, r] of Object.entries(resStat)) {
        const n = N.get(b) || 0;
        if (n < -1e-9) once('neg:' + b, () => AE('AUDIT_MASS', b, `t=${t} s 에 저장소 ${ix.bundleLabel(b)} 가 음수(${n}) — 엔진 오류`, '엔진 버그: 보고할 것'));
        r.min = Math.min(r.min, n); r.max = Math.max(r.max, n);
        if (r.state === 'ok' && n < 1) { r.state = 'exhausted'; r.episodes = (r.episodes || 0) + 1; r.firstExhausted = r.firstExhausted != null ? r.firstExhausted : t; r.lastExhausted = t; ev({ t, type: 'exhausted', bundle: b }); }
        else if (r.state === 'exhausted' && n >= Math.max(2, 0.01 * r.start)) { r.state = 'ok'; r.regenerated = (r.regenerated || 0) + 1; ev({ t, type: 'regenerated', bundle: b }); }
        else if (r.state === 'empty' && n >= 1) r.state = 'ok'; // 처음부터 비어 있던 산물 저장소가 채워짐 (재생 사건 아님)
      }
      // ⑥ 정지 감지: 창 길이 동안의 진행이 1 바퀴(또는 1 분자) 미만. 감시 단계의 입력이 1 분자 아래로 처음 내려간 시각도 기록
      for (const sid of watch) for (const [b, n] of react.get(sid).ins) { const v = N.get(b) || 0; if (v >= n) { seenOK.add(b); delete zeroAt[b]; } else if (seenOK.has(b) && zeroAt[b] == null) zeroAt[b] = t; } // 지금도 0 인 것만 남는다 (일시적 0 은 지움)
      const pg = progress();
      if (Math.floor(pg + 1e-9) > lastTurn.n) lastTurn = { n: Math.floor(pg + 1e-9), t };
      hist.push(pg);
      if (hist.length > winN + 1) hist.shift();
      if (hist.length > winN) {
        const moved = hist[hist.length - 1] - hist[0], rate = moved / (winN * opt.dt);
        peak.rate = Math.max(peak.rate, rate);
        // 시동 중(아직 창당 1 바퀴도 돈 적 없음)에는 정지로 보지 않는다
        const stalled = peak.rate * winN * opt.dt >= 1 && (moved < 1 || (deathFrac > 0 && rate < deathFrac * peak.rate));
        if (!death && stalled && pg >= 1) {
          const exhausted = Object.entries(resStat).filter(([, r]) => r.state === 'exhausted').map(([b, r]) => ({ b, t: r.lastExhausted }));
          death = { t_detected: t, window: winN * opt.dt, exhausted };
        }
        if (death && !stalled) death = null; // 다시 돌기 시작하면 정지가 아님 (재생)
      }
      if (i % every === 0 || i === steps) record(t);
      if (untilDeath && death) { if (i % every !== 0) record(t); break; }
    }
    if (massFirst) AE('AUDIT_MASS', massFirst.en, `${ix.label(massFirst.en)}: t=${massFirst.t} s 에 처음 어긋남 — 시작 ${(ent0[massFirst.en] || 0).toFixed(3)} + 생성 ${(created[massFirst.en] || 0).toFixed(3)} − 소멸 ${(destroyed[massFirst.en] || 0).toFixed(3)}${finite ? '' : ` + 풀에서 들어옴 ${(exIn[massFirst.en] || 0).toFixed(3)} − 풀로 나감 ${(exOut[massFirst.en] || 0).toFixed(3)}`} = ${massFirst.want.toFixed(3)} ≠ 실제 ${massFirst.got.toFixed(3)} — 보존되어야 하는 실체가 원장 밖에서 사라지거나 생김`, massSuggest(db, ix, massFirst.en));
    if (moiFirst) AE('AUDIT_MASS', moiFirst.k, `부분 구조 ${ix.label(moiFirst.k)}: t=${moiFirst.t} s 에 처음 어긋남 — 기대 ${moiFirst.want.toFixed(3)} ≠ 실제 ${moiFirst.got.toFixed(3)} (원장 밖 변화 ${moiFirst.viol.toFixed(3)} 는 위 국소 수지 위반 단계에서 옴)`, '국소 수지 위반 단계를 먼저 고칠 것');
    // 적분 안정성 감사: 한 Δt 에 입력의 20% 넘게 쓰려 한 속도 법칙 단계 — 결과(특히 정지 시각·평형)는 Δt 를 줄여 다시 확인해야 함
    const stiffSteps = Object.entries(stiff).filter(([, f]) => f > 0.2).sort((a, b) => b[1] - a[1]);
    if (stiffSteps.length) AE('AUDIT_KINETIC', target, `Δt ${opt.dt} s 가 너무 큼 — 속도 법칙 단계가 한 Δt 에 입력을 최대 ${stiffSteps.slice(0, 4).map(([sid, f]) => `${sid} ${Math.min(f, 99.99) * 100 > 9999 ? '>9999' : (f * 100).toFixed(0)}%`).join(', ')} 소비하려 함 (오일러 적분 불안정·과도 진동 위험)`, `dt 를 ${(opt.dt * 0.2 / stiffSteps[0][1]).toPrecision(2)} s 이하로 줄여 다시 실행하고 결과가 같은지 확인`);
    // 평형 일치: 결합 단계의 Q 와 Kd
    for (const sid of ids) {
      const { st, k, V: Vr } = react.get(sid);
      if (!k || k.law !== 'binding') continue;
      const Kd = k.Kd || (k.k_off && k.k_on ? k.k_off / k.k_on : null);
      const ins = st.inputs.filter((p) => !p.minor && !res.has(p.b)), outs = st.outputs.filter((p) => !p.minor && !res.has(p.b));
      if (!Kd || ins.length !== 2 || outs.length !== 1) continue;
      if (ids.some((o) => o !== sid && [...db.steps[o].inputs, ...db.steps[o].agents].some((p) => p.b === outs[0].b && !p.minor))) continue;
      if (degr.some((g) => g.k > 0 && [ins[0].b, ins[1].b, outs[0].b].includes(g.b))) continue; // 분해가 끼면 평형이 아님
      const Q = conc(ins[0].b, Vr) * conc(ins[1].b, Vr) / Math.max(conc(outs[0].b, Vr), 1e-30);
      if (conc(ins[0].b, Vr) > 0 && conc(ins[1].b, Vr) > 0 && Math.abs(Math.log10(Q / Kd)) > 1) AE('AUDIT_KINETIC', `${sid} ${react.get(sid).rule.label}`, `끝 시점의 [A][B]/[AB] = ${Q.toExponential(2)} M 가 Kd ${Kd.toExponential(2)} M 와 10배 이상 다름 — 아직 평형 전이거나 dt 가 너무 큼`, `t_end 를 늘리거나 dt 를 줄여 다시 실행 (지금 dt ${opt.dt} s)`);
    }
    // 자원 순환 (Cycle-awareness): 저장소마다 누가 소비·생성하나 → closed(순환) · consumed_only(고갈 위험) · produced_only(축적) · idle
    for (const sid of ids) { const { st } = react.get(sid); for (const p of st.inputs) if (resStat[p.b]) resStat[p.b].consumers.push(sid); for (const p of st.outputs) if (resStat[p.b]) resStat[p.b].producers.push(sid); }
    for (const s of sup) { for (const q of s.rule.consumes) { const b = `${q.ref}|${s.loc}`; if (resStat[b]) resStat[b].consumers.push(s.ref); } for (const q of s.rule.produces) { const b = `${q.ref}|${s.loc}`; if (resStat[b]) resStat[b].producers.push(s.ref); } }
    for (const g of degr) for (const q of g.rec) if (resStat[q.b]) resStat[q.b].producers.push(g.ref);
    const active = (ref) => { if (react.has(ref)) return true; const s = sup.find((x) => x.ref === ref); if (s) return !!(s.k && s.V); const g = degr.find((x) => x.ref === ref); return !!(g && g.k > 0); };
    for (const [b, r] of Object.entries(resStat)) {
      r.consumers = uniq(r.consumers); r.producers = uniq(r.producers);
      const c = r.consumers.some(active), p = r.producers.some(active);
      r.class = c && p ? 'closed' : c ? 'consumed_only' : p ? 'produced_only' : 'idle';
      r.end = N.get(b);
    }
    // 저장소 분자 사이의 순환(예: GTP → GDP → GTP): 반응·공급의 소비 → 생성 그래프의 강하게 연결된 성분
    const G = new Map(), edge = (a, b) => { if (a === b) return; if (!G.has(a)) G.set(a, new Set()); G.get(a).add(b); };
    for (const sid of ids) { const { st } = react.get(sid); for (const a of st.inputs) for (const b of st.outputs) if (res.has(a.b) && res.has(b.b)) edge(a.b, b.b); }
    for (const s of sup) if (s.k && s.V) for (const a of s.rule.consumes) for (const b of s.rule.produces) edge(`${a.ref}|${s.loc}`, `${b.ref}|${s.loc}`);
    const cycles = sccs(G).filter((c) => c.length > 1);
    if (finite) {
      for (const [b, r] of Object.entries(resStat)) {
        if (r.class === 'consumed_only') once('res:' + b, () => AE('AUDIT_RESOURCE', b, `저장소 ${ix.bundleLabel(b)} 는 소비만 되고 재생 경로가 없음 (소비: ${r.consumers.join(', ')})${r.firstExhausted != null ? ` — t=${r.firstExhausted} s 에 고갈` : ''}`, gapSuggest(db, ix, b.split('|')[0], 'Kinetic_Gap', /공급|재생|supply/)));
        if (r.source === 'bulk' && r.consumers.some(active)) once('resamt:' + b, () => AE('AUDIT_CONCENTRATION', b, `저장소 ${ix.bundleLabel(b)} 의 시작량이 기본값(${opt.bulk}) — 고갈 시각은 질적 의미만`, gapSuggest(db, ix, b.split('|')[0], 'Concentration_Gap', /저장소|대사물|뉴클레오타이드|reservoir/)));
      }
    }
    // ===== 사후 분석 (Post-Mortem): 정지 시각·원인·제한 요인·완료한 회로 수·폐기물 축적·소비/생산 비 =====
    const tEnd = series[series.length - 1].t;
    const turnsDone = stepCycles.map((c) => ({ steps: c, completed: Math.floor(turns(c) + 1e-9), exact: turns(c) }));
    const watchIns = new Set([...watch].flatMap((sid) => [...react.get(sid).ins.keys()]));
    const exhaustedNow = Object.entries(resStat).filter(([b, r]) => r.state === 'exhausted' && watchIns.has(b)).sort((a, b) => a[1].lastExhausted - b[1].lastExhausted);
    const firstToZero = Object.entries(zeroAt).sort((a, b) => a[1] - b[1]).map(([b, t]) => ({ bundle: b, t, reservoir: res.has(b) }));
    const consumed = {}, produced = {};
    for (const [b, l] of Object.entries(ledger)) if (res.has(b)) { const net = l.reaction + l.supply + l.degradation + l.recycle; if (net < -1e-6) consumed[b] = -net; else if (net > 1e-6) produced[b] = net; }
    const sum = (o) => Object.values(o).reduce((a, v) => a + v, 0);
    // 폐기물: 생성만 되는 저장소 + 어떤 단계도 입력으로 쓰지 않는 산물 묶음(예: CO₂)
    const usedAsInput = new Set(ids.flatMap((sid) => react.get(sid).st.inputs.map((p) => p.b)));
    const waste = [...Object.entries(resStat).filter(([, r]) => r.class === 'produced_only' || (r.end - r.start > 0 && !r.consumers.length)).map(([b, r]) => ({ bundle: b, accumulated: r.end - r.start })),
      ...Object.entries(ledger).filter(([b, l]) => !res.has(b) && !usedAsInput.has(b) && l.reaction > 0).map(([b, l]) => ({ bundle: b, accumulated: l.reaction + l.degradation }))].filter((w) => w.accumulated > 0).sort((a, b) => b.accumulated - a.accumulated);
    for (const w of waste) if (!res.has(w.bundle)) produced[w.bundle] = w.accumulated; // 저장소가 아닌 폐기물(CO₂ 등)도 생산 쪽에
    let pm = { dead: !!death, alive: !death, t_end: tEnd, cycles: turnsDone, last_turn: lastTurn, death_frac: deathFrac, firstToZero, waste, dp: { consumed, produced, ratio: sum(produced) ? sum(consumed) / sum(produced) : null }, peak_rate: peak.rate };
    if (death) {
      if (exhaustedNow.length) {
        const [b, r] = exhaustedNow[0];
        pm = { ...pm, cause: 'exhaustion', t_death: r.lastExhausted, t_detected: death.t_detected, window: death.window, limiting: { bundle: b, starved: [...watch].filter((sid) => react.get(sid).ins.has(b)), consumers: r.consumers, regeneration: r.producers.filter(active) } };
      } else {
        // 고갈 없이 멈춤: 가역 단계가 평형에 닿음(산물 축적) 또는 속도 상수 한계
        const eq = [...watch].map((sid) => { const x = react.get(sid), k = x.k; if (!k || k.law !== 'mass_action' || !k.reversible || !k.k_r) return null; const f = k.k * [...x.lawIns].reduce((a, [b2, n]) => a * conc(b2, x.V) ** n, 1) * x.st.agents.reduce((a, p2) => a * conc(p2.b, x.V), 1), rv = k.k_r * [...x.lawOuts].reduce((a, [b2, n]) => a * conc(b2, x.V) ** n, 1); return { sid, ratio: f > 0 ? rv / f : Infinity }; }).filter(Boolean).sort((a, b) => b.ratio - a.ratio);
        const starvedIn = firstToZero.find((z) => !z.reservoir);
        const cause = eq.length && eq[0].ratio > 0.5 ? 'equilibrium' : starvedIn ? 'intermediate_drained' : 'kinetic_stall';
        pm = { ...pm, cause, t_death: lastTurn.t, t_detected: death.t_detected, window: death.window, bottleneck: eq[0] || null, limiting: cause === 'intermediate_drained' ? { bundle: starvedIn.bundle, starved: [...watch].filter((sid) => react.get(sid).ins.has(starvedIn.bundle)) } : null };
      }
      const lb = pm.limiting && pm.limiting.bundle, base0 = lb ? lb.split('|')[0] : (pm.bottleneck ? ix.ruleOwner(db.steps[pm.bottleneck.sid].rule) : tg.ids[0]);
      const gtype = pm.cause === 'exhaustion' ? 'Resource_Gap' : 'Kinetic_Gap';
      AE('AUDIT_RESOURCE', target, `사후 분석: t=${pm.t_death} s 에 정지 (${{ exhaustion: '자원 고갈', equilibrium: '산물 축적으로 평형', intermediate_drained: '중간물 고갈', kinetic_stall: '속도 정지' }[pm.cause]})${lb ? ` — 제한 요인 ${ix.bundleLabel(lb)}${pm.limiting.starved.length ? ` (굶은 단계 ${pm.limiting.starved.join(', ')})` : ''}` : ''}${pm.bottleneck ? ` — 병목 ${pm.bottleneck.sid} (역/정 = ${pm.bottleneck.ratio.toFixed(3)})` : ''} · 완료한 회로 ${turnsDone.map((c) => c.completed).join('/') || '—'}바퀴`,
        gapSuggest(db, ix, base0, gtype, gtype === 'Resource_Gap' ? new RegExp(lb ? ix.label(base0).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '고갈') : null));
    }
    const gaps = kineticGaps.filter((x) => !/\/rule\//.test(x) || react.has(x));
    const sgaps = kineticGaps.filter((x) => /\/rule\//.test(x));
    if (gaps.length) AE('AUDIT_KINETIC_GAP', target, `속도 상수가 없는 단계 ${gaps.length}개를 즉시(사건 기반)로 처리함: ${gaps.join(', ')}`, gapSuggest(db, ix, tg.ids[0], 'Kinetic_Gap'));
    if (sgaps.length) AE('AUDIT_KINETIC_GAP', target, `속도 상수가 없는 공급·분해 규칙 ${sgaps.length}개는 적용하지 않음: ${sgaps.join(', ')}`, sgaps.map((x) => gapSuggest(db, ix, x.split('/')[0], 'Kinetic_Gap')).filter((x, i, a) => a.indexOf(x) === i).join(' / '));
    if (approx.size) AE('AUDIT_RESOLUTION', target, `막(2D) 분자가 낀 단계 ${approx.size}개는 인접 3D 부피의 농도로 환산함 (면적 농도 아님): ${[...approx].join(', ')}`, gapSuggest(db, ix, tg.ids[0], 'Concentration_Gap', /2D|면적/));
    return { ids, cell, mode, stochastic, scenario: sc.name || null, hypothetical: !!sc.hypothetical, series, firstReach, final: Object.fromEntries(N), audit, kineticGaps, react, ix, t_end: opt.t_end, dt: opt.dt,
      reservoirs: resStat, ledger, events, stalls, cycles, supplies: sup.map((s) => ({ ref: s.ref, active: !!(s.k && s.V), law: s.k ? s.k.law : null, src: s.k ? s.k.src : null, kin: s.k })),
      degradations: degr.map((g) => ({ bundle: g.b, ref: g.ref, k_deg: g.k, fate: g.rule.fate, src: g.kin ? g.kin.src : null })), created, destroyed, channels: chan, stepCycles, postMortem: pm, modulationGaps: [...modGaps] };
  }
  // 강하게 연결된 성분 (Tarjan, 반복형)
  function sccs(G) {
    const idx = new Map(), low = new Map(), on = new Set(), stack = [], out = [];
    let n = 0;
    const nodes = uniq([...G.keys(), ...[...G.values()].flatMap((s) => [...s])]);
    for (const s of nodes) {
      if (idx.has(s)) continue;
      const work = [[s, 0]];
      while (work.length) {
        const [v, i] = work[work.length - 1];
        if (i === 0) { idx.set(v, n); low.set(v, n); n++; stack.push(v); on.add(v); }
        const nb = [...(G.get(v) || [])];
        if (i < nb.length) {
          work[work.length - 1][1]++;
          const w = nb[i];
          if (!idx.has(w)) work.push([w, 0]);
          else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
          continue;
        }
        work.pop();
        if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
        if (low.get(v) === idx.get(v)) { const c = []; let w; do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v); out.push(c.reverse()); }
      }
    }
    return out;
  }
  // 감사 오류에 붙일 교정 제안: 한계 등록부에서 대상·종류가 맞는 열린 한계를 찾는다
  function gapSuggest(db, ix, base, type, hint) {
    const open = Object.entries(db.limitations).filter(([, l]) => l.type === type && limitationStatus(db, l).status === 'open');
    const hinted = hint ? open.filter(([, l]) => hint.test(l.requirement.text)) : [];
    const hits = hinted.length ? hinted : open.filter(([, l]) => (parseTarget(l.target) || {}).base === base);
    const any = hits.length ? hits : Object.entries(db.limitations).filter(([, l]) => l.type === type && limitationStatus(db, l).status === 'open');
    if (!any.length) return `한계 등록부에 ${type} 로 등록할 것: [${base} | ${type} | 필요한 데이터]`;
    return any.slice(0, 3).map(([id, l]) => `${id}: ${l.requirement.needs.filter((n) => !needMet(db, n)).map((n) => n.kind === 'obs' ? `${n.property} 관찰(${ix.label(n.on)})` : n.kind === 'kinetics' ? `${(n.params || []).join('·')} (${n.rule})` : n.kind === 'residue' ? `잔기 번호(${n.site})` : n.kind === 'xref' ? `${n.db} ID(${ix.label(n.on)})` : n.text).join(', ')} 를 채울 것`).join(' / ');
  }
  // 질량 위반 교정 제안: 그 실체 또는 그것을 구성 요소로 가진 복합체·부위 리간드를 대상으로 한 열린 한계
  function massSuggest(db, ix, entity) {
    const holders = new Set([entity]);
    for (let grew = true; grew;) { grew = false; for (const [id, d] of Object.entries(db.senses)) if (!holders.has(id) && (d.components.some((c) => holders.has(c.ref)) || Object.values(d.site).some((x) => x.ligand && holders.has(x.ligand)))) { holders.add(id); grew = true; } }
    const hits = Object.entries(db.limitations).filter(([, l]) => limitationStatus(db, l).status === 'open' && holders.has((parseTarget(l.target) || {}).base));
    return hits.length ? hits.map(([id, l]) => `${id} [${l.type}] ${l.requirement.text}`).join(' / ') : `규칙의 효과·묶음 화학량을 확인하고, 의도된 소실이면 degrade/convert 효과로 표현할 것 — 원인이 모델 단순화면 한계 등록부에 등록: [${entity} | Structural_Gap | …]`;
  }
  function simulateRateText(db, target, opt) {
    const r = simulateRate(db, target, opt);
    if (r.error) return r.error;
    const ix = r.ix, out = [`속도 기반 시뮬레이션: ${target} — ${r.t_end} s, dt ${r.dt} s${r.cell ? ', 세포 ' + vlabel('cells', r.cell) : ''}${r.scenario ? `, 시나리오 '${r.scenario}'` : ''} · 저장소 ${r.mode}${r.stochastic ? ' · 확률적 분해' : ''}`];
    if (r.hypothetical) out.push('  ⚠ 가상 시나리오 값 — 지식이 아니라 엔진 시험용 (data/db.json 에 저장되지 않음)');
    out.push('단계별 속도 법칙:');
    for (const sid of r.ids) { const x = r.react.get(sid); out.push(`  ${sid} ${ix.label(sid)}: ${x.k ? `${x.k.law} [${x.k.src}] ${KIN_FIELDS.filter((f) => x.k[f] != null).map((f) => `${f}=${x.k[f]}`).join(' ')}` : '속도 상수 없음 → 즉시'}${x.V ? ` · 부피 ${(x.V / 1e-15).toPrecision(3)} fL` : ''}`); }
    const kinTxt = (k) => `${k.law} [${k.src}] ${KIN_FIELDS.filter((f) => k[f] != null).map((f) => `${f}=${k[f]}`).join(' ')}`;
    if (r.supplies.length) out.push('공급 규칙 (Metabolic_Supply_Rule):', ...r.supplies.map((x) => `  ${x.active ? '●' : '○'} ${ruleLine(ix, x.ref.split('/')[0], ix.ruleOf(x.ref)).replace(/ 〈[^〉]*〉$/, '')}${x.kin ? ' · ' + kinTxt(x.kin) : ''}${x.active ? '' : ' — 적용 안 함 (속도 상수·부피 없음)'}`));
    if (r.degradations.length) out.push('분해 규칙 (Degradation_Rule):', ...r.degradations.map((x) => `  ${x.k_deg > 0 ? '●' : '○'} ${ix.bundleLabel(x.bundle)} ← ${x.ref} ${vlabel('lifecycleFates', x.fate)}${x.k_deg > 0 ? ` k_deg=${x.k_deg.toExponential(3)} s⁻¹ [${x.src}]` : ' — 적용 안 함 (속도 상수 없음)'}`));
    const keys = Object.keys(r.firstReach).sort((a, b) => r.firstReach[a] - r.firstReach[b]);
    out.push('처음 1분자 이상이 된 시각:', ...keys.map((b) => `  t=${r.firstReach[b].toFixed(3)} s  ${ix.bundleLabel(b)}`));
    out.push('끝 시점 분자 수 (0 아님, 저장소 제외):', ...Object.entries(r.final).filter(([b, n]) => n > 1e-9 && !r.reservoirs[b] && (r.mode === 'finite' || n < 900)).map(([b, n]) => `  ${n.toFixed(2)}× ${ix.bundleLabel(b)}`));
    const fmt = (n) => (Math.abs(n) >= 1e5 ? n.toExponential(3) : n.toFixed(2));
    const CL = { closed: '순환(소비·재생)', consumed_only: '소비만 — 고갈 위험', produced_only: '생성만 — 축적', idle: '쓰이지 않음' };
    out.push(`대사물 저장소 (${vlabel('reservoirModes', r.mode)}):`);
    for (const [b, x] of Object.entries(r.reservoirs)) out.push(`  ${ix.bundleLabel(b)}: 시작 ${fmt(x.start)} → 끝 ${fmt(x.end)} (최소 ${fmt(x.min)}) · ${CL[x.class]}${x.source === 'bulk' ? ' · 시작량 기본값(농도 공백)' : x.source.startsWith('data') ? ' · ' + x.source : ''}${x.episodes ? ` · 고갈 ${x.episodes}회` : ''}${x.regenerated ? ` · 재생 ${x.regenerated}회` : ''}`);
    if (r.cycles.length) out.push('자원 순환 (저장소 분자 사이의 닫힌 소비·생성 고리 — 강하게 연결된 성분):', ...r.cycles.map((c) => '  ⟲ ' + c.map((b) => ix.bundleLabel(b)).join(' · ')));
    if (r.events.length) out.push('고갈·재생 사건:', ...r.events.slice(0, 30).map((e) => `  t=${e.t} s ${e.type === 'exhausted' ? '고갈 ' + ix.bundleLabel(e.bundle) : e.type === 'regenerated' ? '재생 ' + ix.bundleLabel(e.bundle) : `멈춤 ${e.step} ${ix.label(e.step)} ← ${e.by.map((b) => ix.bundleLabel(b)).join(', ')} 부족`}`), ...(r.events.length > 30 ? [`  … ${r.events.length - 30}건 더`] : []));
    const led = Object.entries(r.ledger).filter(([, l]) => l.supply || l.degradation || l.recycle);
    if (led.length) out.push('변화량 원장 Δ (반응 · 공급 · 분해 · 재활용):', ...led.map(([b, l]) => `  ${ix.bundleLabel(b)}: ${fmt(l.reaction)} · ${fmt(l.supply)} · ${fmt(l.degradation)} · ${fmt(l.recycle)}`));
    const pm = r.postMortem;
    if (r.stepCycles.length) out.push('단계 순환 (회로):', ...pm.cycles.map((c) => `  ⟳ ${c.steps.join(' → ')} → … : 완료 ${c.completed}바퀴 (진행량 ${c.exact.toFixed(3)})`));
    out.push(pm.dead ? `사후 분석 (Post-Mortem) — 정지:` : `사후 분석 — ${pm.t_end} s 까지 정지하지 않음 (최고 속도 ${pm.peak_rate.toPrecision(3)} ${r.stepCycles.length ? '바퀴' : '분자'}/s)`);
    if (pm.dead) {
      const CA = { exhaustion: '자원 고갈 (저장소 < 1 분자 — 다음 반응을 일으킬 수 없음)', equilibrium: '산물 축적으로 평형 (역반응 ≈ 정반응)', intermediate_drained: '중간물 고갈', kinetic_stall: '속도 정지' };
      out.push(`  정지 시각 t=${pm.t_death} s (감지 t=${pm.t_detected} s · 확인 창 ${pm.window} s${pm.death_frac ? ` · 정지 기준 최고 속도의 ${pm.death_frac * 100}%` : ''} · 시간 해상도 Δt ${r.dt} s) · 원인: ${CA[pm.cause]}`);
      out.push(`  마지막으로 완료한 ${r.stepCycles.length ? '바퀴' : '진행'}: ${pm.last_turn.n} 번째, t=${pm.last_turn.t} s`);
      if (pm.limiting) out.push(`  제한 요인: ${ix.bundleLabel(pm.limiting.bundle)} — 굶은 단계 ${pm.limiting.starved.map((x) => `${x} ${ix.label(x)}`).join(', ') || '—'}${pm.limiting.regeneration ? ` · 켜진 재생 경로 ${pm.limiting.regeneration.join(', ') || '없음'}` : ''}`);
      if (pm.bottleneck) out.push(`  병목: ${pm.bottleneck.sid} ${ix.label(pm.bottleneck.sid)} (역/정 = ${pm.bottleneck.ratio.toFixed(3)})`);
    }
    if (pm.firstToZero.length) out.push('  0 에 닿은 순서 (감시 단계의 입력 중 끝까지 1 분자 미만인 것):', ...pm.firstToZero.slice(0, 8).map((z) => `    t=${z.t} s ${ix.bundleLabel(z.bundle)}${z.reservoir ? ' [저장소]' : ''}`));
    if (pm.waste.length) out.push('  축적된 폐기물·산물 (소비되지 않음):', ...pm.waste.slice(0, 8).map((w) => `    +${fmt(w.accumulated)} ${ix.bundleLabel(w.bundle)}`));
    out.push(`  소비/생산 비 (저장소 순소비 ÷ 순생산): ${pm.dp.ratio == null ? '—' : pm.dp.ratio.toFixed(4)} — 소비 ${Object.entries(pm.dp.consumed).map(([b, v]) => `${ix.bundleLabel(b)} ${fmt(v)}`).join(', ') || '—'} / 생산 ${Object.entries(pm.dp.produced).map(([b, v]) => `${ix.bundleLabel(b)} ${fmt(v)}`).join(', ') || '—'}`);
    out.push(r.audit.length ? `감사 (Audit) — ${r.audit.length}건:` : '감사 (Audit): 위반 없음');
    for (const a of r.audit) out.push(`  [${a.code}] ${a.where}: ${a.msg}`, `      → 교정 제안: ${a.suggestion}`);
    return out.join('\n');
  }
  // 전체 감사: 저장소 검사 + 경로마다 해상도·속도 감사
  function auditRun(db, target, opt) {
    db = normalize(db);
    const out = [], v = validate(db);
    for (const e of v.errors) out.push({ code: 'AUDIT_SCHEMA', where: e.where, msg: e.msg, suggestion: '패치를 고쳐 다시 병합' });
    const p = resolutionPlan(db, target);
    if (!p.error) for (const r of p.rows) if (!r.ok) out.push({ code: 'AUDIT_RESOLUTION', where: `${r.sid} ${p.ix.label(r.sid)}`, msg: `필요 ${['R0', 'R1', 'R2'][r.need]} 인데 갖춤 ${['R0', 'R1', 'R2'][r.have]} — ${r.hits.join(', ')}: ${r.comp.map((c) => p.ix.bundleLabel(c.bundle)).join(', ')} 를 두고 ${r.comp.flatMap((c) => c.steps).filter((x, i, a) => a.indexOf(x) === i).join('·')} 가 경쟁하는데 속도 상수도 반응 중심 구조도 없음`, suggestion: gapSuggest(db, p.ix, p.ix.ruleOwner(db.steps[r.sid].rule), 'Kinetic_Gap') });
    const th = thermoLoops(db, target);
    if (!th.error) for (const l of th.loops) if (!l.ok) out.push({ code: 'AUDIT_THERMO', where: l.steps.join('→'), msg: `닫힌 고리의 ΣΔG° = ${l.sum.toFixed(1)} J/mol ≠ 0 (허용 ${V.thermo.loop_tolerance}) — 미시적 가역성 위반: 고리를 한 바퀴 돌면 에너지가 생기거나 사라짐`, suggestion: '고리 단계들의 dG0 를 확인하고 하나를 나머지로부터 정할 것 (Wegscheider 조건)' });
    const s = simulateRate(db, target, opt);
    if (!s.error) out.push(...s.audit);
    return out;
  }

  function parseLoose(text) {
    const s = String(text).trim();
    try { return JSON.parse(s); } catch (_) { /* 아래에서 다시 시도 */ }
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return JSON.parse(fence[1]);
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('JSON 을 찾을 수 없음');
  }
  const ingest = (db, obj) => merge(db, obj);

  return { FORMAT, PATCH_FORMAT, VERSION, VOCAB: V, REL, AXIS_UP, AXIS_DOWN, ROLE, emptyDB, normalize, normName, index, validate, merge, gate, ingest,
    resolveRef, mapVocab, audit, auditText, mapText, contextText, mechanismText, stepLine, ruleLine, promptText, parseLoose, isStepId, isId,
    xrefKey, xrefLabel, parseBundle, bundleKey, locCompatible, vlabel, simulate, simulateText,
    MOTIFS, findMotifs, patternText, limitationStatus, limitationsText, limitationsMarkdown, detectGaps, parseTarget,
    kineticIssues, rateAt, envShift, thermoLoops, defaultTier, resolutionPlan, resolutionText, simulateRate, simulateRateText, auditRun, patchReport, patchReportText, EFFECT_TYPES, CONSERVING, KIN_FIELDS, SENSE_FIELDS,
    modulationIndex, hillFactor, SAT_K, augmentCandidates, refineCheck, refineText, MASS_REL_TOL, moietyOf, moietyImbalance, entityTally, supplyRules, rngOf, binomial, gapSuggest, NA, VOL };
});
