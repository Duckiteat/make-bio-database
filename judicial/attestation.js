// 사법부 — 증명 등록부 (Attestation Registry). docs/design/tripartite-governance.md §3
//
// 'verified' 는 데이터의 자기 선언이 아니라 사법부가 붙이는 외부 도장이다.
//   발급(issue)  : 신원 판결(judicial/identity.js)의 verified 행마다 도장 — 주체(정의항·필드·값) · 주장 · 증거(수신함 파일 sha256) ·
//                  발급 모듈과 그 코드 sha256 · 발급일 · digest(나머지 전부의 정준 JSON sha256).
//   검증(verify) : digest 재계산(위조·변조 탐지) + 재확인(reverify): 증거 파일이 같은 sha256 으로 있고, 같은 확인을 다시 돌려도
//                  verified 가 나오는지. 이 둘을 통과한 도장만 validate(db, { attestations }) 에 넘긴다.
//   validate 는 status 'verified' 인 외부 ID·지문마다 맞는 도장을 요구한다 — 없으면 오류 (엔진·데이터는 스스로 verified 를 만들 수 없음).
//   같은 등록부에 추세 도장(claim 'trend', judicial/trend.js — 시간 축)도 함께 산다. 이 파일은 그것을 검증하지 않고 넘긴다 (validStamps().trend).
// 이 파일은 도장을 계산·검증만 한다. 등록부 파일(attestations/registry.json)에 쓰는 것은 입법 서기(legislative/clerk.mjs)뿐이다.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const M = require('../model.js');
const ID = require('./identity.js');

const FORMAT = 'definition-db-attestations', REGISTRY = 'attestations/registry.json', ISSUER = 'judicial/identity.js';
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));
const codeSha = () => sha(fs.readFileSync(path.join(__dirname, 'identity.js')));
// 주체 열쇠: 정의항|필드|종류:값 — validate 가 데이터의 verified 항목과 맞추는 열쇠
const subjectKey = (s) => `${s.sense}|${s.field}|${s.ns}:${s.value}`;
const digestOf = (st) => { const { digest, ...rest } = st; return sha(canon(rest)); };

function emptyRegistry() { return { format: FORMAT, version: 1, stamps: [] }; }
function readRegistry(root) { const f = path.join(root || process.cwd(), REGISTRY); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : emptyRegistry(); }

// 신원 판결의 verified 행 → 도장들
function issue(rows, date) {
  const code = codeSha(), out = [];
  for (const r of rows.filter((x) => x.outcome === 'verified' && x.evidence && x.facts)) {
    const base = { claim: 'verified', evidence: { kind: r.kind, key: r.key, file: r.evidence.file, sha256: r.evidence.sha256 }, checks: r.detail, issuer: { module: ISSUER, code_sha256: code }, issued_at: date };
    const subs = [{ sense: r.sense, field: 'xref', ns: r.facts.db, value: r.facts.id }];
    if (r.facts.inchikey) subs.push({ sense: r.sense, field: 'fingerprint', ns: 'InChIKey', value: r.facts.inchikey });
    // 도구가 원본 서열에서 계산한 지문도 도장을 받는다 — 그래야 신뢰 지표(judicial/reliability.js)가 그 출처를 S4 로 셀 수 있다
    if (r.facts.seqHash) subs.push({ sense: r.sense, field: 'fingerprint', ns: 'SEQ_SHA256', value: r.facts.seqHash });
    for (const subject of subs) { const st = { subject, ...base }; st.digest = digestOf(st); out.push(st); }
  }
  return out;
}

// 한 도장 검증: digest · (reverify 면) 증거 파일 sha256 · 같은 확인을 다시 돌린 결과
function verifyStamp(st, db, opt) {
  opt = Object.assign({ reverify: true, root: process.cwd() }, opt || {});
  const reasons = [];
  if (!st || !st.subject || st.claim !== 'verified') return { ok: false, reasons: ['형식이 아님'] };
  if (digestOf(st) !== st.digest) reasons.push('digest 불일치 — 도장이 발급 뒤 바뀜(변조)');
  if (opt.reverify && !reasons.length) {
    const file = path.resolve(opt.root, st.evidence.file);
    if (!fs.existsSync(file)) reasons.push(`증거 파일 없음 (${st.evidence.file})`);
    else if (sha(fs.readFileSync(file, 'utf8')) !== st.evidence.sha256) reasons.push('증거 파일 sha256 불일치');
    else {
      // 같은 확인을 다시: 그 외부 ID 를 잠시 asserted 로 되돌린 사본에서 신원 판결을 돌려 verified 가 나오는지.
      //   사본은 **그 정의항 하나만** 새로 만들고 나머지는 참조로 둔다 (전체 복제·재정규화를 도장마다 되풀이하지 않기 위해).
      //   중복 검사는 전체 db 의 색인으로 하므로 좁혀도 약해지지 않는다 — 색인은 외부 ID → 정의항이고 status 에 매이지 않는다.
      const base = opt.base || M.normalize(db), ix = opt.ix || M.index(base), sid = st.subject.sense;
      const s0 = base.senses[sid];
      if (!s0) return { ok: false, stale: true, reasons: ['주체가 데이터에 없음 — 지난 도장 (그 값이 데이터에서 빠졌음, 위조가 아님)'], key: subjectKey(st.subject) };
      const sense = { ...s0, xrefs: s0.xrefs.map((y) => ({ ...y })) };
      const d = { ...base, senses: { ...base.senses, [sid]: sense } };
      // 주체의 외부 ID: xref 면 그 값, 지문이면 그 지문을 낸 증거 항목(evidence.key)의 외부 ID — 한 정의항에 같은 db 항목이 여럿일 수 있다(역할)
      const ns = st.subject.field === 'xref' ? st.subject.ns : (st.subject.ns === 'SEQ_SHA256' ? 'UniProt' : 'ChEBI');
      const x = sense && (sense.xrefs.find((y) => y.db === ns && (st.subject.field === 'xref' ? y.id === st.subject.value : y.id === st.evidence.key)) || (st.subject.field !== 'xref' ? sense.xrefs.find((y) => y.db === ns) : null));
      if (!x) return { ok: false, stale: true, reasons: ['주체가 데이터에 없음 — 지난 도장 (그 값이 데이터에서 빠졌음, 위조가 아님)'], key: subjectKey(st.subject) };
      else {
        x.status = 'asserted';
        if (sense.fingerprint && st.subject.field === 'fingerprint') sense.fingerprint = undefined;
        const rel = ID.fileOf(st.evidence.kind, st.evidence.key), dir = file.replace(/\.(json|fasta|txt|tsv)$/, '').slice(0, -rel.length - 1);
        const v = ID.verifyIdentity(d, { dir, ix, only: { sense: sid, kind: st.evidence.kind, key: st.evidence.key } });
        const row = v.rows.find((r) => r.sense === st.subject.sense && r.kind === st.evidence.kind && r.key === st.evidence.key);
        if (!row || row.outcome !== 'verified') reasons.push(`재확인 실패 (${row ? row.outcome + ': ' + row.detail : '과제 없음'})`);
        else if (st.subject.field === 'xref' && row.facts.id !== st.subject.value) reasons.push(`재확인 값 ${row.facts.id} ≠ ${st.subject.value}`);
        else if (st.subject.field === 'fingerprint' && (st.subject.ns === 'SEQ_SHA256' ? row.facts.seqHash : row.facts.inchikey) !== st.subject.value) reasons.push(`재확인 ${st.subject.ns} 불일치`);
      }
    }
  }
  return { ok: !reasons.length, reasons, key: subjectKey(st.subject) };
}

// 등록부 전체 → validate 에 넘길 유효 도장 열쇠 집합 + 실패 목록
function validStamps(db, registry, opt) {
  // 정규화·색인은 한 번만 — 도장마다 다시 만들면 도장 수에 비례해 느려진다 (판정은 같다)
  const base = M.normalize(db), ix = M.index(base);
  opt = { ...(opt || {}), base, ix };
  const ok = [], bad = [], stale = [], trend = [];
  for (const st of (registry || emptyRegistry()).stamps) {
    // 추세 도장(claim 'trend')은 다른 주장이다 — 검증은 judicial/trend.js 가 한다 (여기서 부르면 순환 의존). 그 쪽으로 넘긴다.
    if (st.claim === 'trend') { trend.push(st); continue; }
    const v = verifyStamp(st, base, opt);
    if (v.ok) ok.push(v.key);
    // 지난 도장: 주체(그 외부 ID)가 데이터에서 빠진 것 — 기록은 남기고(계보) 무효로 세지 않는다. 변조·재확인 실패와 구분한다.
    else if (v.stale) stale.push({ key: st.subject ? subjectKey(st.subject) : '?', reasons: v.reasons });
    else bad.push({ key: st.subject ? subjectKey(st.subject) : '?', reasons: v.reasons });
  }
  return { keys: ok, failed: bad, stale, trend };
}

// 관문 판결 봉인: 서기가 쓸 db 가 사법부가 통과시킨 바로 그 db 임을 보증 (판결을 다른 db 에 재사용 불가)
function sealVerdict(gate, db, extra) {
  const s = { ok: !!gate.ok, errors: gate.errors.length, warnings: gate.warnings.length, db_sha256: sha(JSON.stringify(db, null, 2) + '\n'), issuer: 'judicial/judicial.js#gate', ...(extra || {}) };
  s.digest = sha(canon(s));
  return s;
}
const checkSeal = (s) => !!s && s.digest === (() => { const { digest, ...rest } = s; return sha(canon(rest)); })();

module.exports = { FORMAT, REGISTRY, emptyRegistry, readRegistry, issue, verifyStamp, validStamps, subjectKey, digestOf, sealVerdict, checkSeal, canon };
