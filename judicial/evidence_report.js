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
const { limitationStatus } = require('./judicial.js');
const sha = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const fmt = (x) => (x == null || !Number.isFinite(x) ? '—' : Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(3) : (+x.toPrecision(5)).toString());

// 닫는 방법 (설계 §13 B 분류): measure(재서 닫음) · computed(측정에서 도구 계산) · transfer/assumed(실측 아님) · abstraction(기전 경계·묶음) · none(속도 상수 없음 → 사건 기반)
function closureOfRule(rule) {
  const k = rule && rule.kinetics;
  if (!k) return { closure: 'none', label: '없음 — 속도 상수가 없어 사건 기반(즉시)으로 처리', measured: false };
  if (k.lumped) return { closure: 'abstraction', label: 'abstraction — 묶은 상수(lumped), 원 관찰에서 재계산', measured: false };
  const lvl = k.evidence && k.evidence.level;
  if (lvl === 'curated') return { closure: 'measure', label: 'measure — 문헌 실측값', measured: true };
  if (lvl === 'computed') return { closure: 'computed', label: 'computed — 측정에서 도구로 계산', measured: true };
  if (lvl === 'predicted') return { closure: 'assumed', label: 'assumed — 예측값(실측 아님)', measured: false };
  if (lvl === 'abstracted') return { closure: 'abstraction', label: 'abstraction — 추론으로 대체', measured: false };
  return { closure: 'assumed', label: `${lvl || '?'} — 실측 아님`, measured: false };
}
const PARAM_KO = { kcat: '최대 회전수 kcat', Km: '반포화 농도 Km', k: '속도 상수 k', k_r: '역반응 속도 k_r', k0: '전지수 인자 k0', dG_act: '활성화 에너지 ΔG‡', dG0: '표준 반응 자유에너지 ΔG°′', half_life: '반감기' };
function taxonLabel(sp) { if (!sp) return null; const t = V.taxa && V.taxa[sp]; const nm = t && (t.ko || t.en || t.name); return nm ? `${nm}(${sp})` : sp; }
const CLOSURE_SELF = { // 사고 패턴: 각 닫는 방법이 결론에 어떤 무게를 싣는지 (독자가 스스로 판단하도록)
  measure: '이 종·이 반응에서 실제로 잰 값 — 결론의 단단한 바닥',
  computed: '측정에서 도구로 계산 — 측정만큼 믿되 도구 가정을 짊어짐',
  abstraction: '기전을 묶어 한 상수로 — 세부는 접혔고, 그 경계는 Structural_Gap 으로 등록',
  assumed: '실측이 아닌 추정 — 결론은 여기에 조건부, 재면 바뀔 수 있음',
  none: '속도 상수가 없어 이 단계는 즉시 처리 — 시간·병목을 이 단계로는 말할 수 없음',
};

function evidenceReport(db, scenario, opt = {}) {
  db = M.normalize(db);
  const ix = M.index(db), L = (id) => ix.label(id);
  scenario = scenario || {};
  const tgtRef = opt.target;
  const tg = tgtRef ? M.resolveRef(ix, tgtRef) : { error: '대상(target)이 없음 — --target <경로|상태>' };
  if (tg.error) return { error: tg.error };
  const target = tg.id;
  // 경로의 단계: part_of 가 대상을 가리키는 단계, 번호순 (그 경로의 반응 순서에 가깝다)
  const steps = Object.entries(db.steps).filter(([, st]) => (st.part_of || []).includes(target)).map(([sid]) => sid).sort();
  const ruleOf = (ref) => { const d = db.senses[ref.split('/')[0]]; return d && d.rule.find((r) => ref.endsWith('/' + r.id)); };
  const relRows = REL.items(db, opt.reliability || {});
  const gradeOf = (ref, what) => relRows.find((r) => r.target === ref && r.what === what) || null;

  // 2·3. 인과 사슬 + 값 표 — 이름으로(번호 아님), 기질 → 〈효소〉 → 산물 로 인과를 드러낸다
  const chain = [], values = [];
  for (const sid of steps) {
    const st = db.steps[sid], ref = st.rule, rule = ruleOf(ref), c = closureOfRule(rule);
    const g = gradeOf(ref, 'kinetics'), senseId = ref.split('/')[0], eff = (rule && rule.effect) || {};
    const inputs = (eff.consumes || []).map(L), outputs = (eff.produces || []).map(L);
    chain.push({ sid, enzyme: L(senseId), reaction: (rule && rule.label) || L(sid), inputs, outputs,
      rule: ref, closure: c.closure, closureLabel: c.label, measured: c.measured, grade: g ? g.grade : null });
    const k = rule && rule.kinetics;
    if (k) for (const f of M.KIN_VALUE_FIELDS || ['kcat', 'Km', 'k', 'k_r', 'k0', 'dG_act', 'dG0', 'half_life']) {
      if (k[f] == null) continue;
      const srcs = (k.evidence && k.evidence.sources) || [];
      const fromObs = (k.from || []).filter((x) => x.param === f).map((x) => x.obs);
      values.push({ step: sid, rule: ref, enzyme: L(senseId), reaction: (rule && rule.label) || L(sid),
        param: f, paramKo: PARAM_KO[f] || f, value: k[f], unit: unitOf(db, ref, f, k),
        species: taxonLabel((k.context && k.context.species) || null), sources: srcs.map((s) => `${s.db}:${s.id}`), fromObs,
        closure: c.closure, closureLabel: c.label, grade: g ? { grade: g.grade, s: g.s, d: g.d, why: g.why } : null });
    }
  }

  // 3b. 가정 입력 (시나리오의 가상 값) — 자료를 다 보인다: 무엇이 측정이고 무엇이 가정인지 나란히
  const assumptions = [];
  const hyp = !!scenario.hypothetical;
  const bl = (key) => (ix.bundleLabel ? ix.bundleLabel(key) || key : key);
  for (const [key, v] of Object.entries(scenario.amounts || {})) assumptions.push({ kind: '시작량', key: bl(key), value: v });
  for (const [key, v] of Object.entries(scenario.reservoirs || {})) assumptions.push({ kind: '저장소(무한 풀)', key: bl(key), value: v });
  for (const [key, v] of Object.entries(scenario.volumes || {})) assumptions.push({ kind: '부피', key: bl(key), value: `${v.value} ${v.unit}` });
  for (const key of Object.keys(scenario.kinetics || {})) { const r = key.split('/')[0]; assumptions.push({ kind: '속도 상수 덮어쓰기', key: `${L(r)} — ${(ruleOf(key) || {}).label || key}`, value: '시나리오에서 지정' }); }

  // 5. 실패·막다른 길 — 등록된 한계가 곧 '이래서 안 됐다 / 이게 있어야 닫힌다' 의 기록
  const onPath = (t) => { const base = (M.parseTarget(t) || {}).base; return t === target || base === target || steps.some((sid) => db.steps[sid].rule.split('/')[0] === base) || steps.some((sid) => db.steps[sid].rule === t); };
  const failures = [];
  for (const [id, l] of Object.entries(db.limitations)) {
    if (!onPath(l.target)) continue;
    const s = limitationStatus(db, l);
    if (s.status.startsWith('resolved')) continue; // 닫힌 것은 실패가 아니다
    failures.push({ id, type: l.type, target: l.target, status: s.status, done: s.done, total: s.total, text: l.requirement.text });
  }
  failures.sort((a, b) => a.id.localeCompare(b.id));

  // 4. 판정 수준
  const reg = scenario.protocol && scenario.protocol.validation;
  const judgment = hyp
    ? { level: '가설 생성 / 탐색', why: '시나리오가 hypothetical — 농도·부피 등 가상 값을 쓰므로 관찰과의 일치를 주장하지 않는다 (설계 P6)' }
    : reg ? { level: '검증(사전 등록 규약)', why: '등록된 모의 실험 규약 아래 — 검증 세트로만 일치 결론' }
    : { level: '탐색 (규약 없음)', why: '사전 등록 규약이 없어 관찰과의 일치 결론을 내지 않는다' };

  // 6·7. 사고 패턴(지문) + 삼각 결론
  const measured = chain.filter((c) => c.measured), eventBased = chain.filter((c) => c.closure === 'none');
  const gained = measured.map((c) => `${c.sid} ${c.label}: ${c.closure} · 등급 ${c.grade || '—'}`);
  const floor = [];
  // 가정 입력은 한 줄로 요약한다 (낱개 나열은 소음) — 가장 약한 것은 보통 '측정이 아닌 입력' 그 자체다
  const concAssume = assumptions.filter((x) => x.kind !== '속도 상수 덮어쓰기');
  if (hyp && concAssume.length) floor.push(`시작량·저장소·부피가 모두 **가상 값**(시나리오 hypothetical, 입력 ${concAssume.length}개) — 농도 공백(L000039 등). 소진 시각·완료 바퀴 수는 질적 의미만이다.`);
  // 근사·구조·열역학 한계를 앞세운다 — 결론을 실제로 흔드는 것들
  for (const f of failures.filter((x) => x.type === 'Structural_Gap' || /pH|협동|가역|ΔG|역반응|힐|열역학|비가역/.test(x.text))) floor.push(`${f.id} [${f.type}] ${f.text.slice(0, 90)}`);
  // 사건 기반(사람 kcat 없음) 단계는 시간·병목을 말하지 못하는 바닥
  if (eventBased.length) floor.push(`${eventBased.length}개 단계(${eventBased.map((c) => c.sid).join('·')})는 속도 상수가 없어 사건 기반 — 회로 전체의 시간·병목은 아직 말할 수 없다 (L000096·L000110).`);
  const next = [];
  if (measured.length) next.push(`${measured.length}개 단계가 실측 상수로 rate-active — "측정 상수가 속도를 정하는가" 를 같은 방식으로 더 물을 수 있다`);
  if (eventBased.length) next.push(`${eventBased.length}개 단계는 아직 사건 기반(사람 kcat 없음) — 같은 경로(BRENDA route 1 등)로 채우면 회로 전체의 시간·병목을 말할 수 있다`);

  return {
    target: { id: target, label: L(target), kind: (db.senses[target] || {}).kind },
    scenario: { name: scenario.name || '(이름 없음)', note: scenario._설명 || scenario.note || '', hypothetical: hyp, window: scenario.window || null },
    chain, values, assumptions, failures, judgment,
    fingerprint: {
      invariants: [
        '모든 값에 등급(S,D)과 출처를 붙이고, 닫는 방법(measure·computed·abstraction·assumed·none)을 밝힌다',
        '공백은 숨기지 않고 한계(L…)로 등록한다 — 실패가 데이터다',
        '추정에 쓴 관찰은 검증에 쓰지 않는다(순환 판정 방지) · 규약 없는 실행은 일치 결론을 내지 않는다',
        '실측값은 지어내지 않는다 — 없으면 사건 기반/가상으로 두고 그 사실을 보고한다',
      ],
      closureMeaning: CLOSURE_SELF,
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

  o.push('## 1. 무엇을 물었나', '');
  o.push(`- 대상: **${rep.target.label}** (${rep.target.id}${rep.target.kind ? ' · ' + rep.target.kind : ''})`);
  o.push(`- 시나리오: ${rep.scenario.name}${rep.scenario.hypothetical ? ' · ⚠ **가상(hypothetical)** — 지식이 아니라 "측정 상수가 쓰이는 자리" 를 보이는 실행' : ''}`);
  if (rep.scenario.note) o.push('', `> ${rep.scenario.note}`);
  o.push('');

  o.push('## 2. 인과 사슬 — 무엇이 무엇을 만드나', '');
  o.push('반응을 일어나는 순서대로, **기질 → 〈효소〉 → 산물** 로 읽는다. 각 화살표 옆에 그 단계의 속도를 우리가 어떻게 아는지(● 실제로 잰 값 / ○ 속도 모름·일어난다는 것만) 적는다 — 측정으로 뒷받침된 고리와 아직 비어 있는 고리가 눈으로 갈린다.', '');
  for (const c of rep.chain) {
    const mark = c.measured ? '● 실측 속도' : c.closure === 'none' ? '○ 속도 미상(사건 기반)' : '◐ 가정/추상';
    const lhs = c.inputs.length ? c.inputs.join(' + ') : '(기질 미지정)', rhs = c.outputs.length ? c.outputs.join(' + ') : '(산물 미지정)';
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
  const meas = rep.chain.filter((c) => c.measured).length, ev = rep.chain.filter((c) => c.closure === 'none').length, other = rep.chain.length - meas - ev;
  o.push(`- 고리별 검증 범위: 전체 ${rep.chain.length}단계 중 실측 ${meas} · 사건기반 ${ev} · 가정/추상 ${other}. 측정으로 닫힌 고리의 결론만 "데이터에 매여 있다" 고 말할 수 있다.`);
  o.push('');

  o.push('## 5. 실패·막다른 길 (숨기지 않는다)', '');
  o.push('등록된 한계가 곧 "이래서 안 됐다 / 이게 있어야 닫힌다" 의 기록이다. 이 경로에 열린 한계:', '');
  if (rep.failures.length) {
    o.push('| 한계 | 종류 | 대상 | 진행 | 무엇이 있어야 닫히나 |', '|---|---|---|---|---|');
    for (const f of rep.failures) o.push(`| ${f.id} | ${f.type} | ${f.target} | ${f.done}/${f.total} | ${f.text.slice(0, 90)} |`);
  } else o.push('_(이 경로에 열린 한계 없음)_');
  o.push('');

  o.push('## 6. 사고 패턴 (지문)', '');
  o.push('이 결론을 만든 방식은 아래 규약을 이 경우에 그대로 적용한 것이다 — 이것이 이 시스템의 지문이다:', '');
  for (const inv of rep.fingerprint.invariants) o.push(`- ${inv}`);
  o.push('', '그래서 위 2~5절의 "닫는 방법" 하나하나가 결론에 싣는 무게는 다음과 같이 읽어야 한다:', '');
  for (const [k, meaning] of Object.entries(rep.fingerprint.closureMeaning)) o.push(`- \`${k}\`: ${meaning}`);
  o.push('');

  o.push('## 7. 얻은 것 · 다음으로 나갈 지점 · 바닥의 불안정함', '');
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
  return o.join('\n');
}

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DefDBEvidenceReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return { evidenceReport, evidenceReportMarkdown, closureOfRule };
});
