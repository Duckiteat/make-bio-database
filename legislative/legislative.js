// 입법부(Legislative): 데이터 정의·수정 전용. 패치를 db 에 적용한 새 db 를 계산할 뿐, 스스로 검사하거나 시뮬레이션하지 않는다.
//
// 삼권 분립 (docs/design/tripartite-governance.md)
//   merge 는 순수 함수(db, patch → 새 db + 적용 보고)다. 파일 쓰기는 legislative/clerk.mjs(입법 서기)만 하고,
//   서기는 사법부의 관문 판결이 통과일 때만 쓴다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../vocab.js'), require('../model.js'));
  else root.DefDBLegislative = factory(root.DefDBVocab, root.DefDBModel);
})(typeof self !== 'undefined' ? self : this, function (V, M) {
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


  // ===== 병합 =====
  // 패치(v4): { terms:[…], senses:[{id?, term, kind, …정의항 필드…}], steps:[{id?, rule, agents, inputs, outputs, regulators, part_of}], remove:[…] }
  //   기존 정의항은 패치에 적힌 최상위 필드만 교체된다(적지 않은 필드는 유지).
  function merge(dbIn, patchIn) {
    const db = normalize(clone(dbIn));
    // why: 변경 이유를 보고에 옮겨 적는다(판정은 사법부 관문이 한다 — 입법부는 검사하지 않는다)
    const report = { added: [], updated: [], removed: [], idmap: {}, mapped: [], errors: [], why: isObj(patchIn) ? str(patchIn.why) : '' };
    const ERR = (rule, where, msg) => report.errors.push({ where, msg, rule }); // rule: 집행하는 규칙 번호
    const MAP = (from, to, via) => report.mapped.push({ from, to, via });
    if (!isObj(patchIn)) { ERR('RULE-0505', '패치', 'JSON 객체가 아님'); return { db, report }; }
    if (isObj(patchIn.terms) || patchIn.definientia || isObj(patchIn.states) || isObj(patchIn.limitations)) { ERR('RULE-0421', '패치', '이전 형식 패치 — v4 는 terms·senses·steps 배열 (prompt 참고)'); return { db, report }; }
    if ('values' in patchIn) ERR('RULE-0125', '패치', '값 층(values)은 패치가 직접 쓰지 않는다 — 값은 정의항 obs·규칙 kinetics 로 적으면 병합이 대체·철회 기록으로 접는다 (형식 v12)');
    // 이동된 번호를 가리키는 패치는 받지 않는다 — 이동 대상을 알려 준다 (형식 v12 §6, moved 의 키 자체는 제외)
    if (db.moved) {
      const { moved: _m, why: _w, ...body } = patchIn, hit = new Set();
      for (const x of JSON.stringify(body).match(/[TDS]\d{6}/g) || []) if (db.moved[x] && !hit.has(x)) { hit.add(x); ERR('RULE-0123', x, `이동된 번호 (${db.moved[x].kind}) — ${db.moved[x].to.join('·')} 를 쓸 것`); }
    }
    const alloc = (p) => fmtId(p, db.meta.next[p]++);
    const ix0 = index(db);
    const preSenses = new Map([...ix0.termSenses].map(([k, v]) => [k, v.length]));
    const nameOwner = new Map();
    const findTerm = (name) => { const h = lookupName(ix0, name); return h.length ? h : nameOwner.has(normName(name)) ? [nameOwner.get(normName(name))] : []; };
    const claimNames = (tid, names) => {
      for (const n of names.filter(Boolean)) {
        const owner = findTerm(n).filter((x) => x !== tid);
        if (owner.length) ERR('RULE-0323', `${tid}(${db.terms[tid] ? db.terms[tid].names.ko : n})`, `이름 '${n}' 은(는) 이미 ${owner.map((o) => `${o}(${db.terms[o].names.ko})`).join(', ')} 의 이름 — 같은 개념이면 그 개념을 쓸 것`);
        else nameOwner.set(normName(n), tid);
      }
    };
    // 1. 개념
    for (const raw of arr(patchIn.terms)) {
      if (!isObj(raw)) { ERR('RULE-0505', 'terms', '개념 항목이 객체가 아님'); continue; }
      const pt = normTerm(raw), rid = str(raw.id);
      if (rid && !isTemp('T', rid)) {
        const t = db.terms[rid];
        if (!t) { ERR('RULE-0218', rid, '없는 개념 번호 — 새 개념은 임시 번호(T+1)를 쓸 것'); continue; }
        if (pt.names.ko && pt.names.ko !== t.names.ko) t.aliases.push(t.names.ko);
        t.names = { ...t.names, ...Object.fromEntries(Object.entries(pt.names).filter(([, v]) => v)) };
        t.aliases = uniq([...t.aliases, ...pt.aliases]).filter((a) => a !== t.names.ko && a !== t.names.en);
        if (pt.note) t.note = pt.note;
        claimNames(rid, [t.names.ko, t.names.en, ...pt.aliases]);
        report.updated.push(rid);
        continue;
      }
      if (!pt.names.ko) { ERR('RULE-0505', rid || 'terms', '새 개념에 names.ko 가 없음'); continue; }
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
      if (same.length > 1) { ERR('RULE-0323', pt.names.ko, `이름이 여러 개념과 겹침: ${same.join(', ')}`); continue; }
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
      if (/^T(\+|\d)/.test(r)) { ERR('RULE-0218', where, `개념 '${r}' 없음`); return null; }
      if (!r) { ERR('RULE-0500', where, 'term 없음'); return null; }
      const h = findTerm(r);
      if (h.length === 1) { MAP(r, h[0], '이름'); return h[0]; }
      if (h.length > 1) { ERR('RULE-0327', where, `이름 '${r}' 이 여러 개념과 겹침`); return null; }
      if (RESERVED.test(r)) { ERR('RULE-0323', where, `이름 '${r}' 에 # @ | / 를 쓸 수 없음`); return null; }
      const tid = alloc('T');
      db.terms[tid] = { names: { ko: r }, aliases: [] };
      nameOwner.set(normName(r), tid);
      report.added.push(tid);
      return tid;
    };
    for (const raw of arr(patchIn.senses)) {
      if (!isObj(raw)) { ERR('RULE-0505', 'senses', '정의항 항목이 객체가 아님'); continue; }
      const d = normSense(raw), rid = str(raw.id);
      if (rid && !isTemp('D', rid)) {
        const old = db.senses[rid];
        if (!old) { ERR('RULE-0060', rid, '없는 정의항 번호 — 새 정의항은 임시 번호(D+1)를 쓸 것'); continue; }
        if (raw.term && termOf(raw.term, rid) !== old.term) { ERR('RULE-0325', rid, '정의항을 다른 개념으로 옮길 수 없음'); continue; }
        const merged = clone(old);
        merged.obs = clone(old.obs); // v12: obs 는 값 층의 보기(열거되지 않음)라 clone 이 빼먹는다 — 적지 않은 obs 는 그대로
        for (const k of SENSE_FIELDS) if (d._given[k]) { if (d[k] === undefined) delete merged[k]; else merged[k] = d[k]; }
        const nd = normSense({ ...merged, term: old.term, n: old.n });
        // v11 — 측정의 파생값은 지울 수 없다. 관찰 기록을 지울 수 없게 한 것과 같은 규약이다:
        //   패치는 배열을 통째로 교체하므로 obs 한 줄을 빼면 측정값이 조용히 사라진다.
        //   잘못된 측정이면 그 관찰 기록을 retracted 로 표시한 뒤에 지운다 (그러면 아래 조건이 풀린다).
        const okey2 = (o) => `${o.property}|${o.context.location || ''}|${o.context.cell || ''}|${o.context.species || ''}`;
        const lost = old.obs.filter((o) => o.from && !nd.obs.some((x) => okey2(x) === okey2(o)))
          .filter((o) => !(db.observations[o.from] && db.observations[o.from].retracted));
        if (lost.length) { ERR('RULE-0130', rid, `측정의 파생값은 지울 수 없음 — ${lost.map((o) => `${o.property} ${o.value}${o.unit ? ' ' + o.unit : ''} (출처 ${o.from})`).join(' · ')}. 잘못된 측정이면 그 관찰 기록에 retracted 를 표시한 뒤에 지운다`); continue; }
        db.senses[rid] = nd; report.updated.push(rid); touched.push([rid, nd]);
        continue;
      }
      const tid = termOf(raw.term, rid || 'senses');
      if (!tid) continue;
      if (preSenses.get(tid) && !d.distinction) {
        ERR('RULE-0324', rid || tid, `'${db.terms[tid].names.ko}'(${tid}) 에는 이미 뜻이 있음 (${ix0.termSenses.get(tid).join(', ')}) — 고치려면 기존 번호를, 새 뜻이면 distinction 에 차이를 적을 것`);
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
      if (!isObj(raw)) { ERR('RULE-0505', 'steps', '단계 항목이 객체가 아님'); continue; }
      const st = normStep(raw), rid = str(raw.id);
      let id;
      if (rid && !isTemp('S', rid)) {
        if (!db.steps[rid]) { ERR('RULE-0060', rid, '없는 단계 번호 — 새 단계는 임시 번호(S+1)를 쓸 것'); continue; }
        id = rid; report.updated.push(id);
      } else { id = alloc('S'); if (rid) report.idmap[rid] = id; report.added.push(id); }
      db.steps[id] = st; touchedSteps.push([id, st]);
    }
    // 3b. 한계
    const touchedLimits = [];
    for (const raw of arr(patchIn.limitations)) {
      if (!isObj(raw)) { ERR('RULE-0505', 'limitations', '한계 항목이 객체가 아님'); continue; }
      const l = normLimitation(raw), rid = str(raw.id);
      let id;
      if (rid && !isTemp('L', rid)) {
        if (!db.limitations[rid]) { ERR('RULE-0060', rid, '없는 한계 번호 — 새 한계는 임시 번호(L+1)를 쓸 것'); continue; }
        id = rid; report.updated.push(id);
      } else { id = alloc('L'); if (rid) report.idmap[rid] = id; report.added.push(id); }
      db.limitations[id] = l; touchedLimits.push([id, l]);
    }
    // 3c. 관찰 기록 (v10, docs/design/observation-port.md) — 새 기록만. 기존 번호에는 철회 표시(retracted)만 더할 수 있다
    const touchedObs = [];
    for (const raw of arr(patchIn.observations)) {
      if (!isObj(raw)) { ERR('RULE-0505', 'observations', '관찰 항목이 객체가 아님'); continue; }
      const rid = str(raw.id);
      if (rid && !isTemp('O', rid)) {
        const o = db.observations[rid];
        if (!o) { ERR('RULE-0060', rid, '없는 관찰 번호 — 새 관찰은 임시 번호(O+1)를 쓸 것'); continue; }
        const extra = Object.keys(raw).filter((k) => !['id', 'retracted'].includes(k));
        if (extra.length || !isObj(raw.retracted)) { ERR('RULE-0448', rid, `관찰 기록은 바꿀 수 없음 — 기존 번호에는 retracted 만 (적은 필드: ${extra.join(', ') || '없음'})`); continue; }
        db.observations[rid] = { ...o, retracted: normObservation({ retracted: raw.retracted }).retracted };
        report.updated.push(rid);
        continue;
      }
      const id = alloc('O'); if (rid) report.idmap[rid] = id; report.added.push(id);
      db.observations[id] = normObservation(Object.assign({}, raw, str(patchIn.recorded_at) ? { recorded_at: str(patchIn.recorded_at) } : {})); touchedObs.push([id, db.observations[id]]);
    }
    // 4. 참조·어휘 매핑
    const ix = index(db);
    const ref = (r, where) => {
      if (!r) return r;
      if (report.idmap[r]) return report.idmap[r];
      const x = resolveRef(ix, r);
      if (x.error) { ERR('RULE-0004', where, x.error); return r; }
      if (x.via !== 'id') MAP(r, x.id, x.via);
      return x.id;
    };
    const voc = (table, value, where) => {
      if (value == null || value === '') return value;
      const m = mapVocab(table, value);
      if (m.error) { ERR('RULE-0330', where, m.error); return value; }
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
      for (const x of d.xrefs || []) if (x.role) x.role = voc('xrefRoles', x.role, id);
      if (d.membrane) {
        d.membrane.association = voc('associations', d.membrane.association, id);
        if (d.membrane.location) d.membrane.location = voc('locations', d.membrane.location, id);
        if (d.membrane.side) d.membrane.side = voc('faces', d.membrane.side, id);
        if (d.membrane.route) d.membrane.route = d.membrane.route.map((l) => voc('locations', l, id));
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
      for (const m of d.mechanisms || []) m.ref = ref(m.ref, `${id} 기전 프로그램`);
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
      if (!m) ERR('RULE-0069', id, `규칙 참조 '${st.rule}' 형식 — 'D…/rule/키' 또는 { owner, id }`);
      else st.rule = `${ref(m[1], `${id} 규칙 소유자`)}/rule/${m[2]}`;
      for (const k of ['agents', 'inputs', 'outputs', 'regulators']) for (const p of st[k]) {
        if (p.b) {
          const b = parseBundle(p.b);
          if (!b.error) { b.base = ref(b.base, `${id} 묶음`); b.location = voc('locations', b.location, id); b.features = b.features.map((f) => ({ site: f.site, feature: voc('features', f.feature, id) })); p.b = bundleKey(b); }
          continue;
        }
        const raw = p.raw; delete p.raw;
        const feats = raw.features.map((f) => { const i = f.indexOf(':'); return i > 0 ? { site: f.slice(0, i), feature: voc('features', f.slice(i + 1), id) } : (ERR('RULE-0359', id, `특징 '${f}' 형식 — '부위:특징'`), null); }).filter(Boolean);
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
    // 관찰 기록의 대상(묶음 키·세포 상태·규칙)과 어휘, 속도 상수의 출처 관찰 번호
    // 측정 대상 하나: 묶음 키의 머리·세포 상태·규칙 참조를 번호로
    const obsTarget = (kind, t, w) => {
      const tk = V.observables[kind] && V.observables[kind].target;
      if (tk === 'bundle' && t) { const parts = t.split('|'); parts[0] = report.idmap[parts[0]] || ref(parts[0], w); return parts.join('|'); }
      if (tk === 'cell_state') return ref(t, w);
      if (tk === 'rule') return target(t, w);
      return t;
    };
    for (const [id, o] of touchedObs) {
      if (o.kind === 'qualitative') { // 정성 관찰 (v12 §4): 읽을 거리·교란 대상
        o.readout.kind = voc('observables', o.readout.kind, id);
        if (o.readout.target) o.readout.target = obsTarget(o.readout.kind, o.readout.target, `${id} 읽을 거리`);
        if (o.expect && typeof o.expect === 'object') o.expect.order = o.expect.order.map((t) => obsTarget(o.readout.kind, t, `${id} 순서`));
        const p = o.perturbation;
        if (p && p.target) p.target = p.type === 'knockout' ? ref(p.target, `${id} 교란 대상`) : p.type === 'clamp' ? obsTarget('amount', p.target, `${id} 교란 대상`) : target(p.target, `${id} 교란 대상`);
      } else {
        const ob = o.observable;
        ob.kind = voc('observables', ob.kind, id);
        ob.target = obsTarget(ob.kind, ob.target, `${id} 측정 대상`);
        o.uncertainty.kind = voc('uncertaintyKinds', o.uncertainty.kind, id);
        o.uncertainty.model = voc('noiseModels', o.uncertainty.model, id);
        if (o.calibration) o.calibration.kind = voc('calibrationKinds', o.calibration.kind, id);
      }
      if (o.condition.condition && Array.isArray(o.condition.condition)) o.condition.condition = o.condition.condition.map((d) => ref(d, `${id} 조건`));
      o.use = voc('obsUses', o.use, id);
      if (o.condition.location) o.condition.location = voc('locations', o.condition.location, id);
      o.condition.states = o.condition.states && o.condition.states.map((b) => { const parts = b.split('|'); parts[0] = report.idmap[parts[0]] || ref(parts[0], `${id} 조건 상태`); return parts.join('|'); });
      if (!o.condition.states) delete o.condition.states;
    }
    for (const [, d] of new Map(touched)) for (const r of d.rule) for (const f of (r.kinetics && r.kinetics.from) || []) if (report.idmap[f.obs]) f.obs = report.idmap[f.obs];
    // v11: 정의항 obs 의 관찰 기록 참조도 같은 치환을 받는다 (kinetics.from 과 같은 자리)
    for (const [, d] of new Map(touched)) for (const b of d.obs) if (b.from && report.idmap[b.from]) b.from = report.idmap[b.from];
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
      if (db.observations[r]) { ERR('RULE-0110', r, '관찰 기록은 지울 수 없음 — 잘못된 관찰은 retracted 로 표시'); continue; }
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
      ERR('RULE-0505', r, '삭제 대상 없음 (번호로 지정할 것)');
    }
    // 5b. 번호 이동 (형식 v12 §6): { "D000123": { to: ["D000045"], kind: "merge" | "split", why } } — 옛 번호는 지우고 이동 기록을 남긴다.
    //   옛 번호를 가리키던 참조는 같은 패치가 새 번호로 고쳐 적어야 한다(사법부가 남은 참조를 거부). 값은 대상이 사라져 철회된다
    if (isObj(patchIn.moved)) for (const [from, m] of Object.entries(patchIn.moved)) {
      const t = ({ T: db.terms, D: db.senses, S: db.steps })[from[0]];
      if (!isObj(m) || !t || !t[from]) { ERR('RULE-0122', from, '이동할 번호가 없음 (개념·정의항·단계 번호로)'); continue; }
      if (db.moved && db.moved[from]) { ERR('RULE-0122', from, '이미 이동된 번호'); continue; }
      if (from[0] === 'D') { const tid = db.senses[from].term; delete db.senses[from]; gone.add(from); if (!Object.values(db.senses).some((x) => x.term === tid)) { delete db.terms[tid]; report.removed.push(tid); } }
      else delete t[from];
      report.removed.push(from);
      db.moved = db.moved || {};
      db.moved[from] = { to: arr(m.to).map((x) => report.idmap[str(x)] || str(x)), kind: str(m.kind), at: str(patchIn.recorded_at), why: str(m.why) || report.why };
    }
    // 합쳐진 정의항을 가리키던 설명 연결은 대상으로 옮기고, 지워진 것은 뺀다
    const redirect = (to) => (db.moved && db.moved[to] && db.moved[to].kind === 'merge' && gone.has(to) ? db.moved[to].to[0] : null);
    if (gone.size) for (const d of Object.values(db.senses)) for (const ds of d.desc) {
      ds.links = ds.links.map((l) => (redirect(l.to) ? Object.assign(l, { to: redirect(l.to) }) : l)).filter((l) => !gone.has(l.to));
      ds.links = ds.links.filter((l, i) => ds.links.findIndex((x) => x.to === l.to && x.rel === l.rel) === i);
    }
    foldValues(db, report, str(patchIn.recorded_at), report.why, ERR);
    return { db, report };
  }

  // 값 층 접기 (형식 v12): 병합이 만든 obs·kinetics(지금 모양)를 값 기록으로 — 바뀐 것은 새 기록이 대체(supersedes), 빠진 것은 철회.
  //   기록은 바꾸거나 지우지 않는다. 새 기록의 recorded_at 은 패치가 가진 시각(병합 전에 dbtool 이 찍음 — 재생해도 같다).
  function foldValues(db, report, recordedAt, why, ERR) {
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k), cur = M.currentValues(db), ops = { added: [], superseded: [], retracted: [] };
    const add = (v, sup) => { const id = fmtId('V', db.meta.next.V++); db.values[id] = Object.assign(v, recordedAt ? { recorded_at: recordedAt } : {}, sup ? { supersedes: sup } : {}); (sup ? ops.superseded : ops.added).push(id); };
    const retract = (id, note) => { db.values[id].retracted = recordedAt ? { note, at: recordedAt } : { note }; ops.retracted.push(id); };
    const strip = (v) => { const { recorded_at, supersedes, evidence_at, retracted, ...rest } = v; return M.canonJ(rest); };
    const diff = (want, have, keyOf, note) => {
      const left = new Map(have.map(([id, v]) => [keyOf(v), id]));
      for (const v of want) { const k = keyOf(v), id = left.get(k); if (id) { left.delete(k); if (strip(db.values[id]) !== strip(v)) add(v, id); } else add(v); }
      for (const id of left.values()) retract(id, note);
    };
    const why0 = `패치에서 빠짐 — ${why || '이유 없음'}`, liveRules = new Set();
    for (const [sid, d] of Object.entries(db.senses)) {
      if (own(d, 'obs')) {
        const have = (cur.get(sid) || []).filter(([, v]) => !v.subject.includes('/rule/'));
        diff((d.obs || []).map((o) => M.valueOfObs(sid, o)), have, (v) => M.obsKey(M.obsOfValue(v)), why0);
        delete d.obs;
      }
      for (const r of d.rule || []) {
        const ref = `${sid}/rule/${r.id}`;
        if (own(r, 'kinetics')) { const k = r.kinetics; delete r.kinetics; if (k) { M.placeLaw(r, M.lawOfKinetics(k)); diff(M.valuesOfKinetics(ref, k), cur.get(ref) || [], (v) => v.property, why0); } else delete r.kinetic_law; }
        if (r.kinetic_law) liveRules.add(ref);
      }
    }
    // 대상이 사라진 현재 값(정의항·규칙 삭제, 속도 법칙을 뺀 규칙)은 철회
    for (const [subject, list] of cur) {
      const dead = subject.includes('/rule/') ? !liveRules.has(subject) : !db.senses[subject];
      if (dead) for (const [id] of list) if (!db.values[id].retracted) retract(id, `대상이 없어짐 — ${why || '이유 없음'}`);
    }
    if ((ops.added.length || ops.superseded.length) && !recordedAt) ERR('RULE-0126', '패치', '값이 바뀌는데 recorded_at 이 없음 — 병합 전에 dbtool 이 찍는다 (형식 v12, 재생 결정론)');
    report.values = ops;
    M.attachViews(db);
  }
  const ingest = (db, obj) => merge(db, obj);

  // 리팩터링 패치 초안 (정제 점검 판결 → 패치): 참조되지 않는 중복 규칙 제거. 사법부 refineCheck 의 issues 를 받는다.
  function draftRefactor(db, issues) {
    db = normalize(db);
    const rm = issues.filter((x) => x.type === 'duplicate_rule' && x.removable);
    const byOwner = new Map(); for (const x of rm) { const [o, , k] = x.where.split('/'); if (!byOwner.has(o)) byOwner.set(o, new Set()); byOwner.get(o).add(k); }
    const refactor = byOwner.size ? { format: PATCH_FORMAT, version: VERSION, why: `리팩터링 패치 (정제 점검): 참조되지 않는 중복 규칙 ${rm.length}개 제거 — ${rm.map((x) => `${x.where} = ${x.same_as}`).join(', ')}`, senses: [...byOwner].map(([o, ks]) => ({ id: o, rule: db.senses[o].rule.filter((r) => !ks.has(r.id)) })) } : null;
    return refactor;
  }

  return Object.freeze({ draftRefactor,
    merge, ingest });
});
