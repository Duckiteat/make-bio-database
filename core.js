// 맥락 보존형 생명과학 데이터베이스 — 행정부(Executive): 읽기·질의·시뮬레이션 전용.
//
// 삼권 분립 (docs/design/tripartite-governance.md)
//   이 파일은 규칙과 초기 상태의 순수 함수다. 데이터를 쓰지 않고(db.json·파일), 스스로 검사·승인·'verified' 선언을 하지 않는다.
//   시뮬레이션은 원자료(raw facts)만 내고, 감사·사후 분석·판정은 사법부(judicial/)가, 병합·기록은 입법부(legislative/)가 한다.
//   공유 형식·정규화·색인은 model.js 에서 읽는다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vocab.js'), require('./model.js'));
  else root.DefDB = factory(root.DefDBVocab, root.DefDBModel);
})(typeof self !== 'undefined' ? self : this, function (V, M) {
  'use strict';
  const {
    NA, VOL, SAT_K, hillFactor, ruleLine, SITE_RE,
    FORMAT, REL, UP_OF, AXIS_UP, AXIS_DOWN, ROLE, EFFECT_TYPES, CONSERVING, ID_RE, fmtId, isId, isTemp,
    isStepId, isObj, clone, str, arr, uniq, RESERVED, RES_RE, MOLECULAR, isParticipantKind, GREEK, normName,
    lev, similar, VTABLES, VNAME, VIX, mapVocab, vlabel, parseXref, xrefKey, xrefLabel, fpKey, locAncestors,
    locSides, sameFamily, locCompatible, taxAncestors, parseBundle, bundleKey, emptyDB, normalize, normTerm, normEvidence, normContext, normDesc,
    normSite, normRule, normKinetics, KIN_FIELDS, SIGNED_KIN, ENV_FIELDS, normObs, SENSE_FIELDS, normSense, normPart, normStep, normNeed,
    normLimitation, parseTarget, index, lookupName, mechIndex, defaultTier, moietyOf, entityTally, resolveRef, suggest, stepLine, targets,
    chains, MOTIFS, trajectory, RT, sccs, parseLoose, PATCH_FORMAT, VERSION,
  } = M;

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

  // ===== 속도 기반 시뮬레이션 (Rate-based) + 생애 주기·대사물 저장소 (형식 v7) =====
  // 농도 = 분자 수 / (N_A × 반응 부피). 속도 법칙: mass_action · binding(가역) · michaelis_menten · zero_order(공급).
  // 속도 상수가 없는 단계는 '즉시'(사건 기반)로 처리하고 Kinetic_Gap 으로 표시한다.
  // 대사물 저장소(Metabolic Reservoir): 보조 기질·부산물·만들어지지 않는 변환 기질 = 위치마다 하나의 유한한 전역 풀(기본, reservoirs 'finite').
  //   단계가 소비하면 줄고, 공급 규칙(supply)·분해 규칙의 재활용(recycled)이 채운다. 바닥나면 그 단계는 멈춘다(고갈) — 오류가 아니라 결과.
  // 분해 규칙(degradation): 소유 정의항의 묶음이 1차(k_deg)로 분해 — 결정론 N(1−e^{−kΔt}) 또는 확률적(이항, seed 고정).
  // 매 Δt 질량 감사: ① 단계가 일어날 때마다 국소 수지(실체·부분 구조) ② 전역 합계 = 시작 + 원장(분해·재활용·공급·교환).
  // scenario: { name, hypothetical, cell, volumes, amounts, reservoirs: { 'D…|위치': 수 }, kinetics: { 'D…/rule/키': {…} }, reservoir_mode, stochastic, seed }
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
    // 원자료만 낸다 (판정·감사·제안 없음): facts 는 관찰된 사실, 나머지는 상태·원장·사건. 판정은 사법부 auditRate 가 한다.
    const ids = base.ids, cell = base.cell, facts = [], kineticGaps = [], approx = new Set(), events = [], seen = new Set(), kinUsed = [], firstFire = {}, negatives = {};
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
          if (n == null) { once('seqlen' + ref, () => facts.push({ kind: 'recycle_stoich_unknown', ref, owner: b.split('|')[0] })); continue; }
          addRes(rb); rec.push({ b: rb, n });
        }
        if (!k) kineticGaps.push(ref);
        else kinUsed.push({ ref, step: null, owner: b.split('|')[0], kin: k });
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
      else kinUsed.push({ ref: s.ref, step: null, owner: s.owner, kin: k });
    }
    // --- 반응 단계
    const react = new Map();
    for (const sid of ids) {
      const st = db.steps[sid], rule = ix.ruleOf(st.rule), k = kinOf(st.rule);
      const parts = [...st.agents, ...st.inputs, ...st.outputs].filter((p) => !p.minor);
      const loc3 = parts.map((p) => locOf(p.b)).find((l) => V.locations[l] && V.locations[l].dim === '3D');
      if (parts.some((p) => V.locations[locOf(p.b)] && V.locations[locOf(p.b)].dim === '2D')) approx.add(sid);
      const vol = loc3 ? volOf(loc3) : null;
      if (k) kinUsed.push({ ref: st.rule, step: sid, owner: st.rule.split('/')[0], kin: k });
      else kineticGaps.push(sid);
      // Tier 1 (v8): 구획 환경(pH·ε)과 전이 상태 이론·ΔG° 로 국소 k, k_r — 역 상수는 상세 균형으로 정해진다
      if (k && k.law === 'mass_action' && (k.k0 > 0 || Number.isFinite(k.dG0) || k.env)) { const r2 = rateAt(k, envOf(loc3)); k.k = r2.kf; if (Number.isFinite(k.dG0)) { k.k_r = r2.kr; k.reversible = true; } k.dG_env = r2.dG_env; }
      // 유한 저장소면 저장소도 입력·출력으로 센다(소비하면 준다). 무한 풀이면 v6 처럼 빼고 교환 원장에 적는다.
      const inc = (p) => finite || !res.has(p.b);
      const ins = new Map(), outs = new Map();
      for (const p of st.inputs) if (inc(p)) ins.set(p.b, (ins.get(p.b) || 0) + (p.n || 1));
      for (const p of st.outputs) if (inc(p)) outs.set(p.b, (outs.get(p.b) || 0) + (p.n || 1));
      const lawIns = new Map([...ins].filter(([b]) => st.inputs.some((p) => p.b === b && !p.minor)));
      const lawOuts = new Map([...outs].filter(([b]) => st.outputs.some((p) => p.b === b && !p.minor)));
      const own = new Map([...ins].filter(([b]) => !res.has(b)));
      react.set(sid, { st, rule, k: k && vol ? k : null, kin0: k, V: vol ? vol.L : null, loc: loc3, ins, outs, lawIns, lawOuts, own });
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
    // 기록점마다 상태와 누적 원장의 사본 — 사법부가 이것으로 질량 수지를 독립적으로 다시 계산한다
    const snap = (o) => Object.assign({}, o);
    const record = (t) => series.push({ t, N: Object.fromEntries([...N].filter(([b]) => finite || !res.has(b))),
      ledger: { created: snap(created), destroyed: snap(destroyed), exIn: snap(exIn), exOut: snap(exOut), covalent: snap(chan.covalent), source: snap(chan.source), lost: snap(chan.lost), recycle: snap(chan.recycle), violation: snap(chan.violation) } });
    const ev = (e) => { if (events.length < 200) events.push(e); };
    const stalls = {}, stiff = {};
    record(0);
    const steps = Math.ceil(opt.t_end / opt.dt), every = opt.trace === 'full' ? 1 : Math.max(1, Math.floor(steps / 200));
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
        if (firstFire[sid] == null) firstFire[sid] = t; // 첫 발화 시각 (국소 수지 판정은 사법부가 이 시각과 화학량으로)
        // 부분 구조 원장: 공유 결합 수식은 '공유 결합' 경로, 그 밖의 한 번당 변화는 '규칙 밖' 경로에 적는다 (판정 아님 — 장부)
        if (finite && Object.keys(x.unitMoi).length) addTo(x.covalent ? chan.covalent : chan.violation, x.unitMoi, xi);
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
      // ⑤ 고갈·재생 사건 (유한 저장소)
      if (finite) for (const [b, r] of Object.entries(resStat)) {
        const n = N.get(b) || 0;
        if (n < -1e-9 && negatives[b] == null) negatives[b] = { t, n };
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
    // 끝 시점 감시 단계의 정·역 흐름 (사후 분석의 평형 판단 재료)
    const endFlux = {};
    for (const sid of watch) { const x = react.get(sid), k = x.k; if (!k || k.law !== 'mass_action' || !k.reversible || !k.k_r) continue; endFlux[sid] = { f: k.k * [...x.lawIns].reduce((a, [b2, n]) => a * conc(b2, x.V) ** n, 1) * x.st.agents.reduce((a, p2) => a * conc(p2.b, x.V), 1), r: k.k_r * [...x.lawOuts].reduce((a, [b2, n]) => a * conc(b2, x.V) ** n, 1) }; }
    for (const [b, r] of Object.entries(resStat)) r.end = N.get(b);
    return { ids, cell, mode, finite, stochastic, scenario: sc.name || null, hypothetical: !!sc.hypothetical, series, firstReach, firstFire, final: Object.fromEntries(N), facts, kineticGaps, kinUsed, react, ix, t_end: opt.t_end, dt: opt.dt, bulk: opt.bulk,
      reservoirSet: [...res], reservoirs: resStat, ledger, events, stalls, negatives, stiff, endFlux, targets: tg.ids,
      supplies: sup.map((s) => ({ ref: s.ref, owner: s.owner, loc: s.loc, V: s.V, active: !!(s.k && s.V), law: s.k ? s.k.law : null, src: s.k ? s.k.src : null, kin: s.k, consumes: s.rule.consumes.map((q) => `${q.ref}|${s.loc}`), produces: s.rule.produces.map((q) => `${q.ref}|${s.loc}`) })),
      degradations: degr.map((g) => ({ bundle: g.b, ref: g.ref, k_deg: g.k, fate: g.rule.fate, src: g.kin ? g.kin.src : null, recycle: g.rec.map((q) => q.b) })),
      created, destroyed, exIn, exOut, channels: chan, chemical: [...changing], stepCycles, cum, watch: [...watch], zeroAt, lastTurn, death, peakRate: peak.rate, deathFrac, approx: [...approx], modulationGaps: [...modGaps] };
  }

  return Object.freeze(Object.assign({}, M, {
    mapText, line, ruleLine, contextText, mechanismText, vlist, promptText, motifCtx, findMotifs, patternText, simulate, envShift,
    rateAt, rngOf, binomial, supplyRules, modulationIndex, simulateRate }));
});
