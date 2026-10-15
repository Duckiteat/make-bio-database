// 사법부(Judicial): 검증·증명 전용. 데이터를 바꾸지 않고, 엔진을 실행하지 않는다.
//
// 삼권 분립 (docs/design/tripartite-governance.md)
//   validate·관문(gate)·Patch Report·정제 점검·한계 상태·감사(audit)는 여기서만 판정한다.
//   시뮬레이션 감사는 행정부가 낸 원자료(raw)를 입력으로 받는다 — 여기서 simulate·simulateRate 를 부르지 않는다.
//   오류를 찾으면 판결(보고서)만 낸다. 고치는 것은 별도 과정(에이전트 → 새 패치 → 입법 서기 → 재검증)이다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../vocab.js'), require('../model.js'), require('../compiler/obs_operator.js'), require('./reliability.js'));
  else root.DefDBJudicial = factory(root.DefDBVocab, root.DefDBModel, root.DefDBObsOp, root.DefDBReliability);
})(typeof self !== 'undefined' ? self : this, function (V, M, OBSOP, RELI) {
  'use strict';
  const {
    NA, VOL, SAT_K, hillFactor, ruleLine, SITE_RE, supplyRules, modulationIndex,
    FORMAT, REL, UP_OF, AXIS_UP, AXIS_DOWN, ROLE, EFFECT_TYPES, CONSERVING, ID_RE, fmtId, isId, isTemp,
    isStepId, isObj, clone, str, arr, uniq, RESERVED, RES_RE, MOLECULAR, isParticipantKind, GREEK, normName,
    lev, similar, VTABLES, VNAME, VIX, mapVocab, vlabel, parseXref, xrefKey, xrefLabel, fpKey, locAncestors,
    locSides, sameFamily, locCompatible, taxAncestors, parseBundle, bundleKey, emptyDB, normalize, normTerm, normEvidence, normContext, normDesc,
    normSite, normRule, normKinetics, KIN_FIELDS, SIGNED_KIN, ENV_FIELDS, normObs, SENSE_FIELDS, normSense, normPart, normStep, normNeed,
    normLimitation, normObservation, parseTarget, index, lookupName, mechIndex, defaultTier, moietyOf, entityTally, resolveRef, suggest, stepLine, targets,
    chains, MOTIFS, trajectory, RT, sccs, parseLoose, PATCH_FORMAT, VERSION,
  } = M;

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
  // opt.attestations: 사법부가 검증한 도장 열쇠 목록 (judicial/attestation.js validStamps().keys). 주면 'verified' 마다 도장을 요구한다.
  function validate(db, opt) {
    const errors = [], warnings = [];
    const E = (where, msg) => errors.push({ where, msg }), W = (where, msg) => warnings.push({ where, msg });
    if (db._version) E('데이터베이스', `형식 버전 ${db._version} — 버전 ${VERSION} 로 변환해야 함 (migrations/ 참고)`);
    const ix = index(db), L = ix.label;
    for (const [p, table] of [['T', db.terms], ['D', db.senses], ['S', db.steps], ['L', db.limitations], ['O', db.observations]]) {
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
    for (const [id, o] of Object.entries(db.observations)) validateObservation(db, ix, id, o, E, W);
    checkAttestations(db, opt, E, W);
    return { errors, warnings };
  }
  // 'verified' 는 외부 도장으로만 (삼권 분립 §3): 데이터·엔진은 스스로 verified 를 선언할 수 없다
  function checkAttestations(db, opt, E, W) {
    const claims = [];
    for (const [id, d] of Object.entries(db.senses)) {
      for (const x of d.xrefs) if (x.status === 'verified') claims.push({ where: `${id} ${x.db}:${x.id}`, key: `${id}|xref|${x.db}:${x.id}` });
      if (d.fingerprint && d.fingerprint.status === 'verified') claims.push({ where: `${id} ${d.fingerprint.scheme}`, key: `${id}|fingerprint|${d.fingerprint.scheme}:${d.fingerprint.value}` });
    }
    if (!claims.length) return;
    const keys = opt && opt.attestations;
    // 경고 문구에 건수를 넣지 않는다 — 관문은 (where, msg) 로 '새 경고' 를 가리므로, 건수가 바뀌면 같은 경고가 새 경고로 보인다
    if (!keys) { W('증명 등록부', "status 'verified' 항목을 증명 등록부와 대조하지 않음 — node dbtool.mjs validate (attestations/registry.json) 로 확인할 것"); return; }
    const have = new Set(keys);
    for (const c of claims) if (!have.has(c.key)) E(c.where, "status 'verified' 인데 사법부 증명(attestations/registry.json 의 유효한 도장)이 없음 — 데이터는 스스로 verified 를 선언할 수 없음 (augment apply 가 판결과 함께 도장을 발급)");
  }

  // ===== 관찰 기록 (v10, docs/design/observation-port.md) =====
  const REL_EQ = 1e-12;
  const near = (a, b) => Math.abs(a - b) <= REL_EQ * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  // 물리적 상한 (v11, vocab.physicalBounds) — "불가능" 을 걸러내는 천장이다. 그럴듯함은 판정하지 않는다.
  //   값은 정준 단위로 들어온다(관찰 기록은 저장 단위가 정준, 정의항 obs 는 환산 뒤).
  function checkBound(dim, si, w, what, E) {
    const B = V.physicalBounds[dim];
    if (!B || !Number.isFinite(si)) return;
    if (B.integer && !Number.isInteger(si)) E(w, `${what}: 값 ${si} 은(는) 정수여야 함`);
    const lowBad = B.exclusiveMin ? !(si > B.min) : !(si >= B.min);
    if (lowBad) E(w, `${what}: 값 ${si} 이(가) 물리적 하한 ${B.min} ${B.exclusiveMin ? '초과' : '이상'} 이 아님 — ${B.why}`);
    if (si > B.max) E(w, `${what}: 값 ${si} 이(가) 물리적 상한 ${B.max} 를 넘음 — ${B.why} (단위를 잘못 적었는지 확인)`);
  }
  // 정의항 obs 의 값을 정준 단위로. 차원·단위를 모르면 null (그 자리에서 이미 단위 오류가 난다)
  function obsSI(P, b) {
    const F = P && P.dim && V.unitFactors[P.dim];
    if (!F || !(b.unit in F) || typeof b.value !== 'number') return null;
    return b.value * F[b.unit];
  }
  // 측정량의 SI 정준 단위 (kinetic_constant 는 칸마다, k·k0·k_r 은 차수에서)
  function obsUnit(db, o) {
    const ov = V.observables[o.observable.kind];
    if (!ov) return null;
    if (ov.unit !== 'param') return ov.unit;
    const p = o.observable.param;
    if (V.kineticUnits[p]) return V.kineticUnits[p];
    if (['k', 'k0', 'k_r'].includes(p)) {
      const t = parseTarget(o.observable.target), r = t && db.senses[t.base] && db.senses[t.base].rule.find((x) => x.id === t.key);
      const order = r && r.kinetics && r.kinetics.order;
      if (p === 'k' && r && r.kinetics && r.kinetics.law === 'zero_order') return 'M s^-1';
      return order != null ? `M^${1 - order} s^-1`.replace('M^0 ', '').replace('M^1 ', 'M ') : null;
    }
    return null;
  }
  function validateObservation(db, ix, id, o, E, W) {
    const w = id, ob = o.observable, ov = V.observables[ob.kind];
    if (!isId('O', id)) E(id, "관찰 번호는 'O' + 숫자 6자리");
    if (o.hypothetical) E(w, '합성(hypothetical) 관찰은 데이터베이스에 넣지 않음 — examples/observations/ 에만 (실측값을 지어내지 않음)');
    if (!ov) E(w, `측정량 '${ob.kind}' — ${Object.keys(V.observables).join(' | ')}`);
    else if (ov.target === 'bundle') checkBundle(db, ix, ob.target, `${w} 측정 대상`, E);
    else if (ov.target === 'cell_state') { const d = db.senses[ob.target]; if (!d || d.kind !== 'cell_state') E(w, `측정 대상 '${ob.target}' 은(는) 세포 상태(cell_state) 정의항이 아님`); }
    else if (ov.target === 'location') { if (!V.locations[ob.target]) E(w, `측정 대상 위치 '${ob.target}' 은(는) 위치 어휘에 없음`); }
    else if (ov.target === 'rule') {
      const t = parseTarget(ob.target);
      if (!t || t.sub !== 'rule' || !db.senses[t.base] || !db.senses[t.base].rule.some((r) => r.id === t.key)) E(w, `측정 대상 규칙 '${ob.target}' 없음 — D…/rule/키`);
      if (!KIN_FIELDS.includes(ob.param) || ob.param === 'order') E(w, `속도 상수 칸 '${ob.param || ''}' — ${KIN_FIELDS.filter((f) => f !== 'order').join(', ')}`);
    }
    if (!Number.isFinite(o.value)) E(w, '값(value)이 수가 아님');
    const want = ov && obsUnit(db, o);
    if (ov && want && o.unit !== want) E(w, `단위 '${o.unit}' — 이 측정량의 SI 정준 단위는 '${want}' (값은 SI 로 환산해 저장)`);
    if (ov && !want) E(w, '이 측정량의 단위를 정할 수 없음 (대상 규칙의 kinetics.order 필요)');
    if (ob.kind === 'fraction' && !(o.value >= 0 && o.value <= 1)) E(w, '비율은 0–1');
    if (['amount', 'concentration', 'event_time'].includes(ob.kind) && !(o.value >= 0)) E(w, '분자 수·농도·시각은 0 이상');
    if (ov && ov.dim) checkBound(ov.dim, o.value, w, `측정량 ${ob.kind}`, E);
    const u = o.uncertainty, nm = V.noiseModels[u.model];
    if (!V.uncertaintyKinds[u.kind]) E(w, `불확도 유형 '${u.kind}' — ${Object.keys(V.uncertaintyKinds).join(' | ')} (값만 있는 관찰은 받지 않음)`);
    if (!nm) E(w, `잡음 모형 '${u.model}' — ${Object.keys(V.noiseModels).join(' | ')}`);
    else {
      if (nm.observables && !nm.observables.includes(ob.kind)) E(w, `잡음 모형 ${u.model} 은(는) ${nm.observables.join('·')} 에만`);
      if (nm.positive && !(o.value > 0)) E(w, `잡음 모형 ${u.model} 은(는) 값 > 0 에만`);
    }
    if (!(u.sd >= 0 && Number.isFinite(u.sd))) E(w, '불확도 크기(uncertainty.sd)가 0 이상의 수가 아님');
    if (!(Number.isInteger(o.replicates) && o.replicates >= 1)) E(w, '반복 수(replicates)는 1 이상의 정수');
    for (const k of ['precision', 'detection_limit']) if (o[k] != null && !(o[k] >= 0)) E(w, `${k} 는 0 이상`);
    const c = o.condition;
    if (!c.species) E(w, '조건에 종(condition.species)이 없음');
    checkContext(c, w + ' 조건', E);
    if (c.temperature_K != null && !(c.temperature_K > 0)) E(w, '온도(K)는 0 보다 커야 함');
    if (c.pH != null && !(c.pH >= 0 && c.pH <= 14)) E(w, 'pH 는 0–14');
    if (c.time_s != null && !(c.time_s >= 0)) E(w, '시각(time_s)은 0 이상');
    for (const b of c.states || []) checkBundle(db, ix, b, `${w} 조건 상태`, E);
    const cal = o.calibration;
    if (cal) {
      if (!V.calibrationKinds[cal.kind]) E(w, `보정 종류 '${cal.kind}' — ${Object.keys(V.calibrationKinds).join(' | ')}`);
      else if (cal.kind !== 'identity') {
        if (!Number.isFinite(o.raw)) E(w, `보정 ${cal.kind} 에는 읽은 값(raw)이 필요함 — 값은 보정으로 다시 계산되어야 함`);
        if (cal.kind === 'linear' && !(Number.isFinite(cal.a) && Number.isFinite(cal.b))) E(w, '선형 보정에는 a·b');
        if (cal.kind === 'table' && !((cal.points || []).length >= 2 && cal.points.every((q, i) => q.length === 2 && q.every(Number.isFinite) && (!i || q[0] > cal.points[i - 1][0])))) E(w, '보정 표는 raw 오름차순 [raw, 값] 점 두 개 이상');
        else if (Number.isFinite(o.raw)) {
          const v = OBSOP.calibrate(cal, o.raw);
          if (!Number.isFinite(v)) E(w, `읽은 값 ${o.raw} 이(가) 보정 범위 밖`);
          else if (!near(v, o.value)) E(w, `값 ${o.value} 이(가) 보정 결과 ${v} 와 다름 — 관찰 값은 보정으로 다시 계산되어야 함`);
        }
      }
    }
    if (o.provenance && !/^[0-9a-f]{64}$/.test(o.provenance.sha256)) E(w, '원본 sha256 형식 틀림 (16진 64자리)');
    if (!V.obsUses[o.use]) E(w, `용도 '${o.use}' — estimation | validation (추정에 쓴 관찰을 검증에 쓰지 않음)`);
    checkEvidence(o.evidence, w, E);
    if (!['curated', 'computed'].includes(o.evidence.level)) E(w, `관찰 근거는 curated(문헌) | computed(포트 변환 도구) — 지금 ${o.evidence.level}`);
    if (o.retracted) { if (!o.retracted.note) E(w, '철회(retracted)에 사유(note) 없음'); checkEvidence(o.retracted.evidence, w + ' 철회', E); }
  }
  // 실측 상수 = 관찰 기록의 파생값: kinetics.from 의 관찰이 같은 규칙·같은 칸을 같은 값으로 쟀어야 한다 (lumped 는 원 관찰 참조만)
  function checkKineticsFrom(db, ref, k, rw, E) {
    const from = k.from || [];
    for (const f of from) {
      const o = db.observations[f.obs], fw = `${rw} 속도 출처 ${f.obs}`;
      if (!o) { E(fw, '관찰 기록 없음'); continue; }
      if (o.use !== 'estimation') E(fw, `용도가 ${o.use} 인 관찰은 상수 추정에 쓸 수 없음 — 검증용 관찰은 판정에만 (순환 판정 방지)`);
      if (o.retracted) E(fw, '철회된 관찰을 참조함');
      if (k.lumped) continue;
      if (o.observable.kind !== 'kinetic_constant' || o.observable.target !== ref || o.observable.param !== f.param) E(fw, `관찰이 이 규칙(${ref})의 '${f.param}' 을(를) 잰 것이 아님`);
      else if (!near(o.value, k[f.param])) E(fw, `'${f.param}' 값 ${k[f.param]} 이(가) 관찰 값 ${o.value} 와 다름 — 실측 상수는 관찰에서 그대로`);
      // v11 — 종·세포 대조: 다른 종에서 잰 값을 이 종의 상수로 적지 않는다 (CLAUDE.md 의 규약을 기계 집행으로)
      const kc = k.context || {}, oc = o.condition || {};
      if (kc.species && oc.species && kc.species !== oc.species)
        E(fw, `종이 다름 — 상수의 맥락은 '${kc.species}', 관찰은 '${oc.species}' (다른 종의 측정을 이 종의 상수로 적지 않는다)`);
      if (kc.location && oc.location && kc.location !== oc.location)
        E(fw, `위치가 다름 — 상수의 맥락은 '${kc.location}', 관찰은 '${oc.location}'`);
    }
    if (k.lumped && !from.length) E(rw, '묶은 상수(lumped)에는 원 관찰 참조(from)가 필요함 — 기전을 세분할 때 다시 재지 않고 다시 계산하려고');
    if (k.evidence.level === 'curated' && !k.lumped) {
      const have = new Set(from.map((f) => f.param));
      const miss = KIN_FIELDS.filter((p) => p !== 'order' && k[p] != null && !have.has(p));
      if (miss.length) E(rw, `문헌(curated) 속도 상수 ${miss.join('·')} 에 관찰 기록(kinetics.from)이 없음 — 실측값은 관찰 기록으로 넣고 상수는 그것을 참조 (observation-port.md §1)`);
    }
  }
  // 정의항 obs ↔ 관찰 기록 (v11) — checkKineticsFrom 의 거울. 측정량 종류·대상·값·종·세포가 모두 같아야 한다.
  function checkSenseObsFrom(db, sid, b, P, ow, E) {
    const o = db.observations[b.from], fw = `${ow} 측정 출처 ${b.from}`;
    if (!o) { E(fw, '관찰 기록 없음'); return; }
    if (!P || !P.observable) { E(fw, `'${b.property}' 에는 대응하는 측정량이 없어 관찰 기록을 가리킬 수 없음`); return; }
    if (o.retracted) E(fw, '철회된 관찰을 참조함');
    if (o.use !== 'estimation') E(fw, `용도가 ${o.use} 인 관찰은 모델 값의 출처로 쓸 수 없음 — 검증용 관찰은 판정에만 (순환 판정 방지)`);
    if (o.observable.kind !== P.observable) E(fw, `관찰이 '${P.observable}' 을(를) 잰 것이 아님 (측정량 ${o.observable.kind})`);
    else {
      // 대상 대조: 묶음 측정량은 이 정의항의 묶음이어야 하고, 위치 측정량은 obs 의 위치여야 한다
      const ovt = (V.observables[o.observable.kind] || {}).target;
      if (ovt === 'bundle' && String(o.observable.target).split('|')[0] !== sid)
        E(fw, `관찰 대상 '${o.observable.target}' 이(가) 이 정의항(${sid})의 묶음이 아님`);
      if (ovt === 'location' && b.context.location && o.observable.target !== b.context.location)
        E(fw, `관찰 대상 위치 '${o.observable.target}' 이(가) obs 의 위치 '${b.context.location}' 와 다름`);
    }
    const si = obsSI(P, b);
    if (si != null && !near(si, o.value)) E(fw, `값 ${b.value} ${b.unit} (= ${si} 정준) 이(가) 관찰 값 ${o.value} ${o.unit} 와 다름 — 파생값은 관찰에서 그대로 환산한다`);
    const c = o.condition || {};
    if (b.context.species && c.species && b.context.species !== c.species)
      E(fw, `종이 다름 — obs 는 '${b.context.species}', 관찰은 '${c.species}' (다른 종의 측정을 이 종의 값으로 적지 않는다)`);
    if (b.context.cell && c.cell && b.context.cell !== c.cell)
      E(fw, `세포 유형이 다름 — obs 는 '${b.context.cell}', 관찰은 '${c.cell}'`);
    if (b.context.location && c.location && b.context.location !== c.location)
      E(fw, `위치가 다름 — obs 는 '${b.context.location}', 관찰은 '${c.location}'`);
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
    const dbs = new Set(), byDb = new Map(), seenId = new Set();
    for (const x of d.xrefs) {
      const src = V.xrefs[x.db];
      if (!src) { E(where, `외부 ID 종류 '${x.db}' 없음`); continue; }
      if (!new RegExp(src.pattern).test(x.id)) E(where, `${x.db} ID '${x.id}' 형식이 틀림`);
      if (K && !K.xref.allowed.includes(x.db)) E(where, `kind '${d.kind}' 에는 ${x.db} ID 를 붙일 수 없음 (허용: ${K.xref.allowed.join(', ') || '없음'})`);
      if (!V.xrefStatus.includes(x.status)) E(where, `외부 ID 상태 '${x.status}' — ${V.xrefStatus.join(' | ')}`);
      if (x.role && !V.xrefRoles[x.role]) E(where, `외부 ID 역할 '${x.role}' — ${Object.keys(V.xrefRoles).join(' | ')}`);
      if (seenId.has(`${x.db}:${x.id}`)) E(where, `외부 ID ${x.db}:${x.id} 가 두 번`);
      seenId.add(`${x.db}:${x.id}`);
      dbs.add(x.db);
      if (!byDb.has(x.db)) byDb.set(x.db, []);
      byDb.get(x.db).push(x);
    }
    // 외부 ID 역할 (ChEBI 실험): 한 db 에 항목이 둘 이상이면 규약을 선언해야 한다 — 역할이 서로 달라야 하고, 엔진이 읽는 physiological 이 있어야 한다.
    //   분류(class) 항목은 단일 종이 없는 물질(중합체·불균일 물질)만 — 셀 수 있는 저분자·이온의 번호로 쓰면 화학식 대조가 건너뛰어진다.
    const SPECIES_KINDS = ['small_molecule', 'ion'];
    for (const [dbName, list] of byDb) {
      if (list.length > 1) {
        const roles = list.map((x) => x.role);
        if (roles.some((r) => !r)) E(where, `${dbName} ID 가 ${list.length}개인데 역할(role)이 없는 것이 있음 — ${Object.keys(V.xrefRoles).join(' | ')} 로 규약을 선언할 것`);
        else if (new Set(roles).size !== roles.length) E(where, `${dbName} ID 의 역할이 겹침 (${roles.join(', ')})`);
        else if (!roles.includes('physiological')) E(where, `${dbName} ID 가 여러 개면 엔진이 읽을 physiological(pH 7.3 우세 종)을 하나 정해야 함`);
      }
      for (const x of list) if (x.role === 'class' && SPECIES_KINDS.includes(d.kind)) E(where, `kind '${d.kind}' 는 셀 수 있는 분자 — 분류(class) 항목 ${dbName}:${x.id} 을 번호로 쓸 수 없음 (화학식이 없어 수지 대조가 건너뛰어진다). pH 7.3 우세 종을 physiological 로 적을 것`);
      if (list.length === 1 && list[0].role === 'parent' && SPECIES_KINDS.includes(d.kind)) W(where, `${dbName}:${list[0].id} 이 중성 모체만 적혀 있음 — 반응 참여자(physiological)를 함께 적는 것이 규약`);
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
        // 막 이동 경로 (MHC 실험): 분비·세포 내 섭취 경로로 옮겨 가는 막 단백질이 거치는 막들. 내강 쪽 면 ↔ 세포 밖 쪽 면은 위상이 같다 (소포 수송)
        for (const l of m.route || []) if (!V.locations[l] || V.locations[l].dim !== '2D') E(where, `막 이동 경로의 '${l}' 은(는) 막(2D) 위치가 아님`); else if (l === m.location) E(where, `막 이동 경로에 기본 막 '${l}' 을 다시 적음`);
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
      if (r.kinetics) { for (const m of kineticIssues(r, null)) E(rw, m); checkEvidence(r.kinetics.evidence, rw + ' 속도', E); if (r.kinetics.context) checkContext(r.kinetics.context, rw, E); checkKineticsFrom(db, `${id}/rule/${r.id}`, r.kinetics, rw, E); }
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
      // v11 — 허용 단위(어휘의 환산표)·물리 상한·관찰 기록 대조. 정의항 obs 는 **측정의 파생값**이므로
      //   측정량이 있는 속성의 문헌(curated) 값은 관찰 기록을 가리켜야 하고, 값·종·세포가 그 관찰과 같아야 한다.
      //   kinetics.from 과 같은 계약이다 — 한쪽만 막혀 있으면 그 틈으로 측정값이 조용히 바뀐다.
      if (P.dim && !P.units && b.unit && !(b.unit in (V.unitFactors[P.dim] || {})))
        E(ow, `'${b.property}' 의 단위 '${b.unit}' 은(는) 어휘의 환산표에 없음 — ${Object.keys(V.unitFactors[P.dim] || {}).join(' | ')}`);
      const si = obsSI(P, b);
      if (si != null) checkBound(P.dim, si, ow, `'${b.property}'`, E);
      if (P.observable && b.evidence.level === 'curated' && !b.from)
        E(ow, `문헌(curated) '${b.property}' 에 관찰 기록 참조(from)가 없음 — 측정값은 관찰 기록(O…)으로 넣고 정의항 obs 는 그것을 가리킨다 (observation-port.md §1, kinetics.from 과 같은 계약)`);
      if (b.from) checkSenseObsFrom(db, id, b, P, ow, E);
    });
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
    // 공급 위치: 부피(3D) 구획, 또는 막(2D) — 막이면 막 단백질의 동시 번역 삽입처럼 모든 생성·소비 분자가 그 막에 있을 수 있어야 함 (속도의 부피는 시나리오 volumes[막] = 유효 부피)
    const memOK = (l) => [...r.consumes, ...r.produces].every((q) => { const x = db.senses[q.ref], m = x && x.membrane; return m && m.association !== 'soluble' && [m.location, ...(m.route || [])].some((y) => sameFamily(l, y)); });
    for (const l of r.where) if (!V.locations[l]) E(rw, `위치 '${l}' 은(는) 위치 어휘에 없음`); else if (V.locations[l].dim !== '3D' && !memOK(l)) E(rw, `공급 위치 '${vlabel('locations', l)}' 는 부피(3D) 구획이어야 함 (막이면 모든 생성·소비 분자가 그 막에 박힌 분자여야 함)`);
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
    const L = ix.label, has = (d.signature || []).length || (d.metabolome || []).length || (d.transitions || []).length || (d.mechanisms || []).length;
    if (d.kind !== 'cell_state') { if (has) E(where, '표지 서명·대사 프로그램·기전 프로그램·전이(signature · metabolome · mechanisms · transitions)는 kind cell_state 만'); return; }
    if (!(d.signature || []).length) E(where, '세포 상태는 표지 서명(signature)이 필요함 — 어떤 분자가 높고 낮은지로 상태를 정의');
    if (d.rule.length || Object.keys(d.site).length || d.moieties || d.components.length) E(where, '세포 상태는 분자가 아님 — 규칙·부위·부분 구조·구성 요소를 두지 않음');
    const seen = new Set();
    for (const m of d.signature || []) {
      const x = db.senses[m.ref];
      if (!x) E(where, `표지 '${m.ref}' 없음`); else if (!isParticipantKind(x.kind)) E(where, `표지 '${L(m.ref)}' 는 분자 종류가 아님`);
      if (!V.signatureLevels[m.level]) E(where, `표지 '${L(m.ref)}' 의 수준 '${m.level}' — ${Object.keys(V.signatureLevels).join(' | ')}`);
      // 표지 위치: 부피(3D) 또는 막(2D, 예: 세포 표면 펩타이드–MHC) — 문턱은 분자 수라 부피가 없어도 판정된다. 막이면 그 분자가 그 막에 박혀 있어야 함
      if (!V.locations[m.location]) E(where, `표지 '${L(m.ref)}' 의 위치 '${m.location}' 은(는) 위치 어휘에 없음`);
      else if (V.locations[m.location].dim === '2D' && x && !(x.membrane && x.membrane.association !== 'soluble' && [x.membrane.location, ...(x.membrane.route || [])].some((l) => sameFamily(m.location, l)))) E(where, `표지 '${L(m.ref)}' 는 막 '${m.location}' 에 있을 수 없음 — 막 위상(membrane)이 그 막이어야 함`);
      else if (V.locations[m.location].dim === '3D' && x && x.membrane && x.membrane.association !== 'soluble') E(where, `표지 '${L(m.ref)}' 는 막 분자 — 부피(3D) 위치 '${m.location}' 에 있을 수 없음`);
      const key = `${m.ref}|${m.location}`; if (seen.has(key)) E(where, `표지 '${L(m.ref)}' 가 같은 위치에 두 번`); seen.add(key);
    }
    for (const m of d.metabolome || []) {
      const t = parseTarget(m.ref), o = t && db.senses[t.base], r = o && o.rule.find((x) => x.id === t.key);
      if (!r) E(where, `대사 프로그램의 규칙 '${m.ref}' 없음 — 'D…/rule/키'`);
      else if (r.type !== 'supply') E(where, `대사 프로그램은 공급 규칙(supply)만 — '${m.ref}' 는 ${r.type}`);
      if (!V.signatureLevels[m.level]) E(where, `대사 프로그램 '${m.ref}' 의 수준 '${m.level}' — ${Object.keys(V.signatureLevels).join(' | ')}`);
    }
    for (const m of d.mechanisms || []) {
      const x = db.senses[m.ref];
      if (!x) E(where, `기전 프로그램 '${m.ref}' 없음`); else if (x.kind !== 'pathway') E(where, `기전 프로그램 '${L(m.ref)}' 는 경로(pathway)가 아님`);
      else if (!Object.values(db.steps).some((st) => (st.part_of || []).includes(m.ref))) E(where, `기전 프로그램 '${L(m.ref)}' 에 속한 단계(part_of)가 없음`);
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
      if (assoc !== 'soluble' && !(L.dim === '2D' && [d.membrane.location, ...(d.membrane.route || [])].some((l) => sameFamily(b.location, l)))) E(where, `${ix.label(b.base)} 은(는) ${vlabel('locations', d.membrane.location)}에 박힌 분자 — '${L.label}' 에 있을 수 없음`);
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
        // 막 복합체에 수용성 구성 요소가 붙거나 떨어질 때(β2m·펩타이드 → 막의 MHC): 그 3D 위치가 복합체 막의 한 면과 맞닿아 있어야 함
        const touches = (x) => (V.locations[x.location] || {}).dim === '3D' && (V.locations[cx.location] || {}).dim === '2D' && Object.values(locSides(cx.location)).includes(x.location);
        for (const x of parts) if (x.location !== cx.location && major(x) && !touches(x)) E(w, '해리·결합 단계에서 위치가 바뀜');
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

  function gate(dbBefore, result, opt) {
    const vo = opt && opt.attestations ? { attestations: opt.attestations } : undefined;
    const b0 = normalize(dbBefore), before = validate(b0, vo), after = validate(result.db, vo);
    const key = (i) => i.where + '|' + i.msg, old = new Set([...before.errors, ...before.warnings].map(key));
    const errors = [...result.report.errors, ...after.errors.filter((i) => !old.has(key(i))), ...observationImmutability(b0, result.db), ...patchPolicy(b0, result)];
    const warnings = after.warnings.filter((i) => !old.has(key(i)));
    const r = result.report;
    const changed = r.added.length + r.updated.length + r.removed.length > 0;
    const ok = changed && !errors.length && (!warnings.length || !!(opt && opt.allowWarnings));
    return { ok, changed, errors, warnings, preexisting: before.errors.length };
  }

  // 병합 규약 (Traceable Evolution Protocol · 한계 등록 · 정제 점검) — 관문 안에서 판정한다.
  //   봉인(sealVerdict)은 관문 판결에만 묶이므로, 병합을 막는 규칙이 관문 밖(CLI)에 있으면 CLI 를 거치지 않는 병합이 그 규칙을 건너뛴다.
  //   ① why 필수 ② 미등록 한계 후보 0 (병합 뒤 db 전체 — CI 의 limitations --detect 와 같은 기준) ③ 이 패치가 새로 만든 중복 규칙·등록 안 된 화학량 모순
  function patchPolicy(before, result) {
    const out = [], after = result.db;
    if (!result.report.why) out.push({ where: '패치', msg: '변경 이유(why)가 없음 — 패치 최상위에 "why": "…" 를 적을 것 (Traceable Evolution Protocol)' });
    for (const g of detectGaps(after)) out.push({ where: g.target, msg: `미등록 한계 후보 [${g.type}] ${g.why} — 같은 패치의 limitations 에 등록할 것` });
    const was = new Set(refineCheck(before).issues.map((x) => x.type + x.where));
    for (const x of refineCheck(after).issues) if (!was.has(x.type + x.where) && (x.type === 'duplicate_rule' || (x.type === 'lumped_contradiction' && !x.known.length)))
      out.push({ where: x.where, msg: `정제 점검 [${x.type}] ${x.msg} — 의도한 단순화면 Structural_Gap 으로 등록, 중복이면 리팩터링 초안(legislative draftRefactor)대로` });
    return out;
  }
  // 관찰 기록은 한 번 들어오면 바뀌지 않는다 — 지울 수 없고, 바꿀 수 있는 것은 철회 표시(retracted) 하나 (실측값을 다시 잴 일이 없게)
  function observationImmutability(before, after) {
    const out = [];
    for (const [id, o] of Object.entries(before.observations || {})) {
      const a = (after.observations || {})[id];
      if (!a) { out.push({ where: id, msg: '관찰 기록은 지울 수 없음 — 잘못된 관찰은 retracted 로 표시' }); continue; }
      const strip = (x) => { const { retracted, ...rest } = x; return JSON.stringify(rest); };
      if (strip(a) !== strip(o)) out.push({ where: id, msg: '관찰 기록은 바꿀 수 없음 — 새 측정은 새 관찰(O+1), 잘못된 관찰은 retracted 로 표시' });
      if (o.retracted && JSON.stringify(a.retracted) !== JSON.stringify(o.retracted)) out.push({ where: id, msg: '철회 표시는 바꾸거나 지울 수 없음' });
    }
    return out;
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
    const kindOf = (id) => ({ T: 'terms', D: 'senses', S: 'steps', L: 'limitations', O: 'observations' })[String(id)[0]];
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
    // v11 — 측정값의 전후. 패치는 최상위 필드를 통째로 교체하므로 기록에는 새 값만 남는다:
    //   선언된 기록(data/patches/*.json)만 읽는 사람도 "무엇이 무엇으로" 바뀌었는지 알 수 있어야 한다.
    //   관찰 기록은 불변이므로(철회만) 값이 바뀔 수 있는 자리는 정의항 obs 와 규칙 kinetics 뿐이다.
    const okey = (o) => `${o.property}|${o.context.location || ''}|${o.context.cell || ''}|${o.context.species || ''}`;
    const uval = (o) => `${o.value}${o.unit ? ' ' + o.unit : ''}`;
    const measured = [];
    for (const id of changedD) {
      const b0 = before.senses[id], a0 = after.senses[id];
      if (!b0 || !a0) continue;
      const bm = new Map(b0.obs.map((o) => [okey(o), o]));
      for (const o of a0.obs) { const q = bm.get(okey(o)); if (q && q.value !== o.value) measured.push({ at: `${id}/obs/${o.property}`, from: uval(q), to: uval(o) }); }
      for (const o of b0.obs) if (!a0.obs.some((x) => okey(x) === okey(o))) measured.push({ at: `${id}/obs/${o.property}`, from: uval(o), to: '없음 (삭제)' });
      const br = new Map(b0.rule.map((x) => [x.id, x]));
      for (const x of a0.rule) {
        const q = br.get(x.id); if (!q) continue;
        for (const f of KIN_FIELDS) {
          const u = q.kinetics && q.kinetics[f], w2 = x.kinetics && x.kinetics[f];
          if (u != null && w2 != null && u !== w2) measured.push({ at: `${id}/rule/${x.id}.${f}`, from: u, to: w2 });
          else if (u != null && w2 == null) measured.push({ at: `${id}/rule/${x.id}.${f}`, from: u, to: '없음 (삭제)' });
        }
      }
    }
    return {
      scope: { files: ['data/db.json', 'data/patches/'], added: group(r.added), updated: group(r.updated), removed: group(r.removed), fields },
      measured_changed: measured,
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
    // 리팩터링 패치 초안은 입법부(legislative.draftRefactor)가 이 판결(issues)로 쓴다 — 사법부는 고치지 않는다
    return { issues, unresolved: issues.filter((x) => x.type === 'duplicate_rule' || (x.type === 'lumped_contradiction' && !x.known.length)).length };
  }
  function refineText(db) {
    const r = refineCheck(db);
    if (!r.issues.length) return { text: '정제 점검: 중복 규칙·화학량 모순 없음', result: r };
    return { text: ['정제 점검 (Continuous Refinement):', ...r.issues.map((x) => `  ${x.type === 'lumped_contradiction' && x.known.length ? '○' : '△'} [${x.type}] ${x.msg}`), ...(r.issues.some((x) => x.type === 'duplicate_rule' && x.removable) ? [`  → 참조 없는 중복 ${r.issues.filter((x) => x.type === 'duplicate_rule' && x.removable).length}개 — 리팩터링 패치 초안은 입법부(legislative draftRefactor)가 쓴다`] : [])].join('\n'), result: r };
  }
  // 자동 보강 후보 (원본 대조 대상): unmapped 필수 외부 ID, 또는 대조 안 된(asserted) UniProt·ChEBI — judicial/identity.js 의 plan 과 같은 기준
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
      `| Scope · 측정값 전후 | ${(rep.measured_changed || []).map((m) => `${m.at}: ${m.from} → ${m.to}`).join(' · ') || '바뀐 측정값 없음'} |`,
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
  // 사건 기반 시뮬레이션 보고: 행정부 simulate 의 원자료(raw)를 판정·서술한다 (엔진을 부르지 않음)
  function simulateText(db, target, opt, raw) {
    const r = raw;
    if (!r) return '원자료 없음 — 행정부 simulate 결과를 넘길 것 (orchestrator.js)';
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
  // opt.pools: 행정부 simulate(rounds 0) 가 낸 시작 풀 분류 { source } — 넉넉한 대사물 풀(bulk)을 경쟁에서 뺀다
  function resolutionPlan(db, target, opt) {
    db = normalize(db);
    const ix = index(db), tg = targets(ix, target);
    if (tg.error) return { error: tg.error };
    const ids = uniq(tg.ids.flatMap((d) => ix.stepsIn(d)));
    const sim = (opt && opt.pools) || { source: {} };
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
  function resolutionText(db, target, opt) {
    const p = resolutionPlan(db, target, opt);
    if (p.error) return p.error;
    const ix = p.ix, lv = (n) => ['R0', 'R1', 'R2'][n], out = [`해상도 계획: ${target} — 단계 ${p.ids.length}개`];
    const cnt = [0, 1, 2].map((n) => p.rows.filter((r) => r.need === n).length);
    out.push(`  필요 해상도: R0(위상) ${cnt[0]} · R1(부위) ${cnt[1]} · R2(구조) ${cnt[2]} — 3차원이 필요한 단계 ${cnt[2]}/${p.ids.length}`);
    for (const r of p.rows) out.push(`  ${r.ok ? '✓' : '✗'} ${r.sid} ${ix.label(r.sid)}: 필요 ${lv(r.need)} / 갖춤 ${lv(r.have)}${r.hits.length ? ' — ' + r.hits.join(', ') : ''}${r.sites.length ? ' · 반응 중심 ' + r.sites.join(', ') : ''}`);
    if (p.competitions.length) out.push('  경쟁(T3):', ...p.competitions.map((c) => `    ${ix.bundleLabel(c.bundle)} ← ${c.steps.map((s) => `${s} ${ix.label(s)}`).join(' / ')}`));
    return out.join('\n');
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
  // ===== 속도 시뮬레이션 감사 (사법부) =====
  // 행정부 simulateRate 의 원자료만 읽는다: 사용한 속도 상수·부피·첫 발화·기록점의 상태와 누적 원장·저장소 통계·정지 관찰.
  // 질량 수지는 기록점마다 상태(N)에서 실체·부분 구조 합계를 model 의 화학량(entityTally·moietyOf)으로 독립적으로 다시 세어
  // 시작 + 원장(생성·소멸·교환·경로)과 맞춘다. 사후 분석(정지 원인·제한 요인·폐기물·소비/생산 비)도 여기서 판정한다.
  function auditRate(db, target, raw) {
    db = normalize(db);
    const ix = index(db), audit = [], AE = (fault, code, where, msg, sug) => audit.push({ code, fault, where, msg, suggestion: sug }); // fault: judicial/fault.js
    const r = raw, ids = r.ids, react = r.react, finite = r.finite, res = new Set(r.reservoirSet), tgIds = r.targets;
    // ① 원자료 사실
    for (const f of r.facts) if (f.kind === 'recycle_stoich_unknown') AE('DATA_GAP', 'AUDIT_RESOURCE', f.ref, `${ix.label(f.owner)} 재활용 화학량(서열 길이)을 모름 — 이 단위는 소실로 처리함`, gapSuggest(db, ix, f.owner, 'Structural_Gap', /서열 길이|sequence_length|재활용/));
    // ② 쓰인 속도 상수의 무결성 · 부피 공백
    for (const u of r.kinUsed) {
      const rule = ix.ruleOf(u.ref), st = u.step ? db.steps[u.step] : null;
      for (const m of kineticIssues(rule, st, u.kin)) AE('DOMAIN_CONFLICT', 'AUDIT_KINETIC', u.step ? `${u.step} ${rule.label}` : u.ref, m, gapSuggest(db, ix, u.owner, 'Kinetic_Gap'));
      if (!u.step) { const s = r.supplies.find((x) => x.ref === u.ref); if (s && !s.V) AE('DATA_GAP', 'AUDIT_CONCENTRATION', s.ref, `공급 위치(${vlabel('locations', s.loc)}) 부피를 모름 — 공급을 적용하지 못함`, gapSuggest(db, ix, tgIds[0], 'Concentration_Gap')); }
      else { const x = react.get(u.step); if (!x.V) AE('DATA_GAP', 'AUDIT_CONCENTRATION', `${u.step} ${rule.label}`, `반응 부피(${x.loc ? vlabel('locations', x.loc) : '3D 위치 없음'})를 모름 — 속도 법칙을 농도로 계산할 수 없어 즉시 처리함`, gapSuggest(db, ix, tgIds[0], 'Concentration_Gap')); }
    }
    // ②′ 상수 등급 (신뢰 지표 ②, judicial/reliability.js): 쓰인 상수마다 등급을 계산하고 문턱 미달을 판정한다.
    //   가상 값(시나리오가 준 상수)은 등급 밖이므로 시나리오가 hypothetical 을 선언했을 때만 허용한다 — 원자료가 그 선언을 싣고 온다.
    {
      const min = r.min_grade || RELI.DEFAULT_MIN, ctx = { evidenceShas: [] };
      if (!RELI.ORDER.includes(min)) AE('DATA_GAP', 'AUDIT_KINETIC', '상수 등급', `등급 문턱 '${min}' 을 모름 — ${RELI.ORDER.join(' | ')}`, '시나리오의 min_grade 를 등급 이름 하나로 적을 것');
      else for (const u of r.kinUsed) {
        const k = u.kin || {}, where = u.step ? `${u.step} ${ix.ruleOf(u.ref).label}` : u.ref;
        if (k.src === 'scenario') {
          if (!r.hypothetical) AE('DATA_GAP', 'AUDIT_KINETIC', where, '상수 등급: 시나리오가 준 가상 값인데 시나리오가 hypothetical 을 선언하지 않음 — 가상 값은 등급 밖이다', '시나리오에 hypothetical: true 를 적거나, 확인한 상수를 규칙의 kinetics 로 데이터에 넣을 것');
          continue;
        }
        const sd = RELI.scoreEvidence(k.evidence, ctx), g = RELI.gradeOf(sd.s, sd.d, 'unchecked');
        if (!RELI.meets({ grade: g }, min)) AE('DATA_GAP', 'AUDIT_KINETIC', where, `상수 등급 ${g} < ${min} (S${sd.s}D${sd.d}) — ${sd.why}`, gapSuggest(db, ix, u.owner, 'Kinetic_Gap'));
      }
    }
    // ③ 국소 수지: 발화한 단계의 한 번당 실체·부분 구조 변화 (첫 발화 시각)
    for (const sid of ids.filter((s) => r.firstFire[s] != null).sort((a, b) => r.firstFire[a] - r.firstFire[b])) {
      const x = react.get(sid), t = r.firstFire[sid];
      if (Object.keys(x.unitEnt).length) AE('DOMAIN_CONFLICT', 'AUDIT_MASS', `${sid} ${x.rule.label}`, `t=${t} s 첫 발화에서 국소 수지 위반 — 한 번 일어날 때마다 ${Object.entries(x.unitEnt).map(([en, v]) => `${ix.label(en)} ${v > 0 ? '+' : ''}${+v.toFixed(6)}`).join(', ')} (보존되어야 할 실체가 생기거나 사라짐)`, massSuggest(db, ix, Object.keys(x.unitEnt)[0]));
      if (finite && Object.keys(x.unitMoi).length && !x.covalent) AE('DOMAIN_CONFLICT', 'AUDIT_MASS', `${sid} ${x.rule.label}`, `t=${t} s 첫 발화에서 부분 구조 수지 위반 — 한 번에 ${Object.entries(x.unitMoi).map(([m, v]) => `${ix.label(m)} ${v > 0 ? '+' : ''}${+v.toFixed(6)}`).join(', ')} (단계의 부산물·보조 기질 묶음이 빠졌거나 규칙이 불완전)`, `단계 ${sid} 의 입력·출력에 빠진 부산물(minor)을 넣거나 규칙 ${x.st.rule} 의 효과·with 를 고칠 것`);
    }
    for (const [b, x] of Object.entries(r.negatives)) AE('ENGINE_DEFECT', 'AUDIT_MASS', b, `t=${x.t} s 에 저장소 ${ix.bundleLabel(b)} 가 음수(${x.n}) — 엔진 오류`, '엔진 버그: 보고할 것');
    // ④ 전역 수지 — 독립 재계산 (기록점마다)
    const TOL = 1e-6, chemical = new Set(r.chemical), vecCache = new Map(), moiCache = new Map();
    const vec = (b) => { if (!vecCache.has(b)) { const t = {}; entityTally(db, b.split('|')[0], new Map(parseBundle(b).features.map((f) => [f.site, f.feature])), 1, t, null); vecCache.set(b, t); } return vecCache.get(b); };
    const totals = (N) => { const t = {}; for (const [b, n] of Object.entries(N)) if (n) for (const [e, c] of Object.entries(vec(b))) t[e] = (t[e] || 0) + c * n; return t; };
    const toMoi = (ent) => { const m = {}; for (const [e, c] of Object.entries(ent)) { if (!moiCache.has(e)) moiCache.set(e, moietyOf(db, e, 1, {})); for (const [x, k] of Object.entries(moiCache.get(e))) m[x] = (m[x] || 0) + c * k; } return m; };
    const ent0 = totals(r.series[0].N), moi0 = toMoi(ent0);
    let massFirst = null, moiFirst = null;
    for (const rec of r.series.slice(1)) {
      const L = rec.ledger, now = totals(rec.N);
      if (!massFirst) for (const en of uniq([...Object.keys(ent0), ...Object.keys(now), ...Object.keys(L.created), ...Object.keys(L.destroyed), ...Object.keys(L.exIn), ...Object.keys(L.exOut)])) {
        if (chemical.has(en)) continue;
        const want = (ent0[en] || 0) + (L.created[en] || 0) - (L.destroyed[en] || 0) + (L.exIn[en] || 0) - (L.exOut[en] || 0), got = now[en] || 0;
        if (Math.abs(want - got) > TOL * Math.max(1, Math.abs(want))) { massFirst = { t: rec.t, en, want, got, L }; break; }
      }
      if (finite && !moiFirst) {
        const m = toMoi(now);
        for (const k of uniq([...Object.keys(moi0), ...Object.keys(m)])) {
          const want = (moi0[k] || 0) + ['covalent', 'source', 'lost', 'recycle'].reduce((a, c) => a + (L[c][k] || 0), 0), got = m[k] || 0;
          if (Math.abs(want - got) > TOL * Math.max(1, Math.abs(want))) { moiFirst = { t: rec.t, k, want, got, viol: L.violation[k] || 0 }; break; }
        }
      }
      if (massFirst && (moiFirst || !finite)) break;
    }
    // 전역 수지 위반의 출처: 국소(한 번당) 수지 위반 단계가 있으면 그 결과(데이터 모순), 없으면 엔진 원장 결함
    const localViol = audit.some((a) => a.code === 'AUDIT_MASS' && a.fault === 'DOMAIN_CONFLICT');
    if (massFirst) { const L = massFirst.L, en = massFirst.en; AE(localViol ? 'DOMAIN_CONFLICT' : 'ENGINE_DEFECT', 'AUDIT_MASS', en, `${ix.label(en)}: t=${massFirst.t} s 기록점까지 처음 어긋남 — 시작 ${(ent0[en] || 0).toFixed(3)} + 생성 ${(L.created[en] || 0).toFixed(3)} − 소멸 ${(L.destroyed[en] || 0).toFixed(3)}${finite ? '' : ` + 풀에서 들어옴 ${(L.exIn[en] || 0).toFixed(3)} − 풀로 나감 ${(L.exOut[en] || 0).toFixed(3)}`} = ${massFirst.want.toFixed(3)} ≠ 실제 ${massFirst.got.toFixed(3)} — 보존되어야 하는 실체가 원장 밖에서 사라지거나 생김`, massSuggest(db, ix, en)); }
    if (moiFirst) AE(localViol ? 'DOMAIN_CONFLICT' : 'ENGINE_DEFECT', 'AUDIT_MASS', moiFirst.k, `부분 구조 ${ix.label(moiFirst.k)}: t=${moiFirst.t} s 기록점까지 처음 어긋남 — 기대 ${moiFirst.want.toFixed(3)} ≠ 실제 ${moiFirst.got.toFixed(3)} (원장 밖 변화 ${moiFirst.viol.toFixed(3)} 는 위 국소 수지 위반 단계에서 옴)`, '국소 수지 위반 단계를 먼저 고칠 것');
    // ⑤ 적분 안정성: 한 Δt 에 입력의 20% 넘게 쓰려 한 속도 법칙 단계
    const stiffSteps = Object.entries(r.stiff).filter(([, f]) => f > 0.2).sort((a, b) => b[1] - a[1]);
    if (stiffSteps.length) AE('NUMERICAL', 'AUDIT_KINETIC', target, `Δt ${r.dt} s 가 너무 큼 — 속도 법칙 단계가 한 Δt 에 입력을 최대 ${stiffSteps.slice(0, 4).map(([sid, f]) => `${sid} ${Math.min(f, 99.99) * 100 > 9999 ? '>9999' : (f * 100).toFixed(0)}%`).join(', ')} 소비하려 함 (오일러 적분 불안정·과도 진동 위험)`, `dt 를 ${(r.dt * 0.2 / stiffSteps[0][1]).toPrecision(2)} s 이하로 줄여 다시 실행하고 결과가 같은지 확인`);
    // ⑥ 평형 일치: 결합 단계의 끝 시점 Q 와 Kd
    const conc = (b, Vr) => Math.max(0, r.final[b] || 0) / (NA * Vr);
    for (const sid of ids) {
      const { st, k, V: Vr } = react.get(sid);
      if (!k || k.law !== 'binding') continue;
      const Kd = k.Kd || (k.k_off && k.k_on ? k.k_off / k.k_on : null);
      const ins = st.inputs.filter((p) => !p.minor && !res.has(p.b)), outs = st.outputs.filter((p) => !p.minor && !res.has(p.b));
      if (!Kd || ins.length !== 2 || outs.length !== 1) continue;
      if (ids.some((o) => o !== sid && [...db.steps[o].inputs, ...db.steps[o].agents].some((p) => p.b === outs[0].b && !p.minor))) continue;
      if (r.degradations.some((g) => g.k_deg > 0 && [ins[0].b, ins[1].b, outs[0].b].includes(g.bundle))) continue;
      const Q = conc(ins[0].b, Vr) * conc(ins[1].b, Vr) / Math.max(conc(outs[0].b, Vr), 1e-30);
      if (conc(ins[0].b, Vr) > 0 && conc(ins[1].b, Vr) > 0 && Math.abs(Math.log10(Q / Kd)) > 1) AE('NUMERICAL', 'AUDIT_KINETIC', `${sid} ${react.get(sid).rule.label}`, `끝 시점의 [A][B]/[AB] = ${Q.toExponential(2)} M 가 Kd ${Kd.toExponential(2)} M 와 10배 이상 다름 — 아직 평형 전이거나 dt 가 너무 큼`, `t_end 를 늘리거나 dt 를 줄여 다시 실행 (지금 dt ${r.dt} s)`);
    }
    // ⑦ 자원 순환 분류: closed(순환) · consumed_only(고갈 위험) · produced_only(축적) · idle
    const resv = {};
    for (const [b, x] of Object.entries(r.reservoirs)) resv[b] = Object.assign({}, x, { consumers: [], producers: [] });
    for (const sid of ids) { const { st } = react.get(sid); for (const p of st.inputs) if (resv[p.b]) resv[p.b].consumers.push(sid); for (const p of st.outputs) if (resv[p.b]) resv[p.b].producers.push(sid); }
    for (const s of r.supplies) { for (const b of s.consumes) if (resv[b]) resv[b].consumers.push(s.ref); for (const b of s.produces) if (resv[b]) resv[b].producers.push(s.ref); }
    for (const g of r.degradations) for (const b of g.recycle) if (resv[b]) resv[b].producers.push(g.ref);
    const active = (ref) => { if (react.has(ref)) return true; const s = r.supplies.find((x) => x.ref === ref); if (s) return s.active; const g = r.degradations.find((x) => x.ref === ref); return !!(g && g.k_deg > 0); };
    for (const x of Object.values(resv)) {
      x.consumers = uniq(x.consumers); x.producers = uniq(x.producers);
      const c = x.consumers.some(active), p = x.producers.some(active);
      x.class = c && p ? 'closed' : c ? 'consumed_only' : p ? 'produced_only' : 'idle';
    }
    const G = new Map(), edge = (a, b) => { if (a === b) return; if (!G.has(a)) G.set(a, new Set()); G.get(a).add(b); };
    for (const sid of ids) { const { st } = react.get(sid); for (const a of st.inputs) for (const b of st.outputs) if (res.has(a.b) && res.has(b.b)) edge(a.b, b.b); }
    for (const s of r.supplies) if (s.active) for (const a of s.consumes) for (const b of s.produces) edge(a, b);
    const cycles = sccs(G).filter((c) => c.length > 1);
    if (finite) for (const [b, x] of Object.entries(resv)) {
      if (x.class === 'consumed_only') AE('DATA_GAP', 'AUDIT_RESOURCE', b, `저장소 ${ix.bundleLabel(b)} 는 소비만 되고 재생 경로가 없음 (소비: ${x.consumers.join(', ')})${x.firstExhausted != null ? ` — t=${x.firstExhausted} s 에 고갈` : ''}`, gapSuggest(db, ix, b.split('|')[0], 'Kinetic_Gap', /공급|재생|supply/));
      if (x.source === 'bulk' && x.consumers.some(active)) AE('DATA_GAP', 'AUDIT_CONCENTRATION', b, `저장소 ${ix.bundleLabel(b)} 의 시작량이 기본값(${r.bulk}) — 고갈 시각은 질적 의미만`, gapSuggest(db, ix, b.split('|')[0], 'Concentration_Gap', /저장소|대사물|뉴클레오타이드|reservoir/));
    }
    // ⑧ 사후 분석 (Post-Mortem): 정지 시각·원인·제한 요인·완료한 회로 수·폐기물 축적·소비/생산 비
    const tEnd = r.series[r.series.length - 1].t, watch = r.watch, death = r.death;
    const turns = (c) => Math.min(...c.map((sid) => r.cum[sid] || 0));
    const turnsDone = r.stepCycles.map((c) => ({ steps: c, completed: Math.floor(turns(c) + 1e-9), exact: turns(c) }));
    const watchIns = new Set(watch.flatMap((sid) => [...react.get(sid).ins.keys()]));
    const exhaustedNow = Object.entries(resv).filter(([b, x]) => x.state === 'exhausted' && watchIns.has(b)).sort((a, b) => a[1].lastExhausted - b[1].lastExhausted);
    const firstToZero = Object.entries(r.zeroAt).sort((a, b) => a[1] - b[1]).map(([b, t]) => ({ bundle: b, t, reservoir: res.has(b) }));
    const consumed = {}, produced = {};
    for (const [b, l] of Object.entries(r.ledger)) if (res.has(b)) { const net = l.reaction + l.supply + l.degradation + l.recycle; if (net < -1e-6) consumed[b] = -net; else if (net > 1e-6) produced[b] = net; }
    const sum = (o) => Object.values(o).reduce((a, v) => a + v, 0);
    const usedAsInput = new Set(ids.flatMap((sid) => react.get(sid).st.inputs.map((p) => p.b)));
    const waste = [...Object.entries(resv).filter(([, x]) => x.class === 'produced_only' || (x.end - x.start > 0 && !x.consumers.length)).map(([b, x]) => ({ bundle: b, accumulated: x.end - x.start })),
      ...Object.entries(r.ledger).filter(([b, l]) => !res.has(b) && !usedAsInput.has(b) && l.reaction > 0).map(([b, l]) => ({ bundle: b, accumulated: l.reaction + l.degradation }))].filter((w) => w.accumulated > 0).sort((a, b) => b.accumulated - a.accumulated);
    for (const w of waste) if (!res.has(w.bundle)) produced[w.bundle] = w.accumulated;
    let pm = { dead: !!death, alive: !death, t_end: tEnd, cycles: turnsDone, last_turn: r.lastTurn, death_frac: r.deathFrac, firstToZero, waste, dp: { consumed, produced, ratio: sum(produced) ? sum(consumed) / sum(produced) : null }, peak_rate: r.peakRate };
    if (death) {
      if (exhaustedNow.length) {
        const [b, x] = exhaustedNow[0];
        pm = { ...pm, cause: 'exhaustion', t_death: x.lastExhausted, t_detected: death.t_detected, window: death.window, limiting: { bundle: b, starved: watch.filter((sid) => react.get(sid).ins.has(b)), consumers: x.consumers, regeneration: x.producers.filter(active) } };
      } else {
        const eq = Object.entries(r.endFlux).map(([sid, f]) => ({ sid, ratio: f.f > 0 ? f.r / f.f : Infinity })).sort((a, b) => b.ratio - a.ratio);
        const starvedIn = firstToZero.find((z) => !z.reservoir);
        const cause = eq.length && eq[0].ratio > 0.5 ? 'equilibrium' : starvedIn ? 'intermediate_drained' : 'kinetic_stall';
        pm = { ...pm, cause, t_death: r.lastTurn.t, t_detected: death.t_detected, window: death.window, bottleneck: eq[0] || null, limiting: cause === 'intermediate_drained' ? { bundle: starvedIn.bundle, starved: watch.filter((sid) => react.get(sid).ins.has(starvedIn.bundle)) } : null };
      }
      const lb = pm.limiting && pm.limiting.bundle, base0 = lb ? lb.split('|')[0] : (pm.bottleneck ? ix.ruleOwner(db.steps[pm.bottleneck.sid].rule) : tgIds[0]);
      const gtype = pm.cause === 'exhaustion' ? 'Resource_Gap' : 'Kinetic_Gap';
      AE('FINDING', 'AUDIT_RESOURCE', target, `사후 분석: t=${pm.t_death} s 에 정지 (${{ exhaustion: '자원 고갈', equilibrium: '산물 축적으로 평형', intermediate_drained: '중간물 고갈', kinetic_stall: '속도 정지' }[pm.cause]})${lb ? ` — 제한 요인 ${ix.bundleLabel(lb)}${pm.limiting.starved.length ? ` (굶은 단계 ${pm.limiting.starved.join(', ')})` : ''}` : ''}${pm.bottleneck ? ` — 병목 ${pm.bottleneck.sid} (역/정 = ${pm.bottleneck.ratio.toFixed(3)})` : ''} · 완료한 회로 ${turnsDone.map((c) => c.completed).join('/') || '—'}바퀴`,
        gapSuggest(db, ix, base0, gtype, gtype === 'Resource_Gap' ? new RegExp(lb ? ix.label(base0).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '고갈') : null));
    }
    // ⑨ 속도 상수 공백 · 해상도 근사
    const gaps = r.kineticGaps.filter((x) => !/\/rule\//.test(x) || react.has(x)), sgaps = r.kineticGaps.filter((x) => /\/rule\//.test(x));
    if (gaps.length) AE('DATA_GAP', 'AUDIT_KINETIC_GAP', target, `속도 상수가 없는 단계 ${gaps.length}개를 즉시(사건 기반)로 처리함: ${gaps.join(', ')}`, gapSuggest(db, ix, tgIds[0], 'Kinetic_Gap'));
    if (sgaps.length) AE('DATA_GAP', 'AUDIT_KINETIC_GAP', target, `속도 상수가 없는 공급·분해 규칙 ${sgaps.length}개는 적용하지 않음: ${sgaps.join(', ')}`, sgaps.map((x) => gapSuggest(db, ix, x.split('/')[0], 'Kinetic_Gap')).filter((x, i, a) => a.indexOf(x) === i).join(' / '));
    if (r.approx.length) AE('DATA_GAP', 'AUDIT_RESOLUTION', target, `막(2D) 분자가 낀 단계 ${r.approx.length}개는 인접 3D 부피의 농도로 환산함 (면적 농도 아님): ${r.approx.join(', ')}`, gapSuggest(db, ix, tgIds[0], 'Concentration_Gap', /2D|면적/));
    return { audit, postMortem: pm, reservoirs: resv, cycles };
  }
  function simulateRateText(db, target, raw) {
    if (!raw) return '원자료 없음 — 행정부 simulateRate 결과를 넘길 것 (orchestrator.js)';
    if (raw.error) return raw.error;
    const r = Object.assign({}, raw, auditRate(db, target, raw));
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
    for (const a of r.audit) out.push(`  [${a.code} · ${a.fault}] ${a.where}: ${a.msg}`, `      → 교정 제안: ${a.suggestion}`);
    return out.join('\n');
  }
  // 전체 감사: 저장소 검사 + 경로마다 해상도·속도 감사
  // raws: { pools (simulate rounds 0), rate (simulateRate 원자료) } — 행정부 결과를 받아 판정만 한다
  function auditRun(db, target, raws) {
    raws = raws || {};
    db = normalize(db);
    const out = [], v = validate(db);
    for (const e of v.errors) out.push({ code: 'AUDIT_SCHEMA', fault: 'DOMAIN_CONFLICT', where: e.where, msg: e.msg, suggestion: '패치를 고쳐 다시 병합' });
    const p = resolutionPlan(db, target, { pools: raws.pools });
    if (!p.error) for (const r of p.rows) if (!r.ok) out.push({ code: 'AUDIT_RESOLUTION', fault: 'DATA_GAP', where: `${r.sid} ${p.ix.label(r.sid)}`, msg: `필요 ${['R0', 'R1', 'R2'][r.need]} 인데 갖춤 ${['R0', 'R1', 'R2'][r.have]} — ${r.hits.join(', ')}: ${r.comp.map((c) => p.ix.bundleLabel(c.bundle)).join(', ')} 를 두고 ${r.comp.flatMap((c) => c.steps).filter((x, i, a) => a.indexOf(x) === i).join('·')} 가 경쟁하는데 속도 상수도 반응 중심 구조도 없음`, suggestion: gapSuggest(db, p.ix, p.ix.ruleOwner(db.steps[r.sid].rule), 'Kinetic_Gap') });
    const th = thermoLoops(db, target);
    if (!th.error) for (const l of th.loops) if (!l.ok) out.push({ code: 'AUDIT_THERMO', fault: 'DOMAIN_CONFLICT', where: l.steps.join('→'), msg: `닫힌 고리의 ΣΔG° = ${l.sum.toFixed(1)} J/mol ≠ 0 (허용 ${V.thermo.loop_tolerance}) — 미시적 가역성 위반: 고리를 한 바퀴 돌면 에너지가 생기거나 사라짐`, suggestion: '고리 단계들의 dG0 를 확인하고 하나를 나머지로부터 정할 것 (Wegscheider 조건)' });
    if (raws.rate && !raws.rate.error) out.push(...auditRate(db, target, raws.rate).audit);
    return out;
  }

  return Object.freeze({ auditRate, checkAttestations,
    needMet, limitationStatus, kindAllowed, checkEvidence, checkContext, validate, validateLimitation, validateObservation, observationImmutability, obsUnit, validateSense, MASS_REL_TOL, moietyImbalance, validateSupply, validateDegradation,
    validateModulation, validateCellState, checkBundle, validateStep, gate, patchPolicy, refsOfRule, patchReport, refineCheck, refineText, augmentCandidates, patchReportText, audit,
    auditText, limitationRows, limitationsText, limitationsMarkdown, detectGaps, simulateText, thermoIssues, thermoLoops, kineticIssues, siteRefsOf, resolutionPlan, resolutionText,
    gapSuggest, massSuggest, simulateRateText, auditRun });
});
