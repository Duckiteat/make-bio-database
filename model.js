// 맥락 보존형 생명과학 데이터베이스 — 공유 모델 (형식·정규화·색인·읽기 도구). 세 권력 모두가 읽는 헌법 층 — 시뮬레이션·판정·쓰기를 하지 않는다.
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
//
// 삼권 분립 (docs/design/tripartite-governance.md): model.js 는 어느 권력에도 속하지 않는 공유 정의다.
//   행정(core.js·engine/) · 입법(legislative/) · 사법(judicial/) 이 모두 이것을 읽기만 한다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vocab.js'));
  else root.DefDBModel = factory(root.DefDBVocab);
})(typeof self !== 'undefined' ? self : this, function (V) {
  'use strict';

  const FORMAT = 'definition-db', PATCH_FORMAT = 'definition-db-patch', VERSION = 12;

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
  // 토큰 → 라벨 보기 (표는 vocab: hierarchyUp·hierarchyDown·bundleRoles)
  const labelsOf = (T) => Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.label]));
  const AXIS_UP = labelsOf(V.hierarchyUp);
  const AXIS_DOWN = labelsOf(V.hierarchyDown);
  const ROLE = labelsOf(V.bundleRoles);
  const EFFECT_TYPES = ['modify', 'convert', 'dissociate', 'associate', 'transport', 'transfer', 'degrade'];
  // 동일성 보존을 검사하는 효과 (화학 변환이 없는 물리적 변화)
  const CONSERVING = new Set(['dissociate', 'associate', 'transport', 'transfer', 'degrade']);

  const ID_RE = { T: /^T\d{6}$/, D: /^D\d{6}$/, S: /^S\d{6}$/, L: /^L\d{6}$/, O: /^O\d{6}$/ };
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
    'tissues', 'cells', 'taxa', 'obsProperties', 'evidenceLevels', 'gapTypes', 'kineticLaws', 'lifecycleFates', 'tiers', 'signatureLevels', 'commitmentCriteria',
    'observables', 'uncertaintyKinds', 'noiseModels', 'calibrationKinds', 'obsUses', 'xrefRoles'];
  const VNAME = { kinds: 'kind', fields: '분야(field)', actions: '변화 종류(action)', activity: '활성(activity)', effects: '조절 효과(effect)',
    locations: '위치(location)', faces: '막 면(face)', associations: '막 결합 방식(association)', features: '특징(feature)', siteTypes: '부위 종류',
    tissues: '조직(tissue)', cells: '세포(cell)', taxa: '종(species/taxa)', obsProperties: '관찰 속성(property)', evidenceLevels: '근거 수준', gapTypes: '한계 종류', kineticLaws: '속도 법칙', lifecycleFates: '분해 산물의 운명(fate)', tiers: '층(tier)', signatureLevels: '표지 수준(level)', commitmentCriteria: '결정 기준(criterion)',
    observables: '측정량(observable)', uncertaintyKinds: '불확도 유형', noiseModels: '잡음 모형', calibrationKinds: '보정 종류', obsUses: '관찰 용도(use)', xrefRoles: '외부 ID 역할(role)' };
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
    if (isObj(x)) return { db: str(x.db), id: str(x.id), status: str(x.status) || 'asserted', role: str(x.role) || undefined, note: str(x.note) || undefined };
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
  function emptyDB() { return { format: FORMAT, version: VERSION, meta: { next: { T: 1, D: 1, S: 1, L: 1, O: 1, V: 1 } }, terms: {}, senses: {}, steps: {}, limitations: {}, observations: {}, values: {} }; }
  function normalize(input) {
    const db = emptyDB();
    if (!isObj(input)) return db;
    if (input.version != null && Number(input.version) !== VERSION) Object.defineProperty(db, '_version', { value: Number(input.version) });
    const nx = isObj(input.meta) && isObj(input.meta.next) ? input.meta.next : {};
    for (const p of ['T', 'D', 'S', 'L', 'O', 'V']) db.meta.next[p] = Math.max(1, parseInt(nx[p], 10) || 1);
    for (const [id, t] of Object.entries(isObj(input.terms) ? input.terms : {})) if (isObj(t)) db.terms[id] = normTerm(t);
    for (const [id, d] of Object.entries(isObj(input.senses) ? input.senses : {})) if (isObj(d)) db.senses[id] = normSense(d);
    for (const [id, st] of Object.entries(isObj(input.steps) ? input.steps : {})) if (isObj(st)) db.steps[id] = normStep(st);
    for (const [id, l] of Object.entries(isObj(input.limitations) ? input.limitations : {})) if (isObj(l)) db.limitations[id] = normLimitation(l);
    for (const [id, o] of Object.entries(isObj(input.observations) ? input.observations : {})) if (isObj(o)) db.observations[id] = normObservation(o);
    for (const [id, v] of Object.entries(isObj(input.values) ? input.values : {})) if (isObj(v)) db.values[id] = normValue(v);
    reconcileValues(db, input);
    // 번호 이동 (형식 v12 §6) — 있을 때만 (빈 표를 더하면 기존 db 의 직렬화가 바뀐다)
    if (isObj(input.moved) && Object.keys(input.moved).length) {
      db.moved = {};
      for (const [id, m] of Object.entries(input.moved)) if (isObj(m)) db.moved[id] = { to: arr(m.to).map(str).filter(Boolean), kind: str(m.kind), at: str(m.at), why: str(m.why) };
    }
    return db;
  }
  // 이동된 번호 → 지금 번호들 (사슬을 따라감 — 순환은 사법부가 거부하므로 깊이로 끊는다)
  function followMoved(db, id) {
    const mv = (db && db.moved) || {};
    let ids = [id];
    for (let depth = 0; depth < 32 && ids.some((x) => mv[x]); depth++) ids = uniq(ids.flatMap((x) => (mv[x] ? mv[x].to : [x])));
    return ids;
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
    for (const k of ['species', 'tissue', 'cell', 'location']) if (str(c[k])) o[k] = str(c[k]);
    // condition: 정의항 번호 목록(형식 v12 §5). 문장으로 온 것은 그대로 두어 사법부가 거부하게 한다 (scope 로 옮길 것)
    if (Array.isArray(c.condition)) { if (c.condition.length) o.condition = c.condition.map(str).filter(Boolean); }
    else if (str(c.condition)) o.condition = str(c.condition);
    for (const k of ['temperature_K', 'pH']) if (c[k] != null && c[k] !== '') o[k] = Number(c[k]);
    return o;
  };
  // 맥락 열쇠 (형식 v12 §5): vocab.contextKeys 여섯 칸만, 빈 칸 null, 조건은 정렬 — 키 정렬 JSON 문자열
  const contextKey = (c) => {
    c = isObj(c) ? c : {};
    const o = {};
    for (const k of Object.keys(V.contextKeys).sort()) {
      const v = c[k];
      o[k] = v == null || v === '' ? null : k === 'condition' ? (Array.isArray(v) ? (v.length ? [...v].sort() : null) : v) : v;
    }
    return JSON.stringify(o);
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
    else if (isObj(r.kinetic_law)) o.kinetic_law = normKineticLaw(r.kinetic_law);
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
    // v10: 실측 상수는 관찰 기록의 파생값 — from: [{ param, obs: O… }]. lumped: 매개 단계를 생략해 맞춘 상수(원 관찰 참조 필수, 값 대조 없음)
    if (arr(k.from).length) o.from = arr(k.from).filter(isObj).map((f) => ({ param: str(f.param), obs: str(f.obs) }));
    if (k.lumped) o.lumped = true;
    o.evidence = normEvidence(k.evidence);
    return o;
  }
  const KIN_FIELDS = ['k', 'k_r', 'order', 'k_on', 'k_off', 'Kd', 'kcat', 'Km', 'half_life', 'k0', 'dG_act', 'dG0', 'K', 'n', 'fmax', 'fmin'];
  const SIGNED_KIN = new Set(['dG_act', 'dG0', 'fmin']); // 자유 에너지(J/mol)는 음수일 수 있음 (dG_act 는 음수면 오류)
  const ENV_FIELDS = ['pH_ref', 'dG_dpH', 'eps_ref', 'dG_dinv_eps'];
  function normObs(b) {
    const o = { property: str(b.property), value: typeof b.value === 'number' ? b.value : str(b.value), context: normContext(b.context), evidence: normEvidence(b.evidence) };
    if (str(b.unit)) o.unit = str(b.unit);
    // v11: 측정의 파생값임을 밝히는 관찰 기록 참조 — 사법부가 값·종·세포를 그 관찰과 대조한다
    if (str(b.from)) o.from = str(b.from);
    if (str(b.note)) o.note = str(b.note);
    return o;
  }
  // ===== 값 층 (형식 v12, docs/design/format-v12.md) =====
  // 저장: 값은 db.values(V…)에만 — 정의항 obs 와 규칙 kinetics 의 수치는 여기로 빠지고, 규칙에는 법칙 모양(kinetic_law)만 남는다.
  // 메모리: 정규화가 값 층에서 지금 모양의 obs·kinetics 를 **열거되지 않는 보기**로 다시 붙인다 — 읽는 코드는 그대로, 직렬화(JSON)에는 값 층만.
  // 값은 바꾸지 않는다: 바뀌면 새 기록이 supersedes 로 대체, 빠지면 retracted (legislative merge 의 foldValues).
  const KIN_VALUE_FIELDS = KIN_FIELDS.filter((f) => f !== 'order'); // 차수는 법칙의 구조
  const canonJ = (o) => (Array.isArray(o) ? `[${o.map(canonJ).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonJ(o[k])).join(',')}}` : JSON.stringify(o));
  function normKineticLaw(k) {
    const o = { law: str(k.law) };
    if (k.order != null && k.order !== '') o.order = Number(k.order);
    if (k.reversible) o.reversible = true;
    if (isObj(k.env)) { o.env = {}; for (const f of ENV_FIELDS) if (k.env[f] != null && k.env[f] !== '') o.env[f] = Number(k.env[f]); }
    if (isObj(k.context)) o.context = normContext(k.context);
    if (k.lumped) o.lumped = true;
    o.evidence = normEvidence(k.evidence);
    return o;
  }
  function normValue(v) {
    const x = isObj(v.value) ? v.value : {}, o = { subject: str(v.subject), property: str(v.property), value: { dist: str(x.dist) || 'point' } };
    for (const f of ['mean', 'sd', 'low', 'high']) if (typeof x[f] === 'number') o.value[f] = x[f];
    if (x.level != null) o.value.level = str(x.level);
    if (str(v.unit)) o.unit = str(v.unit);
    if (isObj(v.context)) o.context = normContext(v.context);
    o.evidence = normEvidence(v.evidence);
    if (arr(v.from).length) o.from = arr(v.from).map(str).filter(Boolean);
    o.derivation = str(v.derivation) || 'direct';
    for (const k of ['note', 'evidence_at', 'recorded_at', 'supersedes']) if (str(v[k])) o[k] = str(v[k]);
    if (isObj(v.retracted)) { o.retracted = { note: str(v.retracted.note) }; if (str(v.retracted.at)) o.retracted.at = str(v.retracted.at); if (isObj(v.retracted.evidence)) o.retracted.evidence = normEvidence(v.retracted.evidence); }
    return o;
  }
  // 현재 값 = 철회되지 않았고 다른 기록이 대체하지 않은 기록 (번호 순)
  function currentValues(db) {
    const sup = new Set(Object.values(db.values || {}).map((v) => v.supersedes).filter(Boolean)), m = new Map();
    for (const id of Object.keys(db.values || {}).sort()) {
      const v = db.values[id];
      if (v.retracted || sup.has(id)) continue;
      if (!m.has(v.subject)) m.set(v.subject, []);
      m.get(v.subject).push([id, v]);
    }
    return m;
  }
  // 값 기록 ↔ 지금 모양 (보기)
  const valueOfObs = (sid, o) => {
    const v = { subject: sid, property: o.property, value: typeof o.value === 'number' ? { dist: 'point', mean: o.value } : { dist: 'categorical', level: String(o.value) }, context: o.context, evidence: o.evidence,
      derivation: o.evidence && o.evidence.level === 'computed' ? 'computed' : 'direct' };
    if (o.unit) v.unit = o.unit; if (o.from) v.from = [o.from]; if (o.note) v.note = o.note;
    return normValue(v);
  };
  const obsOfValue = (v) => {
    const o = { property: v.property, value: v.value.dist === 'categorical' ? v.value.level : v.value.mean, context: v.context || { scope: '' }, evidence: v.evidence };
    if (v.unit) o.unit = v.unit; if (v.from && v.from.length) o.from = v.from[0]; if (v.note) o.note = v.note;
    return o;
  };
  const valuesOfKinetics = (ref, k) => KIN_VALUE_FIELDS.filter((f) => k[f] != null).map((f) => {
    const v = { subject: ref, property: f, value: { dist: 'point', mean: k[f] }, evidence: k.evidence, derivation: k.lumped ? 'lumped' : 'direct' };
    if (k.context) v.context = k.context;
    const fr = (k.from || []).filter((x) => x.param === f).map((x) => x.obs); if (fr.length) v.from = fr;
    return normValue(v);
  });
  const lawOfKinetics = (k) => normKineticLaw(k);
  // 규칙에 법칙 모양을 놓는다 — 키 순서를 normRule 과 같게(evidence 앞) 두어 정규화가 멱등이고 직렬화 해시가 안정적이게
  const placeLaw = (r, law) => { const ev = r.evidence; delete r.evidence; delete r.kinetic_law; if (law) r.kinetic_law = law; if (ev !== undefined) r.evidence = ev; };
  function kineticsOf(law, vals) {
    const o = { law: law.law };
    const by = new Map(vals.map(([, v]) => [v.property, v]));
    for (const f of KIN_FIELDS) { if (f === 'order') { if (law.order != null) o.order = law.order; continue; } if (by.has(f)) o[f] = by.get(f).value.mean; }
    if (law.reversible) o.reversible = true;
    if (law.env) o.env = { ...law.env };
    if (law.context) o.context = law.context;
    const from = KIN_FIELDS.flatMap((f) => (by.has(f) && by.get(f).from ? by.get(f).from.map((obs) => ({ param: f, obs })) : []));
    if (from.length) o.from = from;
    if (law.lumped) o.lumped = true;
    o.evidence = law.evidence;
    return o;
  }
  // 두 시간 (형식 v12): 그날 기준의 db — recorded_at ≤ 그날인 기록만으로 현재 값을 다시 계산한다(그 뒤의 대체·철회는 없던 일로)
  function asOf(db, iso) {
    const t = Date.parse(iso), out = normalize(JSON.parse(JSON.stringify(db)));
    for (const [id, v] of Object.entries(out.values)) if (!(Date.parse(v.recorded_at) <= t)) delete out.values[id];
    for (const v of Object.values(out.values)) if (v.retracted && v.retracted.at && !(Date.parse(v.retracted.at) <= t)) delete v.retracted;
    attachViews(out);
    return out;
  }
  const obsKey = (o) => `${o.property}|${canonJ(o.context || {})}|${o.unit || ''}`;
  // 보기 붙이기 (열거되지 않음 — JSON 에는 나가지 않는다)
  function attachViews(db) {
    const cur = currentValues(db), view = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });
    for (const [sid, d] of Object.entries(db.senses)) {
      view(d, 'obs', (cur.get(sid) || []).filter(([, v]) => !KIN_VALUE_FIELDS.includes(v.property) || !v.subject.includes('/rule/')).map(([, v]) => obsOfValue(v)));
      for (const r of d.rule) if (r.kinetic_law) view(r, 'kinetics', kineticsOf(r.kinetic_law, cur.get(`${sid}/rule/${r.id}`) || []));
    }
  }
  // 정규화의 마지막 단계: 입력이 준 obs·kinetics(보기이든 고친 배열이든)를 값 층과 맞춘다.
  //   값 층이 없는 입력(v10 이하) = 처음 옮기기 — 기록을 새로 만든다(recorded_at 은 변환 스크립트가 찍는다).
  //   값 층이 있는데 입력의 보기가 값과 다르면 = 메모리에서 만든 변형(시험) — 같은 열쇠의 기록을 제자리에서 고친다.
  //   실제 병합은 legislative foldValues 가 먼저 대체·철회로 접으므로 여기서는 차이가 없다(관문이 값 불변을 따로 본다).
  function reconcileValues(db, input) {
    const hasValues = isObj(input.values), inSenses = isObj(input.senses) ? input.senses : {};
    const newId = () => fmtId('V', db.meta.next.V++);
    const stampOf = () => Object.values(db.values).map((v) => v.recorded_at).filter(Boolean).sort().pop();
    for (const [sid, d] of Object.entries(db.senses)) {
      const src = inSenses[sid] || {}, givenObs = 'obs' in src;
      const cur = currentValues(db);
      if (givenObs || !hasValues) {
        const built = d.obs || [], derived = (cur.get(sid) || []).filter(([, v]) => !v.subject.includes('/rule/'));
        if (!hasValues) for (const o of built) db.values[newId()] = valueOfObs(sid, o);
        else if (canonJ(built) !== canonJ(derived.map(([, v]) => obsOfValue(v)))) {
          const left = new Map(derived.map(([id, v]) => [obsKey(obsOfValue(v)), id]));
          for (const o of built) { const k = obsKey(o), id = left.get(k); const nv = valueOfObs(sid, o); if (id) { left.delete(k); const keep = db.values[id]; db.values[id] = Object.assign(nv, keep.recorded_at ? { recorded_at: keep.recorded_at } : {}); } else db.values[newId()] = Object.assign(nv, stampOf() ? { recorded_at: stampOf() } : {}); }
          for (const id of left.values()) delete db.values[id];
        }
      }
      delete d.obs;
      const srcRules = new Map(arr(src.rule).filter(isObj).map((r) => [str(r.id), r]));
      for (const r of d.rule) {
        const ref = `${sid}/rule/${r.id}`, sr = srcRules.get(r.id) || {}, givenK = 'kinetics' in sr || !hasValues;
        if (!givenK) continue;
        const k = r.kinetics, curK = (currentValues(db).get(ref) || []);
        delete r.kinetics;
        if (!k) { if (hasValues && 'kinetics' in sr) { delete r.kinetic_law; for (const [id] of curK) delete db.values[id]; } continue; }
        const want = valuesOfKinetics(ref, k);
        placeLaw(r, lawOfKinetics(k));
        if (!hasValues) { for (const v of want) db.values[newId()] = v; continue; }
        if (canonJ(want) === canonJ(curK.map(([, v]) => { const { recorded_at, supersedes, evidence_at, ...rest } = v; return rest; }))) continue;
        const left = new Map(curK.map(([id, v]) => [v.property, id]));
        for (const v of want) { const id = left.get(v.property); if (id) { left.delete(v.property); const keep = db.values[id]; db.values[id] = Object.assign(v, keep.recorded_at ? { recorded_at: keep.recorded_at } : {}); } else db.values[newId()] = Object.assign(v, stampOf() ? { recorded_at: stampOf() } : {}); }
        for (const id of left.values()) delete db.values[id];
      }
    }
    attachViews(db);
  }
  const SENSE_FIELDS = ['kind', 'tier', 'reference_species', 'membrane', 'xrefs', 'unmapped', 'fingerprint', 'components', 'moieties', 'desc', 'site', 'rule', 'obs', 'motif', 'addresses', 'gap_review', 'distinction', 'note', 'signature', 'metabolome', 'transitions', 'mechanisms', 'elements'];
  function normSense(d) {
    const o = { term: str(d.term), n: parseInt(d.n, 10) || 0, kind: str(d.kind) };
    if (str(d.tier)) o.tier = str(d.tier);
    if (str(d.reference_species)) o.reference_species = str(d.reference_species);
    if (isObj(d.membrane)) { o.membrane = { association: str(d.membrane.association) }; for (const k of ['location', 'side']) if (str(d.membrane[k])) o.membrane[k] = str(d.membrane[k]); if (arr(d.membrane.route).length) o.membrane.route = arr(d.membrane.route).map(str).filter(Boolean); }
    o.xrefs = arr(d.xrefs).map(parseXref).map((x) => Object.fromEntries(Object.entries({ db: x.db, id: x.id, status: x.status, role: x.role, note: x.note }).filter(([, v]) => v !== undefined)));
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
    // 기전 프로그램 (MHC 실험): 이 상태에서 돌아가는 경로(kind pathway)들 — 그 경로의 단계(S, part_of)가 운명 IR 의 반응이 된다
    if (arr(d.mechanisms).length) o.mechanisms = arr(d.mechanisms).filter(isObj).map((m) => ({ ref: str(m.ref) }));
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
    // 구조 필드 (16A 가 스키마): 증상(정량 키 → 수) · 막힌 하류(번호) · 재검토 조건(통제 토큰) · 금지된 우회(저장만 — 관문 강제 안 함). requirement.text(R2)는 그대로
    if (isObj(l.symptom)) o.symptom = Object.fromEntries(Object.entries(l.symptom).map(([k, v]) => [str(k), typeof v === 'number' ? v : Number(v)]));
    if (arr(l.downstream_blocked).length) o.downstream_blocked = arr(l.downstream_blocked).map(str);
    if (str(l.resolution_trigger)) o.resolution_trigger = str(l.resolution_trigger);
    if (arr(l.prohibited_bypasses).length) o.prohibited_bypasses = arr(l.prohibited_bypasses).map(str);
    if (isObj(l.resolution)) o.resolution = { note: str(l.resolution.note), evidence: normEvidence(l.resolution.evidence) };
    return o;
  }
  // 관찰 기록 (v10, docs/design/observation-port.md): 실측값은 모델 표현이 아니라 "무엇을 쟀는가"로 — 한 번 들어오면 바뀌지 않는다(철회 표시만)
  const num = (x) => (x == null || x === '' ? undefined : Number(x));
  // 정성 관찰 (형식 v12 §4): 교란 → 읽을 거리 → 기대. 값·단위·불확도 대신 원문 구절과 1차 문헌 출처
  function normQualitative(b) {
    const o = { kind: 'qualitative' };
    if (isObj(b.perturbation)) {
      const p = b.perturbation, q = { type: str(p.type) };
      if (str(p.target)) q.target = str(p.target);
      for (const k of ['Ki_M', 'dose_M', 'conc_M']) if (num(p[k]) !== undefined) q[k] = num(p[k]);
      o.perturbation = q;
    }
    const rd = isObj(b.readout) ? b.readout : {};
    o.readout = { kind: str(rd.kind) };
    if (str(rd.target)) o.readout.target = str(rd.target);
    if (num(rd.instrument_resolution) !== undefined) o.readout.instrument_resolution = num(rd.instrument_resolution);
    if (arr(rd.also).length) o.readout.also = arr(rd.also).map(str);
    o.expect = isObj(b.expect) ? { order: arr(b.expect.order).map(str) } : str(b.expect);
    if (num(b.replicates) !== undefined) o.replicates = num(b.replicates);
    return o;
  }
  function normObservation(b) {
    if (b.kind === 'qualitative') return Object.assign(normQualitative(b), normObsCommon(b));
    const ob = isObj(b.observable) ? b.observable : {};
    const o = { observable: { kind: str(ob.kind), target: str(ob.target) } };
    if (str(ob.param)) o.observable.param = str(ob.param);
    if (arr(ob.also).length) o.observable.also = arr(ob.also).map(str);
    if (str(ob.denominator)) o.observable.denominator = str(ob.denominator);
    if (num(ob.threshold) !== undefined) o.observable.threshold = num(ob.threshold);
    if (isObj(ob.dose)) o.observable.dose = { target: str(ob.dose.target), values: arr(ob.dose.values).map(num) };
    o.value = num(b.value);
    o.unit = str(b.unit);
    const u = isObj(b.uncertainty) ? b.uncertainty : {};
    o.uncertainty = { kind: str(u.kind), model: str(u.model), sd: num(u.sd) };
    if (u.basis !== undefined) o.uncertainty.basis = str(u.basis);
    for (const k of ['precision', 'detection_limit', 'saturation', 'raw']) if (num(b[k]) !== undefined) o[k] = num(b[k]);
    o.replicates = b.replicates === null ? null : num(b.replicates); // null = 원문에 반복 수가 없음(미보고) — 1 로 적지 않는다
    o.condition = normObsCondition(b.condition);
    if (isObj(b.calibration)) {
      const cal = { kind: str(b.calibration.kind) };
      for (const k of ['a', 'b']) if (num(b.calibration[k]) !== undefined) cal[k] = num(b.calibration[k]);
      if (arr(b.calibration.points).length) cal.points = arr(b.calibration.points).map((q) => arr(q).map(Number));
      o.calibration = cal;
    }
    if (str(b.method)) o.method = str(b.method);
    return Object.assign(o, normObsCommon(b));
  }
  // 관찰 조건 = 맥락 열쇠(v12 §5) + 측정 시각·상태 (조건 목록은 끝에 — 기존 기록의 필드 순서 유지)
  function normObsCondition(c) {
    c = isObj(c) ? c : {};
    const o = { species: str(c.species) };
    for (const k of ['location', 'cell']) if (str(c[k])) o[k] = str(c[k]);
    for (const k of ['temperature_K', 'pH', 'time_s']) if (num(c[k]) !== undefined) o[k] = num(c[k]);
    if (arr(c.states).length) o.states = arr(c.states).map(str);
    if (Array.isArray(c.condition)) { if (c.condition.length) o.condition = c.condition.map(str).filter(Boolean); }
    else if (str(c.condition)) o.condition = str(c.condition);
    return o;
  }
  // 두 종류 공통: 조건 · 출처 · 용도 · 근거 · 실험 묶음 · 두 시간 · 철회 (필드 순서는 v10 그대로 — 기존 기록의 직렬화가 바뀌지 않게)
  function normObsCommon(b) {
    const o = {};
    if (b.kind === 'qualitative') { o.condition = normObsCondition(b.condition); if (str(b.quote)) o.quote = str(b.quote); }
    if (isObj(b.provenance)) {
      const pv = {};
      if (str(b.provenance.sha256)) pv.sha256 = str(b.provenance.sha256).toLowerCase();
      if (isObj(b.provenance.source)) pv.source = { db: str(b.provenance.source.db), id: str(b.provenance.source.id) };
      if (Object.keys(pv).length) o.provenance = pv;
    }
    o.use = str(b.use);
    o.evidence = normEvidence(b.evidence);
    if (str(b.experiment)) o.experiment = str(b.experiment);
    for (const k of ['evidence_at', 'recorded_at']) if (str(b[k])) o[k] = str(b[k]);
    if (b.hypothetical) o.hypothetical = true; // 관문이 거부 — 합성 관찰은 examples/ 에만
    if (str(b.note)) o.note = str(b.note);
    if (isObj(b.retracted)) o.retracted = { note: str(b.retracted.note), evidence: normEvidence(b.retracted.evidence) };
    return o;
  }
  // 대상 문자열 → { base: D/S 번호, sub: 'site'|'rule'|null, key }
  function parseTarget(t) {
    const m = String(t || '').match(/^([DS]\d{6})(?:\/(site|rule)\/(.+))?$/);
    return m ? { base: m[1], sub: m[2] || null, key: m[3] || null } : null;
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

  // ===== 참조 매핑 =====
  function resolveRef(ix, ref) {
    const r = str(ref);
    if (!r) return { error: '참조가 비어 있음' };
    if (ix.senses.has(r)) return { id: r, via: 'id' };
    if (/^[TDS]\+/.test(r)) return { error: `임시 번호 '${r}' 가 이 패치 안에 없음` };
    if (ix.db.moved && ix.db.moved[r]) { // 이동된 번호는 따라간다 — 나뉜 번호는 하나를 골라야 한다
      const to = followMoved(ix.db, r), m = ix.db.moved[r];
      if (to.length === 1) { const x = resolveRef(ix, to[0]); return x.error ? x : { id: x.id, via: `이동 ${r} → ${to[0]} (${m.kind})` }; }
      return { error: `${r} 은(는) 나뉘었음 (${m.kind}) — 하나를 지정할 것: ${to.map((x) => `${x}(${ix.label(x)})`).join(', ')}` };
    }
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

  // ===== 열역학 일관성 (형식 v8) =====
  // 전이 상태 이론: k(r) = k0·exp(−(ΔG‡ + ΔG_env(r))/RT). 미시적 가역성: k_f/k_r = exp(−ΔG°/RT) — 환경이 장벽을 옮겨도 이 비는 유지.
  const RT = () => V.thermo.R * V.thermo.T_ref;
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

  function parseLoose(text) {
    const s = String(text).trim();
    try { return JSON.parse(s); } catch (_) { /* 아래에서 다시 시도 */ }
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return JSON.parse(fence[1]);
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('JSON 을 찾을 수 없음');
  }

  // 물리 상수·부피 단위 (SI) — 행정부의 농도 환산과 사법부의 독립 재계산이 같은 정의를 읽는다
  // 부피 환산표는 어휘 하나에서 (vocab.unitFactors.volume) — 엔진·사법부가 같은 계수를 쓴다
  const NA = 6.02214076e23, VOL = V.unitFactors.volume;

  // 속도 법칙의 정의 (행정부 적분과 사법부 재계산이 같은 법칙을 읽는다)
  const SAT_K = 1e-6; // 포화 보조 기질의 수치 포화 상수 (M) — 생물 상수가 아니라 바닥날 때 속도를 매끄럽게 끄는 정칙화 (시나리오 saturation_K 로 바꿈)
  function hillFactor(effect, k, s) {
    const x = s > 0 ? Math.pow(s / k.K, k.n) : 0, occ = x / (1 + x);
    return effect === 'inhibits' ? (k.fmin || 0) + (1 - (k.fmin || 0)) * (1 - occ) : 1 + ((k.fmax || 1) - 1) * occ;
  }

  // 규칙 한 줄 표기 (읽기 전용 렌더러 — 행정부 질의와 사법부 보고서가 함께 쓴다)
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

  // 공급 규칙 목록 · 조절 규칙 색인 (v9) — 엔진·컴파일러가 함께 읽는 순수 색인
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

  return Object.freeze({ VOCAB: V, NA, VOL, SAT_K, hillFactor, ruleLine, SITE_RE, supplyRules, modulationIndex,
    FORMAT, REL, UP_OF, AXIS_UP, AXIS_DOWN, ROLE, labelsOf, EFFECT_TYPES, CONSERVING, ID_RE, fmtId, isId, isTemp,
    isStepId, isObj, clone, str, arr, uniq, RESERVED, RES_RE, MOLECULAR, isParticipantKind, GREEK, normName,
    lev, similar, VTABLES, VNAME, VIX, mapVocab, vlabel, parseXref, xrefKey, xrefLabel, fpKey, locAncestors,
    locSides, sameFamily, locCompatible, taxAncestors, parseBundle, bundleKey, emptyDB, normalize, normTerm, normEvidence, normContext, normDesc,
    normSite, normRule, normKinetics, KIN_FIELDS, SIGNED_KIN, ENV_FIELDS, normObs, SENSE_FIELDS, normSense, normPart, normStep, normNeed,
    normLimitation, normObservation, normValue, contextKey, followMoved, normKineticLaw, currentValues, attachViews, valueOfObs, obsOfValue, valuesOfKinetics, lawOfKinetics, kineticsOf, KIN_VALUE_FIELDS, canonJ, obsKey, placeLaw, asOf, parseTarget, index, lookupName, mechIndex, defaultTier, moietyOf, entityTally, resolveRef, suggest, stepLine, targets,
    chains, MOTIFS, trajectory, RT, sccs, parseLoose, PATCH_FORMAT, VERSION });
});
