// usage (저장소 최상위에서): node docs/reports/2026-11-21-D000051-dossier/gen.cjs <out.md> <out.html>
// runs.json(extract.cjs 출력 — 엔진 숫자) + notes.json(해석) → 단계별 해부 보고서. 읽기만, 데이터·코드는 건드리지 않는다.
const fs = require('fs'), path = require('path');
const HERE = __dirname, R = process.cwd();
const D = JSON.parse(fs.readFileSync(path.join(HERE, 'runs.json'), 'utf8'));
const N = JSON.parse(fs.readFileSync(path.join(HERE, 'notes.json'), 'utf8'));
const db = require(path.join(R, 'data/db.json'));
const [outMd, outHtml] = process.argv.slice(2);
const RUNS = ['none', 'camp-competition', 'gtp-exhaustion', 'gtp-regeneration'];
const RLAB = { none: '시나리오 없음', 'camp-competition': 'camp-competition', 'gtp-exhaustion': 'gtp-exhaustion', 'gtp-regeneration': 'gtp-regeneration' };
const MAIN = 'gtp-regeneration';
const FEAT = { bound: '결합됨', GDP_bound: 'GDP 결합', GTP_bound: 'GTP 결합', phosphorylated: '인산화됨' };
const LOC = { cytosol: '세포질', plasma_membrane: '세포막', extracellular: '세포 밖', glycogen_granule: '글리코겐 과립' };
const bname = (b) => { const p = b.split('|'), st = p.slice(1, -1).map((x) => FEAT[x.split(':')[1]] || x.split(':')[1]); return `${D.names[b] || p[0]}${st.length ? '[' + st.join('·') + ']' : ''}@${LOC[p[p.length - 1]] || p[p.length - 1]}`; };
const NA = 6.02214076e23, V = 4e-12; // 세포질 4000 fL (A000332) — 시나리오가 있는 실행만
const f = (x) => x == null ? '—' : Math.abs(x) < 1e-6 && x !== 0 ? x.toExponential(1) : Math.abs(x) >= 1e5 ? x.toExponential(2) : +(+x).toPrecision(4) + '';
const conc = (n) => { const M = n / (NA * V); if (!n) return '0'; const u = [[1e-3, 'mM'], [1e-6, 'µM'], [1e-9, 'nM'], [1e-12, 'pM'], [1e-15, 'fM']].find(([s]) => M >= s) || [1e-18, 'aM']; return `${+(M / u[0]).toPrecision(3)} ${u[1]}`; };
const KIN_BY_STEP = (r, sid) => (r.kinUsed || []).find((k) => k.step === sid);
const NOVOL = { 'gtp-exhaustion': ['S000002', 'S000004'], 'gtp-regeneration': ['S000002', 'S000004'] };
function rateOf(run, sid) {
  const r = D.runs[run], k = KIN_BY_STEP(r, sid);
  if (k && !(NOVOL[run] || []).includes(sid)) { const p = Object.entries(k.kin).filter(([x]) => !['law', 'evidence', 'src', 'order'].includes(x)).map(([x, v]) => `${x}=${v}`).join(' · '); return `${k.kin.law} ${p} (시나리오, 근거 predicted · 신뢰 0)`; }
  if (k) return '상수는 시나리오에 있으나 반응 부피 모름 → 즉시 (AUDIT_CONCENTRATION)';
  return '속도 상수 없음 → 즉시 (Δt 마다 입력이 허락하는 만큼)';
}
const stallsOf = (run, sid) => (D.runs[run].events || []).filter((e) => e.step === sid).map((e) => `t=${e.t} s 정지 — ${e.by.map(bname).join(', ')} 바닥`);
const steps = D.steps;
const parts = (s) => [...s.agents.map((p) => ['행위자', p]), ...s.inputs.map((p) => ['재료', p]), ...s.outputs.map((p) => ['산물', p])];
const VERD = { ok: '맞음', warn: '부분적', bad: '틀림' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 요약 (경로 전체) ----------
const summaryRows = steps.map((s) => {
  const n = N.steps[s.id];
  const cum = RUNS.map((r) => f(D.runs[r].cum[s.id] || 0)).join(' / ');
  const fails = RUNS.flatMap((r) => stallsOf(r, s.id).map((x) => `${RLAB[r]}: ${x}`));
  return { id: s.id, label: s.label, kind: s.effect.type, ev: (s.evidence || {}).level, cum, chem: n.chem, bio: n.bio, fails };
});

// ---------- 마크다운 ----------
const md = [];
md.push('# D000051 에피네프린 → 글리코겐 분해 — 단계별 해부 (2026-11-21)', '');
md.push('- 모드: `baseline` (읽기·실행만 — 데이터·코드는 고치지 않음). 코어 커밋 8ac7dea 시점 `data/db.json`.');
md.push('- 실행: `simulateRate` 60 s · Δt 1 ms, 시나리오 4 가지(없음 · camp-competition · gtp-exhaustion · gtp-regeneration). 원자료 `runs.json`(생성: `extract.cjs`), 해석 `notes.json`, 이 문서·페이지는 `gen.cjs` 가 만든다.');
md.push('- **값은 전부 가상(hypothetical) 이거나 기본값** — 기전이 그 값에서 어떻게 흐르는지만 말한다. 사전 등록 없는 탐색 실행이라 검증 결론이 아니다. 화학·생물 판정은 Claude 의 교과서 지식(원문 대조 안 함, asserted 와 같은 무게).');
md.push('- 즉시 단계(속도 상수 없음)가 많아 **시각·바퀴 수·끝 양은 Δt 에 따라 바뀐다**(2026-11-19 보고서 §2 의 Δt 표). 아래 숫자는 "이 Δt 에서 이렇게 흘렀다" 이지 예측값이 아니다 (RULE-0256 · RULE-0454).', '');
md.push('## 0. 반응이 일어난 곳 — 세포·용액·기질', '');
md.push('| 무엇 | 값 | 출처 | 비고 |', '|---|---|---|---|');
md.push(`| 세포 | ${N.env.cell} | 경로 정의 | — |`);
md.push(`| 부피 | ${N.env.volumes} | 가정 원장 | 1 분자 = 0.415 pM |`);
md.push(`| 막 | ${N.env.membrane} | 감사 | — |`);
md.push(`| 용액 조건 | ${N.env.solution} | DB·시나리오 둘 다 없음 | 온도·pH 를 말할 수 없음 |`);
const r0 = D.runs[MAIN];
md.push('', `### 시작 기질 (${MAIN} 기준, 다른 시나리오는 단계별 표에)`, '', '| 묶음 | 시작 분자 수 | 세포질 4000 fL 환산 | 실제 간세포와 비교 (대략, Claude) |', '|---|---|---|---|');
const REAL = { 'D000032|cytosol': '실제 ATP 수 mM — 약 4000 배 적음', 'D000035|cytosol': '실제 GTP 0.1–0.5 mM — 약 10⁴ 배 적음', 'D000037|cytosol': '실제 Pi 수 mM — 수천 배 적음', 'D000027|extracellular': '혈장 에피네프린 0.1–1 nM 대 — 세포 밖 10000 fL 기준 0.33 nM, 크기는 그럴듯함', 'D000042|cytosol': '실제 PKA 0.2–0.5 µM — 기본값 10 분자라 10⁵ 배 적음', 'D000049|cytosol': '기본값 10 분자 — PDE 가 사실상 없음', 'D000047|glycogen_granule': '분자 수 1000(기본값) — 포도당 단위는 세지 않음' };
for (const [b, n] of Object.entries(r0.start)) if (n) md.push(`| ${bname(b)} | ${f(n)} | ${b.includes('extracellular') ? (n / (NA * 1e-11) * 1e9).toPrecision(3) + ' nM (세포 밖 10000 fL)' : b.includes('plasma_membrane') ? '막 — 면적 농도 없음' : conc(n)} | ${REAL[b] || ''} |`);
md.push('', '## 1. 한눈에 — 11 단계', '', '| 단계 | 누적 발화 (없음 / camp / exh / regen) | 화학 · 생물 | 실패(정지) |', '|---|---|---|---|');
for (const x of summaryRows) md.push(`| ${x.id} ${x.label} (${x.kind}, 근거 ${x.ev}) | ${x.cum} | 화학 ${VERD[x.chem[0]]} · 생물 ${VERD[x.bio[0]]} | ${x.fails.join('<br>') || '없음'} |`);
md.push('', '## 2. 단계마다', '');
for (const s of steps) {
  const n = N.steps[s.id];
  md.push(`### ${s.id} ${s.label} — ${s.action} (${s.effect.type})`, '');
  md.push(`- DB 설명: ${s.text || '—'}`);
  md.push(`- 규칙 \`${s.rule}\` · 근거 ${(s.evidence || {}).level}${((s.evidence || {}).sources || []).length ? ' — ' + [...new Set(s.evidence.sources.map((x) => x.citation))].join('; ') : ' (출처 없음)'}`);
  md.push(`- 어디서: ${n.where}`, '');
  md.push('| 실제 세부 진행 (Claude, 교과서) | 모델이 담은 것 | 화학 | 생물 |', '|---|---|---|---|');
  md.push(`| ${n.real.map((x, i) => `${i + 1}) ${x}`).join('<br>')} | ${n.model} | **${VERD[n.chem[0]]}** — ${n.chem[1]} | **${VERD[n.bio[0]]}** — ${n.bio[1]} |`, '');
  md.push('| 참여 분자 | ' + RUNS.map((r) => RLAB[r] + ' 시작 → 끝').join(' | ') + ' |', '|---|' + RUNS.map(() => '---').join('|') + '|');
  for (const [role, p] of parts(s)) md.push(`| ${role}${p.minor ? '(보조)' : ''} ${p.n > 1 ? p.n + '× ' : ''}${bname(p.b)} | ` + RUNS.map((r) => `${f(D.runs[r].start[p.b])} → ${f(D.runs[r].final[p.b])}`).join(' | ') + ' |');
  md.push('', `| ${MAIN} 시각 (s) | ` + r0.pick.join(' | ') + ' |', '|---|' + r0.pick.map(() => '---').join('|') + '|');
  for (const [, p] of parts(s)) if (!p.minor || /D000032|D000035/.test(p.b)) md.push(`| ${bname(p.b)} | ` + (r0.traj[p.b] || []).map(f).join(' | ') + ' |');
  md.push('', '| 실행 | 속도 | 누적 발화 · 첫 발화 | 실패 |', '|---|---|---|---|');
  for (const r of RUNS) md.push(`| ${RLAB[r]} | ${rateOf(r, s.id)} | ${f(D.runs[r].cum[s.id] || 0)} 회 · t=${D.runs[r].firstFire[s.id] ?? '—'} s | ${stallsOf(r, s.id).join('<br>') || '없음'} |`);
  md.push('');
}
md.push('## 3. 새로 찾은 엔진 쪽 이상 (RULE-0262 — 고치지 않음)', '', '| 무엇 | 왜 | 재현 | 넘길 곳 |', '|---|---|---|---|');
md.push(`| ${N.engineFinding.what} | ${N.engineFinding.why} | \`${N.engineFinding.repro}\` | ${N.engineFinding.tag} |`);
md.push('', '## 4. 경로 전체로 본 실패 · 빈 곳', '', '| 무엇 | 근거 | 왜 문제인가 | 넘길 곳 |', '|---|---|---|---|');
const GAPS = [
  ['ATP 0.05 s · GTP 0.1 s 고갈 → S000009 · S000005 · S000002 정지 (시나리오 없음 · camp)', '정지 사건 (stalled)', '공급 규칙 7 개에 속도가 없어 연료가 소비만 됨 — 결과(RULE-0134), 결함 아님', '한계 L000019–L000023 (공급 속도)'],
  ['gtp-exhaustion: GTP 0.002 s 고갈 → S000002 정지, 그런데 하류는 60 s 까지 계속', 'G1P 0 → 600 000', 'AC · PKA · 인산화효소 키네이스를 끄는 단계가 없어 신호가 끊겨도 출력이 안 멈춤', 'L000125–L000127 + 인산화효소 키네이스 끄기(미등록) — author'],
  ['질량 수지 위반 S000003 (네 실행 모두)', 'AUDIT_MASS', 'Gs 가 두 번 세어짐', 'L000015 · L000018 — develop 전환 #9 뒤 author'],
  ['신호 종료 단계 S000007 이 사실상 꺼짐 (60 s 에 1.4 회)', 'PDE 기본값 10 분자 · cAMP ≪ Km', 'cAMP 가 계속 쌓임 (끝 2297 분자 ≈ 0.95 nM)', '분자 수 한계 L000016'],
  ['조절자 포도당(S000010 · S000011)이 적용되지 않음', '두 단계 모두 속도식 없음 → 조절 계수 계산 안 함', '포도당 감지(혈당이 높으면 분해 멈춤)가 모델에서 작동하지 않음', 'author — 조절 상수 (등록 없음)'],
  ['경로가 G1P 에서 끝남 — 혈당까지 안 감', '단계 목록', '이름은 "혈당 상승"인데 G6P · 포도당 · 수송이 없음', 'author — 단계 또는 범위 한계'],
  ['용액 조건 없음 (pH · 온도 · Mg²⁺ · 물)', 'DB · 시나리오', '측정값과 맞대려면 조건이 필요', 'author (ASY-08 계량 기초와 같은 자리)'],
];
for (const g of GAPS) md.push(`| ${g.join(' | ')} |`);
fs.writeFileSync(outMd, md.join('\n') + '\n');

// ---------- HTML ----------
const css = fs.readFileSync(path.join(R, 'docs/reports/2026-11-19-pathway-walkthrough/style.css'), 'utf8');
const pill = (v) => `<span class="pill ${v[0] === 'ok' ? 'ok' : v[0] === 'bad' ? 'bad' : 'warn'}">${VERD[v[0]]}</span>`;
const tbl = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const H = [];
H.push(`<title>글리코겐 분해 해부</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"><style>${css}
.steplist{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}.steplist a{display:block;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);text-decoration:none;font-size:.86rem}
ol.real{margin:0;padding-left:1.2em;font-size:.88rem} .two{display:grid;grid-template-columns:1fr 1fr;gap:12px} @media (max-width:700px){.two{grid-template-columns:1fr}}
.box{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px 12px;min-width:0} .box h4{margin:0 0 6px;font-size:.85rem;color:var(--muted)} .box p{margin:0;font-size:.9rem}
.note{border-left:3px solid var(--warn);padding:8px 12px;background:var(--warn-bg);border-radius:0 6px 6px 0;max-width:80ch}
td code{font-size:.78em} main>*{min-width:0} nav a{white-space:normal;max-width:100%}</style>`);
H.push('<main><header class="top"><p class="eyebrow">make-bio-database · baseline · 2026-11-21 · 코어 8ac7dea</p><h1>에피네프린 → 글리코겐 분해, 단계마다</h1>');
H.push(`<p class="lede">D000051 의 11 단계를 하나씩: 어디서 일어났는지, 실제로는 몇 단계로 나뉘는지, 시작량이 끝에 얼마가 되었는지, 어디서 왜 멈췄는지, 화학·생물로 맞는지, 용액과 속도는 어땠는지. 엔진을 시나리오 4 가지로 60 초씩 돌린 결과다.</p>`);
H.push(`<p class="note">값은 전부 가상이거나 기본값이고, 즉시 처리 단계가 많아 시각·횟수는 Δt 에 따라 바뀐다. 아래 숫자는 "이 설정에서 이렇게 흘렀다" 이지 예측이 아니다. 화학·생물 판정은 Claude 의 교과서 지식이며 원문과 대조하지 않았다.</p>`);
H.push(`<nav>${steps.map((s) => `<a href="#${s.id}">${s.id.slice(-2)} ${esc(s.label)}</a>`).join('')}</nav></header>`);
H.push('<section><h2>반응이 일어난 곳</h2>' + tbl(['무엇', '값'], [['세포', esc(N.env.cell)], ['부피', esc(N.env.volumes)], ['막', esc(N.env.membrane)], ['용액 조건', esc(N.env.solution)], ['환산', esc(N.env.conc1)]]));
H.push(`<h3 class="sec">시작 기질 (${MAIN})</h3>` + tbl(['묶음', '시작 분자 수', '환산', '실제 간세포와 비교 (대략)'], Object.entries(r0.start).filter(([, n]) => n).map(([b, n]) => [esc(bname(b)), f(n), b.includes('extracellular') ? (n / (NA * 1e-11) * 1e9).toPrecision(3) + ' nM' : b.includes('plasma_membrane') ? '막 (면적 농도 없음)' : conc(n), esc(REAL[b] || '')])) + '</section>');
H.push('<section><h2>한눈에 — 11 단계</h2>' + tbl(['단계', '누적 발화 (없음 / camp / exh / regen)', '화학', '생물', '정지'], summaryRows.map((x) => [`<a href="#${x.id}">${x.id}</a> ${esc(x.label)} <span class="pill ${x.ev === 'curated' ? 'ok' : 'warn'}">${x.ev === 'curated' ? '출처 있음' : '출처 없음'}</span>`, x.cum, pill(x.chem), pill(x.bio), esc(x.fails.join(' · ') || '없음')])) + '</section>');
for (const s of steps) {
  const n = N.steps[s.id];
  H.push(`<section class="step" id="${s.id}"><header><span class="sid">${s.id}</span><h2 style="font-size:1.3rem">${esc(s.label)}</h2><span class="act">${esc(s.action)}</span><span class="pill">${esc(s.effect.type)}</span><span class="pill ${(s.evidence || {}).level === 'curated' ? 'ok' : 'warn'}">${(s.evidence || {}).level === 'curated' ? '출처 ' + new Set(s.evidence.sources.map((x) => x.citation)).size : '출처 없음'}</span></header>`);
  H.push(`<p class="plain">${esc(s.text)}</p><p class="muted"><b>어디서</b> — ${esc(n.where)}</p>`);
  H.push(`<div class="two"><div class="box"><h4>실제로는 (세부 진행)</h4><ol class="real">${n.real.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div><div class="box"><h4>모델이 담은 것</h4><p>${esc(n.model)}</p></div></div>`);
  H.push(`<div class="two"><div class="box"><h4>화학 ${pill(n.chem)}</h4><p>${esc(n.chem[1])}</p></div><div class="box"><h4>생물 ${pill(n.bio)}</h4><p>${esc(n.bio[1])}</p></div></div>`);
  H.push('<h3 class="sec">양 — 시작 → 끝 (60 s)</h3>' + tbl(['참여 분자', ...RUNS.map((r) => RLAB[r])], parts(s).map(([role, p]) => [`${role}${p.minor ? '(보조)' : ''} ${p.n > 1 ? p.n + '× ' : ''}${esc(bname(p.b))}`, ...RUNS.map((r) => `${f(D.runs[r].start[p.b])} → <b>${f(D.runs[r].final[p.b])}</b>`)])));
  H.push(`<h3 class="sec">중간 경과 (${MAIN}, 분자 수)</h3>` + tbl(['분자 \\ 시각 s', ...r0.pick.map(String)], parts(s).filter(([, p]) => !p.minor || /D000032|D000035/.test(p.b)).map(([, p]) => [esc(bname(p.b)), ...(r0.traj[p.b] || []).map(f)])));
  H.push('<h3 class="sec">속도 · 발화 · 실패</h3>' + tbl(['실행', '속도', '누적 발화 · 첫 발화', '실패'], RUNS.map((r) => [RLAB[r], esc(rateOf(r, s.id)), `${f(D.runs[r].cum[s.id] || 0)} 회 · t=${D.runs[r].firstFire[s.id] ?? '—'} s`, esc(stallsOf(r, s.id).join(' · ') || '없음')])) + '</section>');
}
H.push('<section><h2>새로 찾은 엔진 쪽 이상</h2>' + tbl(['무엇', '왜', '재현', '넘길 곳'], [[esc(N.engineFinding.what), esc(N.engineFinding.why), `<code>${esc(N.engineFinding.repro)}</code>`, esc(N.engineFinding.tag)]]) + '</section>');
H.push('<section><h2>경로 전체의 실패 · 빈 곳</h2>' + tbl(['무엇', '근거', '왜 문제인가', '넘길 곳'], GAPS.map((g) => g.map(esc))) + '</section>');
H.push('<footer class="muted">원자료: docs/reports/2026-11-21-D000051-dossier/ (extract.cjs → runs.json · notes.json → gen.cjs). 데이터·코드는 고치지 않았다.</footer></main>');
fs.writeFileSync(outHtml, H.join('\n'));
console.log('ok', outMd, outHtml);
