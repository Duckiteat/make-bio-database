// usage: node gen.cjs <repo> <out.html> <notesdir> D000050 [D...]
const fs = require('fs');
const [repo, out, notesDir, ...PS] = process.argv.slice(2);
const db = require(repo + '/data/db.json');
const V = require(repo + '/vocab.js');
const LOC = Object.fromEntries(Object.entries(V.locations).map(([k, v]) => [k, v.label || k]));
const EV = Object.fromEntries(Object.entries(V.evidenceLevels).map(([k, v]) => [k, v.label || k]));
const KIND = Object.fromEntries(Object.entries(V.kinds).map(([k, v]) => [k, v.label || k]));
const FEAT = Object.fromEntries(Object.entries(V.features || {}).map(([k, v]) => [k, v.label || k]));
const GAP = Object.fromEntries(Object.entries(V.gapTypes || {}).map(([k, v]) => [k, v.label || k]));
const name = d => { const s = db.senses[d]; const t = s && db.terms[s.term]; return t ? t.names.ko : d; };
const ruleOf = r => { const [d, id] = r.split('/rule/'); const s = db.senses[d]; return s && (s.rule || []).find(x => x.id === id); };
function bundle(b) { // "D|site:feat|loc"
  const parts = b.split('|'); const d = parts[0]; const loc = parts[parts.length - 1];
  const states = parts.slice(1, -1).map(p => { const [site, f] = p.split(':'); return { site, f, label: FEAT[f] || f }; });
  return { key: b, d, name: name(d), loc, locLabel: LOC[loc] || loc, states };
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const data = PS.map(P => {
  const notes = JSON.parse(fs.readFileSync(`${notesDir}/notes-${P}.json`, 'utf8'));
  const steps = Object.entries(db.steps).filter(([, s]) => (s.part_of || []).includes(P)).map(([id, s]) => {
    const p = x => ({ ...bundle(x.b), n: x.n || 1, minor: !!x.minor });
    return { id, rule: s.rule, owner: s.rule.split('/rule/')[0], ownerName: name(s.rule.split('/rule/')[0]), def: ruleOf(s.rule) || {},
      agents: (s.agents || []).map(p), inputs: (s.inputs || []).map(p), outputs: (s.outputs || []).map(p), regulators: s.regulators || [] };
  });
  const ents = new Set();
  for (const s of steps) for (const k of ['agents', 'inputs', 'outputs']) for (const x of s[k]) ents.add(x.d);
  for (const d of [...ents]) for (const c of (db.senses[d].components || [])) ents.add(c.ref);
  const ids = new Set([...ents, P, ...steps.map(s => s.rule)]);
  const touches = o => { const j = JSON.stringify(o); return [...ids].some(i => j.includes('"' + i)); };
  // successors (major only)
  const key = x => x.key;
  for (const a of steps) a.next = steps.filter(b => b !== a && a.outputs.filter(o => !o.minor).some(o => [...b.inputs, ...b.agents].filter(i => !i.minor).map(key).includes(o.key))).map(b => b.id);
  return {
    P, name: name(P), sense: db.senses[P], notes, steps,
    entities: [...ents].map(d => ({ id: d, name: name(d), aliases: (db.terms[db.senses[d].term] || {}).aliases || [], ...db.senses[d],
      values: Object.entries(db.values).filter(([, v]) => v.subject === d).map(([id, v]) => ({ id, ...v })) })),
    observations: Object.entries(db.observations).filter(([, o]) => touches(o)).map(([id, o]) => ({ id, ...o })),
    limitations: Object.entries(db.limitations).filter(([, l]) => touches(l)).map(([id, l]) => ({ id, ...l })),
  };
});

function chip(x, role) {
  const st = x.states.map(s => `<span class="st">${esc(s.label)}</span>`).join('');
  return `<span class="chip ${role}${x.minor ? ' minor' : ''}" title="${esc(x.key)}">${x.n > 1 ? `<b class="n">${x.n}×</b>` : ''}${esc(x.name)}${st}<span class="loc">${esc(x.locLabel)}</span></span>`;
}
function evPill(ev) { const l = (ev || {}).level || '없음'; return `<span class="pill ev-${esc(l)}">${esc(EV[l] || l)}</span>`; }
function kin(def) { const k = def.kinetics; if (!k) return '<span class="pill warn">속도 상수 없음 → 즉시 처리</span>'; return `<span class="pill">${esc(JSON.stringify(k))}</span>`; }

function renderPath(d) {
  const N = d.notes, lims = d.limitations;
  const limFor = ids => lims.filter(l => ids.some(i => JSON.stringify(l).includes('"' + i)));
  const mer = ['flowchart TD'];
  for (const s of d.steps) mer.push(`  ${s.id}["${s.id} · ${(s.def.label || '').replace(/"/g, '')}"]`);
  for (const s of d.steps) for (const n of s.next) mer.push(`  ${s.id} --> ${n}`);
  for (const s of d.steps) { const r = (N.reverse || {})[s.id]; if (r && r.has === false) mer.push(`  class ${s.id} noRev`); }
  mer.push('  classDef noRev stroke-width:3px,stroke-dasharray:6 3');
  const ladder = d.steps.map((s, i) => {
    const r = (N.reverse || {})[s.id] || {};
    const revTag = r.has === false ? '<span class="pill bad">되돌리는 단계 없음</span>' : r.has === true ? `<span class="pill ok">되돌림 ${esc(r.by)}</span>` : '';
    const L = limFor([s.rule, s.owner]);
    return `<article class="step" id="${s.id}">
  <header><span class="sid">${s.id}</span><h3>${esc(s.def.label)}</h3><span class="act">${esc(s.def.action)}</span>${revTag}</header>
  <div class="rx">
    <div class="side">${s.inputs.map(x => chip(x, 'in')).join('')}</div>
    <div class="arrow">${s.agents.length ? `<div class="by">행위자 ${s.agents.map(x => chip(x, 'ag')).join('')}</div>` : ''}<div class="line">→</div></div>
    <div class="side">${s.outputs.map(x => chip(x, 'out')).join('')}</div>
  </div>
  <p class="plain">${esc((N.plain || {})[s.id])}</p>
  <dl class="facts">
    <dt>DB 설명</dt><dd>${esc(s.def.text)}</dd>
    <dt>규칙</dt><dd><code>${esc(s.rule)}</code> · 주인 ${esc(s.ownerName)}${s.def.via_component ? ` · 작용 소단위 ${esc(s.def.via_component)} ${esc(db.senses[s.def.via_component] ? name(s.def.via_component) : '')}` : ''}</dd>
    <dt>근거</dt><dd>${evPill(s.def.evidence)}</dd>
    <dt>속도</dt><dd>${kin(s.def)}</dd>
    <dt>조절자</dt><dd>${s.regulators.length ? esc(JSON.stringify(s.regulators)) : '없음'}</dd>
    <dt>되돌림</dt><dd>${esc(r.why || '')}</dd>
    <dt>다음 단계</dt><dd>${s.next.length ? s.next.map(n => `<a href="#${n}">${n}</a>`).join(' · ') : '없음'}</dd>
    ${L.length ? `<dt>걸린 한계</dt><dd>${L.map(l => `<a href="#${l.id}">${l.id}</a> ${esc(GAP[l.type] || l.type)}`).join('<br>')}</dd>` : ''}
  </dl>
</article>`;
  }).join('\n');
  const ents = d.entities.map(e => `<article class="ent" id="${e.id}">
  <header><span class="sid">${e.id}</span><h3>${esc(e.name)}</h3><span class="pill">${esc(KIND[e.kind] || e.kind)}</span><span class="pill">${esc(e.tier || '')}</span></header>
  ${(e.desc || []).map(x => `<p>${esc(x.text)} ${evPill(x.evidence)} <span class="muted">${esc(x.field || '')} · ${esc(x.by || '')} ${esc(x.at || '')}</span></p>`).join('')}
  <dl class="facts">
    ${e.aliases.length ? `<dt>별칭</dt><dd>${esc(e.aliases.join(' · '))}</dd>` : ''}
    ${e.note ? `<dt>메모</dt><dd>${esc(e.note)}</dd>` : ''}
    ${e.membrane ? `<dt>막</dt><dd>${esc(LOC[e.membrane.location] || e.membrane.location)} · ${esc(e.membrane.association)}${e.membrane.side ? ' · ' + esc(e.membrane.side) : ''}</dd>` : ''}
    ${(e.components || []).length ? `<dt>구성</dt><dd>${e.components.map(c => `${c.n}× <a href="#${c.ref}">${esc(name(c.ref))}</a> (${esc(c.role || '')})`).join(' · ')}</dd>` : ''}
    ${Object.keys(e.site || {}).length ? `<dt>부위</dt><dd>${Object.entries(e.site).map(([k, s]) => `<b>${esc(k)}</b> ${esc(s.type || '')}: ${(s.features || []).map(f => esc(FEAT[f] || f)).join(' / ')}${s.note ? ' — ' + esc(s.note) : ''}`).join('<br>')}</dd>` : ''}
    <dt>외부 ID</dt><dd>${(e.xrefs || []).length ? e.xrefs.map(x => `${esc(x.db)} ${esc(x.id)} <span class="pill ${x.status === 'verified' ? 'ok' : 'warn'}">${x.status === 'verified' ? '원본 대조함' : '대조 안 함'}</span>${x.role ? ' ' + esc(x.role) : ''}`).join('<br>') : '<span class="pill warn">없음</span>'}</dd>
    ${e.values.length ? `<dt>값</dt><dd>${e.values.map(v => `${esc(v.id)} ${esc(v.property)} = ${esc((v.value || {}).mean ?? JSON.stringify(v.value))} ${esc(v.unit)} ${evPill(v.evidence)}`).join('<br>')}</dd>` : ''}
  </dl>
</article>`).join('\n');
  const limRows = lims.map(l => `<tr id="${l.id}"><td><b>${l.id}</b></td><td>${esc(GAP[l.type] || l.type)}</td><td><code>${esc(l.target)}</code> ${esc(name(String(l.target).split('/')[0]))}</td><td>${esc((l.requirement || {}).text)}</td></tr>`).join('');
  const nNoRev = Object.values(N.reverse || {}).filter(r => r.has === false).length;
  const evCount = d.steps.filter(s => (s.def.evidence || {}).level === 'asserted').length;
  return `<section class="path" id="p-${d.P}">
<div class="head"><p class="eyebrow">${d.P} · ${esc(KIND[d.sense.kind])} · ${(d.sense.xrefs || []).map(x => esc(x.db + ' ' + x.id)).join(' · ')}</p>
<h2>${esc(d.name)}</h2><p class="lede">${esc(N.summary)}</p>
<p class="muted">DB 정의: ${esc((d.sense.desc || [])[0]?.text)}</p></div>
<div class="tiles">
 <div><b>${d.steps.length}</b><span>단계</span></div><div><b>${d.entities.length}</b><span>분자·소단위</span></div>
 <div class="${nNoRev ? 'bad' : ''}"><b>${nNoRev}</b><span>되돌림 없는 단계</span></div>
 <div class="warn"><b>${d.steps.filter(s => !s.def.kinetics).length}/${d.steps.length}</b><span>속도 상수 없음</span></div>
 <div class="warn"><b>${evCount}/${d.steps.length}</b><span>출처 없는 단계</span></div>
 <div><b>${d.observations.length}</b><span>관찰 기록</span></div><div><b>${lims.length}</b><span>걸린 한계</span></div>
</div>
<h3 class="sec">단계 연결도</h3><p class="muted">화살표는 앞 단계의 산물이 다음 단계의 재료나 행위자로 쓰이는 연결. 굵은 점선 상자 = 되돌리는 단계가 없는 단계. 보조 기질(GTP·ATP 같은 무한 풀)은 빼고 그렸다.</p>
<div class="mer"><pre class="mermaid">${mer.join('\n')}</pre></div>
<h3 class="sec">단계 하나씩</h3><p class="muted">왼쪽 = 쓰이는 재료, 가운데 = 행위자(쓰이지 않고 남음), 오른쪽 = 생기는 것. 흐린 칩 = 보조 기질. 회색 꼬리표 = 부위 상태, 끝 글자 = 위치.</p>
<div class="steps">${ladder}</div>
<h3 class="sec">돌려 본 결과</h3><div class="tw"><table><thead><tr><th>명령</th><th>무엇</th><th>결과</th><th>읽는 법</th></tr></thead><tbody>${(N.runs || []).map(r => `<tr><td><code>${esc(r.cmd)}</code></td><td>${esc(r.what)}</td><td>${esc(r.result)}</td><td>${esc(r.read)}</td></tr>`).join('')}</tbody></table></div>
<h3 class="sec">찾은 것</h3><div class="tw"><table><thead><tr><th>무엇</th><th>근거</th><th>지금 상태</th><th>넘길 곳</th></tr></thead><tbody>${(N.findings || []).map(r => `<tr><td>${esc(r.what)}</td><td>${esc(r.evidence)}</td><td>${esc(r.status)}</td><td>${esc(r.to)}</td></tr>`).join('')}</tbody></table></div>
<h3 class="sec">등장 분자 전부</h3><div class="ents">${ents}</div>
<h3 class="sec">걸린 한계 (${lims.length})</h3><p class="muted">이 경로의 단계·규칙·분자 번호가 한 번이라도 나오는 한계 등록부 항목.</p>
<div class="tw"><table><thead><tr><th>번호</th><th>종류</th><th>대상</th><th>요구</th></tr></thead><tbody>${limRows}</tbody></table></div>
</section>`;
}

const css = fs.readFileSync(__dirname + '/style.css', 'utf8');
const nav = data.map(d => `<a href="#p-${d.P}">${esc(d.name)}</a>`).join('');
const html = `<title>경로 해부도</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${css}</style>
<main>
<header class="top"><p class="eyebrow">make-bio-database · baseline 점검 · ${new Date().toISOString().slice(0, 10)}</p>
<h1>경로 해부도</h1>
<p class="lede">DB 에 적힌 경로를 단계마다 펼쳐, 무엇이 무엇이 되는지 · 누가 일하는지 · 근거와 속도가 있는지 · 어디가 비어 있는지를 한 번에 보인다. 데이터는 커밋 시점 <code>data/db.json</code> 에서 그대로 꺼냈고 고치지 않았다.</p>
<nav>${nav}</nav></header>
${data.map(renderPath).join('\n')}
<footer class="muted">근거 수준: "출처 없이 적음"(asserted) = 문헌 인용 없이 적은 교과서 지식 · "문헌·큐레이션 근거"(curated) = 출처 있음 · "도구로 계산"(computed). 속도 상수가 없으면 엔진은 그 단계를 순간에 끝낸다 — 시간 척도를 결론으로 쓰지 않는다.</footer>
</main>`;
fs.writeFileSync(out, html);
console.log('ok', out, html.length);
