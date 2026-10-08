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

  const FORMAT = 'definition-db', PATCH_FORMAT = 'definition-db-patch', VERSION = 6;

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
    'tissues', 'cells', 'taxa', 'obsProperties', 'evidenceLevels', 'gapTypes', 'kineticLaws'];
  const VNAME = { kinds: 'kind', fields: '분야(field)', actions: '변화 종류(action)', activity: '활성(activity)', effects: '조절 효과(effect)',
    locations: '위치(location)', faces: '막 면(face)', associations: '막 결합 방식(association)', features: '특징(feature)', siteTypes: '부위 종류',
    tissues: '조직(tissue)', cells: '세포(cell)', taxa: '종(species/taxa)', obsProperties: '관찰 속성(property)', evidenceLevels: '근거 수준', gapTypes: '한계 종류', kineticLaws: '속도 법칙' };
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
    if (arr(s.taxa).length) o.taxa = arr(s.taxa).map(str);
    // 고해상도 반응 중심: 3차원 구조 참조 (좌표는 저장하지 않고 구조 데이터베이스를 가리킨다)
    if (isObj(s.structure)) { o.structure = { db: str(s.structure.db) || 'PDB', id: str(s.structure.id) }; for (const k of ['chain', 'residues', 'note']) if (str(s.structure[k])) o.structure[k] = str(s.structure[k]); }
    return o;
  }
  function normRule(r) {
    const o = { id: str(r.id), type: str(r.type) || (r.effect ? 'transition' : 'meaning'), label: str(r.label) };
    if (o.type === 'meaning') {
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
    if (isObj(k.context)) o.context = normContext(k.context);
    o.evidence = normEvidence(k.evidence);
    return o;
  }
  const KIN_FIELDS = ['k', 'k_r', 'order', 'k_on', 'k_off', 'Kd', 'kcat', 'Km'];
  function normObs(b) {
    const o = { property: str(b.property), value: typeof b.value === 'number' ? b.value : str(b.value), context: normContext(b.context), evidence: normEvidence(b.evidence) };
    if (str(b.unit)) o.unit = str(b.unit);
    if (str(b.note)) o.note = str(b.note);
    return o;
  }
  const SENSE_FIELDS = ['kind', 'reference_species', 'membrane', 'xrefs', 'unmapped', 'fingerprint', 'components', 'desc', 'site', 'rule', 'obs', 'motif', 'addresses', 'gap_review', 'distinction', 'note'];
  function normSense(d) {
    const o = { term: str(d.term), n: parseInt(d.n, 10) || 0, kind: str(d.kind) };
    if (str(d.reference_species)) o.reference_species = str(d.reference_species);
    if (isObj(d.membrane)) { o.membrane = { association: str(d.membrane.association) }; for (const k of ['location', 'side']) if (str(d.membrane[k])) o.membrane[k] = str(d.membrane[k]); }
    o.xrefs = arr(d.xrefs).map(parseXref).map((x) => (x.note ? x : { db: x.db, id: x.id, status: x.status }));
    if (str(d.unmapped)) o.unmapped = str(d.unmapped);
    if (isObj(d.fingerprint) && str(d.fingerprint.value)) o.fingerprint = { scheme: str(d.fingerprint.scheme), value: str(d.fingerprint.value), status: str(d.fingerprint.status) || 'asserted' };
    o.components = arr(d.components).filter(isObj).map((c) => { const x = { ref: str(c.ref), n: parseInt(c.n, 10) || 1 }; if (str(c.role)) x.role = str(c.role); return x; });
    o.desc = arr(d.desc).filter(isObj).map(normDesc);
    o.site = {};
    if (isObj(d.site)) for (const [k, s] of Object.entries(d.site)) if (isObj(s)) o.site[str(k)] = normSite(s);
    o.rule = arr(d.rule).filter(isObj).map(normRule);
    o.obs = arr(d.obs).filter(isObj).map(normObs);
    // 상위 개념: motif = 경로에서 자동으로 찾는 패턴(MOTIFS 의 키), addresses = 이 개념이 해결하려는 한계(L…)와 방법
    if (str(d.motif)) o.motif = str(d.motif);
    if (arr(d.addresses).length) o.addresses = arr(d.addresses).filter(isObj).map((a) => ({ limitation: str(a.limitation), how: str(a.how) }));
    for (const k of ['gap_review', 'distinction', 'note']) if (str(d[k])) o[k] = str(d[k]);
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
      return !!(r && r.kinetics && (n.params || []).every((f) => r.kinetics[f] > 0));
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
      if (!participant) E(rw, '규칙은 분자 종류 정의항만 가질 수 있음');
      checkEvidence(r.evidence, rw, E);
      for (const t of r.taxa || []) if (!V.taxa[t]) E(rw, `종 조건 '${t}' 은(는) 종 어휘에 없음`);
      if (r.kinetics) { for (const m of kineticIssues(r, null)) E(rw, m); checkEvidence(r.kinetics.evidence, rw + ' 속도', E); if (r.kinetics.context) checkContext(r.kinetics.context, rw, E); }
      if (r.type === 'meaning') {
        if (!V.activity[r.activity]) E(rw, `활성 '${r.activity}' 은(는) 어휘에 없음`);
        for (const [s, f] of Object.entries(r.when)) {
          if (!d.site[s]) E(rw, `조건의 부위 '${s}' 가 이 정의항에 없음`);
          else if (!d.site[s].features.includes(f)) E(rw, `부위 '${s}' 는 특징 '${f}' 를 가질 수 없음`);
        }
        continue;
      }
      if (r.type !== 'transition') { E(rw, `규칙 종류 '${r.type}' — meaning | transition`); continue; }
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
    // 관찰
    d.obs.forEach((b, i) => {
      const ow = `${id}/obs/${i + 1}`, P = V.obsProperties[b.property];
      if (!P) { E(ow, `관찰 속성 '${b.property}' 은(는) 어휘에 없음`); return; }
      checkContext(b.context, ow, E);
      checkEvidence(b.evidence, ow, E);
      if (P.speciesRequired && !b.context.species) E(ow, `'${b.property}' 는 종에 따라 달라짐 — context.species 필수`);
      if (P.value === 'number' && typeof b.value !== 'number') E(ow, '값은 숫자여야 함');
      if (P.unit && !b.unit) E(ow, '단위(unit) 필요');
      if (P.value === 'location' && !V.locations[b.value]) E(ow, `값 '${b.value}' 은(는) 위치 어휘에 없음`);
      if (Array.isArray(P.value) && !P.value.includes(b.value)) E(ow, `값은 ${P.value.join(' | ')} 중 하나`);
      if (P.value === 'xref') { const x = parseXref(b.value); if (!V.xrefs[x.db] || !new RegExp(V.xrefs[x.db].pattern).test(x.id)) E(ow, `외부 ID '${b.value}' 형식 틀림`); }
    });
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
      if (!site || !site.ligand || !f) continue;
      const on = site.on ? d.components.find((c) => c.ref === site.on) : null;
      entityTally(db, site.ligand, new Map(), mult * (on ? on.n : 1), out, null); // 리간드가 복합체면 그 구성 요소로
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
      if (d.reference_species) d.reference_species = voc('taxa', d.reference_species, id);
      else if (V.kinds[d.kind] && V.kinds[d.kind].species === 'required' && !d._given.reference_species) d.reference_species = V.defaultReferenceSpecies;
      if (d.membrane) {
        d.membrane.association = voc('associations', d.membrane.association, id);
        if (d.membrane.location) d.membrane.location = voc('locations', d.membrane.location, id);
        if (d.membrane.side) d.membrane.side = voc('faces', d.membrane.side, id);
      }
      for (const c of d.components) c.ref = ref(c.ref, `${id} 구성 요소`);
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
    for (const l of Object.values(db.limitations)) { covered.add(l.target); for (const n of l.requirement.needs) if (n.site) covered.add(n.site); }
    const out = [];
    for (const [id, d] of ix.senses) for (const [k, st] of Object.entries(d.site)) if (st.residue_unknown && !covered.has(`${id}/site/${k}`)) out.push({ target: `${id}/site/${k}`, type: 'Structural_Gap', why: `${ix.label(id)} 의 부위 ${k} 잔기 번호 모름` });
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
        if (bulk) { seed(p.b, opt.init[p.b] != null ? opt.init[p.b] : opt.bulk); source[p.b] = opt.init[p.b] != null ? 'init' : 'bulk'; }
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

  // ===== 반응 속도 무결성 (Kinetic Integrity) =====
  // r: 규칙, st: 단계(있으면 화학량까지 검사). 문제 목록(문자열)을 돌려준다.
  function kineticIssues(r, st, kin) {
    const k = kin || r.kinetics, out = [], L = V.kineticLaws[k.law];
    if (!L) return [`반응 속도 법칙 '${k.law}' — ${Object.keys(V.kineticLaws).join(' | ')}`];
    for (const f of L.required) if (!(f.split('|').some((g) => k[g] > 0))) out.push(`${k.law} 는 ${f.split('|').join(' 또는 ')} 가 필요함 (양수, SI 정준 단위)`);
    for (const f of KIN_FIELDS) if (k[f] != null && !(Number.isFinite(k[f]) && (f === 'order' ? k[f] >= 0 : k[f] > 0))) out.push(`${f} 값이 양수가 아님`);
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

  // ===== 속도 기반 시뮬레이션 (Rate-based) =====
  // 농도 = 분자 수 / (N_A × 반응 부피). 속도 법칙: mass_action · binding(가역) · michaelis_menten.
  // 속도 상수가 없는 단계는 '즉시'(사건 기반)로 처리하고 Kinetic_Gap 으로 표시한다.
  // scenario: { name, hypothetical, cell, volumes: { 위치: { value, unit } }, amounts: { 묶음키: 수 }, kinetics: { 'D…/rule/키': {…} } }
  const NA = 6.02214076e23, VOL = { fL: 1e-15, pL: 1e-12, nL: 1e-9, 'µL': 1e-6, uL: 1e-6, L: 1 };
  function simulateRate(db, target, opt) {
    db = normalize(db);
    opt = Object.assign({ t_end: 60, dt: 1e-3, scenario: null, amount: 10 }, opt || {});
    const sc = opt.scenario || {}, ix = index(db), tg = targets(ix, target);
    if (tg.error) return { error: tg.error };
    const base = simulate(db, target, { rounds: 0, init: sc.amounts || {}, cell: sc.cell, amount: opt.amount });
    if (base.error) return base;
    const ids = base.ids, cell = base.cell, audit = [], kineticGaps = [], approx = new Set();
    const AE = (code, where, msg, sug) => audit.push({ code, where, msg, suggestion: sug });
    // 부피: 시나리오 → 구획 농도 모델 관찰 → 없음
    const volOf = (loc) => {
      const v = (sc.volumes || {})[loc];
      if (v && VOL[v.unit]) return { L: v.value * VOL[v.unit], src: 'scenario' };
      const o = Object.values(db.senses).flatMap((x) => x.obs).find((b) => b.property === 'compartment_volume' && b.context.location === loc && (!cell || !b.context.cell || b.context.cell === cell));
      return o && VOL[o.unit] ? { L: o.value * VOL[o.unit], src: 'data' } : null;
    };
    const N = new Map(Object.entries(base.origin)), bulk = new Set(base.bulkSet);
    for (const sid of ids) for (const p of db.steps[sid].outputs) if (!N.has(p.b)) N.set(p.b, 0);
    const kinOf = (sid) => { const ref = db.steps[sid].rule; return (sc.kinetics || {})[ref] ? { ...normKinetics(sc.kinetics[ref]), src: 'scenario' } : ix.ruleOf(ref).kinetics ? { ...ix.ruleOf(ref).kinetics, src: 'data' } : null; };
    const locOf = (b) => b.split('|').pop();
    const react = new Map();
    for (const sid of ids) {
      const st = db.steps[sid], rule = ix.ruleOf(st.rule), k = kinOf(sid);
      const parts = [...st.agents, ...st.inputs, ...st.outputs].filter((p) => !p.minor);
      const loc3 = parts.map((p) => locOf(p.b)).find((l) => V.locations[l] && V.locations[l].dim === '3D');
      if (parts.some((p) => V.locations[locOf(p.b)] && V.locations[locOf(p.b)].dim === '2D')) approx.add(sid);
      const vol = loc3 ? volOf(loc3) : null;
      if (k) { for (const m of kineticIssues(rule, st, k)) AE('AUDIT_KINETIC', `${sid} ${rule.label}`, m, gapSuggest(db, ix, st.rule.split('/')[0], 'Kinetic_Gap')); }
      else kineticGaps.push(sid);
      if (k && !vol) AE('AUDIT_CONCENTRATION', `${sid} ${rule.label}`, `반응 부피(${loc3 ? vlabel('locations', loc3) : '3D 위치 없음'})를 모름 — 속도 법칙을 농도로 계산할 수 없어 즉시 처리함`, gapSuggest(db, ix, tg.ids[0], 'Concentration_Gap'));
      react.set(sid, { st, rule, k: k && vol ? k : null, V: vol ? vol.L : null, loc: loc3 });
    }
    const conc = (b, Vr) => (N.get(b) || 0) / (NA * Vr);
    const tally = () => { const t = {}; for (const [b, n] of N) if (!bulk.has(b) && n) entityTally(db, b.split('|')[0], new Map(parseBundle(b).features.map((f) => [f.site, f.feature])), n, t, null); return t; };
    // 화학 변환이 일어나는 실체(변환 기질·산물, 분해되는 구성 요소)는 보존 검사에서 뺀다
    const changing = new Set();
    for (const sid of ids) { const ru = react.get(sid).rule, e = ru.effect || {}; for (const x of [...(e.consumes || []), ...(e.produces || []), ...(e.component ? [e.component] : []), ...(ru.with ? [...ru.with.consumes, ...ru.with.produces] : [])]) { const t = {}; entityTally(db, x, new Map(), 1, t, null); for (const y of Object.keys(t)) changing.add(y); changing.add(x); } }
    const t0 = tally(), exIn = {}, exOut = {}; // 대사물 풀(열린 저장소)과 주고받은 실체
    const exchange = (b, n, into) => entityTally(db, b.split('|')[0], new Map(parseBundle(b).features.map((f) => [f.site, f.feature])), n, into, null);
    const series = [], firstReach = {};
    const record = (t) => series.push({ t, N: Object.fromEntries([...N].filter(([b]) => !bulk.has(b))) });
    record(0);
    const steps = Math.ceil(opt.t_end / opt.dt), every = Math.max(1, Math.floor(steps / 200));
    for (let i = 1; i <= steps; i++) {
      for (const sid of ids) {
        const { st, k, V: Vr } = react.get(sid);
        const ins = new Map(); for (const p of st.inputs) if (!bulk.has(p.b)) ins.set(p.b, (ins.get(p.b) || 0) + (p.n || 1));
        const outs = new Map(); for (const p of st.outputs) if (!bulk.has(p.b)) outs.set(p.b, (outs.get(p.b) || 0) + (p.n || 1));
        if (!st.agents.every((p) => (N.get(p.b) || 0) > 0)) continue;
        let xi; // 이번 dt 의 반응 진행량 (분자 사건 수)
        // 속도 상수 없음 → 즉시: 입력이 허락하는 만큼 이번 dt 안에 끝냄. 입력이 모두 대사물 풀이면 행위자 수만큼(0차)
        if (!k) { xi = ins.size ? Math.min(...[...ins].map(([b, n]) => (N.get(b) || 0) / n)) : st.agents.length ? Math.min(...st.agents.map((p) => N.get(p.b) || 0)) : 0; }
        else {
          const prodIn = [...ins].reduce((a, [b, n]) => a * conc(b, Vr) ** n, 1), prodOut = [...outs].reduce((a, [b, n]) => a * conc(b, Vr) ** n, 1);
          const agentC = st.agents.reduce((a, p) => a * conc(p.b, Vr), 1);
          let v = 0; // M/s
          if (k.law === 'mass_action') v = k.k * prodIn * agentC - (k.reversible && k.k_r ? k.k_r * prodOut : 0);
          else if (k.law === 'binding') { const kon = k.k_on || (k.k_off && k.Kd ? k.k_off / k.Kd : 0), koff = k.k_off || (k.k_on && k.Kd ? k.k_on * k.Kd : 0); v = kon * prodIn - koff * prodOut; }
          else if (k.law === 'michaelis_menten') { const S = [...ins][0]; const s0 = S ? conc(S[0], Vr) : 1; v = k.kcat * agentC * s0 / (k.Km + s0); }
          xi = v * NA * Vr * opt.dt;
        }
        if (xi > 0) xi = Math.min(xi, ...[...ins].map(([b, n]) => (N.get(b) || 0) / n));
        else if (xi < 0) xi = -Math.min(-xi, ...[...outs].map(([b, n]) => (N.get(b) || 0) / n));
        if (!xi) continue;
        for (const p of st.inputs) if (bulk.has(p.b)) exchange(p.b, (p.n || 1) * xi, xi > 0 ? exIn : exOut);
        for (const p of st.outputs) if (bulk.has(p.b)) exchange(p.b, (p.n || 1) * xi, xi > 0 ? exOut : exIn);
        for (const [b, n] of ins) N.set(b, (N.get(b) || 0) - n * xi);
        for (const [b, n] of outs) { N.set(b, (N.get(b) || 0) + n * xi); if (xi > 0 && (N.get(b) >= 1) && firstReach[b] == null) firstReach[b] = i * opt.dt; }
      }
      if (i % every === 0 || i === steps) record(+(i * opt.dt).toFixed(6));
    }
    // 질량·동일성 보존 (변환되는 실체 제외)
    const t1 = tally();
    for (const e of uniq([...Object.keys(t0), ...Object.keys(t1), ...Object.keys(exIn), ...Object.keys(exOut)])) {
      if (changing.has(e)) continue;
      const a = (t0[e] || 0) + (exIn[e] || 0) - (exOut[e] || 0), b = t1[e] || 0;
      if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a))) AE('AUDIT_MASS', e, `${ix.label(e)}: 시작 ${(t0[e] || 0).toFixed(3)} + 풀에서 들어옴 ${(exIn[e] || 0).toFixed(3)} − 풀로 나감 ${(exOut[e] || 0).toFixed(3)} ≠ 끝 ${b.toFixed(3)} — 보존되어야 하는 실체가 사라지거나 생김`, massSuggest(db, ix, e));
    }
    // 평형 일치: 결합 단계의 Q 와 Kd (순속도가 거의 0 인데 어긋나면 적분 오류)
    for (const sid of ids) {
      const { st, k, V: Vr } = react.get(sid);
      if (!k || k.law !== 'binding') continue;
      const Kd = k.Kd || (k.k_off && k.k_on ? k.k_off / k.k_on : null);
      const ins = st.inputs.filter((p) => !p.minor && !bulk.has(p.b)), outs = st.outputs.filter((p) => !p.minor && !bulk.has(p.b));
      if (!Kd || ins.length !== 2 || outs.length !== 1) continue;
      if (ids.some((o) => o !== sid && [...db.steps[o].inputs, ...db.steps[o].agents].some((p) => p.b === outs[0].b && !p.minor))) continue; // 산물이 하류로 빠지면 평형이 아님
      const Q = conc(ins[0].b, Vr) * conc(ins[1].b, Vr) / Math.max(conc(outs[0].b, Vr), 1e-30);
      if (conc(ins[0].b, Vr) > 0 && conc(ins[1].b, Vr) > 0 && Math.abs(Math.log10(Q / Kd)) > 1) AE('AUDIT_KINETIC', `${sid} ${react.get(sid).rule.label}`, `끝 시점의 [A][B]/[AB] = ${Q.toExponential(2)} M 가 Kd ${Kd.toExponential(2)} M 와 10배 이상 다름 — 아직 평형 전이거나 dt 가 너무 큼`, `t_end 를 늘리거나 dt 를 줄여 다시 실행 (지금 dt ${opt.dt} s)`);
    }
    if (kineticGaps.length) AE('AUDIT_KINETIC_GAP', target, `속도 상수가 없는 단계 ${kineticGaps.length}개를 즉시(사건 기반)로 처리함: ${kineticGaps.join(', ')}`, gapSuggest(db, ix, tg.ids[0], 'Kinetic_Gap'));
    if (approx.size) AE('AUDIT_RESOLUTION', target, `막(2D) 분자가 낀 단계 ${approx.size}개는 인접 3D 부피의 농도로 환산함 (면적 농도 아님): ${[...approx].join(', ')}`, gapSuggest(db, ix, tg.ids[0], 'Concentration_Gap', /2D|면적/));
    return { ids, cell, scenario: sc.name || null, hypothetical: !!sc.hypothetical, series, firstReach, final: Object.fromEntries(N), audit, kineticGaps, react, ix, t_end: opt.t_end, dt: opt.dt };
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
    const ix = r.ix, out = [`속도 기반 시뮬레이션: ${target} — ${r.t_end} s, dt ${r.dt} s${r.cell ? ', 세포 ' + vlabel('cells', r.cell) : ''}${r.scenario ? `, 시나리오 '${r.scenario}'` : ''}`];
    if (r.hypothetical) out.push('  ⚠ 가상 시나리오 값 — 지식이 아니라 엔진 시험용 (data/db.json 에 저장되지 않음)');
    out.push('단계별 속도 법칙:');
    for (const sid of r.ids) { const x = r.react.get(sid); out.push(`  ${sid} ${ix.label(sid)}: ${x.k ? `${x.k.law} [${x.k.src}] ${KIN_FIELDS.filter((f) => x.k[f] != null).map((f) => `${f}=${x.k[f]}`).join(' ')}` : '속도 상수 없음 → 즉시'}${x.V ? ` · 부피 ${(x.V / 1e-15).toPrecision(3)} fL` : ''}`); }
    const keys = Object.keys(r.firstReach).sort((a, b) => r.firstReach[a] - r.firstReach[b]);
    out.push('처음 1분자 이상이 된 시각:', ...keys.map((b) => `  t=${r.firstReach[b].toFixed(3)} s  ${ix.bundleLabel(b)}`));
    out.push('끝 시점 분자 수 (0 아님, 보조 기질 제외):', ...Object.entries(r.final).filter(([b, n]) => n > 1e-9 && n < 900).map(([b, n]) => `  ${n.toFixed(2)}× ${ix.bundleLabel(b)}`));
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
    kineticIssues, resolutionPlan, resolutionText, simulateRate, simulateRateText, auditRun };
});
