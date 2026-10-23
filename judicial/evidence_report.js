// 증거·방법 보고서 (Evidence & Method Report) — build-plan 12 / 설계 §13.4 "독자 = 논문·분야 전문가"
//   한 사람이 이것 하나를 읽고 결론을 완전히 이해하고 질문할 수 있어야 한다. 그래서 인과만이 아니라
//   그 인과를 따라간 방식·사고 패턴(지문)을 드러내고, 자료를 다 보이고, 실패·막다른 길을 숨기지 않으며,
//   끝에서 '얻은 것 · 다음으로 나갈 지점 · 바닥의 불안정함' 을 말한다.
// 삼권 분립: 이 파일은 사법부다. db(정규화된 보기)와 시나리오만 읽고, 엔진을 돌리거나 파일을 쓰지 않는다.
//   사고 패턴(지문)은 지어낸 산문이 아니라 '등급·닫는 방법·등록된 한계·falsifiable 판정' 이라는 실제 규약의 자취다.
//   이름은 데이터 색인(ix.label)으로 표시만 한다 — 분자·반응 이름을 코드가 알지 않는다.
'use strict';
const crypto = require('crypto');
const M = require('../model.js');
const V = require('../vocab.js');
const REL = require('./reliability.js');
const DICT = require('../dictionary.js'); // 통제 토큰(닫는 방법·판정 수준)의 라벨·의미는 사전 조회 — 코드에 문구를 두지 않는다 (build-plan 16A)
const PROTO = require('./protocol.js');
const IRB = require('../compiler/ir_builder.js'); // 세포 상태 계의 규칙 집합 — 엔진이 먹는 것과 같은 조립(공유 순수 층)
const { limitationStatus } = require('./judicial.js');
const sha = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const fmt = (x) => (x == null || !Number.isFinite(x) ? '—' : Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(3) : (+x.toPrecision(5)).toString());

// 닫는 방법 (설계 §13 B 분류): measure(재서 닫음) · computed(측정에서 도구 계산) · transfer/assumed(실측 아님) · abstraction(기전 경계·묶음) · none(속도 상수 없음 → 사건 기반)
// 반환 = { closure: 토큰(vocab.closureMethods), detail: 이 고리에서의 세부(R2), label: 사전 라벨 + 세부, measured }
const closureLabel = (key, detail) => `${key} — ${DICT.entry(key).label_ko}${detail ? ' · ' + detail : ''}`;
const closure = (key, detail, measured) => ({ closure: key, detail: detail || null, label: closureLabel(key, detail), measured });
function closureOfRule(rule) {
  const k = rule && rule.kinetics;
  if (!k) return closure('none', null, false);
  if (k.lumped) return closure('abstraction', '묶은 상수(lumped), 원 관찰에서 재계산', false);
  const lvl = k.evidence && k.evidence.level;
  if (lvl === 'curated') return closure('measure', null, true);
  if (lvl === 'computed') return closure('computed', null, true);
  if (lvl === 'predicted') return closure('assumed', '예측값', false);
  if (lvl === 'abstracted') return closure('abstraction', '추론으로 대체', false);
  return closure('assumed', `근거 수준 ${lvl || '?'}`, false);
}
// 실행에 실제로 쓰인 상수의 닫는 방법: 시나리오가 덮어쓴 값은 db 근거와 무관하게 가정(시나리오 값은 hypothetical 만 허용)
function closureOfUse(k, src) {
  if (k && src === 'scenario') return closure('assumed', '시나리오가 지정한 가상 값', false);
  return closureOfRule({ kinetics: k || null });
}
const PARAM_KO = { kcat: '최대 회전수 kcat', Km: '반포화 농도 Km', k: '속도 상수 k', k_r: '역반응 속도 k_r', k_on: '결합 속도 k_on', k_off: '해리 속도 k_off', Kd: '해리 상수 Kd', k0: '전지수 인자 k0', dG_act: '활성화 에너지 ΔG‡', dG0: '표준 반응 자유에너지 ΔG°′', half_life: '반감기', K: '힐 반포화 K', n: '힐 계수 n', fmax: '최대 배율 fmax', fmin: '최소 배율 fmin' };
function taxonLabel(sp) { if (!sp) return null; const t = V.taxa && V.taxa[sp]; const nm = t && (t.ko || t.en || t.name); return nm ? `${nm}(${sp})` : sp; }
// 대상 참조를 사람 이름 + 번호로: "시트르산 회로 (D000148)" · "석신산 탈수소효소 · 석신산 산화 (D000154/rule/oxidize)"
function labelRef(ix, db, ref) {
  if (!ref) return '(미지정)';
  const t = M.parseTarget(ref);
  if (t && t.sub === 'rule') { const d = db.senses[t.base], r = d && d.rule.find((x) => x.id === t.key); return `${ix.label(t.base)}${r && r.label ? ' · ' + r.label : ''} (${ref})`; }
  return `${ix.label((t && t.base) || ref)} (${ref})`;
}
// 사고 패턴: 각 닫는 방법이 결론에 싣는 무게 = 사전의 의미(vocab.closureMethods.note) — 독자가 스스로 판단하도록
const closureMeaning = () => Object.fromEntries(Object.keys(require('../vocab.js').closureMethods).map((k) => [k, DICT.entry(k).meaning_ko]));

function evidenceReport(db, scenario, opt = {}) {
  db = M.normalize(db);
  const ix = M.index(db), L = (id) => ix.label(id);
  scenario = scenario || {};
  const tgtRef = opt.target;
  const tg = tgtRef ? M.resolveRef(ix, tgtRef) : { error: '대상(target)이 없음 — --target <경로|상태>' };
  if (tg.error) return { error: tg.error };
  const target = tg.id, targetKind = (db.senses[target] || {}).kind;
  const ruleOf = (ref) => { const d = db.senses[ref.split('/')[0]]; return d && d.rule.find((r) => ref.endsWith('/' + r.id)); };
  const relRows = REL.items(db, opt.reliability || {});
  const gradeOf = (ref, what) => relRows.find((r) => r.target === ref && r.what === what) || null;
  const bl = (key) => (ix.bundleLabel ? ix.bundleLabel(key) || key : key);
  // 실행에 쓰이는 상수: 시나리오 덮어쓰기가 db 보다 앞선다 (엔진·컴파일러의 kinOf 와 같은 우선순위)
  const kinUse = (ref) => (scenario.kinetics || {})[ref] ? { k: scenario.kinetics[ref], src: 'scenario' } : { k: (ruleOf(ref) || {}).kinetics || null, src: 'data' };

  // 사슬 고리 원재료 — 경로: part_of 위계 아래 단계(반응 순서) · 세포 상태: 컴파일러가 조립한 계(공급·분해·기전 단계·조절), 엔진이 먹는 것과 같은 집합
  let links = [], states = [], excluded = [];
  if (targetKind === 'cell_state') {
    const A = IRB.assemble(db, target, scenario);
    if (A.error) return { error: A.error };
    states = A.states;
    excluded = A.facts.filter((f) => f.kind === 'excluded').map((f) => f.ref);
    const seen = new Set();
    for (const R of A.rules) {
      if (R.dir === 'r' || seen.has(R.ref)) continue; // 가역 결합의 역 채널은 같은 고리
      seen.add(R.ref);
      links.push({ sid: R.step || null, kind: R.kind, ref: R.ref, inputs: R.cons.map((q) => bl(q.b)), outputs: R.prods.map((q) => bl(q.b)) });
      for (const m of R.mods || []) if (!seen.has(m.ref + '>' + R.ref)) {
        seen.add(m.ref + '>' + R.ref);
        links.push({ sid: null, kind: 'modulation', ref: m.ref, inputs: [bl(m.b)], outputs: [], effect: m.rule.effect, on: R.ref });
      }
    }
  } else {
    for (const sid of ix.stepsIn(target)) { // part_of 위계 아래 모든 하위 경로의 단계, 반응 순서(위상 정렬) — 속도 실행과 같은 집합
      const ref = db.steps[sid].rule, eff = (ruleOf(ref) || {}).effect || {};
      links.push({ sid, kind: 'step', ref, inputs: (eff.consumes || []).map(L), outputs: (eff.produces || []).map(L) });
    }
  }
  const steps = links.filter((x) => x.sid).map((x) => x.sid);

  // 2·3. 인과 사슬 + 값 표 — 이름으로(번호 아님), 기질 → 〈효소〉 → 산물 로 인과를 드러낸다
  const chain = [], values = [];
  for (const lk of links) {
    const ref = lk.ref, rule = ruleOf(ref), u = kinUse(ref), c = closureOfUse(u.k, u.src);
    const g = u.src === 'data' ? gradeOf(ref, 'kinetics') : null, senseId = ref.split('/')[0];
    const reaction = (rule && rule.label) || (lk.sid ? L(lk.sid) : ref);
    chain.push({ sid: lk.sid, kind: lk.kind, enzyme: L(senseId), reaction, inputs: lk.inputs, outputs: lk.outputs,
      effect: lk.effect || null, on: lk.on ? { ref: lk.on, label: (ruleOf(lk.on) || {}).label || lk.on } : null,
      rule: ref, closure: c.closure, closureLabel: c.label, measured: c.measured, grade: g ? g.grade : null, src: u.k ? u.src : null });
    const k = u.k;
    if (!k || u.src !== 'data') continue; // 시나리오 값은 3b 가정 표에
    if (values.some((v) => v.rule === ref)) continue;
    for (const f of M.KIN_VALUE_FIELDS) {
      if (k[f] == null) continue;
      const srcs = (k.evidence && k.evidence.sources) || [];
      const fromObs = (k.from || []).filter((x) => x.param === f).map((x) => x.obs);
      values.push({ step: lk.sid, rule: ref, enzyme: L(senseId), reaction,
        param: f, paramKo: PARAM_KO[f] || f, value: k[f], unit: unitOf(db, ref, f, k),
        species: taxonLabel((k.context && k.context.species) || null), sources: srcs.map((s) => `${s.db}:${s.id}`), fromObs,
        closure: c.closure, closureLabel: c.label, grade: g ? { grade: g.grade, s: g.s, d: g.d, why: g.why } : null });
    }
  }

  // 1′. 교란 (파생 시나리오 = 기준 + 교란 한 줄): 무엇을 바꾼 실험인지 — 풀기는 부르는 쪽(compiler/perturb.derive), 여기선 기록을 보이기만
  const perturbation = opt.derived ? { base: opt.derived.base, perturbation: opt.derived.record.perturbation, change: opt.derived.record.change, hash: opt.derived.record.hash } : null;

  // 3b. 가정 입력 (시나리오의 가상 값) — 자료를 다 보인다: 무엇이 측정이고 무엇이 가정인지 나란히
  const assumptions = [];
  const hyp = !!scenario.hypothetical;
  for (const [key, v] of Object.entries(scenario.amounts || {})) assumptions.push({ kind: '시작량', key: bl(key), value: v });
  for (const [key, v] of Object.entries(scenario.reservoirs || {})) assumptions.push({ kind: '저장소(무한 풀)', key: bl(key), value: v });
  for (const [key, v] of Object.entries(scenario.volumes || {})) assumptions.push({ kind: '부피', key: bl(key), value: `${v.value} ${v.unit}` });
  for (const [key, v] of Object.entries(scenario.buffered || {})) assumptions.push({ kind: '완충(농도 고정)', key: bl(key), value: `${v.conc_M} M` });
  for (const [key, v] of Object.entries(scenario.signals || {})) assumptions.push({ kind: '신호(시각별 분자 수)', key: bl(key), value: (Array.isArray(v) ? v : []).map((p) => `t=${p.t}s: ${p.n}`).join(', ') });
  for (const [key, v] of Object.entries(scenario.thresholds || {})) assumptions.push({ kind: '표지 문턱(낮음·높음)', key: bl(key), value: `${v.low} · ${v.high}` });
  for (const key of Object.keys(scenario.kinetics || {})) { const r = key.split('/')[0]; assumptions.push({ kind: '속도 상수 덮어쓰기', key: `${L(r)} — ${(ruleOf(key) || {}).label || key}`, value: '시나리오에서 지정' }); }

  // 5. 실패·막다른 길 — 등록된 한계가 곧 '이래서 안 됐다 / 이게 있어야 닫힌다' 의 기록
  const pathRefs = new Set([target, ...states, ...steps, ...links.map((x) => x.ref)]);
  const pathBases = new Set([target, ...states, ...links.map((x) => x.ref.split('/')[0])]);
  const onPath = (t) => pathRefs.has(t) || pathBases.has((M.parseTarget(t) || {}).base);
  const failures = [];
  for (const [id, l] of Object.entries(db.limitations)) {
    if (!onPath(l.target)) continue;
    const s = limitationStatus(db, l);
    if (s.status.startsWith('resolved')) continue; // 닫힌 것은 실패가 아니다
    failures.push({ id, type: l.type, target: l.target, targetLabel: labelRef(ix, db, l.target), status: s.status, done: s.done, total: s.total, text: l.requirement.text });
  }
  failures.sort((a, b) => a.id.localeCompare(b.id));

  // 4. 판정 수준 + 판정 기준과 그 근거 (무슨 기준으로 이렇게 잡았나 — reliability.js 의 실제 정의에서)
  // 판정 수준: 규약 선언만으로는 검증이 아니다 — 사전 등록부(입력 해시)와 맞아야 한다(protocolVerdict). 규약 검사가 hypothetical 보다 앞선다
  //   (검증 시나리오도 농도·상수는 가상이다 — 그때 결론은 규약이 선언한 검증 세트의 판정이지, 가상 숫자 자체가 아니다)
  const pv = PROTO.protocolVerdict(db, scenario, { prereg: opt.prereg || [] });
  let judgment;
  const J = (key, why, extra) => Object.assign({ key, level: DICT.entry(key).label_ko, why: why || DICT.entry(key).meaning_ko }, extra || {});
  if (pv.declared && opt.prereg == null) judgment = J('registration_unchecked');
  else if (pv.declared && pv.ok) {
    const vs = pv.validation.map((o) => `${o}${(db.observations[o] || {}).kind === 'qualitative' ? '(정성)' : ''}`);
    judgment = J('validated_registered', null, { protocol: pv });
    judgment.level = `${DICT.entry('validated_registered').label_ko.replace(/\)$/, '')} #${pv.registered.seq})`;
    judgment.why = `등록된 모의 실험 규약 아래 — 일치 결론은 검증 세트 ${vs.join('·') || '(비어 있음)'} 로만${hyp ? '. 농도·상수는 가상 값이므로 결론은 그 관찰의 판정(방향·유무 등)이지 실행의 숫자가 아니다' : ''}`;
  } else if (pv.declared) judgment = J('protocol_violation', pv.problems.join(' · '), { protocol: pv });
  else judgment = hyp
    ? J('hypothesis_generating', '시나리오가 hypothetical — 농도·부피 등 가상 값을 쓰므로 관찰과의 일치를 주장하지 않는다 (설계 P6)')
    : J('exploratory');
  const usedGrades = new Set([...chain.map((c) => c.grade), ...values.map((v) => v.grade && v.grade.grade)].filter(Boolean));
  const criteria = {
    threshold: scenario.min_grade || REL.DEFAULT_MIN, // 이 실행에 적용된 등급 문턱 (시나리오가 올릴 수만, 내릴 수 없음)
    thresholdDefault: REL.DEFAULT_MIN,
    sScale: REL.S_LABEL, dScale: REL.D_LABEL,
    grades: REL.ORDER.map((g) => ({ key: g, label: REL.GRADES[g].label, rule: REL.GRADES[g].rule, use: REL.GRADES[g].use, used: usedGrades.has(g) })),
    basis: [
      '등급은 데이터에 쓰는 값이 아니라 사법부(reliability.js)가 출처 S 와 데이터 D 에서 **계산**한다 — S·D 를 곱하지 않고 둘 다 문턱을 넘어야 한다(한쪽만 좋으면 주 매개변수로 쓰지 않는다).',
      '판정 수준은 "사전 등록된 모의 실험 규약(음성 대조·검정력·검증 세트·허용 차이 δ·중단 규칙)" 아래에서만 검증이 된다 — 규약이 없으면 탐색, 가상 값을 쓰면 가설 생성(설계 P6). 규약 없는 실행은 관찰과의 일치를 주장하지 않는다.',
      `등급 문턱은 기본 ${REL.DEFAULT_MIN}(주 매개변수 사용 최소선)이고 시나리오가 올릴 수만 있다(내릴 수 없다).`,
    ],
  };

  // 5·7. 흐름 비교 — 기대 vs 실제 (시뮬레이션 원자료는 조정자가 돌려 opt.sim 으로 넣는다; 사법부는 읽기만)
  //   actual = 실행의 단계별 누적 진행량 / 창(window) = 회/s. expected = 시나리오가 실행 전에 선언한 예측(report.expect).
  const flux = [];
  const sim = opt.sim, win = sim && (sim.window || scenario.window || 1);
  const expectDecl = (scenario.report && scenario.report.expect) || scenario.expect || [];
  const findExpect = (sid, ref) => expectDecl.find((e) => e.step === sid || e.rule === ref || e.target === ref);
  if (sim && sim.cum) {
    for (const c of chain) {
      const actual = sim.cum[c.sid] != null ? sim.cum[c.sid] / win : null;
      const ex = findExpect(c.sid, c.rule);
      if (actual == null && !ex) continue;
      let pass = null, rel = null;
      if (ex && actual != null && ex.value) { rel = Math.abs(actual - ex.value) / Math.abs(ex.value); pass = rel <= (ex.tol != null ? ex.tol : 0.05); }
      flux.push({ step: c.sid, enzyme: c.enzyme, reaction: c.reaction, measured: c.measured,
        expected: ex ? ex.value : null, expectedNote: ex ? ex.note : null, unit: (ex && ex.unit) || '회/s', actual, rel, pass });
    }
  }

  // 6·7. 사고 패턴(지문) + 삼각 결론
  // 상수 없는 고리의 뜻은 실행 방식마다 다르다: 경로 속도 실행은 사건 기반(즉시)으로 돌리고, 운명 엔진(세포 상태)은 그 규칙을 끈다(Kinetic_Gap)
  const NONE = targetKind === 'cell_state'
    ? { word: '꺼짐', label: closureLabel('none', '이 실행에서 꺼짐(Kinetic_Gap)') }
    : { word: '사건기반', label: closureLabel('none', '사건 기반(즉시)으로 처리') };
  for (const c of chain) if (c.closure === 'none') c.closureLabel = NONE.label;
  const measured = chain.filter((c) => c.measured), eventBased = chain.filter((c) => c.closure === 'none');
  const gained = measured.map((c) => `${c.enzyme} — ${c.reaction}: 실측 속도(${c.closure}) · 등급 ${c.grade || '—'}`);
  const floor = [];
  // 가정 입력은 한 줄로 요약한다 (낱개 나열은 소음) — 가장 약한 것은 보통 '측정이 아닌 입력' 그 자체다
  const concAssume = assumptions.filter((x) => x.kind !== '속도 상수 덮어쓰기');
  if (hyp && concAssume.length) floor.push(`시작량·저장소·부피가 모두 **가상 값**(시나리오 hypothetical, 입력 ${concAssume.length}개) — 농도 공백. 소진 시각·완료 바퀴 수는 질적 의미만이다.`);
  // 근사·구조·열역학 한계를 앞세운다 — 결론을 실제로 흔드는 것들 (문장을 자르지 않는다)
  for (const f of failures.filter((x) => x.type === 'Structural_Gap' || /pH|협동|가역|ΔG|역반응|힐|열역학|비가역/.test(x.text))) floor.push(`${labelRef(ix, db, f.target)} — ${f.text} 〔${f.id}, ${f.type}〕`);
  // 사건 기반(사람 kcat 없음) 단계는 시간·병목을 말하지 못하는 바닥
  if (eventBased.length) floor.push(targetKind === 'cell_state'
    ? `${eventBased.length}개 고리(${[...new Set(eventBased.map((c) => c.enzyme))].join('·')})는 속도 상수가 없어 이 실행에서 꺼졌다 — 그 고리가 결과를 바꾸는지는 아직 말할 수 없다.`
    : `${eventBased.length}개 단계(${eventBased.map((c) => c.enzyme).join('·')})는 속도 상수가 없어 사건 기반 — 회로 전체의 시간·병목은 아직 말할 수 없다.`);
  const next = [];
  if (measured.length) next.push(`${measured.length}개 단계가 실측 상수로 돌아간다 — "측정 상수가 속도를 정하는가" 를 같은 방식으로 더 물을 수 있다`);
  if (eventBased.length) next.push(targetKind === 'cell_state'
    ? `${eventBased.length}개 고리는 속도 상수가 없어 꺼져 있다 — 관찰(O…)로 상수를 채우면 그 고리를 켜서 다시 물을 수 있다`
    : `${eventBased.length}개 단계는 아직 사건 기반(사람 kcat 없음) — 같은 경로로 채우면 회로 전체의 시간·병목을 말할 수 있다`);

  // 0. 핵심 실행 결과 요약 — 질문·결론(Pass/Fail)·판정 수준 (맨 위 상자)
  const checked = flux.filter((f) => f.pass != null);
  const verdict = !checked.length ? '선언된 기대 없음 (탐색 실행)'
    : checked.every((f) => f.pass) ? 'PASS — 선언한 기대와 실제 흐름이 일치' : 'FAIL — 기대와 실제가 어긋남';
  const summary = {
    question: scenario.name || '(이름 없음)',
    verdict,
    detail: checked.map((f) => `${f.enzyme}: 기대 ${fmt(f.expected)} ${f.unit} · 실제 ${fmt(f.actual)} ${f.unit}${f.pass ? ' ✓' : ' ✗'}`),
    judgment: judgment.level,
    coverage: `전체 ${chain.length}고리 중 실측 ${measured.length} · ${NONE.word} ${eventBased.length}`,
  };

  return {
    summary, flux,
    target: { id: target, label: L(target), kind: targetKind }, states: states.map((id) => ({ id, label: L(id) })),
    perturbation, excluded, noneWord: NONE.word,
    scenario: { name: scenario.name || '(이름 없음)', note: scenario._설명 || scenario.note || '', hypothetical: hyp, window: scenario.window || null },
    chain, values, assumptions, failures, judgment, criteria,
    fingerprint: {
      invariants: [
        '모든 값에 등급(S,D)과 출처를 붙이고, 닫는 방법(measure·computed·abstraction·assumed·none)을 밝힌다',
        '공백은 숨기지 않고 한계(L…)로 등록한다 — 실패가 데이터다',
        '추정에 쓴 관찰은 검증에 쓰지 않는다(순환 판정 방지) · 규약 없는 실행은 일치 결론을 내지 않는다',
        '실측값은 지어내지 않는다 — 없으면 사건 기반/가상으로 두고 그 사실을 보고한다',
      ],
      closureMeaning: closureMeaning(),
    },
    triad: {
      gained: gained.length ? gained : ['(이 경로에서 실측으로 닫힌 단계 없음)'],
      next: next.length ? next : ['(다음 지점 자동 추출 없음)'],
      floor: floor.length ? floor : ['(자동 추출된 불안정 지점 없음 — 한계·가정 확인)'],
    },
    reproduce: {
      dbSha: opt.dbText ? sha(opt.dbText).slice(0, 16) : sha(JSON.stringify(db)).slice(0, 16),
      scenarioSha: opt.scenarioText ? sha(opt.scenarioText).slice(0, 16) : sha(JSON.stringify(scenario)).slice(0, 16),
      asOf: (db.model && db.model.asOf) || null,
    },
  };
}
// 측정량의 단위 (사법부 obsUnit 과 같은 규약의 가벼운 판): kcat·Km 는 고정, 그 밖은 차수에서
function unitOf(db, ref, f, k) {
  if (V.kineticUnits && V.kineticUnits[f]) return V.kineticUnits[f];
  if (f === 'dG0' || f === 'dG_act') return 'J/mol';
  if (f === 'half_life') return 's';
  return '';
}

function evidenceReportMarkdown(rep) {
  if (rep.error) return `증거·방법 보고서: ${rep.error}`;
  const o = [];
  o.push(`# 증거·방법 보고서 — ${rep.target.label} 〔${rep.scenario.name}〕`, '');
  o.push('> 이 보고서는 한 사람이 읽고 결론을 **완전히 이해하고 질문할 수 있도록** 쓰였다. 인과뿐 아니라 그것을 따라간 방식과 사고 패턴(지문), 실패·막다른 길, 그리고 바닥의 불안정함까지 드러낸다.', '');

  const s0 = rep.summary;
  o.push('> **［핵심 실행 결과 요약］**  ');
  o.push(`> **질문** — ${s0.question}  `);
  o.push(`> **결론** — ${s0.verdict}${s0.detail.length ? ' (' + s0.detail.join(' · ') + ')' : ''}  `);
  o.push(`> **판정 수준** — ${s0.judgment} · ${s0.coverage}`, '');

  o.push('## 1. 무엇을 물었나', '');
  o.push(`- 대상: **${rep.target.label}** (${rep.target.id}${rep.target.kind ? ' · ' + rep.target.kind : ''})`);
  o.push(`- 시나리오: ${rep.scenario.name}${rep.scenario.hypothetical ? ' · ⚠ **가상(hypothetical)** — 지식이 아니라 "측정 상수가 쓰이는 자리" 를 보이는 실행' : ''}`);
  if (rep.states.length > 1) o.push(`- 계에 든 세포 상태(시작 + 전이로 닿는 상태): ${rep.states.map((x) => `${x.label} (${x.id})`).join(' → ')}`);
  if (rep.perturbation) {
    const p = rep.perturbation, ch = p.change || {};
    o.push(`- **교란 실험** — 기준 \`${p.base}\` + 교란 \`${JSON.stringify(p.perturbation)}\` (교란 기록 ${String(p.hash).slice(0, 12)}…). 교란 밖은 기준(대조군)과 같다.`);
    const bits = [];
    if ((ch.exclude_rules || []).length) bits.push(`뺀 규칙 ${ch.exclude_rules.join(', ')}`);
    for (const f of ['amounts', 'signals', 'rule_scale', 'buffered']) if (ch[f] && Object.keys(ch[f]).length) bits.push(`${f} ${Object.keys(ch[f]).join(', ')}`);
    if (bits.length) o.push(`    · 바뀐 것: ${bits.join(' · ')}`);
  }
  if (rep.scenario.note) o.push('', `> ${rep.scenario.note}`);
  o.push('');

  o.push('## 2. 인과 사슬 — 무엇이 무엇을 만드나', '');
  o.push('반응을 일어나는 순서대로, **기질 → 〈효소〉 → 산물** 로 읽는다. 각 화살표 옆에 그 단계의 속도를 우리가 어떻게 아는지(● 실제로 잰 값 / ○ 속도 모름·일어난다는 것만) 적는다 — 측정으로 뒷받침된 고리와 아직 비어 있는 고리가 눈으로 갈린다.', '');
  for (const c of rep.chain) {
    if (c.kind === 'modulation') {
      o.push(`- **${c.inputs.join(' + ')}**  ${c.effect === 'inhibits' ? '⊣ 억제' : c.effect === 'activates' ? '→ 촉진' : '~ 조절(' + c.effect + ')'}  「${c.on ? c.on.label : '?'}」`);
      o.push(`    · ${c.reaction} — ${c.measured ? '● 실측' : c.closure === 'none' ? `○ 상수 미상(${rep.noneWord})` : '◐ 가정/추상'}${c.grade ? ` · 등급 ${c.grade}` : ''}`);
      continue;
    }
    const mark = c.measured ? '● 실측 속도' : c.closure === 'none' ? `○ 속도 미상(${rep.noneWord})` : '◐ 가정/추상';
    const lhs = c.inputs.length ? c.inputs.join(' + ') : c.kind === 'supply' ? '(모델 밖 원료)' : '(기질 미지정)';
    const rhs = c.outputs.length ? c.outputs.join(' + ') : c.kind === 'degradation' ? '(소멸)' : '(산물 미지정)';
    o.push(`- **${lhs}**  →  〈${c.enzyme}〉  →  **${rhs}**`);
    o.push(`    · ${c.reaction} — ${mark}${c.grade ? ` · 등급 ${c.grade}` : ''}`);
  }
  o.push('', '> ● 인 고리만 "얼마나 빠른지" 를 데이터로 말할 수 있다. ○ 인 고리는 "일어난다" 까지만 알고 속도는 모른다(아래 5·7절).', '');

  o.push('## 3. 자료 — 쓰인 값 전부 (숨기지 않음)', '');
  o.push('### 3a. 실제로 잰 상수 (효소 이름으로)', '');
  if (rep.values.length) {
    o.push('| 효소 · 반응 | 무엇 | 값 | 종 | 출처 | 등급(S,D) | 어떻게 알았나 |', '|---|---|---|---|---|---|---|');
    for (const v of rep.values) o.push(`| ${v.enzyme} · ${v.reaction} | ${v.paramKo} | ${fmt(v.value)}${v.unit ? ' ' + v.unit : ''} | ${v.species || '—'} | ${v.sources.join(', ') || '—'} | ${v.grade ? `${v.grade.grade} (${v.grade.s},${v.grade.d})` : '—'} | ${v.closure}${v.fromObs.length ? ` · 관찰 ${v.fromObs.join(', ')}` : ''} |`);
  } else o.push('_(측정·유도 상수 없음 — 모든 단계가 "일어난다" 까지만, 속도는 미상)_');
  o.push('');
  o.push('### 3b. 가정 값 (시나리오가 넣은 가상 입력 — 측정이 아니다)', '');
  if (rep.assumptions.length) {
    o.push('| 종류 | 대상 | 값 |', '|---|---|---|');
    for (const a of rep.assumptions) o.push(`| ${a.kind} | ${a.key} | ${a.value} |`);
    o.push('', '→ 위 값들은 **측정이 아니다**. 아래 7절 "바닥의 불안정함" 에서 결론이 이들에 얼마나 기대는지 짚는다.');
  } else o.push('_(가정 입력 없음)_');
  o.push('');

  o.push('## 4. 얼마나 믿나 — 판정 수준 · 고리별 검증 범위', '');
  o.push(`- **판정 수준: ${rep.judgment.level}** — ${rep.judgment.why}`);
  if (rep.judgment.protocol && rep.judgment.protocol.declared) o.push(`- ${PROTO.protocolText(rep.judgment.protocol).replace(/\n/g, ' ')}`);
  const meas = rep.chain.filter((c) => c.measured).length, ev = rep.chain.filter((c) => c.closure === 'none').length, other = rep.chain.length - meas - ev;
  o.push(`- 고리별 검증 범위: 전체 ${rep.chain.length}고리 중 실측 ${meas} · ${rep.noneWord} ${ev} · 가정/추상 ${other}. 측정으로 닫힌 고리의 결론만 "데이터에 매여 있다" 고 말할 수 있다.`);
  o.push('');

  o.push(`- 등급·판정 수준을 **무슨 기준으로** 잡았는지(출처 S·데이터 D 척도, 등급 규칙, 적용 문턱과 그 근거)는 본문 흐름을 가리지 않도록 맨 뒤 **［부록 A. 사법부 판정 기준］** 에 두었다.`);
  o.push('');

  o.push('## 5. 실패·막다른 길 (숨기지 않는다)', '');
  o.push('등록된 한계가 곧 "이래서 안 됐다 / 이게 있어야 닫힌다" 의 기록이다. 이 경로에 열린 한계(문장을 자르지 않는다):', '');
  if (rep.failures.length) {
    for (const f of rep.failures) o.push(`- **${f.targetLabel}** — ${f.text}  _〔${f.id} · ${f.type} · 진행 ${f.done}/${f.total}〕_`);
  } else o.push('_(이 경로에 열린 한계 없음)_');
  o.push('');

  o.push('## 6. 사고 패턴 (지문)', '');
  o.push('이 결론을 만든 방식은 아래 규약을 이 경우에 그대로 적용한 것이다 — 이것이 이 시스템의 지문이다:', '');
  for (const inv of rep.fingerprint.invariants) o.push(`- ${inv}`);
  o.push('', '그래서 위 2~5절의 "닫는 방법" 하나하나가 결론에 싣는 무게는 다음과 같이 읽어야 한다:', '');
  for (const [k, meaning] of Object.entries(rep.fingerprint.closureMeaning)) o.push(`- \`${k}\`: ${meaning}`);
  o.push('');

  o.push('## 7. 얻은 것 · 다음으로 나갈 지점 · 바닥의 불안정함', '');
  if (rep.flux && rep.flux.length) {
    o.push('**측정 흐름 — 기대 vs 실제** (시뮬레이션 실행 결과; 기대값은 실행 전 시나리오가 선언한 예측)', '');
    o.push('| 효소 · 반응 | 기대 | 실제(측정) | 일치 |', '|---|---|---|---|');
    for (const f of rep.flux) {
      const exp = f.expected != null ? `${fmt(f.expected)} ${f.unit}${f.expectedNote ? ` (${f.expectedNote})` : ''}` : '— (선언 안 됨)';
      const act = f.actual != null ? `${fmt(f.actual)} ${f.unit}` : '—';
      const pass = f.pass == null ? '—' : f.pass ? `✓ 일치 (오차 ${(f.rel * 100).toFixed(1)}%)` : `✗ 불일치 (오차 ${(f.rel * 100).toFixed(1)}%)`;
      o.push(`| ${f.enzyme} · ${f.reaction} | ${exp} | ${act} | ${pass} |`);
    }
    o.push('', '> 기대값(예: kcat·[E]/2)은 측정 상수에서 손으로 계산한 예측이고, 실제값은 그 상수로 돌린 시뮬레이션의 단계별 진행량 ÷ 창(window)이다. 둘이 맞으면 "측정 상수가 실제로 속도를 정한다" 는 뜻이다.', '');
  }
  o.push('**얻은 것**');
  for (const g of rep.triad.gained) o.push(`- ${g}`);
  o.push('', '**다음으로 나갈 수 있게 된 지점**');
  for (const n of rep.triad.next) o.push(`- ${n}`);
  o.push('', '**바닥의 불안정함 (결론을 떠받치는 가장 약한 지점)**');
  for (const f of rep.triad.floor) o.push(`- ${f}`);
  o.push('');

  o.push('## 8. 재현', '');
  o.push(`- db sha256: \`${rep.reproduce.dbSha}…\` · 시나리오 sha256: \`${rep.reproduce.scenarioSha}…\`${rep.reproduce.asOf ? ` · 기준 시각(asOf) ${rep.reproduce.asOf}` : ''}`);
  o.push('- 이 보고서는 읽기 전용 판결(사법부)이다 — db·엔진을 바꾸지 않는다. 시뮬레이션 과정·무결성 증명서는 `fate --report`(운명) 또는 `simulate --rate`(속도)로.');
  o.push('');

  // 부록 A — 판정 기준 (본문 흐름을 가리지 않도록 뒤로)
  o.push('---', '');
  o.push('## 부록 A. 사법부 판정 기준 — 무슨 기준으로 등급·판정 수준을 잡았나', '');
  o.push('본문의 등급·판정 수준은 자의가 아니라 사법부(`reliability.js`)의 고정된 기준에서 계산된다:', '');
  o.push('**출처 척도 S · 데이터 척도 D** (등급은 둘을 곱하지 않고 둘 다 문턱을 넘어야 한다):', '');
  o.push('| S (출처) | 뜻 | | D (데이터) | 뜻 |', '|---|---|---|---|---|');
  const sK = Object.keys(rep.criteria.sScale).sort((a, b) => b - a), dK = Object.keys(rep.criteria.dScale).sort((a, b) => b - a);
  for (let i = 0; i < Math.max(sK.length, dK.length); i++) {
    const s = sK[i], d = dK[i];
    o.push(`| ${s != null ? 'S' + s : ''} | ${s != null ? rep.criteria.sScale[s] : ''} | | ${d != null ? 'D' + d : ''} | ${d != null ? rep.criteria.dScale[d] : ''} |`);
  }
  o.push('', '**등급 규칙과 용도** (▶ = 이 보고서에 실제로 쓰인 등급):', '');
  o.push('| 등급 | 규칙 | 쓸 수 있는 곳 | |', '|---|---|---|---|');
  for (const g of rep.criteria.grades) o.push(`| ${g.key} (${g.label}) | ${g.rule} | ${g.use} | ${g.used ? '▶' : ''} |`);
  o.push('', `**적용 문턱: ${rep.criteria.threshold}**${rep.criteria.threshold === rep.criteria.thresholdDefault ? ' (기본)' : ' (시나리오가 올림)'} — 이 값 미만의 상수를 "데이터" 로 쓰면 위반이다.`, '');
  o.push('왜 이렇게 잡았나:', '');
  for (const b of rep.criteria.basis) o.push(`- ${b}`);
  return o.join('\n');
}

// 판정 수준 색인 — 시나리오 전부를 한 표로 (build-plan 12 "기존 시나리오 전부에 판정 수준"). rows = [{ file, subject, rep }], rep 는 evidenceReport 결과 그대로
function evidenceIndexMarkdown(rows) {
  const ok = rows.filter((r) => !r.rep.error), bad = rows.filter((r) => r.rep.error);
  const count = {}; for (const r of ok) count[r.rep.judgment.key] = (count[r.rep.judgment.key] || 0) + 1; // 토큰으로 센다(라벨 문자열 아님)
  const o = ['# 증거 보고서 색인 — 시나리오별 판정 수준', ''];
  o.push(`시나리오 ${rows.length}개 · 보고서 ${ok.length} · 실패 ${bad.length}. 판정 수준: ${Object.entries(count).map(([k, n]) => `${DICT.entry(k).label_ko} ${n}`).join(' · ')}.`, '');
  o.push('> 판정 수준은 등록 확인(사전 등록부의 입력 해시)에서 나온다 — 규약 선언만으로는 검증이 아니다. 고리 수는 실행이 쓰는 규칙(경로 단계 또는 세포 상태 계의 공급·분해·기전 단계·조절)이고, 실측 고리만 "데이터에 매여 있다". 대상은 `examples/scenarios/subjects.json`.', '');
  o.push('| 시나리오 | 대상 | 판정 수준 | 고리 (실측 · 가정/추상 · 상수 없음) | 열린 한계 | 교란 |', '|---|---|---|---|---|---|');
  for (const r of ok) {
    const c = r.rep.chain, m = c.filter((x) => x.measured).length, n = c.filter((x) => x.closure === 'none').length;
    const p = r.rep.perturbation ? `${r.rep.perturbation.perturbation.type} ${r.rep.perturbation.perturbation.target || ''}`.trim() : '—';
    o.push(`| \`${r.file}\` | ${r.rep.target.label} (${r.subject}) | ${r.rep.judgment.level} | ${c.length} (${m} · ${c.length - m - n} · ${n} ${r.rep.noneWord}) | ${r.rep.failures.length} | ${p} |`);
  }
  if (bad.length) { o.push('', '## 보고서를 내지 못한 시나리오 (숨기지 않음)', ''); for (const r of bad) o.push(`- \`${r.file}\` (${r.subject || '대상 없음'}): ${r.rep.error}`); }
  return o.join('\n');
}

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DefDBEvidenceReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return { evidenceReport, evidenceReportMarkdown, evidenceIndexMarkdown, closureOfRule };
});
