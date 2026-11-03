// 검색 계층 (PLAN-078) — 효소·종·파라미터로 후보 문헌과 큐레이션 속도 상수를 찾는 질의 만들기·응답 해석. 순수 함수만 (파일·네트워크 없음).
//   받기와 기록은 mcp/fetch.mjs 가 서기를 거쳐 한다. 여기서 나온 것은 전부 "후보"다 — 값·인용 근거가 아니다.
//   값은 fetch_abstract / fetch_fulltext 로 받은 원문에서 인용을 대조한 뒤에만 핸드오프에 오른다 (SOURCES.md 규칙 1).

export const PARAMS = {
  kcat: ['kcat', '"turnover number"', '"catalytic constant"'],
  km: ['Km', '"Michaelis constant"', '"Michaelis-Menten"'],
  vmax: ['Vmax', '"specific activity"'],
  halflife: ['"half-life"', '"half life"'],
};
export const SPECIES = { 9606: ['human', '"Homo sapiens"'] };

const SAFE = /^[A-Za-z0-9][A-Za-z0-9 ,.()'+\-/]{0,79}$/; // 따옴표·콜론·불린 연산자를 못 넣게 — 질의를 우리가 짠다

function term(label, v) {
  if (typeof v !== 'string' || !SAFE.test(v.trim())) throw new Error(`인자 '${label}' 형식이 아님: ${v}`);
  if (/\b(AND|OR|NOT)\b/.test(v)) throw new Error(`인자 '${label}' 에 질의 연산자를 넣을 수 없음`);
  return v.trim();
}

// Europe PMC 질의: (효소 이름 또는 EC) AND (파라미터 동의어) AND (종 동의어)
export function buildLiteratureQuery({ enzyme, ec, gene, param, taxon }) {
  const names = [];
  if (enzyme) names.push(`"${term('enzyme', enzyme)}"`);
  if (gene) names.push(`"${term('gene', gene)}"`);
  if (ec) {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ec)) throw new Error(`인자 'ec' 형식이 아님: ${ec}`);
    names.push(`"EC ${ec}"`, `"${ec}"`);
  }
  if (!names.length) throw new Error("enzyme · gene · ec 중 하나가 필요함");
  const p = PARAMS[param || 'km'];
  if (!p) throw new Error(`인자 'param' 은 ${Object.keys(PARAMS).join(' | ')}`);
  const sp = SPECIES[taxon == null ? 9606 : taxon];
  if (!sp) throw new Error(`종 ${taxon} 은 아직 지원하지 않음 (사람 9606 만) — 다른 종 값을 사람 칸에 쓰지 않는다`);
  return `(${names.join(' OR ')}) AND (${p.join(' OR ')}) AND (${sp.join(' OR ')})`;
}

const API = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
export const literatureUrl = (query, pageSize = 25) => `${API}/search?query=${encodeURIComponent(query)}&resultType=lite&pageSize=${Math.min(100, Math.max(1, pageSize | 0))}&format=json`;

const access = (r) => (r.isOpenAccess === 'Y' ? 'open' : r.inPMC === 'Y' ? 'free_read' : 'paywalled');
// 검색 응답 → 후보 목록. 접근 상태는 lite 응답의 필드 그대로 (없으면 unknown — 추정하지 않는다)
export function parseLiterature(json) {
  const list = (json && json.resultList && json.resultList.result) || [];
  return {
    hitCount: (json && json.hitCount) || 0,
    hits: list.filter((r) => r.source === 'MED' && /^\d+$/.test(r.pmid || '')).map((r) => ({
      pmid: r.pmid, pmcid: r.pmcid || null, doi: r.doi || null, title: r.title || '', year: r.pubYear || null,
      access: r.isOpenAccess == null && r.inPMC == null ? 'unknown' : access(r),
    })),
  };
}

// UniProt: 사람(9606) 검토됨(Swiss-Prot) 항목의 큐레이션 속도 상수. 필드 이름은 `kinetics` (cc_ 접두사 없음)
const UNI = 'https://rest.uniprot.org/uniprotkb/search';
export function uniprotKineticsUrl({ ec, accession, gene }) {
  let q;
  if (accession) { if (!/^[A-NR-Z][0-9][A-Z0-9]{3}[0-9]$|^[OPQ][0-9][A-Z0-9]{3}[0-9]$/.test(accession)) throw new Error(`인자 'accession' 형식이 아님: ${accession}`); q = `accession:${accession}`; }
  else if (ec) { if (!/^\d+\.\d+\.\d+\.\d+$/.test(ec)) throw new Error(`인자 'ec' 형식이 아님: ${ec}`); q = `ec:${ec}`; }
  else if (gene) { if (!/^[A-Za-z0-9-]{1,20}$/.test(gene)) throw new Error(`인자 'gene' 형식이 아님: ${gene}`); q = `gene_exact:${gene}`; }
  else throw new Error('ec · accession · gene 중 하나가 필요함');
  return `${UNI}?query=${encodeURIComponent(`reviewed:true AND organism_id:9606 AND ${q}`)}&fields=accession,gene_primary,ec,kinetics&format=json&size=50`;
}

const ev = (arr) => [...new Set((arr || []).filter((e) => e.source === 'PubMed' && /^\d+$/.test(e.id || '')).map((e) => e.id))];
// 응답 → 줄. 한 줄 = 상수 하나 + 그 근거 PMID. 줄은 후보다: 기질·조건은 원문(UniProt 의 enzyme/substrate 글)을 그대로 두고 환산하지 않는다
export function parseUniprotKinetics(json) {
  const rows = [];
  for (const e of (json && json.results) || []) {
    const gene = (((e.genes || [])[0] || {}).geneName || {}).value || null;
    for (const c of e.comments || []) {
      const k = c.kineticParameters;
      if (c.commentType !== 'BIOPHYSICOCHEMICAL PROPERTIES' || !k) continue;
      const base = { accession: e.primaryAccession, gene, taxon: 9606 };
      for (const m of k.michaelisConstants || []) rows.push({ ...base, kind: 'km', value: m.constant, unit: m.unit, substrate: m.substrate || null, pmids: ev(m.evidences) });
      for (const m of k.maximumVelocities || []) rows.push({ ...base, kind: 'vmax', value: m.velocity, unit: m.unit, condition: m.enzyme || null, pmids: ev(m.evidences) });
      // kcat 은 구조화 칸이 없고 note 문장에만 있다 — 문장을 그대로 후보로 (숫자를 우리가 뽑지 않는다)
      for (const t of (k.note && k.note.texts) || []) if (/kcat|turnover/i.test(t.value || '')) rows.push({ ...base, kind: 'kcat_note', text: t.value, pmids: ev(t.evidences) });
    }
  }
  return rows;
}
