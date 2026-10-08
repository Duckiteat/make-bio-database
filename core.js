// 맥락 보존형 생명과학 데이터베이스 — 공용 로직 (브라우저 viewer.html 과 Node dbtool.mjs 가 함께 사용)
//
// 층 구조
//   피정의항(term)    : 정의되는 말. 여러 정의항(뜻)을 가질 수 있다.
//   정의항(definiens) : 뜻 하나. kind(종류)·field(분야)·정의 문장·맥락·연결·외부 ID·상태를 가진다.
//   연결(link)        : 정의항 → 정의항. 같은 말이라도 어느 뜻이 어느 뜻 아래에 있는지가 보존된다.
//   상태(state)       : 분자 정의항의 형태(인산화형, GTP 결합형 …). "정의항id@키" 로 가리킨다.
//   기전 단계(step)   : 행위자(상태)가 입력(상태)을 출력(상태)으로 바꾸는 사건. 출력이 다른 단계의 입력·행위자·조절자와
//                       같은 "정의항@상태" 이면 두 단계는 자동으로 이어진다. 단계는 경로(pathway) 정의항에 part_of 로 묶인다.
//
// 매핑 규칙 (SCHEMA.md 참고)
//   - 저장된 데이터의 모든 참조는 정확한 정의항 id 여야 한다. 이름·별칭·외부 ID 로 들어온 참조는 병합 때 id 로 바뀐다.
//   - 모든 이름(피정의항 label + 별칭)은 정규화했을 때 데이터베이스 전체에서 하나의 피정의항만 가리켜야 한다.
//   - 같은 외부 ID 는 하나의 정의항에만 붙는다.
//   - kind·field·action·위치·활성·수식·효과는 vocab.js 의 값만 쓴다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vocab.js'));
  else root.DefDB = factory(root.DefDBVocab);
})(typeof self !== 'undefined' ? self : this, function (V) {
  'use strict';

  const FORMAT = 'definition-db', PATCH_FORMAT = 'definition-db-patch', VERSION = 2;

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
  const ROLE = { agent: '촉매/행위자', agent_after: '행위자 상태 변화로 생김', input: '소비(입력)', output: '생성(출력)', activator: '활성화 조절', inhibitor: '억제 조절' };

  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const str = (s) => (s == null ? '' : String(s)).normalize('NFC').trim();
  const arr = (a) => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]);
  const uniq = (a) => [...new Set(a)];
  const isTempId = (id) => !id || /#\+/.test(id);
  const isStepId = (id) => /^step:/.test(String(id));
  const isTempStep = (id) => !id || /^step:\+/.test(id);
  const termOfId = (id) => { const s = String(id), i = s.lastIndexOf('#'); return i < 0 ? s : s.slice(0, i); };
  const RESERVED = /[#@|]/;
  const KEY_RE = new RegExp(V.stateKeyPattern), RES_RE = new RegExp(V.residuePattern);
  const MOLECULAR = new Set(V.groups.molecular);
  const isParticipantKind = (k) => !!(V.kinds[k] && V.kinds[k].participant);

  // ===== 이름 정규화: 띄어쓰기·하이픈·괄호·대소문자·그리스 문자 차이를 없앤다 =====
  const GREEK = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'κ': 'kappa', 'μ': 'mu' };
  function normName(s) {
    return String(s || '').normalize('NFKC').toLowerCase()
      .replace(/[αβγδεκμ]/g, (c) => GREEK[c])
      .replace(/[\s\-_·•.,'’"()[\]{}/:]/g, '');
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
  const VIX = {};
  for (const table of ['kinds', 'fields', 'compartments', 'actions', 'activity', 'modifications', 'effects']) {
    const m = new Map();
    for (const [key, v] of Object.entries(V[table])) for (const n of [key, v.label, ...(v.aliases || [])]) if (n) m.set(normName(n), key);
    VIX[table] = m;
  }
  const VNAME = { kinds: 'kind', fields: '분야(field)', compartments: '세포 내 위치(compartment)', actions: '변화 종류(action)', activity: '활성(activity)', modifications: '수식(modification)', effects: '조절 효과(effect)' };
  function mapVocab(table, value) {
    const v = str(value);
    if (!v) return { error: `${VNAME[table]} 없음` };
    if (V[table][v]) return { key: v };
    const key = VIX[table].get(normName(v));
    if (key) return { key, mapped: true };
    const sug = similar(v, Object.keys(V[table]));
    return { error: `${VNAME[table]} '${v}' 은(는) 어휘 목록에 없음 — 가능한 값: ${(sug.length ? sug : Object.keys(V[table])).join(', ')}` };
  }
  function parseXref(x) {
    if (isObj(x)) return { db: str(x.db), id: str(x.id), status: str(x.status) || 'asserted', note: str(x.note) || undefined };
    const s = str(x);
    for (const [db, v] of Object.entries(V.xrefs)) if (new RegExp(v.pattern).test(s)) return { db, id: s, status: 'asserted' };
    const i = s.indexOf(':');
    return i > 0 ? { db: s.slice(0, i), id: s.slice(i + 1), status: 'asserted' } : { db: '', id: s, status: 'asserted' };
  }
  const xrefKey = (x) => `${x.db}:${x.id}`;
  // 화면용: ID 자체에 접두어가 있으면(CHEBI:…, GO:…, EC …) 그대로, 없으면 "UniProt:P06737"
  const xrefLabel = (x) => (/^[A-Z]+[: ]/.test(x.id) ? x.id : `${x.db}:${x.id}`);

  // ===== 정규화 =====
  function emptyDB() { return { format: FORMAT, version: VERSION, terms: {}, steps: {} }; }
  function normalize(input) {
    const db = emptyDB();
    if (!isObj(input)) return db;
    if (input.version != null && Number(input.version) !== VERSION) Object.defineProperty(db, '_version', { value: Number(input.version) });
    for (const [key, t] of Object.entries(isObj(input.terms) ? input.terms : {})) {
      const label = str(key);
      if (label && isObj(t)) db.terms[label] = normTerm(label, t);
    }
    for (const st of stepList(input)) if (st.id && !isTempStep(st.id)) db.steps[st.id] = st;
    return db;
  }
  function normTerm(label, t) {
    const out = { label, aliases: uniq(arr(t.aliases).map(str).filter(Boolean)), definientia: [] };
    if (str(t.note)) out.note = str(t.note);
    for (const d of arr(t.definientia)) if (isObj(d)) out.definientia.push(normDef(d));
    return out;
  }
  function normDef(d) {
    const o = { id: str(d.id), kind: str(d.kind), field: str(d.field), text: str(d.text), context: str(d.context), links: [] };
    for (const l of arr(d.links)) {
      if (!isObj(l)) continue;
      const nl = { to: str(l.to), rel: str(l.rel) };
      if (str(l.span)) nl.span = str(l.span);
      if (str(l.note)) nl.note = str(l.note);
      o.links.push(nl);
    }
    o.xrefs = arr(d.xrefs).map(parseXref).map((x) => (x.note ? x : { db: x.db, id: x.id, status: x.status }));
    if (str(d.unmapped)) o.unmapped = str(d.unmapped);
    o.states = arr(d.states).filter(isObj).map(normState);
    o.examples = arr(d.examples).map(str).filter(Boolean);
    for (const k of ['distinction', 'note', 'source', 'by', 'at']) if (str(d[k])) o[k] = str(d[k]);
    // 패치에서 생략된 필드는 기존 값을 유지하기 위해 표시해 둔다 (JSON 으로 저장되지 않음)
    Object.defineProperty(o, '_given', { value: { states: 'states' in d, xrefs: 'xrefs' in d, unmapped: 'unmapped' in d } });
    return o;
  }
  function normState(s) {
    const o = {
      key: str(s.key), label: str(s.label), aliases: uniq(arr(s.aliases).map(str).filter(Boolean)), activity: str(s.activity) || 'unknown',
      modifications: arr(s.modifications).filter(isObj).map((m) => (str(m.site) ? { type: str(m.type), site: str(m.site) } : { type: str(m.type) })),
      bound: arr(s.bound).map(str).filter(Boolean),
    };
    if (str(s.note)) o.note = str(s.note);
    return o;
  }
  function stepList(input) {
    if (!isObj(input)) return [];
    const raw = Array.isArray(input.steps) ? input.steps
      : isObj(input.steps) ? Object.entries(input.steps).map(([id, st]) => (isObj(st) ? Object.assign({}, st, { id: st.id || id }) : null)) : [];
    return raw.filter(isObj).map(normStep);
  }
  function normPart(p) {
    if (typeof p === 'string') p = { ref: p };
    const o = { ref: str(p && p.ref) };
    if (str(p.state)) o.state = str(p.state);
    if (p.minor) o.minor = true;
    if (str(p.note)) o.note = str(p.note);
    return o;
  }
  function normStep(st) {
    const o = {
      id: str(st.id), label: str(st.label), action: str(st.action), compartment: str(st.compartment), cell: str(st.cell),
      text: str(st.text), context: str(st.context),
      agents: arr(st.agents).map((a) => { const x = normPart(a); if (isObj(a) && str(a.after)) x.after = str(a.after); return x; }).filter((x) => x.ref),
      inputs: arr(st.inputs).map(normPart).filter((x) => x.ref),
      outputs: arr(st.outputs).map(normPart).filter((x) => x.ref),
      regulators: arr(st.regulators).map((r) => { const x = normPart(r); x.effect = str(isObj(r) && r.effect) || 'activates'; return x; }).filter((x) => x.ref),
      part_of: arr(st.part_of).map(str).filter(Boolean),
    };
    if (!o.cell) delete o.cell;
    if (!o.context) delete o.context;
    for (const k of ['source', 'by', 'at']) if (str(st[k])) o[k] = str(st[k]);
    return o;
  }

  // ===== 색인 =====
  function index(db) {
    const defs = new Map(), names = new Map(), xrefs = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const t of Object.values(db.terms)) {
      push(names, normName(t.label), { term: t.label, name: t.label });
      for (const a of t.aliases) push(names, normName(a), { term: t.label, name: a });
      for (const d of t.definientia) {
        defs.set(d.id, { term: t.label, def: d });
        for (const x of d.xrefs) push(xrefs, xrefKey(x), d.id);
      }
    }
    const edges = [];
    for (const { term, def } of defs.values()) def.links.forEach((link, i) => {
      const r = REL[link.rel] || {};
      const e = { from: def.id, fromTerm: term, link, i, target: link.to, status: defs.has(link.to) ? 'ok' : 'missing', rel: link.rel, axis: r.axis || null };
      if (r.axis) { e.child = r.dir === 'up' ? def.id : link.to; e.parent = r.dir === 'up' ? link.to : def.id; }
      edges.push(e);
    });
    const up = new Map(), down = new Map(), side = new Map();
    for (const e of edges) {
      if (e.axis) { push(up, e.child, e); push(down, e.parent, e); }
      else { push(side, e.from, e); if (e.target !== e.from) push(side, e.target, e); }
    }
    const children = (n) => down.get(n) || [];
    const stateOf = (id, key) => { const x = defs.get(id); return x ? x.def.states.find((s) => s.key === key) || null : null; };
    return Object.assign({ defs, names, xrefs, edges, stateOf, parents: (n) => up.get(n) || [], children, sides: (n) => side.get(n) || [] },
      mechIndex(db, children, stateOf));
  }
  const lookupName = (ix, name) => uniq((ix.names.get(normName(name)) || []).map((h) => h.term));

  // ===== 기전 색인: 참여자 열쇠 = "정의항id@상태키" =====
  function mechIndex(db, children, stateOf) {
    const K = (ref, state) => ref + '@' + (state || '');
    const steps = new Map(), byKey = new Map(), byNode = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const st of Object.values(db.steps || {})) {
      const uses = [], makes = [];
      for (const a of st.agents) {
        uses.push({ key: K(a.ref, a.state), role: 'agent', p: a });
        if (a.after && a.after !== (a.state || '')) makes.push({ key: K(a.ref, a.after), role: 'agent_after', p: { ref: a.ref, state: a.after } });
      }
      for (const p of st.inputs) uses.push({ key: K(p.ref, p.state), role: 'input', p });
      for (const p of st.regulators) uses.push({ key: K(p.ref, p.state), role: p.effect === 'inhibits' ? 'inhibitor' : 'activator', p });
      for (const p of st.outputs) makes.push({ key: K(p.ref, p.state), role: 'output', p });
      steps.set(st.id, { step: st, uses, makes });
      for (const u of [...uses, ...makes]) {
        push(byKey, u.key, { id: st.id, role: u.role, p: u.p });
        push(byNode, u.p.ref, { id: st.id, role: u.role, p: u.p, key: u.key });
      }
    }
    const major = (x) => !x.p.minor;
    // 다음 단계: 이 단계가 만든 것(부산물 제외)을 입력·행위자·조절자로 쓰는 단계
    const next = (id) => {
      const r = steps.get(id); if (!r) return [];
      const out = [];
      for (const m of r.makes.filter(major)) for (const u of byKey.get(m.key) || [])
        if (u.id !== id && u.role !== 'output' && u.role !== 'agent_after' && !u.p.minor) out.push({ id: u.id, via: m.key, role: u.role });
      return out;
    };
    // 앞 단계: 이 단계가 쓰는 것(부산물 제외)을 만든 단계
    const prev = (id) => {
      const r = steps.get(id); if (!r) return [];
      const out = [];
      for (const u of r.uses.filter(major)) for (const m of byKey.get(u.key) || [])
        if (m.id !== id && (m.role === 'output' || m.role === 'agent_after') && !m.p.minor) out.push({ id: m.id, via: u.key, role: u.role });
      return out;
    };
    // 이어지는 순서대로 정렬 (순환이 있으면 남은 것은 원래 순서)
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
        for (const n of new Set(next(i).map((x) => x.id))) if (set.has(n) && !done.has(n)) {
          indeg.set(n, indeg.get(n) - 1);
          if (indeg.get(n) <= 0 && !ready.includes(n)) ready.push(n);
        }
      }
      return out;
    };
    // 경로 정의항에 속한 단계: 그 정의항과 part 축 하위 정의항(하위 경로)에 part_of 로 붙은 단계 전부
    const stepsIn = (defId) => {
      const scope = new Set([defId]), queue = [defId];
      while (queue.length) for (const e of children(queue.shift())) if (e.axis === 'part' && !scope.has(e.child)) { scope.add(e.child); queue.push(e.child); }
      return order([...steps.values()].filter((r) => r.step.part_of.some((p) => scope.has(p))).map((r) => r.step.id));
    };
    const roles = (defId) => byNode.get(defId) || [];
    const partName = (p) => {
      const s = p.state ? stateOf(p.ref, p.state) : null;
      return termOfId(p.ref) + (p.state ? `(${s ? s.label : p.state})` : '');
    };
    const keyName = (k) => { const i = k.lastIndexOf('@'); return partName({ ref: k.slice(0, i), state: k.slice(i + 1) }); };
    return { steps, next, prev, stepsIn, order, roles, partName, keyName };
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
  function validate(db) {
    const errors = [], warnings = [];
    const E = (where, msg) => errors.push({ where, msg }), W = (where, msg) => warnings.push({ where, msg });
    if (db._version) E('데이터베이스', `형식 버전 ${db._version} — 버전 ${VERSION} 로 변환해야 함 (migrations/ 참고)`);
    const ix = index(db);
    // 이름 충돌: 정규화한 이름 하나가 두 피정의항을 가리키면 중복 개념일 가능성 → 오류
    for (const hits of ix.names.values()) {
      const terms = uniq(hits.map((h) => h.term));
      if (terms.length > 1) E(terms.join(' / '), `이름 충돌 '${hits.map((h) => h.name).join("' ≈ '")}' — 같은 개념이면 하나로 합치고, 다른 개념이면 이름을 구별해야 함`);
    }
    for (const [k, ids] of ix.xrefs) if (uniq(ids).length > 1) E(uniq(ids).join(' / '), `외부 ID ${k.slice(k.indexOf(':') + 1)} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것`);
    const seen = new Set();
    for (const [key, t] of Object.entries(db.terms)) {
      if (key !== t.label) E(key, `피정의항 키와 label 이 다름 (${t.label})`);
      if (RESERVED.test(key) || isStepId(key)) E(key, "피정의항 이름에 # @ | 를 쓸 수 없고 'step:' 으로 시작할 수 없음");
      for (const a of t.aliases) if (RESERVED.test(a)) E(key, `별칭 '${a}' 에 # @ | 를 쓸 수 없음`);
      if (!t.definientia.length) E(key, '정의항이 없는 피정의항');
      for (const d of t.definientia) {
        const where = d.id || key;
        if (!d.id) { E(key, '정의항 id 없음'); continue; }
        if (termOfId(d.id) !== key || !/^\d+$/.test(d.id.slice(key.length + 1))) E(where, `id 는 '${key}#번호' 형식이어야 함`);
        if (seen.has(d.id)) E(where, '중복 id');
        seen.add(d.id);
        if (!d.text) E(where, '정의 문장(text) 없음');
        if (!d.context) E(where, '맥락(context) 없음');
        if (!V.kinds[d.kind]) E(where, `kind '${d.kind}' 은(는) 어휘 목록에 없음`);
        if (!V.fields[d.field]) E(where, `field '${d.field}' 은(는) 어휘 목록에 없음`);
        const K = V.kinds[d.kind];
        // 외부 ID
        const dbs = new Set();
        for (const x of d.xrefs) {
          const src = V.xrefs[x.db];
          if (!src) { E(where, `외부 ID 종류 '${x.db}' 없음`); continue; }
          if (!new RegExp(src.pattern).test(x.id)) E(where, `${x.db} ID '${x.id}' 형식이 틀림`);
          if (K && !K.xref.allowed.includes(x.db)) E(where, `kind '${d.kind}' 에는 ${x.db} ID 를 붙일 수 없음 (허용: ${K.xref.allowed.join(', ') || '없음'})`);
          if (!V.xrefStatus.includes(x.status)) E(where, `외부 ID 상태 '${x.status}' — ${V.xrefStatus.join(' | ')}`);
          dbs.add(x.db);
        }
        if (K) for (const req of K.xref.required || []) if (!dbs.has(req) && !d.unmapped)
          E(where, `kind '${d.kind}' 는 ${req} ID 가 필요함 — 확실한 ID 를 모르면 unmapped 에 사유를 적을 것 (추측 금지)`);
        // 상태
        if (d.states.length && K && !K.participant) E(where, `kind '${d.kind}' 는 상태를 가질 수 없음 (분자 종류만)`);
        const sk = new Map();
        for (const s of d.states) {
          const sw = `${d.id}@${s.key}`;
          if (!KEY_RE.test(s.key)) E(sw, '상태 키는 영문·숫자·한글·_- 만');
          if (!s.label) E(sw, '상태 이름(label) 없음');
          if (!V.activity[s.activity]) E(sw, `활성 '${s.activity}' 은(는) 어휘 목록에 없음`);
          for (const n of uniq([s.key, s.label, ...s.aliases].map(normName))) {
            if (sk.has(n) && sk.get(n) !== s.key) E(sw, `상태 이름이 상태 '${sk.get(n)}' 와 겹침`);
            sk.set(n, s.key);
          }
          for (const m of s.modifications) {
            if (!V.modifications[m.type]) E(sw, `수식 '${m.type}' 은(는) 어휘 목록에 없음`);
            if (m.site && !RES_RE.test(m.site)) E(sw, `잔기 '${m.site}' 형식 틀림 (예: Ser14)`);
          }
          for (const b of s.bound) {
            const x = ix.defs.get(b);
            if (!x) E(sw, `결합 분자 '${b}' 가 없음`);
            else if (!MOLECULAR.has(x.def.kind)) E(sw, `결합 분자 '${b}' 는 분자 종류가 아님`);
          }
        }
        // 연결
        d.links.forEach((l, i) => {
          const lw = `${where} 연결 ${i + 1}`;
          if (!REL[l.rel]) { E(lw, `알 수 없는 관계 '${l.rel}'`); return; }
          if (l.to === d.id) E(lw, '자기 자신을 가리킴');
          const tg = ix.defs.get(l.to);
          if (!tg) { E(lw, `대상 '${l.to}' 가 정의항 id 가 아니거나 없음`); return; }
          const down = !!UP_OF[l.rel];
          if (V.kinds[d.kind] && V.kinds[tg.def.kind] && !(down ? kindAllowed(l.rel, tg.def.kind, d.kind) : kindAllowed(l.rel, d.kind, tg.def.kind)))
            E(lw, `${l.rel}: kind '${d.kind}' → '${tg.def.kind}' 는 허용되지 않음 (vocab.js relationRules)`);
          if (l.span && !d.text.includes(l.span)) E(lw, `근거 구절 '${l.span}' 이 정의 문장에 없음`);
          if (!l.span && !['contrasts', 'requires'].includes(l.rel)) W(lw, `(→${l.to}) 근거 구절(span) 없음`);
        });
      }
    }
    // 위계 순환
    const parentsOf = new Map();
    for (const e of ix.edges) if (e.axis && e.status === 'ok') { if (!parentsOf.has(e.child)) parentsOf.set(e.child, []); parentsOf.get(e.child).push(e.parent); }
    const state = new Map();
    const dfs = (n, path) => {
      if (state.get(n) === 1) { E(n, '위계 순환: ' + [...path.slice(path.indexOf(n)), n].join(' → ')); return; }
      if (state.get(n) === 2) return;
      state.set(n, 1); path.push(n);
      for (const p of parentsOf.get(n) || []) dfs(p, path);
      path.pop(); state.set(n, 2);
    };
    for (const n of parentsOf.keys()) dfs(n, []);
    // 기전 단계
    for (const [id, st] of Object.entries(db.steps || {})) {
      if (!/^step:\d+$/.test(id)) E(id, "단계 id 는 'step:번호' 형식");
      if (!st.label) E(id, '단계 이름(label) 없음');
      if (!V.actions[st.action]) E(id, `변화 종류 '${st.action}' 은(는) 어휘 목록에 없음`);
      if (!V.compartments[st.compartment]) E(id, `세포 내 위치 '${st.compartment}' 은(는) 어휘 목록에 없음`);
      if (!st.inputs.length && !st.outputs.length && !st.agents.some((a) => a.after)) E(id, '입력·출력이 없음');
      if (!st.part_of.length) E(id, 'part_of 없음 — 어느 경로에 속하는지 적어야 함');
      for (const p of st.part_of) {
        const x = ix.defs.get(p);
        if (!x) E(id, `소속 경로 '${p}' 가 정의항 id 가 아니거나 없음`);
        else if (x.def.kind !== 'pathway') E(id, `소속 '${p}' 의 kind 가 pathway 가 아님 (${x.def.kind})`);
      }
      const chkPart = (p, what) => {
        const x = ix.defs.get(p.ref);
        if (!x) { E(id, `${what} '${p.ref}' 가 정의항 id 가 아니거나 없음`); return; }
        if (!isParticipantKind(x.def.kind)) E(id, `${what} '${p.ref}' 의 kind '${x.def.kind}' 는 참여자가 될 수 없음`);
        for (const [k, label] of [[p.state, '상태'], [p.after, '단계 뒤 상태']]) if (k && !ix.stateOf(p.ref, k))
          E(id, `${what} '${p.ref}' 에 ${label} '${k}' 가 정의되지 않음 (있는 상태: ${x.def.states.map((s) => s.key).join(', ') || '없음'})`);
        if (!p.state && x.def.states.length && !p.minor) E(id, `${what} '${p.ref}' 는 상태가 정의된 분자 — state 를 지정해야 함 (${x.def.states.map((s) => s.key).join(', ')})`);
      };
      st.agents.forEach((p) => chkPart(p, '행위자'));
      st.inputs.forEach((p) => chkPart(p, '입력'));
      st.outputs.forEach((p) => chkPart(p, '출력'));
      st.regulators.forEach((p) => { chkPart(p, '조절자'); if (!V.effects[p.effect]) E(id, `조절 효과 '${p.effect}' 은(는) 어휘 목록에 없음`); });
    }
    return { errors, warnings };
  }

  // ===== 참조 매핑: 이름·별칭·외부 ID → 정의항 id =====
  function resolveRef(ix, ref) {
    const r = str(ref);
    if (!r) return { error: '참조가 비어 있음' };
    if (ix.defs.has(r)) return { id: r, via: 'id' };
    if (isTempId(r)) return { error: `임시 id '${r}' 가 이 패치 안에 없음` };
    if (r.includes('#')) {
      const tp = termOfId(r), hit = lookupName(ix, tp);
      if (hit.length === 1 && ix.defs.has(hit[0] + r.slice(tp.length))) return { id: hit[0] + r.slice(tp.length), via: `별칭 '${tp}'` };
      return { error: `'${r}' 정의항 없음` + suggest(ix, tp) };
    }
    const x = parseXref(r);
    if (x.db && ix.xrefs.has(xrefKey(x))) return { id: ix.xrefs.get(xrefKey(x))[0], via: `외부 ID ${xrefLabel(x)}` };
    const hit = lookupName(ix, r);
    if (hit.length === 1) {
      const ds = [...ix.defs.values()].filter((v) => v.term === hit[0]);
      if (ds.length === 1) return { id: ds[0].def.id, via: `이름 '${r}'` };
      return { error: `'${r}' 은(는) 뜻이 여러 개 — 정의항 id 로 지정할 것: ${ds.map((v) => `${v.def.id}(${v.def.context})`).join(', ')}` };
    }
    return { error: `'${r}' 은(는) 데이터베이스에 없음` + suggest(ix, r) };
  }
  function suggest(ix, name) {
    const all = uniq([...ix.names.values()].flat().map((h) => h.name));
    const s = similar(name, all, 4);
    return s.length ? ` — 비슷한 이름: ${s.join(', ')}` : ' — 새 개념이면 같은 패치에서 만들고 임시 id 로 가리킬 것';
  }
  function resolveState(def, value) {
    const v = str(value), n = normName(v);
    const s = def.states.find((x) => x.key === v) || def.states.find((x) => [x.key, x.label, ...x.aliases].some((y) => normName(y) === n));
    return s ? { key: s.key, mapped: s.key !== v } : { error: `'${def.id}' 에 상태 '${v}' 없음 — 있는 상태: ${def.states.map((x) => `${x.key}(${x.label})`).join(', ') || '없음'}` };
  }

  // ===== 병합 =====
  // 패치: { format, terms:{ 이름:{aliases, note, definientia:[…]} }, states:{ 정의항참조:[상태…] }, steps:[…], remove:[id…] }
  // report.errors 가 비어 있지 않으면 패치를 거부해야 한다(gate 참고).
  function merge(dbIn, patchIn) {
    const db = normalize(clone(dbIn));
    const report = { added: [], updated: [], removed: [], idmap: {}, mapped: [], errors: [] };
    const ERR = (where, msg) => report.errors.push({ where, msg });
    const MAP = (from, to, via) => report.mapped.push({ from, to, via });
    if (!isObj(patchIn)) { ERR('패치', 'JSON 객체가 아님'); return { db, report }; }
    const ix0 = index(db);
    const touched = [], touchedSteps = [];
    // 1. 피정의항: 이미 있는 이름·별칭이면 그 피정의항으로 매핑 (중복 개념 방지)
    for (const [rawKey, rawT] of Object.entries(isObj(patchIn.terms) ? patchIn.terms : {})) {
      if (!isObj(rawT)) { ERR(rawKey, '피정의항 내용이 객체가 아님'); continue; }
      let key = str(rawKey);
      if (!db.terms[key]) {
        const hit = lookupName(ix0, key);
        if (hit.length === 1) { MAP(rawKey, hit[0], '같은 이름·별칭의 기존 피정의항'); key = hit[0]; }
        else if (hit.length > 1) { ERR(rawKey, `이름이 여러 피정의항과 겹침: ${hit.join(', ')}`); continue; }
      }
      const pt = normTerm(key, rawT);
      for (const a of pt.aliases) {
        const hit = lookupName(ix0, a).filter((x) => x !== key);
        if (hit.length) ERR(key, `별칭 '${a}' 은(는) 이미 '${hit.join(', ')}' 의 이름 — 같은 개념이면 그 피정의항을 쓸 것`);
      }
      const t = db.terms[key] || (db.terms[key] = { label: key, aliases: [], definientia: [] });
      t.aliases = uniq([...t.aliases, ...pt.aliases]).filter((a) => a !== key);
      if (pt.note) t.note = pt.note;
      for (const d of pt.definientia) {
        if (isTempId(d.id)) {
          if (t.definientia.length && !d.distinction) {
            ERR(d.id || key, `'${key}' 에는 이미 정의항(${t.definientia.map((x) => x.id).join(', ')})이 있음 — 고치려면 기존 id 를, 새 뜻이면 distinction 에 기존 뜻과의 차이를 적을 것`);
            continue;
          }
          const nid = key + '#' + nextNum(t);
          if (d.id) report.idmap[d.id] = nid;
          d.id = nid; t.definientia.push(d); report.added.push(nid);
        } else {
          const tp = termOfId(d.id);
          if (tp !== key) {
            if (lookupName(ix0, tp).includes(key)) { MAP(d.id, key + d.id.slice(tp.length), `별칭 '${tp}'`); d.id = key + d.id.slice(tp.length); }
            else { ERR(d.id, `'${key}' 아래 정의항인데 id 가 다른 피정의항을 가리킴`); continue; }
          }
          const i = t.definientia.findIndex((x) => x.id === d.id);
          if (i < 0) { ERR(d.id, '없는 id — 새 정의항은 임시 id(피정의항#+1)를 쓸 것'); continue; }
          const old = t.definientia[i];
          for (const k of ['states', 'xrefs', 'unmapped']) if (!d._given[k] && old[k] !== undefined) d[k] = old[k];
          t.definientia[i] = d; report.updated.push(d.id);
        }
        touched.push(d);
      }
    }
    // 2. 기전 단계
    for (const st of stepList(patchIn)) {
      if (isTempStep(st.id)) {
        const nid = 'step:' + nextStepNum(db);
        if (st.id) report.idmap[st.id] = nid;
        st.id = nid; report.added.push(nid);
      } else if (!db.steps[st.id]) { ERR(st.id, '없는 단계 id — 새 단계는 step:+1 같은 임시 id 를 쓸 것'); continue; }
      else report.updated.push(st.id);
      db.steps[st.id] = st; touchedSteps.push(st);
    }
    // 3. 참조 매핑 (임시 id → 실제 id, 이름·별칭·외부 ID → id)
    const ix = index(db);
    const ref = (r, where) => {
      if (report.idmap[r]) return report.idmap[r];
      const x = resolveRef(ix, r);
      if (x.error) { ERR(where, x.error); return r; }
      if (x.via !== 'id') MAP(r, x.id, x.via);
      return x.id;
    };
    for (const d of touched) {
      d.links.forEach((l, i) => { l.to = ref(l.to, `${d.id} 연결 ${i + 1}`); });
      for (const s of d.states) s.bound = s.bound.map((b) => ref(b, `${d.id}@${s.key} 결합 분자`));
    }
    // 4. 상태 추가·수정 (패치의 states 구역): 같은 키면 교체, 새 키면 추가
    for (const [r, list] of Object.entries(isObj(patchIn.states) ? patchIn.states : {})) {
      const id = ref(r, `상태 대상 '${r}'`);
      const x = ix.defs.get(id);
      if (!x) continue;
      for (const s of arr(list).filter(isObj).map(normState)) {
        s.bound = s.bound.map((b) => ref(b, `${id}@${s.key} 결합 분자`));
        const i = x.def.states.findIndex((y) => y.key === s.key);
        if (i >= 0) x.def.states[i] = s; else x.def.states.push(s);
      }
      touched.push(x.def);
      if (!report.added.includes(id) && !report.updated.includes(id)) report.updated.push(id);
    }
    // 5. 어휘 매핑 (별칭 → 표준 키)
    const voc = (table, value, where, set) => {
      const m = mapVocab(table, value);
      if (m.error) ERR(where, m.error);
      else { if (m.mapped) MAP(value, m.key, VNAME[table]); set(m.key); }
    };
    for (const d of uniq(touched)) {
      voc('kinds', d.kind, d.id, (k) => { d.kind = k; });
      voc('fields', d.field, d.id, (k) => { d.field = k; });
      for (const s of d.states) {
        voc('activity', s.activity, `${d.id}@${s.key}`, (k) => { s.activity = k; });
        for (const m of s.modifications) voc('modifications', m.type, `${d.id}@${s.key}`, (k) => { m.type = k; });
      }
    }
    for (const st of touchedSteps) {
      voc('actions', st.action, st.id, (k) => { st.action = k; });
      voc('compartments', st.compartment, st.id, (k) => { st.compartment = k; });
      for (const p of st.regulators) voc('effects', p.effect, st.id, (k) => { p.effect = k; });
      st.part_of = st.part_of.map((p) => ref(p, `${st.id} 소속 경로`));
      // 참여자: 참조 → id, 상태 이름·별칭 → 상태 키
      for (const p of [...st.agents, ...st.inputs, ...st.outputs, ...st.regulators]) {
        p.ref = ref(p.ref, `${st.id} 참여자`);
        const x = ix.defs.get(p.ref);
        if (!x) continue;
        for (const f of ['state', 'after']) if (p[f]) {
          const m = resolveState(x.def, p[f]);
          if (m.error) ERR(st.id, m.error);
          else { if (m.mapped) MAP(p[f], m.key, `${p.ref} 상태`); p[f] = m.key; }
        }
      }
    }
    // 6. 삭제
    for (const id of arr(patchIn.remove).map(str)) {
      if (isStepId(id)) { if (db.steps[id]) { delete db.steps[id]; report.removed.push(id); } else ERR(id, '삭제 대상 없음'); continue; }
      const t = db.terms[termOfId(id)];
      const n = t ? t.definientia.length : 0;
      if (t) t.definientia = t.definientia.filter((d) => d.id !== id);
      if (t && t.definientia.length < n) { report.removed.push(id); if (!t.definientia.length) delete db.terms[t.label]; }
      else ERR(id, '삭제 대상 없음');
    }
    // 삭제된 정의항을 가리키는 연결은 정리한다. 단계·상태가 가리키면 검사에서 오류로 드러난다.
    if (report.removed.length) for (const t of Object.values(db.terms)) for (const d of t.definientia)
      d.links = d.links.filter((l) => !report.removed.includes(l.to));
    return { db, report };
  }
  function nextNum(t) {
    let m = 0;
    for (const d of t.definientia) { const n = parseInt(String(d.id).split('#').pop(), 10); if (n > m) m = n; }
    return m + 1;
  }
  function nextStepNum(db) {
    let m = 0;
    for (const id of Object.keys(db.steps)) { const n = parseInt(id.slice(5), 10); if (n > m) m = n; }
    return m + 1;
  }

  // ===== 관문: 병합 결과를 받아들일지 판단 =====
  // 매핑 오류·검사 오류가 하나라도 있으면 거부. 패치가 새로 만든 경고도 거부(allowWarnings 일 때만 통과).
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

  // ===== 매핑 현황 =====
  function audit(db) {
    db = normalize(db);
    const ix = index(db);
    const byKind = {}, unmapped = [], asserted = [], verified = [], unusedStates = [];
    const used = new Set();
    for (const r of ix.steps.values()) for (const u of [...r.uses, ...r.makes]) used.add(u.key);
    for (const { def } of ix.defs.values()) {
      byKind[def.kind] = (byKind[def.kind] || 0) + 1;
      if (def.unmapped) unmapped.push({ id: def.id, kind: def.kind, reason: def.unmapped });
      for (const x of def.xrefs) (x.status === 'verified' ? verified : asserted).push({ id: def.id, xref: xrefLabel(x) });
      for (const s of def.states) if (!used.has(def.id + '@' + s.key)) unusedStates.push(def.id + '@' + s.key);
    }
    return { byKind, unmapped, asserted, verified, unusedStates };
  }
  function auditText(db) {
    const a = audit(db);
    return [
      '종류별 정의항: ' + Object.entries(a.byKind).sort().map(([k, n]) => `${k} ${n}`).join(', '),
      `외부 ID: 원본과 대조됨 ${a.verified.length}, 대조 안 됨(asserted) ${a.asserted.length}`,
      ...a.asserted.map((x) => `  ? ${x.id} — ${x.xref}`),
      `미매핑(unmapped) ${a.unmapped.length}`,
      ...a.unmapped.map((x) => `  - ${x.id} [${x.kind}]: ${x.reason}`),
      `단계에 쓰이지 않은 상태 ${a.unusedStates.length}` + (a.unusedStates.length ? ': ' + a.unusedStates.join(', ') : ''),
    ].join('\n');
  }
  function mapText(db, query) {
    db = normalize(db);
    const ix = index(db), r = resolveRef(ix, query);
    if (r.error) return r.error;
    const x = ix.defs.get(r.id), d = x.def;
    return [`${query} → ${r.id}  (${r.via})`, `  ${x.term} [${d.kind} · ${d.field}] ${d.text}`,
      d.xrefs.length ? '  외부 ID: ' + d.xrefs.map((y) => `${xrefLabel(y)}(${y.status})`).join(', ') : '',
      d.unmapped ? '  미매핑: ' + d.unmapped : '',
      d.states.length ? '  상태: ' + d.states.map((s) => `${s.key}=${s.label}[${s.activity}]`).join(', ') : ''].filter(Boolean).join('\n');
  }

  // ===== 이전 형식(bionote v3 개념) 변환 — kind·field·context 는 비워 두므로 병합 전에 채워야 한다 =====
  const V3_ROLE = { '상위범주': 'is_a', '구성요소': 'has_part', '조건': 'requires', '대비': 'contrasts', '기능': 'refers', '미정': 'refers' };
  function fromV3(items) {
    const list = [];
    const walk = (o) => { if (!isObj(o)) return; if (o.kind === 'bundle') (o.items || []).forEach(walk); else if (o.title && (o.kind === 'concept' || !o.kind)) list.push(o); };
    (Array.isArray(items) ? items : [items]).forEach(walk);
    const patch = { format: PATCH_FORMAT, version: VERSION, terms: {} };
    for (const c of list) {
      const key = str(c.title);
      patch.terms[key] = {
        definientia: (c.defs || []).map((d, i) => ({
          id: key + '#+' + (i + 1), kind: '', field: '', context: '',
          text: str(d.text).replace(/\[\[([^\]]+)\]\]/g, '$1'),
          links: (d.links || []).map((l) => ({ to: str(l.to), rel: V3_ROLE[l.role] || 'refers', span: str(d.text).includes(l.to) ? str(l.to) : undefined, note: str(l.note) || undefined })),
          examples: (d.examples || []).map((e) => e.text), source: 'bionote v3 변환',
        })),
        note: (c.axioms || []).map((a) => '공리: ' + a.text).join('\n') || undefined,
      };
    }
    return patch;
  }
  const looksV3 = (o) => isObj(o) && (o.kind === 'bundle' || o.kind === 'concept' || (o.title && Array.isArray(o.defs)));
  function ingest(db, obj) { return merge(db, looksV3(obj) || Array.isArray(obj) ? fromV3(obj) : obj); }

  // ===== 사람/AI 가 읽는 텍스트 =====
  function line(ix, id) {
    const x = ix.defs.get(id);
    if (!x) return `[${id}] (없음)`;
    return `[${id}] ${x.term} := ${x.def.text} 〈${x.def.field}${x.def.context && x.def.context !== x.def.field ? ' · ' + x.def.context : ''}〉 {${x.def.kind}}`;
  }
  function stepLine(ix, id) {
    const r = ix.steps.get(id);
    if (!r) return `${id} (없음)`;
    const st = r.step, P = (p) => ix.partName(p) + (p.minor ? '*' : '');
    const ag = st.agents.map((a) => P(a) + (a.after && a.after !== (a.state || '') ? ` ⟹ ${ix.partName({ ref: a.ref, state: a.after })}` : '')).join(', ');
    const rg = st.regulators.map((p) => `${(V.effects[p.effect] || {}).label || p.effect} ${P(p)}`).join(', ');
    return `${id} 「${st.label}」 [${st.action}]${ag ? ` 행위자 ${ag} |` : ''} ${st.inputs.map(P).join(' + ') || '∅'} → ${st.outputs.map(P).join(' + ') || '∅'}`
      + `${rg ? ` | 조절: ${rg}` : ''} 〈${st.compartment}${st.cell ? ' · ' + st.cell : ''}〉`;
  }
  function contextText(db, target, opt) {
    opt = Object.assign({ up: 4, down: 1 }, opt || {});
    db = normalize(db);
    const ix = index(db);
    let ids;
    if (ix.defs.has(target)) ids = [target];
    else if (db.terms[target]) ids = db.terms[target].definientia.map((d) => d.id);
    else {
      const hit = lookupName(ix, target);
      if (hit.length === 1) ids = db.terms[hit[0]].definientia.map((d) => d.id);
      else { const r = resolveRef(ix, target); if (r.error) return r.error; ids = [r.id]; }
    }
    const out = [];
    for (const id of ids) {
      const d = ix.defs.get(id).def;
      out.push(line(ix, id));
      if (d.xrefs.length) out.push('  외부 ID: ' + d.xrefs.map((y) => `${xrefLabel(y)}${y.status === 'verified' ? '' : '(미대조)'}`).join(', '));
      if (d.unmapped) out.push('  미매핑: ' + d.unmapped);
      for (const s of d.states) out.push(`  ◇ 상태 ${s.key} = ${s.label} [${V.activity[s.activity] ? V.activity[s.activity].label : s.activity}]`
        + (s.modifications.length ? ' 수식: ' + s.modifications.map((m) => (V.modifications[m.type] || {}).label + (m.site ? ' ' + m.site : '')).join(', ') : '')
        + (s.bound.length ? ' 결합: ' + s.bound.map(termOfId).join(', ') : ''));
      if (d.examples.length) out.push('  예: ' + d.examples.join(' / '));
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
      for (const ro of ix.roles(id)) out.push(`  ⚙ ${ROLE[ro.role]}${ro.p.state ? ` [${ix.partName(ro.p)}]` : ''}: ${stepLine(ix, ro.id)}`);
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
      const out = [], st = ix.steps.get(target).step;
      const walk = (id, depth, pad, dir, seen) => {
        if (depth >= (dir === 'next' ? opt.down : opt.up)) return;
        for (const n of ix[dir](id)) {
          out.push(`${pad}${dir === 'next' ? '↓' : '↑'} (${ix.keyName(n.via)}) ${stepLine(ix, n.id)}`);
          if (!seen.has(n.id)) walk(n.id, depth + 1, pad + '   ', dir, new Set([...seen, n.id]));
        }
      };
      walk(target, 0, '  ', 'prev', new Set([target]));
      const ups = out.splice(0);
      walk(target, 0, '  ', 'next', new Set([target]));
      return [...(ups.length ? ['앞 단계:', ...ups] : []), '▶ ' + stepLine(ix, target), ...(st.text ? ['  ' + st.text] : []),
        '  소속: ' + st.part_of.join(', '), ...(out.length ? ['다음 단계:', ...out] : [])].join('\n');
    }
    let ids = ix.defs.has(target) ? [target] : db.terms[target] ? db.terms[target].definientia.map((d) => d.id) : [];
    if (!ids.length) { const hit = lookupName(ix, target); if (hit.length === 1) ids = db.terms[hit[0]].definientia.map((d) => d.id); }
    const out = [];
    for (const id of ids) {
      const list = ix.stepsIn(id);
      if (!list.length) continue;
      out.push(line(ix, id));
      list.forEach((sid, i) => {
        out.push(`  ${i + 1}. ${stepLine(ix, sid)}`);
        const nx = ix.next(sid);
        if (nx.length) out.push(`       → ${nx.map((n) => `${n.id} (${ix.keyName(n.via)})`).join(', ')}`);
      });
      out.push('');
    }
    return out.length ? out.join('\n').trimEnd() : `'${target}' 에 속한 기전 단계가 없습니다.`;
  }

  // ===== AI 에게 줄 작성 지침 =====
  const vocabList = (table, withLabel) => Object.entries(V[table]).map(([k, v]) => (withLabel && v.label ? `${k}(${v.label})` : k)).join(', ');
  function promptText(db, opt) {
    db = normalize(db);
    opt = opt || {};
    const ix = index(db);
    const idx = [];
    for (const t of Object.values(db.terms).sort((a, b) => a.label.localeCompare(b.label))) {
      const al = t.aliases.length ? ` (별칭: ${t.aliases.join(', ')})` : '';
      for (const d of t.definientia) {
        const st = d.states.length ? ` | 상태: ${d.states.map((s) => `${s.key}=${s.label}`).join(', ')}` : '';
        idx.push(`${d.id}${al} | ${d.kind} | ${d.field} · ${d.context} | ${d.text.length > 50 ? d.text.slice(0, 50) + '…' : d.text}${st}`);
      }
    }
    const kinds = Object.entries(V.kinds).map(([k, v]) => `  - ${k}: ${v.label}${v.participant ? ' [참여자·상태 가능]' : ''}`
      + `${(v.xref.required || []).length ? ` [필수 ID: ${v.xref.required.join(', ')}]` : ''}${v.xref.allowed.length ? ` (허용 ID: ${v.xref.allowed.join(', ')})` : ''}`).join('\n');
    const rules = Object.entries(V.relationRules).map(([rel, r]) => (typeof r === 'string' ? `  - ${rel}: ${r.slice(1)} 와 같음`
      : `  - ${rel}: ` + Object.entries(r).map(([k, v]) => `${k}→${v.map((x) => (x === '=' ? '같은 kind' : x === '@molecular' ? '분자 종류' : x)).join('/')}`).join('; '))).join('\n');
    const stepIdx = [...ix.steps.keys()].map((id) => stepLine(ix, id));
    return `너는 "맥락 보존형 생명과학 데이터베이스"에 항목을 추가하는 작성자다. 아래 자료를 읽고 패치 JSON 하나만 출력하라.
규칙은 엄격하게 검사되며, 하나라도 어기면 패치 전체가 거부된다.

## 데이터 모델
- 피정의항(terms 의 키): 정의되는 말. 별칭(aliases)에 영어·다른 표기를 넣는다.
- 정의항(definientia): 뜻 하나. 같은 말이라도 분야·관점이 다르면 정의항을 따로 둔다.
  - id: 새 정의항은 "피정의항#+1" 같은 임시 id. 기존 정의항을 고칠 때만 기존 id (정의항 전체가 교체됨 — 연결·예시도 다시 적을 것. states·xrefs·unmapped 는 생략하면 유지).
  - kind (필수, 아래 목록), field (필수, 아래 목록), text (정의 문장 하나), context (이 정의가 성립하는 범위, 필수)
  - links: [{ to, rel, span, note }] — to 는 정의항 id 또는 같은 패치의 임시 id. span 은 정의 문장 속 근거 구절(원문 그대로).
  - xrefs: [{ db, id }] 외부 ID. 확실히 아는 것만 — 추측 금지. 형식: ChEBI "CHEBI:15422", UniProt "P06737", EC "EC 2.7.11.11", GO "GO:0007165".
  - unmapped: kind 가 필수 ID 를 요구하는데 확실한 ID 를 모르면 그 사유.
  - states: 분자 종류만. [{ key, label, aliases, activity, modifications:[{type, site}], bound:[정의항 id], note }]
  - distinction: 이미 정의항이 있는 피정의항에 새 뜻을 추가할 때 필수 — 기존 뜻과 무엇이 다른지.
  - examples, note, source, by(작성 AI), at(YYYY-MM-DD)
- 기전 단계(steps): 행위자가 입력을 출력으로 바꾸는 사건 하나.
  - id "step:+1" …, label, action(목록), compartment(목록), cell(세포 종류, 선택), text(설명)
  - agents [{ ref, state, after }], inputs / outputs [{ ref, state, minor }], regulators [{ ref, state, effect }], part_of [경로 정의항 id]
  - ref 는 정의항 id. state·after 는 그 정의항에 정의된 상태 키. 상태가 정의된 분자를 쓸 때는 state 필수 (minor 부산물 제외).
  - 한 단계의 출력(정의항+상태)이 다른 단계의 입력·행위자·조절자와 같으면 자동으로 이어진다.
  - part_of 대상은 kind 가 pathway 인 정의항. 작은 경로는 큰 경로와 part_of/has_part 로 잇는다.
- 기존 분자에 상태만 추가할 때는 패치의 "states" 구역: { "정의항id": [상태…] } (같은 키면 교체).

## 어휘 (이 값만 허용)
- kind:
${kinds}
- field: ${vocabList('fields')}
- action: ${vocabList('actions')}
- compartment: ${vocabList('compartments')}
- activity: ${vocabList('activity', true)}
- modification type: ${vocabList('modifications', true)} (site 는 Ser14 처럼 세 글자 약어+번호)
- effect: ${vocabList('effects', true)}
- 관계 rel: ${Object.entries(REL).map(([k, r]) => `${k}(${r.label})`).join(', ')}
- 관계의 kind 제약 (원천 kind → 대상 kind):
${rules}

## 엄격 규칙
1. 아래 색인에 있는 개념은 새로 만들지 말고 그 id 를 쓴다. 이름·별칭이 기존 것과 겹치는 새 피정의항은 기존 것으로 합쳐지거나 거부된다
   (띄어쓰기·하이픈·괄호·대소문자·그리스 문자 차이는 같은 이름으로 본다).
2. 같은 외부 ID 를 두 정의항에 붙일 수 없다.
3. 인산화형·활성형 같은 변화는 새 피정의항이 아니라 상태(state)로 표현한다.
4. 정의 문장에 쓰인 핵심 개념이 색인에 없으면 같은 패치에서 만들고 임시 id 로 연결한다.
5. 자료에 없는 내용을 지어내지 말고, 불확실하면 note 에 적는다.
6. 출력은 JSON 하나만.

## 출력 형식
{ "format": "definition-db-patch", "version": ${VERSION},
  "terms": { "이름": { "aliases": [], "definientia": [ { "id": "이름#+1", "kind": "", "field": "", "text": "", "context": "", "links": [], "xrefs": [], "states": [] } ] } },
  "states": {}, "steps": [], "remove": [] }

## 현재 색인 (id | kind | 분야·맥락 | 정의 앞부분 | 상태)
${idx.length ? idx.join('\n') : '(비어 있음)'}

## 기존 기전 단계 (* = 부산물)
${stepIdx.length ? stepIdx.join('\n') : '(없음)'}

## 자료
${opt.material || '(여기에 정리할 자료를 붙여 넣으세요)'}
`;
  }

  // AI 응답에서 JSON 만 꺼낸다(코드 펜스나 앞뒤 설명이 붙어 와도 처리)
  function parseLoose(text) {
    const s = String(text).trim();
    try { return JSON.parse(s); } catch (_) { /* 아래에서 다시 시도 */ }
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return JSON.parse(fence[1]);
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('JSON 을 찾을 수 없음');
  }

  return { FORMAT, PATCH_FORMAT, VERSION, VOCAB: V, REL, AXIS_UP, AXIS_DOWN, ROLE, emptyDB, normalize, normName, index, validate, merge, gate, ingest, fromV3,
    resolveRef, mapVocab, audit, auditText, mapText, contextText, mechanismText, stepLine, promptText, parseLoose, termOfId, isStepId, xrefKey, xrefLabel };
});
