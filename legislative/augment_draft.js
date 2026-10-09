// 입법부 — 자동 보강 패치 초안 (Augmentation Drafting). docs/design/tripartite-governance.md §1
//
// 사법부의 신원 판결(judicial/identity.js verifyIdentity)을 받아 패치 초안과 CHANGES.md 한 행의 내용을 만든다.
// 스스로 확인하지 않고(판결에 verified 로 적힌 행만 반영), 파일을 쓰지 않는다 — 저장은 입법 서기(legislative/clerk.mjs)만.
'use strict';
const M = require('../model.js');

// ===== 패치 초안 (입법) =====
// 사법부 판결 행(judicial/identity.js verifyIdentity)을 받아 패치를 쓴다. 스스로 확인하지 않는다 — verified 행만 반영한다.
// 패치의 status 'verified' 는 사법부 증명(attestations/) 이 함께 있어야 관문을 통과한다 (데이터는 스스로 verified 를 선언할 수 없음).
// 안전 규칙: 이미 적힌 asserted 값을 다른 값으로 덮어쓰지 않는다 (sync 를 명시했을 때만).
function draftPatch(db, verdict, opt) {
  db = M.normalize(db); opt = Object.assign({ sync: false, date: new Date().toISOString().slice(0, 10) }, opt || {});
  const rows = verdict.rows.map((r) => Object.assign({}, r)), upd = new Map(), limUpd = new Map();
  const S = (id) => { if (!upd.has(id)) { const d = db.senses[id]; upd.set(id, { id, _xrefs: d.xrefs.map((x) => ({ ...x })), _obs: d.obs.map((o) => JSON.parse(JSON.stringify(o))), _fp: d.fingerprint, _unmapped: d.unmapped, _changed: new Set() }); } return upd.get(id); };
  for (const r of rows) {
    if (r.outcome === 'ambiguous' && r.kind === 'chebi_search') {
      for (const lid of r.gaps) { const l = JSON.parse(JSON.stringify(db.limitations[lid])); l.note = `자동 보강 ${opt.date}: ${r.reason}. 검색 후보 ${(r.candidates || []).map((c) => `${c.id}${c.name ? ' ' + c.name : ''}${c.formula ? ' ' + c.formula : ''}`).join('; ') || '없음'} — 이름이 정확히 하나로 맞을 때만 고른다`; limUpd.set(lid, { id: lid, ...l }); }
      continue;
    }
    if (r.outcome !== 'verified') continue;
    const f = r.facts, s = S(r.sense), notes = [r.detail];
    if (f.db === 'UniProt') {
      const x = s._xrefs.find((y) => y.db === 'UniProt' && y.id === f.from);
      x.id = f.id; x.status = 'verified'; x.note = `UniProtKB ${f.format} 조회 ${opt.date} (${f.reviewed ? 'Swiss-Prot' : 'TrEMBL'}${f.entryVersion ? `, 항목 v${f.entryVersion}` : ''}${f.sequenceVersion ? `, 서열 v${f.sequenceVersion}` : ''}) · 이름 일치 '${f.name}' · ${r.src}`;
      s._changed.add('xrefs');
      if (f.length) {
        const tool = `dbtool augment — UniProtKB ${f.id}${f.sequenceVersion ? ` 서열 v${f.sequenceVersion}` : ''} (${r.src})`;
        const old = s._obs.find((o) => o.property === 'sequence_length' && o.context.species === f.taxon);
        if (!old) { s._obs.push({ property: 'sequence_length', value: f.length, unit: 'aa', context: { species: f.taxon }, evidence: { level: 'computed', tool } }); s._changed.add('obs'); notes.push(`서열 길이 ${f.length} aa`); }
        else if (old.value !== f.length) { if (opt.sync) { old.value = f.length; old.evidence = { level: 'computed', tool }; s._changed.add('obs'); notes.push(`서열 길이 ${old.value} 로 동기화`); } else notes.push(`서열 길이 충돌 (있음 ${old.value}, 원본 ${f.length}) — 그대로 둠`); }
        if (f.seqHash) {
          if (!s._fp) { s._fp = { scheme: 'SEQ_SHA256', value: f.seqHash, status: 'computed' }; s._changed.add('fingerprint'); notes.push('서열 지문 SEQ_SHA256 (도구 계산)'); }
          else if (s._fp.scheme === 'SEQ_SHA256' && s._fp.value !== f.seqHash) notes.push(`서열 지문 충돌 — 그대로 둠${opt.sync ? ' (sync 는 지문을 바꾸지 않음)' : ''}`);
        }
      }
    } else if (f.db === 'ChEBI') {
      let x = s._xrefs.find((y) => y.db === 'ChEBI');
      if (!x) { x = { db: 'ChEBI', id: f.id }; s._xrefs.push(x); }
      const fc = f.formulaCheck;
      x.id = f.id; x.status = 'verified'; x.note = `ChEBI 조회 ${opt.date} · 이름 일치 '${f.name}' · 화학식 ${f.formula || '없음'}${f.charge != null ? ` (전하 ${f.charge})` : ''} · 부분 구조 대조 ${fc.status}${fc.status === 'ok' ? ` (${fc.note})` : ''} · ${r.src}`;
      s._changed.add('xrefs');
      if (s._unmapped) { s._unmapped = undefined; s._changed.add('unmapped'); }
      if (f.inchikeyDuplicateOf) notes.push(`InChIKey 가 이미 ${f.inchikeyDuplicateOf} 에 — 넣지 않음`);
      else if (f.inchikey && !s._fp) { s._fp = { scheme: 'InChIKey', value: f.inchikey, status: 'verified' }; s._changed.add('fingerprint'); notes.push('InChIKey (ChEBI 원본)'); }
    }
    r.detail = notes.join(' · ');
  }
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
  const patch = { format: M.PATCH_FORMAT, version: M.VERSION,
    why: `자동 보강 고리 (${opt.date}): 원본(UniProt·ChEBI)에서 받은 ${rows.filter((r) => r.file).length}개 파일로 외부 ID 확인 — 검증 ${count('verified')}, 거부 ${count('rejected')}, 모호 ${count('ambiguous')}, 수신함에 없음 ${count('missing')}. 검증된 것만 status verified·출처 메모·서열 길이·지문을 더하고, asserted 값은 ${opt.sync ? 'sync 요청에 따라 동기화' : '바꾸지 않음'}`,
    senses, limitations: [...limUpd.values()] };
  return { patch, rows, tasks: verdict.tasks, empty: !senses.length && !limUpd.size };
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

module.exports = { draftPatch, changesRow };
