// 맥락 보존형 생명과학 데이터베이스 — 공용 로직 (브라우저 viewer.html 과 Node dbtool.mjs 가 함께 사용)
//
// 식별자 (형식 v3): 모든 연결은 의미 없는 고정 번호로만 한다. 이름은 번호에 붙는 꼬리표다.
//   T000001  피정의항(개념) — names {ko, en}, aliases
//   D000001  정의항(뜻)     — term(T…), n(그 개념 안의 뜻 번호), kind·field·정의 문장·맥락·연결·외부 ID·지문·상태
//   D000001@a 상태          — 분자 정의항의 형태(인산화형, GTP 결합형 …)
//   S000001  기전 단계      — 행위자(상태)가 입력(상태)을 출력(상태)으로 바꾸는 사건
//   번호는 meta.next 로만 배정하고 다시 쓰지 않는다. 이름을 바꿔도 번호와 연결은 그대로다.
//   사람·AI 는 "글리코겐 인산화효소", "효소#2", "CHEBI:15422" 처럼 불러도 된다 — 병합 때 번호로 매핑된다.
//
// 매핑 규칙 (SCHEMA.md)
//   - 저장된 데이터의 모든 참조는 정의항 번호(D…)다.
//   - 정규화한 이름(ko·en·별칭) 하나는 개념 하나만 가리킨다. 같은 외부 ID·같은 지문은 정의항 하나에만 붙는다.
//   - kind·field·action·위치·활성·수식·효과는 vocab.js 의 값만 쓴다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vocab.js'));
  else root.DefDB = factory(root.DefDBVocab);
})(typeof self !== 'undefined' ? self : this, function (V) {
  'use strict';

  const FORMAT = 'definition-db', PATCH_FORMAT = 'definition-db-patch', VERSION = 3;

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

  const ID_RE = { T: /^T\d{6}$/, D: /^D\d{6}$/, S: /^S\d{6}$/ };
  const fmtId = (p, n) => p + String(n).padStart(6, '0');
  const isId = (p, id) => ID_RE[p].test(String(id));
  const isTemp = (p, id) => !id || new RegExp('^' + p + '\\+').test(String(id));
  const isStepId = (id) => isId('S', id);

  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const str = (s) => (s == null ? '' : String(s)).normalize('NFC').trim();
  const arr = (a) => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]);
  const uniq = (a) => [...new Set(a)];
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
  const xrefLabel = (x) => (/^[A-Z]+[: ]/.test(x.id) ? x.id : `${x.db}:${x.id}`);
  const fpKey = (f) => `${f.scheme}:${f.value}`;

  // ===== 정규화 =====
  function emptyDB() { return { format: FORMAT, version: VERSION, meta: { next: { T: 1, D: 1, S: 1 } }, terms: {}, senses: {}, steps: {} }; }
  function normalize(input) {
    const db = emptyDB();
    if (!isObj(input)) return db;
    if (input.version != null && Number(input.version) !== VERSION) Object.defineProperty(db, '_version', { value: Number(input.version) });
    const nx = isObj(input.meta) && isObj(input.meta.next) ? input.meta.next : {};
    for (const p of ['T', 'D', 'S']) db.meta.next[p] = Math.max(1, parseInt(nx[p], 10) || 1);
    for (const [id, t] of Object.entries(isObj(input.terms) ? input.terms : {})) if (isObj(t)) db.terms[id] = normTerm(t);
    for (const [id, d] of Object.entries(isObj(input.senses) ? input.senses : {})) if (isObj(d)) db.senses[id] = normSense(d);
    for (const [id, st] of Object.entries(isObj(input.steps) ? input.steps : {})) if (isObj(st)) db.steps[id] = normStep(st);
    return db;
  }
  function normNames(n) {
    const o = { ko: str(isObj(n) ? n.ko : n) };
    if (isObj(n) && str(n.en)) o.en = str(n.en);
    return o;
  }
  function normTerm(t) {
    const o = { names: normNames(t.names), aliases: uniq(arr(t.aliases).map(str).filter(Boolean)) };
    if (str(t.note)) o.note = str(t.note);
    return o;
  }
  function normSense(d) {
    const o = { term: str(d.term), n: parseInt(d.n, 10) || 0, kind: str(d.kind), field: str(d.field), text: str(d.text), context: str(d.context), links: [] };
    for (const l of arr(d.links)) {
      if (!isObj(l)) continue;
      const nl = { to: str(l.to), rel: str(l.rel) };
      if (str(l.span)) nl.span = str(l.span);
      if (str(l.note)) nl.note = str(l.note);
      o.links.push(nl);
    }
    o.xrefs = arr(d.xrefs).map(parseXref).map((x) => (x.note ? x : { db: x.db, id: x.id, status: x.status }));
    if (str(d.unmapped)) o.unmapped = str(d.unmapped);
    if (isObj(d.fingerprint) && str(d.fingerprint.value)) o.fingerprint = { scheme: str(d.fingerprint.scheme), value: str(d.fingerprint.value), status: str(d.fingerprint.status) || 'asserted' };
    o.states = arr(d.states).filter(isObj).map(normState);
    o.examples = arr(d.examples).map(str).filter(Boolean);
    for (const k of ['distinction', 'note', 'source', 'by', 'at']) if (str(d[k])) o[k] = str(d[k]);
    // 패치에서 생략된 필드는 기존 값을 유지하기 위한 표시 (JSON 으로 저장되지 않음)
    Object.defineProperty(o, '_given', { value: { states: 'states' in d, xrefs: 'xrefs' in d, unmapped: 'unmapped' in d, fingerprint: 'fingerprint' in d } });
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
      label: str(st.label), action: str(st.action), compartment: str(st.compartment), cell: str(st.cell), text: str(st.text), context: str(st.context),
      agents: arr(st.agents).map((a) => { const x = normPart(a); if (isObj(a) && str(a.after)) x.after = str(a.after); return x; }).filter((x) => x.ref),
      inputs: arr(st.inputs).map(normPart).filter((x) => x.ref),
      outputs: arr(st.outputs).map(normPart).filter((x) => x.ref),
      regulators: arr(st.regulators).map((r) => { const x = normPart(r); x.effect = str(isObj(r) && r.effect) || 'activates'; return x; }).filter((x) => x.ref),
      part_of: arr(st.part_of).map(str).filter(Boolean),
    };
    for (const k of ['cell', 'context']) if (!o[k]) delete o[k];
    for (const k of ['source', 'by', 'at']) if (str(st[k])) o[k] = str(st[k]);
    return o;
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
    // 사람용 꼬리표: 뜻이 하나면 "이름", 여러 개면 "이름#n"
    const label = (id) => {
      if (db.senses[id]) { const d = db.senses[id], many = (termSenses.get(d.term) || []).length > 1; return termName(d.term) + (many ? '#' + d.n : ''); }
      if (db.terms[id]) return termName(id);
      if (db.steps[id]) return db.steps[id].label;
      return id;
    };
    const edges = [];
    for (const [id, d] of senses) d.links.forEach((link, i) => {
      const r = REL[link.rel] || {};
      const e = { from: id, link, i, target: link.to, status: senses.has(link.to) ? 'ok' : 'missing', rel: link.rel, axis: r.axis || null };
      if (r.axis) { e.child = r.dir === 'up' ? id : link.to; e.parent = r.dir === 'up' ? link.to : id; }
      edges.push(e);
    });
    const up = new Map(), down = new Map(), side = new Map();
    for (const e of edges) {
      if (e.axis) { push(up, e.child, e); push(down, e.parent, e); }
      else { push(side, e.from, e); if (e.target !== e.from) push(side, e.target, e); }
    }
    const children = (n) => down.get(n) || [];
    const stateOf = (id, key) => { const d = senses.get(id); return d ? d.states.find((s) => s.key === key) || null : null; };
    return Object.assign({ db, senses, termSenses, names, xrefs, fps, edges, stateOf, label, termName,
      parents: (n) => up.get(n) || [], children, sides: (n) => side.get(n) || [] }, mechIndex(db, children, stateOf, label));
  }
  const lookupName = (ix, name) => uniq((ix.names.get(normName(name)) || []).map((h) => h.term));

  // ===== 기전 색인: 참여자 열쇠 = "D…@상태키" =====
  function mechIndex(db, children, stateOf, label) {
    const K = (ref, state) => ref + '@' + (state || '');
    const steps = new Map(), byKey = new Map(), byNode = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const [id, st] of Object.entries(db.steps)) {
      const uses = [], makes = [];
      for (const a of st.agents) {
        uses.push({ key: K(a.ref, a.state), role: 'agent', p: a });
        if (a.after && a.after !== (a.state || '')) makes.push({ key: K(a.ref, a.after), role: 'agent_after', p: { ref: a.ref, state: a.after } });
      }
      for (const p of st.inputs) uses.push({ key: K(p.ref, p.state), role: 'input', p });
      for (const p of st.regulators) uses.push({ key: K(p.ref, p.state), role: p.effect === 'inhibits' ? 'inhibitor' : 'activator', p });
      for (const p of st.outputs) makes.push({ key: K(p.ref, p.state), role: 'output', p });
      steps.set(id, { id, step: st, uses, makes });
      for (const u of [...uses, ...makes]) {
        push(byKey, u.key, { id, role: u.role, p: u.p });
        push(byNode, u.p.ref, { id, role: u.role, p: u.p, key: u.key });
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
      return order([...steps.values()].filter((r) => r.step.part_of.some((p) => scope.has(p))).map((r) => r.id));
    };
    const roles = (defId) => byNode.get(defId) || [];
    const partName = (p) => {
      const s = p.state ? stateOf(p.ref, p.state) : null;
      return label(p.ref) + (p.state ? `(${s ? s.label : p.state})` : '');
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
    const ix = index(db), L = ix.label;
    // 번호 배정기: 다음 번호가 이미 쓰인 번호보다 커야 한다 (재사용 금지)
    for (const [p, table] of [['T', db.terms], ['D', db.senses], ['S', db.steps]]) {
      const max = Math.max(0, ...Object.keys(table).map((id) => parseInt(id.slice(1), 10) || 0));
      if (db.meta.next[p] <= max) E('meta.next', `${p} 다음 번호(${db.meta.next[p]})가 이미 쓰인 번호(${max}) 이하 — 번호 재사용 위험`);
    }
    // 이름 충돌
    for (const hits of ix.names.values()) {
      const terms = uniq(hits.map((h) => h.term));
      if (terms.length > 1) E(terms.map((t) => `${t}(${ix.termName(t)})`).join(' / '), `이름 충돌 '${hits.map((h) => h.name).join("' ≈ '")}' — 같은 개념이면 합치고, 다른 개념이면 이름을 구별해야 함`);
    }
    for (const [k, ids] of ix.xrefs) if (uniq(ids).length > 1) E(uniq(ids).join(' / '), `외부 ID ${k.slice(k.indexOf(':') + 1)} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것`);
    for (const [k, ids] of ix.fps) if (uniq(ids).length > 1) E(uniq(ids).join(' / '), `구조 지문 ${k} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것`);
    // 개념
    for (const [tid, t] of Object.entries(db.terms)) {
      const w = `${tid}(${t.names.ko || '?'})`;
      if (!isId('T', tid)) E(tid, "개념 번호는 'T' + 숫자 6자리");
      if (!t.names.ko) E(w, '한국어 이름(names.ko) 없음');
      for (const n of [t.names.ko, t.names.en, ...t.aliases].filter(Boolean)) if (RESERVED.test(n)) E(w, `이름 '${n}' 에 # @ | 를 쓸 수 없음`);
      if (!ix.termSenses.get(tid).length) E(w, '정의항(뜻)이 없는 개념');
    }
    // 정의항
    for (const [id, d] of Object.entries(db.senses)) {
      const where = `${id}(${L(id)})`;
      if (!isId('D', id)) E(id, "정의항 번호는 'D' + 숫자 6자리");
      if (!db.terms[d.term]) E(where, `소속 개념 '${d.term}' 없음`);
      if (!(d.n >= 1)) E(where, '뜻 번호(n) 없음');
      else if ((ix.termSenses.get(d.term) || []).filter((x) => db.senses[x].n === d.n).length > 1) E(where, `같은 개념 안에 뜻 번호 ${d.n} 이 겹침`);
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
      // 구조 지문
      if (d.fingerprint) {
        const f = d.fingerprint, sc = V.fingerprints[f.scheme];
        if (!sc) E(where, `지문 방식 '${f.scheme}' 없음 (허용: ${Object.keys(V.fingerprints).join(', ')})`);
        else {
          if (!new RegExp(sc.pattern).test(f.value)) E(where, `${f.scheme} 지문 '${f.value}' 형식이 틀림`);
          if (!sc.kinds.includes(d.kind)) E(where, `kind '${d.kind}' 에는 ${f.scheme} 지문을 붙일 수 없음`);
        }
        if (!V.fingerprintStatus.includes(f.status)) E(where, `지문 상태 '${f.status}' — ${V.fingerprintStatus.join(' | ')}`);
      }
      // 상태
      if (d.states.length && K && !K.participant) E(where, `kind '${d.kind}' 는 상태를 가질 수 없음 (분자 종류만)`);
      const sk = new Map();
      for (const s of d.states) {
        const sw = `${id}@${s.key}(${L(id)})`;
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
          const x = db.senses[b];
          if (!x) E(sw, `결합 분자 '${b}' 가 없음`);
          else if (!MOLECULAR.has(x.kind)) E(sw, `결합 분자 '${b}' 는 분자 종류가 아님`);
        }
      }
      // 연결
      d.links.forEach((l, i) => {
        const lw = `${where} 연결 ${i + 1}`;
        if (!REL[l.rel]) { E(lw, `알 수 없는 관계 '${l.rel}'`); return; }
        if (l.to === id) E(lw, '자기 자신을 가리킴');
        const tg = db.senses[l.to];
        if (!tg) { E(lw, `대상 '${l.to}' 가 정의항 번호가 아니거나 없음`); return; }
        const down = !!UP_OF[l.rel];
        if (V.kinds[d.kind] && V.kinds[tg.kind] && !(down ? kindAllowed(l.rel, tg.kind, d.kind) : kindAllowed(l.rel, d.kind, tg.kind)))
          E(lw, `${l.rel}: kind '${d.kind}' → '${tg.kind}'(${L(l.to)}) 는 허용되지 않음 (vocab.js relationRules)`);
        if (l.span && !d.text.includes(l.span)) E(lw, `근거 구절 '${l.span}' 이 정의 문장에 없음`);
        if (!l.span && !['contrasts', 'requires'].includes(l.rel)) W(lw, `(→${L(l.to)}) 근거 구절(span) 없음`);
      });
    }
    // 위계 순환
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
    // 기전 단계
    for (const [id, st] of Object.entries(db.steps)) {
      const where = `${id}(${st.label || '?'})`;
      if (!isStepId(id)) E(id, "단계 번호는 'S' + 숫자 6자리");
      if (!st.label) E(where, '단계 이름(label) 없음');
      if (!V.actions[st.action]) E(where, `변화 종류 '${st.action}' 은(는) 어휘 목록에 없음`);
      if (!V.compartments[st.compartment]) E(where, `세포 내 위치 '${st.compartment}' 은(는) 어휘 목록에 없음`);
      if (!st.inputs.length && !st.outputs.length && !st.agents.some((a) => a.after)) E(where, '입력·출력이 없음');
      if (!st.part_of.length) E(where, 'part_of 없음 — 어느 경로에 속하는지 적어야 함');
      for (const p of st.part_of) {
        const x = db.senses[p];
        if (!x) E(where, `소속 경로 '${p}' 가 정의항 번호가 아니거나 없음`);
        else if (x.kind !== 'pathway') E(where, `소속 '${L(p)}' 의 kind 가 pathway 가 아님 (${x.kind})`);
      }
      const chkPart = (p, what) => {
        const x = db.senses[p.ref];
        if (!x) { E(where, `${what} '${p.ref}' 가 정의항 번호가 아니거나 없음`); return; }
        if (!isParticipantKind(x.kind)) E(where, `${what} '${L(p.ref)}' 의 kind '${x.kind}' 는 참여자가 될 수 없음`);
        for (const [k, nm] of [[p.state, '상태'], [p.after, '단계 뒤 상태']]) if (k && !ix.stateOf(p.ref, k))
          E(where, `${what} '${L(p.ref)}' 에 ${nm} '${k}' 가 정의되지 않음 (있는 상태: ${x.states.map((s) => s.key).join(', ') || '없음'})`);
        if (!p.state && x.states.length && !p.minor) E(where, `${what} '${L(p.ref)}' 는 상태가 정의된 분자 — state 를 지정해야 함 (${x.states.map((s) => s.key).join(', ')})`);
      };
      st.agents.forEach((p) => chkPart(p, '행위자'));
      st.inputs.forEach((p) => chkPart(p, '입력'));
      st.outputs.forEach((p) => chkPart(p, '출력'));
      st.regulators.forEach((p) => { chkPart(p, '조절자'); if (!V.effects[p.effect]) E(where, `조절 효과 '${p.effect}' 은(는) 어휘 목록에 없음`); });
    }
    return { errors, warnings };
  }

  // ===== 참조 매핑: 번호·"이름#n"·이름·별칭·외부 ID·지문 → 정의항 번호 =====
  function resolveRef(ix, ref) {
    const r = str(ref);
    if (!r) return { error: '참조가 비어 있음' };
    if (ix.senses.has(r)) return { id: r, via: 'id' };
    if (/^[TDS]\+/.test(r)) return { error: `임시 번호 '${r}' 가 이 패치 안에 없음` };
    if (isId('D', r)) return { error: `정의항 ${r} 없음` };
    const fromTerm = (tid, via) => {
      const ds = ix.termSenses.get(tid) || [];
      if (ds.length === 1) return { id: ds[0], via };
      return { error: `'${r}' 은(는) 뜻이 여러 개 — 하나를 지정할 것: ${ds.map((x) => `${x}(${ix.label(x)}: ${ix.senses.get(x).context})`).join(', ')}` };
    };
    if (isId('T', r)) return ix.db.terms[r] ? fromTerm(r, `개념 ${r}`) : { error: `개념 ${r} 없음` };
    if (r.includes('#')) {
      const i = r.lastIndexOf('#'), name = r.slice(0, i), n = parseInt(r.slice(i + 1), 10);
      const hit = lookupName(ix, name);
      if (hit.length === 1) {
        const id = (ix.termSenses.get(hit[0]) || []).find((x) => ix.senses.get(x).n === n);
        if (id) return { id, via: `'${r}'` };
      }
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
    const all = uniq([...ix.names.values()].flat().map((h) => h.name));
    const s = similar(name, all, 4);
    return s.length ? ` — 비슷한 이름: ${s.join(', ')}` : ' — 새 개념이면 같은 패치에서 만들고 임시 번호로 가리킬 것';
  }
  function resolveState(ix, defId, value) {
    const d = ix.senses.get(defId), v = str(value), n = normName(v);
    const s = d.states.find((x) => x.key === v) || d.states.find((x) => [x.key, x.label, ...x.aliases].some((y) => normName(y) === n));
    return s ? { key: s.key, mapped: s.key !== v } : { error: `'${ix.label(defId)}'(${defId}) 에 상태 '${v}' 없음 — 있는 상태: ${d.states.map((x) => `${x.key}(${x.label})`).join(', ') || '없음'}` };
  }

  // ===== 병합 =====
  // 패치(v3): { terms:[{id?, names:{ko,en}, aliases, note}], senses:[{id?, term, kind, field, text, context, links, …}],
  //            states:{ 정의항참조:[상태…] }, steps:[{id?, …}], remove:[번호…] }
  //   새 항목 id 는 비우거나 "T+1"·"D+gp"·"S+1" 같은 임시 번호. 기존 번호를 쓰면 수정.
  //   sense.term 은 개념 번호, 임시 번호, 또는 이름(없으면 그 이름으로 개념을 새로 만든다).
  function merge(dbIn, patchIn) {
    const db = normalize(clone(dbIn));
    const report = { added: [], updated: [], removed: [], idmap: {}, mapped: [], errors: [] };
    const ERR = (where, msg) => report.errors.push({ where, msg });
    const MAP = (from, to, via) => report.mapped.push({ from, to, via });
    if (!isObj(patchIn)) { ERR('패치', 'JSON 객체가 아님'); return { db, report }; }
    if (isObj(patchIn.terms) || patchIn.definientia) { ERR('패치', '형식 v2 패치 — terms 는 배열, 뜻은 senses 배열로 써야 함 (prompt 참고)'); return { db, report }; }
    const alloc = (p) => fmtId(p, db.meta.next[p]++);
    const ix0 = index(db);
    const preSenses = new Map([...ix0.termSenses].map(([k, v]) => [k, v.length]));
    const nameOwner = new Map();   // 이 패치에서 새로 생긴 이름 → 개념 (패치 안 중복 방지)
    const findTerm = (name) => { const h = lookupName(ix0, name); return h.length ? h : nameOwner.has(normName(name)) ? [nameOwner.get(normName(name))] : []; };
    const claimNames = (tid, t) => {
      for (const n of [t.names.ko, t.names.en, ...t.aliases].filter(Boolean)) {
        const owner = findTerm(n).filter((x) => x !== tid);
        if (owner.length) ERR(`${tid}(${t.names.ko})`, `이름 '${n}' 은(는) 이미 ${owner.map((o) => `${o}(${db.terms[o].names.ko})`).join(', ')} 의 이름 — 같은 개념이면 그 개념을 쓸 것`);
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
        if (pt.names.ko && pt.names.ko !== t.names.ko) t.aliases.push(t.names.ko);   // 이름을 바꾸면 옛 이름은 별칭으로 남긴다
        t.names = { ...t.names, ...Object.fromEntries(Object.entries(pt.names).filter(([, v]) => v)) };
        t.aliases = uniq([...t.aliases, ...pt.aliases]).filter((a) => a !== t.names.ko && a !== t.names.en);
        if (pt.note) t.note = pt.note;
        claimNames(rid, { names: t.names, aliases: pt.aliases });
        report.updated.push(rid);
        continue;
      }
      if (!pt.names.ko) { ERR(rid || 'terms', '새 개념에 names.ko 가 없음'); continue; }
      const same = uniq([pt.names.ko, pt.names.en].filter(Boolean).flatMap((n) => lookupName(ix0, n)));
      if (same.length === 1) {   // 이미 있는 이름 → 그 개념으로 매핑, 새 별칭·영문명만 더한다
        const tid = same[0], t = db.terms[tid];
        MAP(pt.names.ko, tid, '같은 이름의 기존 개념');
        if (rid) report.idmap[rid] = tid;
        if (pt.names.en && !t.names.en) t.names.en = pt.names.en;
        const extra = uniq([pt.names.ko, pt.names.en, ...pt.aliases].filter((n) => n && !lookupName(ix0, n).includes(tid)));
        claimNames(tid, { names: {}, aliases: extra });
        t.aliases = uniq([...t.aliases, ...extra]).filter((a) => a !== t.names.ko && a !== t.names.en);
        continue;
      }
      if (same.length > 1) { ERR(pt.names.ko, `이름이 여러 개념과 겹침: ${same.join(', ')}`); continue; }
      const tid = alloc('T');
      if (rid) report.idmap[rid] = tid;
      db.terms[tid] = pt;
      claimNames(tid, pt);
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
      if (RESERVED.test(r)) { ERR(where, `이름 '${r}' 에 # @ | 를 쓸 수 없음`); return null; }
      const tid = alloc('T');   // 이름만 적은 새 개념
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
        d.term = old.term; d.n = old.n;
        for (const k of ['states', 'xrefs', 'unmapped', 'fingerprint']) if (!d._given[k] && old[k] !== undefined) d[k] = old[k];
        db.senses[rid] = d; report.updated.push(rid); touched.push([rid, d]);
        continue;
      }
      const tid = termOf(raw.term, rid || 'senses');
      if (!tid) continue;
      if (preSenses.get(tid) && !d.distinction) {
        ERR(rid || tid, `'${db.terms[tid].names.ko}'(${tid}) 에는 이미 뜻이 있음 (${ix0.termSenses.get(tid).map((x) => `${x}: ${ix0.senses.get(x).text.slice(0, 20)}…`).join(' / ')}) — 고치려면 기존 번호를, 새 뜻이면 distinction 에 차이를 적을 것`);
        continue;
      }
      d.term = tid;
      d.n = 1 + Math.max(0, ...Object.values(db.senses).filter((x) => x.term === tid).map((x) => x.n));
      const id = alloc('D');
      if (rid) report.idmap[rid] = id;
      db.senses[id] = d; report.added.push(id); touched.push([id, d]);
    }
    // 3. 기전 단계
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
    // 4. 참조 매핑
    const ix = index(db);
    const ref = (r, where) => {
      if (report.idmap[r]) return report.idmap[r];
      const x = resolveRef(ix, r);
      if (x.error) { ERR(where, x.error); return r; }
      if (x.via !== 'id') MAP(r, x.id, x.via);
      return x.id;
    };
    for (const [id, d] of touched) {
      d.links.forEach((l, i) => { l.to = ref(l.to, `${id} 연결 ${i + 1}`); });
      for (const s of d.states) s.bound = s.bound.map((b) => ref(b, `${id}@${s.key} 결합 분자`));
    }
    // 5. 상태 추가·수정 (패치의 states 구역)
    for (const [r, list] of Object.entries(isObj(patchIn.states) ? patchIn.states : {})) {
      const id = ref(r, `상태 대상 '${r}'`), d = db.senses[id];
      if (!d) continue;
      for (const s of arr(list).filter(isObj).map(normState)) {
        s.bound = s.bound.map((b) => ref(b, `${id}@${s.key} 결합 분자`));
        const i = d.states.findIndex((y) => y.key === s.key);
        if (i >= 0) d.states[i] = s; else d.states.push(s);
      }
      touched.push([id, d]);
      if (!report.added.includes(id) && !report.updated.includes(id)) report.updated.push(id);
    }
    // 6. 어휘 매핑
    const voc = (table, value, where, set) => {
      const m = mapVocab(table, value);
      if (m.error) ERR(where, m.error);
      else { if (m.mapped) MAP(value, m.key, VNAME[table]); set(m.key); }
    };
    for (const [id, d] of new Map(touched)) {
      voc('kinds', d.kind, id, (k) => { d.kind = k; });
      voc('fields', d.field, id, (k) => { d.field = k; });
      for (const s of d.states) {
        voc('activity', s.activity, `${id}@${s.key}`, (k) => { s.activity = k; });
        for (const m of s.modifications) voc('modifications', m.type, `${id}@${s.key}`, (k) => { m.type = k; });
      }
    }
    for (const [id, st] of touchedSteps) {
      voc('actions', st.action, id, (k) => { st.action = k; });
      voc('compartments', st.compartment, id, (k) => { st.compartment = k; });
      for (const p of st.regulators) voc('effects', p.effect, id, (k) => { p.effect = k; });
      st.part_of = st.part_of.map((p) => ref(p, `${id} 소속 경로`));
      for (const p of [...st.agents, ...st.inputs, ...st.outputs, ...st.regulators]) {
        p.ref = ref(p.ref, `${id} 참여자`);
        if (!ix.senses.has(p.ref)) continue;
        for (const f of ['state', 'after']) if (p[f]) {
          const m = resolveState(ix, p.ref, p[f]);
          if (m.error) ERR(id, m.error);
          else { if (m.mapped) MAP(p[f], m.key, `${ix.label(p.ref)} 상태`); p[f] = m.key; }
        }
      }
    }
    // 7. 삭제 (번호는 다시 쓰지 않는다)
    const gone = new Set();
    for (const r of arr(patchIn.remove).map(str)) {
      if (db.steps[r]) { delete db.steps[r]; report.removed.push(r); continue; }
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
    // 삭제된 정의항을 가리키는 연결은 정리한다. 단계·상태가 가리키면 검사에서 오류로 드러난다.
    if (gone.size) for (const d of Object.values(db.senses)) d.links = d.links.filter((l) => !gone.has(l.to));
    return { db, report };
  }

  // ===== 관문: 매핑·검사 오류가 하나라도 있거나 새 경고가 생기면 거부 (allowWarnings 일 때만 경고 통과) =====
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
    const byKind = {}, unmapped = [], asserted = [], verified = [], unusedStates = [], fingerprints = { with: 0, without: [] };
    const used = new Set();
    for (const r of ix.steps.values()) for (const u of [...r.uses, ...r.makes]) used.add(u.key);
    for (const [id, d] of ix.senses) {
      byKind[d.kind] = (byKind[d.kind] || 0) + 1;
      if (d.unmapped) unmapped.push({ id, label: ix.label(id), kind: d.kind, reason: d.unmapped });
      for (const x of d.xrefs) (x.status === 'verified' ? verified : asserted).push({ id, label: ix.label(id), xref: xrefLabel(x) });
      for (const s of d.states) if (!used.has(id + '@' + s.key)) unusedStates.push(`${id}@${s.key}`);
      const canFp = Object.values(V.fingerprints).some((f) => f.kinds.includes(d.kind));
      if (d.fingerprint) fingerprints.with++; else if (canFp) fingerprints.without.push(`${id}(${ix.label(id)})`);
    }
    return { byKind, unmapped, asserted, verified, unusedStates, fingerprints };
  }
  function auditText(db) {
    const a = audit(db);
    return [
      '종류별 정의항: ' + Object.entries(a.byKind).sort().map(([k, n]) => `${k} ${n}`).join(', '),
      `외부 ID: 원본과 대조됨 ${a.verified.length}, 대조 안 됨(asserted) ${a.asserted.length}`,
      ...a.asserted.map((x) => `  ? ${x.id} ${x.label} — ${x.xref}`),
      `미매핑(unmapped) ${a.unmapped.length}`,
      ...a.unmapped.map((x) => `  - ${x.id} ${x.label} [${x.kind}]: ${x.reason}`),
      `구조 지문: 있음 ${a.fingerprints.with}, 지문을 가질 수 있는데 없음 ${a.fingerprints.without.length}` + (a.fingerprints.without.length ? ` (${a.fingerprints.without.join(', ')})` : ''),
      `단계에 쓰이지 않은 상태 ${a.unusedStates.length}` + (a.unusedStates.length ? ': ' + a.unusedStates.join(', ') : ''),
    ].join('\n');
  }
  function mapText(db, query) {
    db = normalize(db);
    const ix = index(db), r = resolveRef(ix, query);
    if (r.error) return r.error;
    const d = ix.senses.get(r.id), t = db.terms[d.term];
    return [`${query} → ${r.id}  (${r.via})`,
      `  ${ix.label(r.id)}  개념 ${d.term} · 뜻 ${d.n} [${d.kind} · ${d.field}] ${d.text}`,
      `  이름: ${t.names.ko}${t.names.en ? ' / ' + t.names.en : ''}${t.aliases.length ? ' · 별칭 ' + t.aliases.join(', ') : ''}`,
      d.xrefs.length ? '  외부 ID: ' + d.xrefs.map((y) => `${xrefLabel(y)}(${y.status})`).join(', ') : '',
      d.fingerprint ? `  지문: ${d.fingerprint.scheme} ${d.fingerprint.value} (${d.fingerprint.status})` : '',
      d.unmapped ? '  미매핑: ' + d.unmapped : '',
      d.states.length ? '  상태: ' + d.states.map((s) => `${s.key}=${s.label}[${s.activity}]`).join(', ') : ''].filter(Boolean).join('\n');
  }

  // ===== 이전 형식(bionote v3 개념) 변환 — kind·field·context 는 비워 두므로 병합 전에 채워야 한다 =====
  const V3_ROLE = { '상위범주': 'is_a', '구성요소': 'has_part', '조건': 'requires', '대비': 'contrasts', '기능': 'refers', '미정': 'refers' };
  function fromBionote(items) {
    const list = [];
    const walk = (o) => { if (!isObj(o)) return; if (o.kind === 'bundle') (o.items || []).forEach(walk); else if (o.title && (o.kind === 'concept' || !o.kind)) list.push(o); };
    (Array.isArray(items) ? items : [items]).forEach(walk);
    const patch = { format: PATCH_FORMAT, version: VERSION, terms: [], senses: [] };
    list.forEach((c, ci) => {
      const tid = `T+${ci + 1}`;
      patch.terms.push({ id: tid, names: { ko: str(c.title) }, note: (c.axioms || []).map((a) => '공리: ' + a.text).join('\n') || undefined });
      (c.defs || []).forEach((d) => patch.senses.push({
        term: tid, kind: '', field: '', context: '', text: str(d.text).replace(/\[\[([^\]]+)\]\]/g, '$1'),
        links: (d.links || []).map((l) => ({ to: str(l.to), rel: V3_ROLE[l.role] || 'refers', span: str(d.text).includes(l.to) ? str(l.to) : undefined, note: str(l.note) || undefined })),
        examples: (d.examples || []).map((e) => e.text), source: 'bionote v3 변환',
      }));
    });
    return patch;
  }
  const looksBionote = (o) => isObj(o) && (o.kind === 'bundle' || o.kind === 'concept' || (o.title && Array.isArray(o.defs)));
  function ingest(db, obj) { return merge(db, looksBionote(obj) || Array.isArray(obj) ? fromBionote(obj) : obj); }

  // ===== 사람/AI 가 읽는 텍스트 =====
  function line(ix, id) {
    const d = ix.senses.get(id);
    if (!d) return `[${id}] (없음)`;
    return `[${id} ${ix.label(id)}] ${d.text} 〈${d.field}${d.context && d.context !== d.field ? ' · ' + d.context : ''}〉 {${d.kind}}`;
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
  // 대상(번호·이름·"이름#n"·외부 ID)을 정의항 번호 목록으로
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
    const out = [];
    for (const id of tg.ids) {
      const d = ix.senses.get(id), t = db.terms[d.term];
      out.push(line(ix, id));
      out.push(`  개념 ${d.term}: ${t.names.ko}${t.names.en ? ' / ' + t.names.en : ''}${t.aliases.length ? ' · 별칭 ' + t.aliases.join(', ') : ''}`);
      if (d.xrefs.length) out.push('  외부 ID: ' + d.xrefs.map((y) => `${xrefLabel(y)}${y.status === 'verified' ? '' : '(미대조)'}`).join(', '));
      if (d.fingerprint) out.push(`  지문: ${d.fingerprint.scheme} ${d.fingerprint.value}`);
      if (d.unmapped) out.push('  미매핑: ' + d.unmapped);
      for (const s of d.states) out.push(`  ◇ 상태 ${id}@${s.key} = ${s.label} [${V.activity[s.activity] ? V.activity[s.activity].label : s.activity}]`
        + (s.modifications.length ? ' 수식: ' + s.modifications.map((m) => (V.modifications[m.type] || {}).label + (m.site ? ' ' + m.site : '')).join(', ') : '')
        + (s.bound.length ? ' 결합: ' + s.bound.map(ix.label).join(', ') : ''));
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
    for (const [tid, t] of Object.entries(db.terms).sort((a, b) => a[1].names.ko.localeCompare(b[1].names.ko))) {
      const nm = `${t.names.en ? ' / ' + t.names.en : ''}${t.aliases.length ? ' (별칭: ' + t.aliases.join(', ') + ')' : ''}`;
      for (const id of ix.termSenses.get(tid)) {
        const d = ix.senses.get(id);
        const st = d.states.length ? ` | 상태: ${d.states.map((s) => `${s.key}=${s.label}`).join(', ')}` : '';
        idx.push(`${id} ${ix.label(id)}${nm} | ${tid} | ${d.kind} | ${d.field} · ${d.context} | ${d.text.length > 50 ? d.text.slice(0, 50) + '…' : d.text}${st}`);
      }
    }
    const kinds = Object.entries(V.kinds).map(([k, v]) => `  - ${k}: ${v.label}${v.participant ? ' [참여자·상태 가능]' : ''}`
      + `${(v.xref.required || []).length ? ` [필수 ID: ${v.xref.required.join(', ')}]` : ''}${v.xref.allowed.length ? ` (허용 ID: ${v.xref.allowed.join(', ')})` : ''}`).join('\n');
    const rules = Object.entries(V.relationRules).map(([rel, r]) => (typeof r === 'string' ? `  - ${rel}: ${r.slice(1)} 와 같음`
      : `  - ${rel}: ` + Object.entries(r).map(([k, v]) => `${k}→${v.map((x) => (x === '=' ? '같은 kind' : x === '@molecular' ? '분자 종류' : x)).join('/')}`).join('; '))).join('\n');
    const stepIdx = [...ix.steps.keys()].map((id) => stepLine(ix, id));
    return `너는 "맥락 보존형 생명과학 데이터베이스"에 항목을 추가하는 작성자다. 아래 자료를 읽고 패치 JSON 하나만 출력하라.
규칙은 엄격하게 검사되며, 하나라도 어기면 패치 전체가 거부된다.

## 식별자
- 모든 항목은 의미 없는 고정 번호를 가진다: 개념 T000001, 정의항(뜻) D000001, 기전 단계 S000001, 상태는 D000001@키.
- 새 항목은 id 를 비우거나 임시 번호("T+1", "D+1", "S+1", "D+gp" 등)를 쓴다. 병합 때 실제 번호가 배정되고, 패치 안의 임시 번호 참조도 함께 바뀐다.
- 참조(to, ref, term, part_of, bound)는 아래 색인의 번호를 쓰는 것이 원칙이다. 이름, "이름#뜻번호"(예: 효소#2), 외부 ID(CHEBI:15422)로 써도 번호로 매핑되지만, 뜻이 여러 개인 이름은 거부된다.

## 데이터 모델
- terms: [{ id, names: { ko, en }, aliases, note }] — 개념. ko 필수, en 권장. 기존 개념을 고칠 때만 기존 T 번호.
- senses: [{ id, term, kind, field, text, context, links, xrefs, unmapped, states, distinction, examples, note, source, by, at }] — 뜻 하나.
  - term: 개념 번호(T…), 같은 패치의 임시 번호, 또는 이름(없는 이름이면 그 이름으로 개념이 새로 생김).
  - kind·field 필수(아래 어휘), text 는 정의 문장 하나, context 는 이 정의가 성립하는 범위(필수).
  - links: [{ to, rel, span, note }] — span 은 정의 문장 속 근거 구절(원문 그대로).
  - xrefs: [{ db, id }] — 확실히 아는 것만. 추측 금지. 형식: ChEBI "CHEBI:15422", UniProt "P06737", EC "EC 2.7.11.11", GO "GO:0007165".
  - unmapped: kind 가 필수 ID 를 요구하는데 확실한 ID 를 모를 때 그 사유.
  - states: 분자 종류만. [{ key, label, aliases, activity, modifications:[{type, site}], bound:[정의항 참조], note }]
  - distinction: 이미 뜻이 있는 개념에 새 뜻을 더할 때 필수 — 기존 뜻과의 차이.
  - 기존 정의항을 고칠 때만 기존 D 번호 (정의항 전체 교체 — 연결·예시도 다시 적을 것. states·xrefs·unmapped 는 생략하면 유지).
- states: { "정의항 참조": [상태…] } — 기존 분자에 상태만 추가·교체.
- steps: [{ id, label, action, compartment, cell, text, agents:[{ref, state, after}], inputs/outputs:[{ref, state, minor}], regulators:[{ref, state, effect}], part_of:[경로 정의항] }]
  - state·after 는 그 정의항에 정의된 상태(키 또는 이름). 상태가 정의된 분자는 state 필수(minor 부산물 제외).
  - 한 단계의 출력(정의항+상태)이 다른 단계의 입력·행위자·조절자와 같으면 자동으로 이어진다.
  - part_of 대상은 kind 가 pathway 인 정의항.
- remove: [번호…]

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
1. 색인에 있는 개념은 새로 만들지 말고 그 번호를 쓴다. 이름(ko·en·별칭)이 기존 것과 겹치면 기존 개념으로 합쳐지거나 거부된다
   (띄어쓰기·하이픈·괄호·대소문자·그리스 문자 차이는 같은 이름으로 본다).
2. 같은 외부 ID 를 두 정의항에 붙일 수 없다.
3. 인산화형·활성형 같은 변화는 새 개념이 아니라 상태(state)로 표현한다.
4. 정의 문장에 쓰인 핵심 개념이 색인에 없으면 같은 패치에서 만들고 임시 번호로 연결한다.
5. 자료에 없는 내용을 지어내지 말고, 불확실하면 note 에 적는다.
6. 출력은 JSON 하나만.

## 출력 형식
{ "format": "definition-db-patch", "version": ${VERSION},
  "terms": [ { "id": "T+1", "names": { "ko": "", "en": "" }, "aliases": [] } ],
  "senses": [ { "id": "D+1", "term": "T+1", "kind": "", "field": "", "text": "", "context": "", "links": [], "xrefs": [], "states": [] } ],
  "states": {}, "steps": [], "remove": [] }

## 현재 색인 (정의항 번호 꼬리표 / 영문 (별칭) | 개념 번호 | kind | 분야·맥락 | 정의 앞부분 | 상태)
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

  return { FORMAT, PATCH_FORMAT, VERSION, VOCAB: V, REL, AXIS_UP, AXIS_DOWN, ROLE, emptyDB, normalize, normName, index, validate, merge, gate, ingest,
    fromBionote, resolveRef, mapVocab, audit, auditText, mapText, contextText, mechanismText, stepLine, promptText, parseLoose, isStepId, isId,
    xrefKey, xrefLabel };
});
