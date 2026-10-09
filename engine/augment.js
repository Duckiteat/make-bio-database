// 자동 보강 고리 (Auto-Augmentation Loop) — Identity_Gap·unmapped·대조 안 된(asserted) 외부 ID 를 권위 있는 원본(UniProt·ChEBI)에서
// 가져와 확인하고 패치로 만든다. 데이터베이스는 언제나 패치 → merge(관문)로만 바뀐다.
//
//   ① plan    : 데이터에서 과제를 찾는다 — unmapped/Identity_Gap(이름 검색 → 번호), asserted UniProt·ChEBI(번호 직접 조회 → 대조).
//   ② fetch   : curl(프록시 설정을 따름)로 받아 data/fetched/ 수신함에 원본 그대로 저장. 막히면 '수동 수집 과제'(RETRIEVAL_TASKS.md)를 쓴다.
//   ③ build   : 수신함 파일을 읽어(JSON·FASTA·평문만 해석, 실행하지 않음) 확인한다 —
//               단백질: 번호 일치 · 종(taxon) = 기준 종 · 유전자/단백질 이름이 개념 이름·별칭과 일치 · 다른 정의항과 중복 없음
//               저분자: 이름 일치(검색이면 정확히 하나) · 화학식의 C·N·P·S 원자 수 = 선언된 부분 구조의 원자 수(엔진 질량 수지와 대조) · 중복 없음
//               통과 → status 'verified' + 출처 메모, 서열 길이 관찰(sequence_length)·서열 지문(SEQ_SHA256, 도구 계산)·InChIKey 를 더한다.
//               실패·모호 → 바꾸지 않고(unmapped 유지) 보고, 검색 후보는 그 Identity_Gap 의 note 로.
//   ④ apply   : 패치를 관문에 통과시켜 병합하고 CHANGES.md 맨 위에 한 행(Scope·Why·Impact·Verification)을 더한다.
// 안전 규칙: 이미 적힌 asserted 값을 다른 값으로 덮어쓰지 않는다 (sync 를 명시했을 때만). 같은 값이면 status 만 verified 로 올린다.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('../core.js');
const V = C.VOCAB;

const INBOX = 'data/fetched';
const URLS = {
  uniprot_entry: (acc) => [`https://rest.uniprot.org/uniprotkb/${acc}.json`, `https://rest.uniprot.org/uniprotkb/${acc}.fasta`, `https://rest.uniprot.org/uniprotkb/${acc}.txt`],
  uniprot_search: (gene, taxon) => [`https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(`gene_exact:${gene} AND organism_id:${taxon} AND reviewed:true`)}&fields=accession,gene_names,protein_name,organism_id,length&format=json&size=5`],
  chebi_entity: (id) => [`https://www.ebi.ac.uk/chebi/backend/api/public/compound/${id}/`, `https://www.ebi.ac.uk/ols4/api/ontologies/chebi/terms?obo_id=${id}`],
  chebi_search: (q) => [`https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(q)}&ontology=chebi&exact=true&rows=5`, `https://www.ebi.ac.uk/chebi/backend/api/public/es_search/?term=${encodeURIComponent(q)}&size=5`],
};
const fileOf = (kind, key) => ({ uniprot_entry: `uniprot/${key}`, uniprot_search: `uniprot-search/${key}`, chebi_entity: `chebi/${key.replace(':', '_')}`, chebi_search: `chebi-search/${key}` })[kind];

// ===== ① 과제 =====
function namesOf(db, id) { const d = db.senses[id], t = d && db.terms[d.term]; return t ? [t.names.ko, t.names.en, ...t.aliases].filter(Boolean) : []; }
function plan(db, opt) {
  db = C.normalize(db); opt = opt || {};
  const ix = C.index(db), tasks = [], dir = opt.dir || INBOX;
  const gapOf = (id) => Object.entries(db.limitations).filter(([, l]) => l.type === 'Identity_Gap' && (l.target === id || l.requirement.needs.some((n) => n.on === id))).map(([lid]) => lid);
  const seqGap = (id) => Object.entries(db.limitations).filter(([, l]) => l.requirement.needs.some((n) => n.kind === 'obs' && n.property === 'sequence_length' && n.on === id)).map(([lid]) => lid);
  const add = (t) => { t.file = path.join(dir, fileOf(t.kind, t.key)); t.present = present(t.file); tasks.push(t); };
  for (const [id, d] of Object.entries(db.senses)) {
    const K = V.kinds[d.kind];
    if (!K) continue;
    const up = d.xrefs.find((x) => x.db === 'UniProt'), ch = d.xrefs.find((x) => x.db === 'ChEBI');
    if (up && up.status !== 'verified') add({ kind: 'uniprot_entry', key: up.id, sense: id, label: ix.label(id), why: `UniProt ${up.id} 대조 (asserted → verified)${seqGap(id).length ? ` · 서열 길이(${seqGap(id).join(', ')})` : ''}`, gaps: [...gapOf(id), ...seqGap(id)], urls: URLS.uniprot_entry(up.id) });
    if (ch && ch.status !== 'verified') add({ kind: 'chebi_entity', key: ch.id, sense: id, label: ix.label(id), why: `ChEBI ${ch.id} 대조 (asserted → verified, 화학식 ↔ 부분 구조)`, gaps: gapOf(id), urls: URLS.chebi_entity(ch.id) });
    if (d.unmapped && (K.xref.required || []).includes('ChEBI') && !ch) {
      const q = (db.terms[d.term].names.en || db.terms[d.term].names.ko);
      add({ kind: 'chebi_search', key: id, sense: id, label: ix.label(id), query: q, why: `unmapped → ChEBI 번호 찾기 (이름 '${q}')`, gaps: gapOf(id), urls: URLS.chebi_search(q) });
      // 검색 결과가 이미 있으면 정확히 하나로 좁혀진 후보의 항목 조회를 다음 과제로
      const s = readTask({ kind: 'chebi_search', file: path.join(dir, fileOf('chebi_search', id)) });
      if (s && s.ok) { const pick = pickCandidate(db, id, s.data); if (pick.id) add({ kind: 'chebi_entity', key: pick.id, sense: id, label: ix.label(id), why: `검색으로 고른 ${pick.id} 의 항목 조회 (화학식 확인)`, gaps: gapOf(id), urls: URLS.chebi_entity(pick.id), fromSearch: true }); }
    }
    if (d.unmapped && (K.xref.required || []).includes('UniProt') && !up) {
      const gene = namesOf(db, id).find((n) => /^[A-Z0-9-]{2,12}$/.test(n)) || db.terms[d.term].names.en;
      add({ kind: 'uniprot_search', key: id, sense: id, label: ix.label(id), query: gene, why: `unmapped → UniProt 번호 찾기 (유전자 '${gene}', 종 ${d.reference_species})`, gaps: gapOf(id), urls: URLS.uniprot_search(gene, d.reference_species || V.defaultReferenceSpecies) });
    }
  }
  return tasks;
}
// 수신함: 확장자는 받아 본 형식으로 (.json · .fasta · .txt)
function present(base) { for (const ext of ['.json', '.fasta', '.txt']) if (fs.existsSync(base + ext)) return base + ext; return null; }

// ===== ② 받기 =====
function fetchTasks(tasks, opt) {
  opt = Object.assign({ timeout: 20 }, opt || {});
  const out = [];
  for (const t of tasks) {
    if (t.present && !opt.refetch) { out.push({ task: t, ok: true, cached: true, file: t.present }); continue; }
    let res = null;
    for (const url of t.urls) {
      const ext = /\.fasta$/.test(url) ? '.fasta' : /\.txt$/.test(url) ? '.txt' : '.json', dest = t.file + ext, tmp = dest + '.part';
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        execFileSync('curl', ['-sS', '-f', '-L', '-m', String(opt.timeout), '-o', tmp, url], { stdio: ['ignore', 'ignore', 'pipe'] });
        fs.renameSync(tmp, dest); res = { task: t, ok: true, file: dest, url }; break;
      } catch (e) { try { fs.unlinkSync(tmp); } catch (_) { /* 없음 */ } res = { task: t, ok: false, url, error: String(e.stderr || e.message).trim().split('\n').pop() }; }
    }
    out.push(res);
  }
  return out;
}
// 수동 수집 과제 (네트워크가 막혔을 때 사람에게 넘기는 목록)
function retrievalTasksMarkdown(tasks, results, date) {
  const failed = new Map((results || []).filter((r) => !r.ok).map((r) => [r.task, r.error]));
  const rows = tasks.filter((t) => !t.present);
  const L = [];
  L.push('# 수동 수집 과제 (Manual Retrieval Task)', '');
  L.push(`> \`node dbtool.mjs augment plan --write\` 가 ${date} 에 생성. 샌드박스에서 원본(UniProt·ChEBI)에 닿지 못할 때, 아래 응답 본문을 받아 **그대로** '저장 위치'에 두고 \`node dbtool.mjs augment build\` 를 실행한다.`);
  L.push('> 저장한 파일은 해석만 되고 실행되지 않는다. 응답 형식이 다르면(API 변경) 오른쪽 형식의 간이 JSON 을 손으로 써도 된다 — 값은 원본 화면에서 그대로 옮긴다.', '');
  L.push('| # | 정의항 | 과제 | 받을 주소 (첫 번째가 기본) | 저장 위치 | 관련 한계 | 간이 JSON 형식 |', '|---|---|---|---|---|---|---|');
  rows.forEach((t, i) => {
    const simple = t.kind === 'uniprot_entry' ? '원본 그대로 (.json · .fasta · .txt)' : t.kind === 'chebi_entity' ? '`{"id":"CHEBI:…","name":"…","formula":"C…","charge":0,"inchikey":"…-…-…","synonyms":["…"]}`' : t.kind === 'chebi_search' ? '`{"results":[{"id":"CHEBI:…","name":"…","formula":"…"}]}`' : '`{"results":[{"primaryAccession":"…"}]}`';
    L.push(`| ${i + 1} | ${t.sense} ${t.label} | ${t.why} | ${t.urls.map((u) => `<${u}>`).join('<br>')} | \`${t.file}.json\`${t.kind === 'uniprot_entry' ? ' (또는 .fasta/.txt)' : ''} | ${t.gaps.join(', ') || '—'} | ${simple} |`);
  });
  if (!rows.length) L.push('| — | — | 모든 과제의 파일이 수신함에 있음 | — | — | — | — |');
  const err = [...new Set([...failed.values()])];
  if (err.length) L.push('', `자동 받기 실패 사유: ${err.join(' · ')}`);
  return L.join('\n') + '\n';
}

// ===== 해석 (수신한 원본은 데이터로만 다룬다) =====
function readTask(t) {
  const file = t.present || present(t.file);
  if (!file) return null;
  const text = fs.readFileSync(file, 'utf8'), sha = crypto.createHash('sha256').update(text).digest('hex');
  try {
    const data = t.kind === 'uniprot_entry' ? parseUniProt(text, file) : t.kind === 'chebi_entity' ? parseChEBI(text) : t.kind === 'chebi_search' ? parseChEBISearch(text) : parseUniProtSearch(text);
    return { ok: true, file, sha, data };
  } catch (e) { return { ok: false, file, sha, error: e.message }; }
}
function parseUniProt(text, file) {
  const s = text.trim();
  if (s.startsWith('{')) {
    const j = JSON.parse(s);
    const genes = (j.genes || []).flatMap((g) => [g.geneName && g.geneName.value, ...(g.synonyms || []).map((x) => x.value)]).filter(Boolean);
    const pd = j.proteinDescription || {}, nm = (x) => x && x.fullName && x.fullName.value;
    const names = [nm(pd.recommendedName), ...((pd.recommendedName || {}).shortNames || []).map((x) => x.value), ...(pd.alternativeNames || []).flatMap((a) => [nm(a), ...(a.shortNames || []).map((x) => x.value)]), ...(pd.submissionNames || []).map(nm)].filter(Boolean);
    return { format: 'json', accession: j.primaryAccession, secondary: j.secondaryAccessions || [], entryName: j.uniProtkbId, reviewed: /reviewed/i.test(j.entryType || '') && !/unreviewed/i.test(j.entryType || ''),
      taxon: j.organism && String(j.organism.taxonId), organism: j.organism && j.organism.scientificName, genes, names,
      sequence: j.sequence && j.sequence.value, length: j.sequence && j.sequence.length, entryVersion: j.entryAudit && j.entryAudit.entryVersion, sequenceVersion: j.entryAudit && j.entryAudit.sequenceVersion };
  }
  if (s.startsWith('>')) { // FASTA: >sp|P29459|IL12A_HUMAN Interleukin-12 subunit alpha OS=Homo sapiens OX=9606 GN=IL12A PE=1 SV=2
    const [head, ...rest] = s.split(/\r?\n/), m = head.match(/^>(sp|tr)\|([^|]+)\|(\S+)\s+(.*?)\s+OS=(.*?)\s+OX=(\d+)(?:\s+GN=(\S+))?/);
    if (!m) throw new Error('FASTA 머리줄 형식을 알 수 없음');
    const seq = rest.join('').replace(/\s+/g, '');
    return { format: 'fasta', accession: m[2], secondary: [], entryName: m[3], reviewed: m[1] === 'sp', taxon: m[6], organism: m[5], genes: m[7] ? [m[7]] : [], names: [m[4]], sequence: seq, length: seq.length, sequenceVersion: (head.match(/SV=(\d+)/) || [])[1] };
  }
  if (/^ID\s{3}/.test(s)) { // UniProt 평문
    const lines = s.split(/\r?\n/), get = (tag) => lines.filter((l) => l.startsWith(tag + '   ')).map((l) => l.slice(5));
    const acc = get('AC').join(' ').split(';').map((x) => x.trim()).filter(Boolean);
    const seqStart = lines.findIndex((l) => l.startsWith('SQ   ')), seq = lines.slice(seqStart + 1).filter((l) => l.startsWith('     ')).join('').replace(/\s+/g, '');
    const de = get('DE').join(' '), gn = get('GN').join(' ');
    return { format: 'txt', accession: acc[0], secondary: acc.slice(1), entryName: get('ID')[0].split(/\s+/)[0], reviewed: /Reviewed;/.test(get('ID')[0]), taxon: (get('OX').join(' ').match(/NCBI_TaxID=(\d+)/) || [])[1],
      organism: get('OS').join(' ').replace(/\.$/, ''), genes: [...gn.matchAll(/(?:Name|Synonyms)=([^;{]+)/g)].flatMap((x) => x[1].split(',').map((y) => y.trim())), names: [...de.matchAll(/(?:Full|Short)=([^;{]+)/g)].map((x) => x[1].trim()), sequence: seq, length: seq.length };
  }
  throw new Error(`${path.basename(file)}: UniProt JSON·FASTA·평문 어느 것도 아님`);
}
// 깊이 우선으로 키를 찾는 도우미 (API 응답 모양이 바뀌어도 이름으로 찾는다)
function walk(o, f, depth) { if (depth > 8 || o == null) return; if (Array.isArray(o)) { for (const x of o) walk(x, f, depth + 1); return; } if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { f(k, v, o); walk(v, f, depth + 1); } }
const CHEBI_RE = /^CHEBI[:_](\d+)$/i, IK_RE = new RegExp(V.fingerprints.InChIKey.pattern);
const normChebi = (s) => { const m = String(s || '').trim().match(CHEBI_RE); return m ? `CHEBI:${m[1]}` : null; };
function parseChEBI(text) {
  const j = JSON.parse(text);
  const out = { id: null, name: null, formula: null, charge: null, inchikey: null, synonyms: [], stars: null };
  const firstStr = (v) => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : v && typeof v === 'object' && typeof (v.formula || v.value || v.name) === 'string' ? (v.formula || v.value || v.name) : null);
  walk(j, (k, v) => {
    const key = k.toLowerCase();
    if (!out.id && ['id', 'chebi_accession', 'chebiid', 'chebi_id', 'obo_id', 'accession'].includes(key) && normChebi(v)) out.id = normChebi(v);
    if (!out.name && ['name', 'ascii_name', 'chebiasciiname', 'label'].includes(key) && typeof v === 'string' && !normChebi(v)) out.name = v;
    if (!out.formula && /formula/.test(key)) { const f = firstStr(v); if (f && /^[A-Z][A-Za-z0-9().]*$/.test(f)) out.formula = f; }
    if (out.charge == null && key === 'charge' && Number.isFinite(Number(v))) out.charge = Number(v);
    if (!out.inchikey && /inchi_?key/.test(key) && typeof v === 'string' && IK_RE.test(v.replace(/^InChIKey=/, ''))) out.inchikey = v.replace(/^InChIKey=/, '');
    if (/synonym/.test(key)) for (const x of [].concat(v)) { const s = typeof x === 'string' ? x : x && (x.name || x.data || x.value); if (typeof s === 'string') out.synonyms.push(s); }
    if (out.stars == null && /stars?$/.test(key) && Number.isFinite(Number(v))) out.stars = Number(v);
  }, 0);
  if (!out.id) throw new Error('ChEBI 번호(CHEBI:…)를 찾을 수 없음');
  return out;
}
function parseChEBISearch(text) {
  const j = JSON.parse(text), seen = new Map();
  walk(j, (k, v, o) => {
    const id = ['id', 'obo_id', 'chebi_accession', 'chebiid', 'accession', 'short_form'].includes(k.toLowerCase()) && normChebi(v);
    if (!id || seen.has(id)) return;
    const name = typeof o.name === 'string' ? o.name : typeof o.label === 'string' ? o.label : typeof o.ascii_name === 'string' ? o.ascii_name : typeof o.chebiAsciiName === 'string' ? o.chebiAsciiName : null;
    const formula = typeof o.formula === 'string' ? o.formula : Array.isArray(o.formula) ? o.formula[0] : null;
    seen.set(id, { id, name, formula, synonyms: [].concat(o.synonyms || o.synonym || []).filter((x) => typeof x === 'string') });
  }, 0);
  return { candidates: [...seen.values()] };
}
function parseUniProtSearch(text) { const j = JSON.parse(text); return { candidates: (j.results || []).map((r) => ({ accession: r.primaryAccession, taxon: r.organism && String(r.organism.taxonId), genes: (r.genes || []).map((g) => g.geneName && g.geneName.value).filter(Boolean) })).filter((r) => r.accession) }; }

// ===== ③ 확인 =====
const nn = (s) => C.normName(String(s || ''));
function nameHit(db, id, cands) { const mine = new Set(namesOf(db, id).map(nn)); return cands.filter(Boolean).find((c) => mine.has(nn(c))) || null; }
// 검색 후보 고르기: 이름(정규화)이 개념 이름·별칭과 같은 후보가 정확히 하나일 때만
function pickCandidate(db, id, data) {
  const mine = new Set(namesOf(db, id).map(nn));
  const hits = data.candidates.filter((c) => [c.name, ...(c.synonyms || [])].some((x) => x && mine.has(nn(x))));
  const ids = [...new Set(hits.map((c) => c.id))];
  return ids.length === 1 ? { id: ids[0], name: hits[0].name, candidates: data.candidates } : { id: null, reason: ids.length ? `이름이 맞는 후보 ${ids.length}개 — 모호` : '이름이 맞는 후보 없음', hits, candidates: data.candidates };
}
// 부분 구조 → 원자 수는 데이터(구조 요소 정의항의 elements)에서 읽는다 — 이 코드는 생물·화학 이름을 모른다.
function parseFormula(f) {
  const s = String(f || '').replace(/\s+/g, '');
  if (!s || /[^A-Za-z0-9()]/.test(s) || /\)[nNx]/.test(s) || /R/.test(s.replace(/R[a-z]/g, ''))) return null; // 중합체·R 기는 검사 안 함
  const tok = (str) => { const out = {}; const re = /([A-Z][a-z]?)(\d*)|\(([^()]*)\)(\d*)/g; let m; while ((m = re.exec(str))) { if (m[1]) out[m[1]] = (out[m[1]] || 0) + (m[2] ? +m[2] : 1); else { const inner = tok(m[3]), k = m[4] ? +m[4] : 1; for (const [e, n] of Object.entries(inner)) out[e] = (out[e] || 0) + n * k; } } return out; };
  return tok(s);
}
function formulaCheck(db, id, formula) {
  const d = db.senses[id], el = parseFormula(formula);
  if (!el) return { status: 'skipped', note: `화학식 '${formula || '없음'}' 은 원자 수로 풀 수 없음 (중합체·R 기)` };
  if (!(d.moieties || []).length) return { status: 'no_moieties', note: `부분 구조가 선언되지 않음 — 화학식 C${el.C || 0} 를 보면 탄소 골격 단위 ${el.C || 0} 를 선언할 수 있음 (수지 검사를 켜려면)`, elements: el };
  const want = {}, unknown = [];
  for (const m of d.moieties) { const x = db.senses[m.ref], t = x && x.elements; if (!t) { unknown.push(m.ref); continue; } for (const [e, n] of Object.entries(t)) want[e] = (want[e] || 0) + n * m.n; }
  if (unknown.length) return { status: 'skipped', note: `원자 수(elements)가 없는 부분 구조: ${unknown.join(', ')} — 구조 요소 정의항에 elements 를 넣으면 대조된다` };
  const bad = ['C', 'N', 'P', 'S'].filter((e) => (want[e] || 0) !== (el[e] || 0));
  return bad.length ? { status: 'mismatch', note: `원자 수 불일치 ${bad.map((e) => `${e}: 부분 구조 ${want[e] || 0} ≠ 화학식 ${el[e] || 0}`).join(', ')}`, elements: el, want } : { status: 'ok', note: `C${want.C || 0} N${want.N || 0} P${want.P || 0} S${want.S || 0} 일치`, elements: el, want };
}

// ===== 패치 만들기 =====
function build(db, opt) {
  db = C.normalize(db); opt = Object.assign({ dir: INBOX, sync: false, date: new Date().toISOString().slice(0, 10) }, opt || {});
  const ix = C.index(db), tasks = plan(db, { dir: opt.dir }), rows = [], upd = new Map(), limUpd = new Map();
  const S = (id) => { if (!upd.has(id)) { const d = db.senses[id]; upd.set(id, { id, _xrefs: d.xrefs.map((x) => ({ ...x })), _obs: d.obs.map((o) => JSON.parse(JSON.stringify(o))), _fp: d.fingerprint, _unmapped: d.unmapped, _changed: new Set() }); } return upd.get(id); };
  const holder = (db_, id) => [...ix.xrefs.get(`${db_}:${id}`) || []];
  const row = (t, outcome, detail, extra) => rows.push(Object.assign({ sense: t.sense, label: t.label, kind: t.kind, key: t.key, outcome, detail }, extra || {}));
  for (const t of tasks) {
    const got = readTask(t);
    if (!got) { row(t, 'missing', `수신함에 없음 — ${t.file}.json`); continue; }
    if (!got.ok) { row(t, 'unreadable', got.error, { file: got.file }); continue; }
    const src = `${path.relative(process.cwd(), got.file) || got.file} · sha256:${got.sha.slice(0, 12)}`;
    if (t.kind === 'uniprot_entry') {
      const u = got.data, d = db.senses[t.sense], fails = [];
      if (u.accession !== t.key && !(u.secondary || []).includes(t.key)) fails.push(`번호 ${u.accession} ≠ ${t.key}`);
      if (u.taxon !== (d.reference_species || V.defaultReferenceSpecies)) fails.push(`종 ${u.taxon} ≠ 기준 종 ${d.reference_species}`);
      const hit = nameHit(db, t.sense, [...u.genes, ...u.names, u.entryName && u.entryName.split('_')[0]]);
      if (!hit) fails.push(`이름 불일치 — 원본 ${[...u.genes, ...u.names].slice(0, 4).join(' / ')} · 개념 ${namesOf(db, t.sense).join(' / ')}`);
      const others = holder('UniProt', u.accession).filter((x) => x !== t.sense);
      if (others.length) fails.push(`${u.accession} 는 이미 ${others.join(', ')} 에 있음`);
      if (u.accession !== t.key && !opt.sync) fails.push(`asserted 번호 ${t.key} 를 ${u.accession} 로 바꾸려면 sync`);
      if (fails.length) { row(t, 'rejected', fails.join(' · '), { file: got.file }); continue; }
      const s = S(t.sense), x = s._xrefs.find((y) => y.db === 'UniProt' && y.id === t.key);
      x.id = u.accession; x.status = 'verified'; x.note = `UniProtKB ${u.format} 조회 ${opt.date} (${u.reviewed ? 'Swiss-Prot' : 'TrEMBL'}${u.entryVersion ? `, 항목 v${u.entryVersion}` : ''}${u.sequenceVersion ? `, 서열 v${u.sequenceVersion}` : ''}) · 이름 일치 '${hit}' · ${src}`;
      s._changed.add('xrefs');
      const notes = [`검증 (이름 '${hit}', 종 ${u.taxon})`];
      if (u.sequence && u.length) {
        const tool = `dbtool augment — UniProtKB ${u.accession}${u.sequenceVersion ? ` 서열 v${u.sequenceVersion}` : ''} (${src})`;
        const old = s._obs.find((o) => o.property === 'sequence_length' && o.context.species === u.taxon);
        if (!old) { s._obs.push({ property: 'sequence_length', value: u.length, unit: 'aa', context: { species: u.taxon }, evidence: { level: 'computed', tool } }); s._changed.add('obs'); notes.push(`서열 길이 ${u.length} aa`); }
        else if (old.value !== u.length) { if (opt.sync) { old.value = u.length; old.evidence = { level: 'computed', tool }; s._changed.add('obs'); notes.push(`서열 길이 ${old.value} 로 동기화`); } else notes.push(`서열 길이 충돌 (있음 ${old.value}, 원본 ${u.length}) — 그대로 둠`); }
        if (u.sequence.length === u.length) {
          const h = crypto.createHash('sha256').update(u.sequence.toUpperCase()).digest('hex');
          if (!s._fp) { s._fp = { scheme: 'SEQ_SHA256', value: h, status: 'computed' }; s._changed.add('fingerprint'); notes.push('서열 지문 SEQ_SHA256 (도구 계산)'); }
          else if (s._fp.scheme === 'SEQ_SHA256' && s._fp.value !== h) notes.push(`서열 지문 충돌 — 그대로 둠${opt.sync ? ' (sync 는 지문을 바꾸지 않음)' : ''}`);
        }
      }
      row(t, 'verified', notes.join(' · '), { file: got.file, id: u.accession });
    } else if (t.kind === 'chebi_entity') {
      const c = got.data, fails = [];
      if (c.id !== t.key) fails.push(`번호 ${c.id} ≠ ${t.key}`);
      const hit = nameHit(db, t.sense, [c.name, ...c.synonyms]);
      if (!hit) fails.push(`이름 불일치 — 원본 '${c.name}' · 개념 ${namesOf(db, t.sense).join(' / ')}`);
      const fc = formulaCheck(db, t.sense, c.formula);
      if (fc.status === 'mismatch') fails.push(`화학식 ↔ 부분 구조: ${fc.note}`);
      const others = holder('ChEBI', c.id).filter((x) => x !== t.sense);
      if (others.length) fails.push(`${c.id} 는 이미 ${others.join(', ')} 에 있음`);
      const s0 = db.senses[t.sense], existing = s0.xrefs.find((y) => y.db === 'ChEBI');
      if (existing && existing.id !== c.id && !opt.sync) fails.push(`asserted ${existing.id} 를 ${c.id} 로 바꾸려면 sync`);
      if (fails.length) { row(t, 'rejected', fails.join(' · '), { file: got.file, formula: fc }); continue; }
      const s = S(t.sense);
      let x = s._xrefs.find((y) => y.db === 'ChEBI');
      if (!x) { x = { db: 'ChEBI', id: c.id }; s._xrefs.push(x); }
      x.id = c.id; x.status = 'verified'; x.note = `ChEBI 조회 ${opt.date} · 이름 일치 '${hit}' · 화학식 ${c.formula || '없음'}${c.charge != null ? ` (전하 ${c.charge})` : ''} · 부분 구조 대조 ${fc.status}${fc.status === 'ok' ? ` (${fc.note})` : ''} · ${src}`;
      s._changed.add('xrefs');
      if (s._unmapped) { s._unmapped = undefined; s._changed.add('unmapped'); }
      const notes = [`검증 (이름 '${hit}', ${fc.status === 'ok' ? '부분 구조 원자 수 일치' : fc.note})`];
      if (c.inchikey && !s._fp && V.fingerprints.InChIKey.kinds.includes(s0.kind)) {
        const dup = Object.entries(db.senses).find(([oid, o]) => oid !== t.sense && o.fingerprint && o.fingerprint.value === c.inchikey);
        if (dup) notes.push(`InChIKey 가 이미 ${dup[0]} 에 — 넣지 않음`); else { s._fp = { scheme: 'InChIKey', value: c.inchikey, status: 'verified' }; s._changed.add('fingerprint'); notes.push('InChIKey (ChEBI 원본)'); }
      }
      row(t, 'verified', notes.join(' · '), { file: got.file, id: c.id, formula: fc });
    } else if (t.kind === 'chebi_search') {
      const pick = pickCandidate(db, t.sense, got.data);
      if (!pick.id) {
        row(t, 'ambiguous', `${pick.reason}${pick.candidates.length ? ` — 후보 ${pick.candidates.slice(0, 5).map((c) => `${c.id}(${c.name || '?'})`).join(', ')}` : ''}`, { file: got.file });
        for (const lid of t.gaps) { const l = JSON.parse(JSON.stringify(db.limitations[lid])); l.note = `자동 보강 ${opt.date}: ${pick.reason}. 검색 후보 ${pick.candidates.slice(0, 5).map((c) => `${c.id}${c.name ? ' ' + c.name : ''}${c.formula ? ' ' + c.formula : ''}`).join('; ') || '없음'} — 이름이 정확히 하나로 맞을 때만 고른다`; limUpd.set(lid, { id: lid, ...l }); }
        continue;
      }
      const entity = tasks.find((x) => x.kind === 'chebi_entity' && x.sense === t.sense && x.key === pick.id);
      row(t, 'candidate', `이름이 맞는 후보 ${pick.id} (${pick.name}) — ${entity && entity.present ? '항목 파일로 확인' : `항목 조회 과제 생성 (${fileOf('chebi_entity', pick.id)}.json)`}`, { file: got.file, id: pick.id });
    } else if (t.kind === 'uniprot_search') {
      const d = db.senses[t.sense], c = got.data.candidates.filter((r) => r.taxon === (d.reference_species || V.defaultReferenceSpecies) && nameHit(db, t.sense, r.genes));
      row(t, c.length === 1 ? 'candidate' : 'ambiguous', c.length === 1 ? `후보 ${c[0].accession} — 항목 조회 후 확인하려면 xrefs 에 asserted 로 넣고 다시 build` : `종·유전자 이름이 맞는 후보 ${c.length}개`, { file: got.file });
    }
  }
  // 패치
  const senses = [];
  for (const s of upd.values()) {
    if (!s._changed.size) continue;
    const o = { id: s.id };
    if (s._changed.has('xrefs')) o.xrefs = s._xrefs;
    if (s._changed.has('obs')) o.obs = s._obs;
    if (s._changed.has('fingerprint')) o.fingerprint = s._fp;
    if (s._changed.has('unmapped')) o.unmapped = '';
    senses.push(o);
  }
  const count = (k) => rows.filter((r) => r.outcome === k).length;
  const patch = { format: C.PATCH_FORMAT, version: C.VERSION,
    why: `자동 보강 고리 (${opt.date}): 원본(UniProt·ChEBI)에서 받은 ${rows.filter((r) => r.file).length}개 파일로 외부 ID 확인 — 검증 ${count('verified')}, 거부 ${count('rejected')}, 모호 ${count('ambiguous')}, 수신함에 없음 ${count('missing')}. 검증된 것만 status verified·출처 메모·서열 길이·지문을 더하고, asserted 값은 ${opt.sync ? 'sync 요청에 따라 동기화' : '바꾸지 않음'}`,
    senses, limitations: [...limUpd.values()] };
  return { patch, rows, tasks, empty: !senses.length && !limUpd.size };
}

// ===== ④ CHANGES.md 한 행 =====
function changesRow(rec, rep, rows, date, drafted) {
  const lim = (rep.impact.limitation_status_changed || []).filter((l) => l.after !== l.before);
  const scope = `\`data/db.json\`·\`${rec}\` — ${Object.entries(rep.scope.added || {}).map(([k, v]) => `추가 ${k} ${v.join(' ')}`).concat(Object.entries(rep.scope.updated || {}).map(([k, v]) => `수정 ${k} ${v.join(' ')}`)).join(' · ') || '—'} (바뀐 필드 ${Object.entries(rep.scope.fields || {}).map(([id, f]) => `${id}{${f.join(',')}}`).join(' ') || '—'})`;
  const verify = `관문 ${rep.verification.gate} · 오류 ${rep.verification.errors} · 경고 ${rep.verification.warnings} · 미등록 한계 후보 ${rep.verification.undetected_gaps} · 정제 점검 새 문제 0`;
  if (drafted) return `| ${date} · 데이터 패치 (augment apply) | ${scope} | ${rep.why} | 한계 상태 ${lim.map((l) => `${l.id} ${l.before}→${l.after}`).join(', ') || '변화 없음'} · 하류 규칙 ${(rep.impact.rules || []).length}·단계 ${(rep.impact.steps || []).length}·경로 ${(rep.impact.pathways || []).join(' ') || '—'} | ${verify} |\n`;
  const v = rows.filter((r) => r.outcome === 'verified');
  return `| ${date} · 자동 보강 (Auto-Augmentation) | ${scope} | ${rep.why} | 외부 ID verified ${v.length}건 (${v.map((r) => `${r.sense} ${r.id}`).join(', ') || '—'}) · 한계 상태 ${lim.map((l) => `${l.id} ${l.before}→${l.after}`).join(', ') || '변화 없음'} · 거부 ${rows.filter((r) => r.outcome === 'rejected').length}·모호 ${rows.filter((r) => r.outcome === 'ambiguous').length}·없음 ${rows.filter((r) => r.outcome === 'missing').length} | ${verify} |\n`;
}

module.exports = { INBOX, URLS, plan, fetchTasks, retrievalTasksMarkdown, readTask, parseUniProt, parseChEBI, parseChEBISearch, parseUniProtSearch, parseFormula, formulaCheck, pickCandidate, build, changesRow };
