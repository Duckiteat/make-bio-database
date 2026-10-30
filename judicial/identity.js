// 사법부 — 외부 ID 신원 확인 (Identity Verification). docs/design/tripartite-governance.md §2·§3
//
// 자동 보강 고리의 판결 쪽: ① 과제 찾기(대조 안 된 주장) ② 수신함 원본 해석(JSON·FASTA·평문만, 실행하지 않음) ③ 확인 —
//   단백질: 번호 일치 · 종(taxon) = 기준 종 · 유전자/단백질 이름이 개념 이름·별칭과 일치 · 다른 정의항과 중복 없음
//   저분자: 이름 일치(검색이면 정확히 하나) · 화학식의 C·N·P·S 원자 수 = 선언된 부분 구조의 원자 수 · 중복 없음
// 통과한 행에 사실·증거(파일 sha256)를 붙여 낸다. 'verified' 는 judicial/attestation.js 가 이 행으로 발급하는 증명으로만 성립한다.
// 이 파일은 받기(네트워크)·쓰기를 하지 않는다 — 받기와 수신함 저장은 입법 서기(legislative/clerk.mjs)가 한다.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const M = require('../model.js');
const V = M.VOCAB;

const INBOX = 'data/fetched';
const URLS = {
  uniprot_entry: (acc) => [`https://rest.uniprot.org/uniprotkb/${acc}.json`, `https://rest.uniprot.org/uniprotkb/${acc}.fasta`, `https://rest.uniprot.org/uniprotkb/${acc}.txt`],
  uniprot_search: (gene, taxon) => [`https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(`gene_exact:${gene} AND organism_id:${taxon} AND reviewed:true`)}&fields=accession,gene_names,protein_name,organism_id,length&format=json&size=5`],
  chebi_entity: (id) => [`https://www.ebi.ac.uk/chebi/backend/api/public/compound/${id}/`, `https://www.ebi.ac.uk/ols4/api/ontologies/chebi/terms?obo_id=${id}`],
  chebi_search: (q) => [`https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(q)}&ontology=chebi&exact=true&rows=5`, `https://www.ebi.ac.uk/chebi/backend/api/public/es_search/?term=${encodeURIComponent(q)}&size=5`],
  // pH 7.3 우세 종 주장의 근거: 큐레이션된 반응 DB(Rhea)가 그 번호를 반응식의 참여자로 쓰는 횟수
  rhea_usage: (id) => [`https://www.rhea-db.org/rhea?query=${encodeURIComponent(id)}&columns=rhea-id,equation,chebi-id&format=tsv&limit=50`],
};
const RHEA_MIN = 3; // 이보다 적게 쓰이면 '반응 참여자' 주장을 받아들이지 않는다
const fileOf = (kind, key) => ({ uniprot_entry: `uniprot/${key}`, uniprot_search: `uniprot-search/${key}`, chebi_entity: `chebi/${key.replace(':', '_')}`, chebi_search: `chebi-search/${key}`, rhea_usage: `rhea/${key.replace(':', '_')}` })[kind];

// ===== ① 과제 =====
function namesOf(db, id) { const d = db.senses[id], t = d && db.terms[d.term]; return t ? [t.names.ko, t.names.en, ...t.aliases].filter(Boolean) : []; }
// opt.only = { sense, kind, key } 면 그 주체의 과제 하나만 낸다 (도장 재검증처럼 한 주장만 다시 볼 때 — 다른 정의항의 수신함을 훑지 않는다).
// opt.ix 는 이미 만든 색인 — 정규화·색인을 되풀이하지 않기 위해 받는다. 중복 검사는 색인(전체 db)으로 하므로 좁혀도 약해지지 않는다.
function plan(db, opt) {
  opt = opt || {};
  db = opt.ix ? db : M.normalize(db);
  const ix = opt.ix || M.index(db), tasks = [], dir = opt.dir || INBOX;
  const gapOf = (id) => Object.entries(db.limitations).filter(([, l]) => l.type === 'Identity_Gap' && (l.target === id || l.requirement.needs.some((n) => n.on === id))).map(([lid]) => lid);
  const seqGap = (id) => Object.entries(db.limitations).filter(([, l]) => l.requirement.needs.some((n) => n.kind === 'obs' && n.property === 'sequence_length' && n.on === id)).map(([lid]) => lid);
  const add = (t) => { if (opt.only && !(t.sense === opt.only.sense && t.kind === opt.only.kind && t.key === opt.only.key)) return; t.file = path.join(dir, fileOf(t.kind, t.key)); t.present = present(t.file); tasks.push(t); };
  for (const [id, d] of Object.entries(db.senses)) {
    const K = V.kinds[d.kind];
    if (!K || (opt.only && id !== opt.only.sense)) continue;
    const up = d.xrefs.find((x) => x.db === 'UniProt'), chAll = d.xrefs.filter((x) => x.db === 'ChEBI');
    const ch = chAll.find((x) => x.role === 'physiological') || chAll.find((x) => !x.role) || chAll[0];
    // 도구가 계산한 서열 지문도 사법부 도장을 받는다 — 도장 재확인이 같은 확인을 다시 돌리므로 원본 파일이 수신함에 남아 있어야 한다 (evidence: true)
    if (up && up.status === 'verified' && d.fingerprint && d.fingerprint.scheme === 'SEQ_SHA256') add({ kind: 'uniprot_entry', key: up.id, sense: id, label: ix.label(id), evidence: true, why: `${up.id} 원본 — 서열 지문 재확인 증거`, gaps: [], urls: URLS.uniprot_entry(up.id) });
    if (up && up.status !== 'verified') add({ kind: 'uniprot_entry', key: up.id, sense: id, label: ix.label(id), why: `UniProt ${up.id} 대조 (asserted → verified)${seqGap(id).length ? ` · 서열 길이(${seqGap(id).join(', ')})` : ''}`, gaps: [...gapOf(id), ...seqGap(id)], urls: URLS.uniprot_entry(up.id) });
    for (const x of chAll) {
      if (x.status !== 'verified') add({ kind: 'chebi_entity', key: x.id, sense: id, label: ix.label(id), role: x.role, why: `ChEBI ${x.id} 대조 (asserted → verified, 화학식 ↔ 부분 구조${x.role ? ` · 역할 ${x.role}` : ''})`, gaps: gapOf(id), urls: URLS.chebi_entity(x.id) });
      // pH 7.3 우세 종이라는 주장은 큐레이션된 반응 DB 의 쓰임으로 뒷받침한다 (RHEA_MIN 개 이상의 반응).
      //   이미 verified 인 번호에도 과제를 내는 이유: 도장 재확인이 같은 확인을 다시 돌리므로 증거 파일이 수신함에 남아 있어야 한다 (evidence: true — 보강 후보로 세지 않음)
      if (x.role === 'physiological') add({ kind: 'rhea_usage', key: x.id, sense: id, label: ix.label(id), role: x.role, evidence: x.status === 'verified' || undefined, why: `${x.id} 가 반응 참여자로 쓰이는지 (Rhea ≥ ${RHEA_MIN})${x.status === 'verified' ? ' — 재확인 증거' : ''}`, gaps: gapOf(id), urls: URLS.rhea_usage(x.id) });
    }
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
function present(base) { for (const ext of ['.json', '.fasta', '.txt', '.tsv']) if (fs.existsSync(base + ext)) return base + ext; return null; }

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
    const data = t.kind === 'uniprot_entry' ? parseUniProt(text, file) : t.kind === 'chebi_entity' ? parseChEBI(text) : t.kind === 'chebi_search' ? parseChEBISearch(text) : t.kind === 'rhea_usage' ? parseRhea(text, t.key) : parseUniProtSearch(text);
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
  // conjugate acid/base 관계 (모체 ↔ 이온 종을 잇는 ChEBI 자체의 관계) 와 분류 여부(화학식 없음)
  out.conjugates = [];
  const rel = j && j.ontology_relations;
  if (rel && typeof rel === 'object') for (const side of ['outgoing_relations', 'incoming_relations']) for (const r of rel[side] || []) {
    if (!/conjugate/i.test(String(r.relation_type || ''))) continue;
    for (const n of [r.final_id, r.init_id]) if (Number.isFinite(Number(n))) out.conjugates.push(`CHEBI:${n}`);
  }
  out.conjugates = [...new Set(out.conjugates)].filter((x) => x !== out.id);
  out.isClass = !out.formula;
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
// 이름 정규화 (서식만 벗긴다 — 물질을 바꾸지 않는다): HTML 꾸밈, 이온화 꼬리표 '(3−)'·'(1+)', 유니코드 빼기·곱셈 기호
//   ChEBI 의 이온 종 이름은 모체 이름 + 이온화 꼬리표다('citrate(3−)'). 꼬리표는 역할(role)이 이미 적고 있으므로 이름 대조에서는 뺀다.
const stripNameDeco = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\(\s*\d*\s*[-−+±]\s*\)\s*$/, '').replace(/[−–]/g, '-').trim();
const nn = (s) => M.normName(stripNameDeco(s));
function nameHit(db, id, cands) { const mine = new Set(namesOf(db, id).map(nn)); return cands.filter(Boolean).find((c) => mine.has(nn(c))) || null; }
// 검색 후보 고르기: 이름(정규화)이 개념 이름·별칭과 같은 후보가 정확히 하나일 때만
// Rhea 표(TSV: 반응 번호 · 반응식 · 참여 ChEBI 번호) → 그 번호가 참여자로 쓰인 반응 수. 해석만 한다 (받기는 입법 서기).
function parseRhea(text, id) {
  const lines = String(text).trim().split('\n');
  if (!lines.length || !/reaction identifier/i.test(lines[0])) throw new Error('Rhea TSV 머리글이 아님');
  const want = String(id).toUpperCase(), rx = new RegExp(`(^|;)${want.replace(':', ':')}(;|$)`);
  const hits = [];
  for (const L of lines.slice(1)) { const f = L.split('\t'); if (f.length >= 3 && rx.test(f[2].toUpperCase())) hits.push({ rhea: f[0], equation: f[1] }); }
  return { id: want, reactions: hits.length, examples: hits.slice(0, 3).map((h) => `${h.rhea} ${h.equation}`) };
}
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

// ===== ③ 확인 (판결) =====
// 수신함 원본마다 판결 행을 낸다: verified · rejected · ambiguous · candidate · missing · unreadable.
// verified 행에는 확인한 사실(facts)과 증거(evidence: 파일·sha256)가 붙는다 — 이것으로 사법부가 증명(attestation)을 발급하고,
// 입법부(legislative/augment_draft.js)가 패치 초안을 쓴다. 여기서는 데이터를 바꾸지도, 패치를 만들지도 않는다.
function verifyIdentity(db, opt) {
  opt = Object.assign({ dir: INBOX, sync: false }, opt || {});
  db = opt.ix ? db : M.normalize(db);
  const ix = opt.ix || M.index(db), tasks = plan(db, { dir: opt.dir, ix, only: opt.only }), rows = [];
  const holder = (db_, id) => [...ix.xrefs.get(`${db_}:${id}`) || []];
  const row = (t, outcome, detail, extra) => rows.push(Object.assign({ sense: t.sense, label: t.label, kind: t.kind, key: t.key, role: t.role, gaps: t.gaps, outcome, detail }, extra || {}));
  for (const t of tasks) {
    const got = readTask(t);
    if (!got) { row(t, 'missing', `수신함에 없음 — ${t.file}.json`); continue; }
    if (!got.ok) { row(t, 'unreadable', got.error, { file: got.file }); continue; }
    const evidence = { file: path.relative(process.cwd(), got.file) || got.file, sha256: got.sha };
    const src = `${evidence.file} · sha256:${got.sha.slice(0, 12)}`;
    if (t.kind === 'uniprot_entry') {
      const u = got.data, d = db.senses[t.sense], fails = [], rules = [], fail = (rule, m) => { fails.push(m); rules.push(rule); }; // rules[i] = fails[i] 의 규칙 번호
      if (u.accession !== t.key && !(u.secondary || []).includes(t.key)) fail('RULE-0511', `번호 ${u.accession} ≠ ${t.key}`);
      if (u.taxon !== (d.reference_species || V.defaultReferenceSpecies)) fail('RULE-0511', `종 ${u.taxon} ≠ 기준 종 ${d.reference_species}`);
      const hit = nameHit(db, t.sense, [...u.genes, ...u.names, u.entryName && u.entryName.split('_')[0]]);
      if (!hit) fail('RULE-0511', `이름 불일치 — 원본 ${[...u.genes, ...u.names].slice(0, 4).join(' / ')} · 개념 ${namesOf(db, t.sense).join(' / ')}`);
      const others = holder('UniProt', u.accession).filter((x) => x !== t.sense);
      if (others.length) fail('RULE-0511', `${u.accession} 는 이미 ${others.join(', ')} 에 있음`);
      if (u.accession !== t.key && !opt.sync) fail('RULE-0066', `asserted 번호 ${t.key} 를 ${u.accession} 로 바꾸려면 sync`);
      if (fails.length) { row(t, 'rejected', fails.join(' · '), { file: got.file, rules }); continue; }
      const seqHash = u.sequence && u.length && u.sequence.length === u.length ? crypto.createHash('sha256').update(u.sequence.toUpperCase()).digest('hex') : null;
      row(t, 'verified', `검증 (이름 '${hit}', 종 ${u.taxon})`, { file: got.file, id: u.accession, evidence, src,
        facts: { db: 'UniProt', id: u.accession, from: t.key, format: u.format, reviewed: u.reviewed, entryVersion: u.entryVersion, sequenceVersion: u.sequenceVersion, taxon: u.taxon, name: hit, length: u.sequence ? u.length : null, seqHash } });
    } else if (t.kind === 'chebi_entity') {
      const c = got.data, fails = [], rules = [], fail = (rule, m) => { fails.push(m); rules.push(rule); };
      if (c.id !== t.key) fail('RULE-0511', `번호 ${c.id} ≠ ${t.key}`);
      const hit = nameHit(db, t.sense, [c.name, ...c.synonyms]);
      if (!hit) fail('RULE-0511', `이름 불일치 — 원본 '${c.name}' · 개념 ${namesOf(db, t.sense).join(' / ')}`);
      const fc = formulaCheck(db, t.sense, c.formula);
      if (fc.status === 'mismatch') fail('RULE-0389', `화학식 ↔ 부분 구조: ${fc.note}`);
      const others = holder('ChEBI', c.id).filter((x) => x !== t.sense);
      if (others.length) fail('RULE-0511', `${c.id} 는 이미 ${others.join(', ')} 에 있음`);
      const s0 = db.senses[t.sense], existing = s0.xrefs.find((y) => y.db === 'ChEBI' && (t.role ? y.role === t.role : true) && y.id === c.id) ? null : s0.xrefs.find((y) => y.db === 'ChEBI' && (t.role ? y.role === t.role : !y.role));
      if (existing && existing.id !== c.id && !opt.sync) fail('RULE-0066', `asserted ${existing.id} 를 ${c.id} 로 바꾸려면 sync`);
      // 역할 규약 (ChEBI 실험): physiological 은 분류 항목일 수 없고, 모체와 함께 있으면 conjugate 관계로 이어져 있어야 한다
      if (t.role === 'physiological' && c.isClass) fail('RULE-0063', `${c.id} 는 분류 항목(화학식 없음) — pH 7.3 우세 종이 될 수 없음`);
      let rhea = null;
      if (t.role === 'physiological') {
        const ru = readTask({ kind: 'rhea_usage', key: c.id, file: path.join(opt.dir || INBOX, fileOf('rhea_usage', c.id)) });
        if (!ru || !ru.ok) fail('RULE-0064', `반응 참여 자료(${fileOf('rhea_usage', c.id)}.tsv)가 수신함에 없음 — pH 7.3 우세 종 주장을 확인할 수 없음`);
        else if (ru.data.reactions < RHEA_MIN) fail('RULE-0064', `반응 참여 ${ru.data.reactions}회 < ${RHEA_MIN} — 반응 참여자로 쓰이는 종이 아님`);
        else rhea = { reactions: ru.data.reactions, examples: ru.data.examples, file: path.relative(process.cwd(), ru.file) || ru.file, sha256: ru.sha };
      }
      if (t.role === 'parent' && Number(c.charge) !== 0) fail('RULE-0063', `${c.id} 는 전하 ${c.charge} — 중성 모체가 아님`);
      // 짝 역할과의 관계: 켤레 산·염기는 **수소와 전하만** 달라야 한다 (ATP C10H16… 0 ↔ ATP(4−) C10H12… −4).
      //   ChEBI 의 conjugate 관계는 한 단계씩만 이어져 있어(ATP ↔ ATP(3−) ↔ ATP(4−)) 직접 연결을 요구할 수 없다 — 화학식으로 검사한다.
      //   짝 항목 파일이 수신함에 있어야 한다 (받기는 입법 서기, 여기서는 읽기만).
      let conj = null;
      if (t.role && t.role !== 'class') {
        const other = s0.xrefs.find((y) => y.db === 'ChEBI' && y.role && y.role !== t.role && y.role !== 'class');
        if (other) {
          const sib = readTask({ kind: 'chebi_entity', file: path.join(opt.dir || INBOX, fileOf('chebi_entity', other.id)) });
          if (!sib || !sib.ok) { row(t, 'ambiguous', `짝 역할 ${other.id}(${other.role})의 항목 파일이 수신함에 없어 켤레 관계를 확인할 수 없음`, { file: got.file }); continue; }
          const a = parseFormula(c.formula), b = parseFormula(sib.data.formula);
          if (!a || !b) { row(t, 'ambiguous', `화학식을 원자 수로 풀 수 없어 켤레 관계를 확인할 수 없음 (${c.formula} / ${sib.data.formula})`, { file: got.file }); continue; }
          const heavy = (o) => Object.fromEntries(Object.entries(o).filter(([e]) => e !== 'H'));
          const same = JSON.stringify(heavy(a)) === JSON.stringify(heavy(b));
          const dH = (a.H || 0) - (b.H || 0), dQ = Number(c.charge) - Number(sib.data.charge);
          if (!same) { row(t, 'rejected', `${c.id} 와 ${other.id}(${other.role}) 는 수소 말고도 원자 수가 다름 — 켤레 산·염기가 아님 (${c.formula} / ${sib.data.formula})`, { file: got.file }); continue; }
          // 양성자 하나가 떨어지면 H 하나와 전하 −1 이 같이 줄어든다 → dH = dQ (탈양성자 −1·−1, 양성자화 +1·+1)
          if (dH !== dQ) { row(t, 'rejected', `수소 차이 ${dH} 와 전하 차이 ${dQ} 가 맞지 않음 — 양성자 하나당 전하 하나여야 함`, { file: got.file }); continue; }
          conj = { with: other.id, role: other.role, dH, dCharge: dQ, direct: c.conjugates.includes(other.id) };
        }
      }
      if (fails.length) { row(t, 'rejected', fails.join(' · '), { file: got.file, formula: fc, rules }); continue; }
      const ikOK = c.inchikey && V.fingerprints.InChIKey.kinds.includes(s0.kind);
      const dupIK = ikOK ? Object.entries(db.senses).find(([oid, o]) => oid !== t.sense && o.fingerprint && o.fingerprint.value === c.inchikey) : null;
      row(t, 'verified', `검증 (이름 '${hit}', ${fc.status === 'ok' ? '부분 구조 원자 수 일치' : fc.note}${t.role ? ` · 역할 ${t.role}` : ''}${rhea ? ` · Rhea 반응 참여 ${rhea.reactions}회` : ''}${conj ? ` · 켤레 ${conj.with} 와 수소 ${conj.dH >= 0 ? '+' : ''}${conj.dH}·전하 ${conj.dCharge >= 0 ? '+' : ''}${conj.dCharge}` : ''})`, { file: got.file, id: c.id, formula: fc, evidence, src,
        facts: { db: 'ChEBI', id: c.id, role: t.role, conjugate: conj, rhea, from: existing ? existing.id : null, name: hit, formula: c.formula, charge: c.charge, formulaCheck: fc, inchikey: ikOK && !dupIK ? c.inchikey : null, inchikeyDuplicateOf: dupIK ? dupIK[0] : null } });
    } else if (t.kind === 'rhea_usage') {
      // 그 자체로는 신원 주장이 아니다 (도장 없음) — physiological 역할의 전제 조건으로 chebi_entity 판정이 이 파일을 읽는다
      const r = got.data;
      row(t, 'candidate', `반응 참여 ${r.reactions}회 (Rhea pH 7.3 큐레이션)${r.reactions < RHEA_MIN ? ` < ${RHEA_MIN} — 우세 종 주장을 뒷받침하지 못함` : ''}`, { file: got.file, id: r.id, reactions: r.reactions });
    } else if (t.kind === 'chebi_search') {
      const pick = pickCandidate(db, t.sense, got.data);
      if (!pick.id) { row(t, 'ambiguous', `${pick.reason}${pick.candidates.length ? ` — 후보 ${pick.candidates.slice(0, 5).map((c) => `${c.id}(${c.name || '?'})`).join(', ')}` : ''}`, { file: got.file, reason: pick.reason, candidates: pick.candidates.slice(0, 5) }); continue; }
      const entity = tasks.find((x) => x.kind === 'chebi_entity' && x.sense === t.sense && x.key === pick.id);
      row(t, 'candidate', `이름이 맞는 후보 ${pick.id} (${pick.name}) — ${entity && entity.present ? '항목 파일로 확인' : `항목 조회 과제 생성 (${fileOf('chebi_entity', pick.id)}.json)`}`, { file: got.file, id: pick.id });
    } else if (t.kind === 'uniprot_search') {
      const d = db.senses[t.sense], c = got.data.candidates.filter((r) => r.taxon === (d.reference_species || V.defaultReferenceSpecies) && nameHit(db, t.sense, r.genes));
      row(t, c.length === 1 ? 'candidate' : 'ambiguous', c.length === 1 ? `후보 ${c[0].accession} — 항목 조회 후 확인하려면 xrefs 에 asserted 로 넣고 다시 build` : `종·유전자 이름이 맞는 후보 ${c.length}개`, { file: got.file });
    }
  }
  return { rows, tasks };
}

module.exports = { INBOX, URLS, fileOf, plan, present, retrievalTasksMarkdown, readTask, parseUniProt, parseChEBI, parseChEBISearch, parseUniProtSearch, parseFormula, formulaCheck, pickCandidate, nameHit, namesOf, verifyIdentity };
