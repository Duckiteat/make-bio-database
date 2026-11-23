// 사법부 — 감독 장부의 승인 증거 판정 (PLAN-102 · 설계 docs/design/supervisor.md §4.3 · DEC-0064 가 · DEC-0068 · DEC-0069)
// 계약: 순수 — 값만 받고 값만 돌려준다 (git 읽기 · 파일 · 실행 없음). 사실은 감독 도구(supervise.mjs 의 evidence)가 모아 넘긴다.
//
// 승인은 장부에 적는 사건이 아니라 사실에서 계산한다:
//   ① 승인 대상 = 마지막으로 넘긴 실행(baseline 이 아닌)의 커밋에서 바뀐 파일들의 바이트 (git blob — 지움은 null)
//   ② 그 바이트가 main 의 어떤 커밋에 "모두 그대로" 처음 나타남 — 머지 · 스쿼시 · 리베이스 어느 방식이든 (커밋 모양에 기대지 않음, HEAD 가 아니라 처음)
//   ③ 그 병합을 사람이 했다는 보장 — 지금 가능한 것은 Claude Code 설정의 PR 병합 도구 막음(DEC-0069 가). 그 커밋 시점 설정에 막음이 없으면
//      "병합 확인 · 사람 보장 없음" 이다 (DEC-0068: AI 의 병합도 merged_by 가 사람 계정으로 남는다)
//   ④ 영수증에 AI 세션의 PR 병합 호출이 있으면 사람 승인으로 치지 않는다
// 결과는 상태 하나와 이유 목록. 이 판정은 쓰지 않고, 장부를 고치지 않는다.
export const MERGE_TOOL = 'mcp__github__merge_pull_request';
export const STATUS = {
  empty: '승인 대상 없음 — 넘긴 커밋에서 바뀐 파일이 없음',
  not_merged: '병합 전 — main 에 이 바이트가 아직 없음',
  merged_unguarded: '병합 확인 · 사람 보장 없음 — 그 시점 설정에 AI 의 PR 병합 막음이 없음 (PLAN-113 전)',
  merged_ai: '병합 확인 · AI 병합 흔적 — 영수증에 PR 병합 호출이 있음, 사람 승인으로 치지 않음',
  approved: '승인 — 사람이 병합 (Claude Code 설정이 AI 의 병합을 막은 뒤, 영수증에 AI 병합 호출 없음) · 다른 실행 환경까지의 보장은 CI 겹(PLAN-114) · 서명(나중)',
};

// target  : { [path]: blob | null }  승인 대상 (null = 지운 파일)
// commits : [{ sha, time, blobs: { [path]: blob | null }, denyMerge: boolean }]  main 의 커밋, 오래된 것부터 (분기점 뒤) · time = 커밋 시각(ISO)
// aiMerges: [{ at, receipt }]  영수증의 PR 병합 호출 (분기점 뒤) — 그 커밋 시각 앞 WINDOW 초 안의 호출만 그 병합으로 본다
export const WINDOW = { before: 600, after: 60 };
export function judge({ target, commits, aiMerges = [] }) {
  const paths = Object.keys(target || {}).sort();
  if (!paths.length) return { status: 'empty', text: STATUS.empty, commit: null, reasons: [] };
  const hit = (commits || []).find((c) => paths.every((p) => (c.blobs[p] ?? null) === target[p]));
  if (!hit) {
    // 가장 가까운 커밋 — 몇 개가 맞고 무엇이 다른지 (사람이 보게)
    let best = null;
    for (const c of commits || []) { const same = paths.filter((p) => (c.blobs[p] ?? null) === target[p]).length; if (!best || same > best.same) best = { sha: c.sha, same }; }
    const reasons = best ? [`가장 가까운 main 커밋 ${best.sha.slice(0, 7)} — ${best.same}/${paths.length} 파일이 같음`] : ['분기점 뒤 main 커밋 없음'];
    return { status: 'not_merged', text: STATUS.not_merged, commit: null, reasons };
  }
  const reasons = [`${paths.length} 파일의 바이트가 main 커밋 ${hit.sha.slice(0, 7)} 에 처음 모두 나타남`];
  const t = Date.parse(hit.time || ''), near = aiMerges.filter((m) => { const a = Date.parse(m.at); return Number.isFinite(t) && Number.isFinite(a) && a >= t - WINDOW.before * 1000 && a <= t + WINDOW.after * 1000; });
  if (near.length) return { status: 'merged_ai', text: STATUS.merged_ai, commit: hit.sha, reasons: [...reasons, ...near.map((m) => `영수증 ${m.receipt} · ${m.at} — ${MERGE_TOOL} (병합 커밋 시각 ${hit.time} 근처)`)] };
  if (!hit.denyMerge) return { status: 'merged_unguarded', text: STATUS.merged_unguarded, commit: hit.sha, reasons: [...reasons, `커밋 ${hit.sha.slice(0, 7)} 의 .claude/settings.json deny 에 ${MERGE_TOOL} 없음`] };
  return { status: 'approved', text: STATUS.approved, commit: hit.sha, reasons };
}

// 감독 장부의 상위 작업(접은 것) + 승인 판정 + baseline 사실 → 계산된 상태
//   sup: 감독 도구 fold 의 상위 작업 하나 · verdict: judge() · baselineOnApproved: baseline 실행이 승인 커밋 위(또는 뒤)에서 시작했나 (실행 번호 → boolean)
export function derive(sup, verdict, baselineOnApproved = {}) {
  if (['blocked', 'cancelled', 'planned'].includes(sup.state) || sup.active) return { state: sup.state, why: null };
  const pre = sup.steps.filter((m) => m !== 'baseline');
  const done = (m) => sup.runs.some((r) => r.mode === m && r.result === 'handed_off');
  if (!pre.every(done)) return { state: sup.state, why: `다음 실행을 기다림 — 아직 넘기지 않은 단계 ${pre.filter((m) => !done(m)).join(' · ')}` };
  if (!verdict || verdict.status === 'empty') return { state: sup.state, why: verdict ? verdict.text : '승인 판정 전' };
  if (verdict.status === 'not_merged') return { state: 'awaiting_approval', why: verdict.text };
  if (verdict.status !== 'approved') return { state: 'awaiting_approval', why: verdict.text };
  if (!sup.steps.includes('baseline')) return { state: 'completed', why: '승인 — baseline 단계 없음' };
  const ok = sup.runs.find((r) => r.mode === 'baseline' && r.result === 'handed_off' && baselineOnApproved[r.run]);
  return ok ? { state: 'completed', why: `승인 + baseline ${ok.run} 이 승인 커밋 위에서 끝남` } : { state: 'applying', why: '승인 — baseline 확인 대기 (승인 커밋 위에서 시작한 baseline 실행)' };
}

// ── 검수 독립성 (PLAN-116 G3 · DEC-0077 · 제안서 §7.2 다섯 요소) — 사실은 감독 도구가 모아 넘긴다(장부 · 모드 표 · 영수증 · git) ──
//   facts = { author: { modes:[…], sessions:[…], zones:[glob…], stamps:[…]|null }, inspect: { mode, session, zone:[glob…], stamps:[…]|null },
//             receipt: null | { touches: n(원문 자리를 가리킨 도구 호출 수), pmids:[…](그 호출의 글에 나온 문헌 번호) }, cited:[PMID…](작성 패치가 단 출처) }
//   요소마다 { ok: true | false | null(셀 수 없음), why, estimated? } — 정보 접근 · 판단 근거는 영수증의 명령 글에서 추정(estimated: true): 실제로 읽었는지는 사람이 본다.
//   수준: 다섯 다 true → full · 하나라도 false → limited · false 없이 null 이 있음 → unknown
export const SHARED_ZONE = ['docs/reports/**'];
export const CONTENT_SPLIT = { 'attestations/**': 'stamps' }; // 그 자리의 내용을 모드마다 나누는 정책 칸 (모드표 gate.modes[m].stamps — DEC-0078) // 보고서 자리는 모든 검토가 쓴다 — 권한 겹침으로 치지 않음
export function independence(f) {
  const a = f.author || {}, i = f.inspect || {}, out = {};
  out.role = { ok: i.mode === 'inspect' && !(a.modes || []).includes('inspect'), why: `작성 ${(a.modes || []).join('·') || '없음'} · 검수 ${i.mode || '없음'}` };
  // 겹친 자리 중 내용 정책으로 갈리는 것(CONTENT_SPLIT — 도장 등록부는 도장 종류, DEC-0078): 두 쪽이 모두 정책을 선언했고(null 아님) 종류가 겹치지 않을 때만 갈린 것으로.
  //   정책이 없거나 겹치면 그대로 겹침 — 계산 기준을 완화하지 않는다. 정책의 강제는 ci-zone · 문지기가 한다(여기서는 선언만 본다).
  const raw = (i.zone || []).filter((z) => (a.zones || []).includes(z) && !SHARED_ZONE.includes(z));
  const split = raw.filter((z) => { const c = CONTENT_SPLIT[z]; if (!c) return false; const x = a[c], y = i[c]; return Array.isArray(x) && Array.isArray(y) && y.length > 0 && !x.some((k) => y.includes(k)); });
  const overlap = raw.filter((z) => !split.includes(z));
  out.authority = { ok: overlap.length === 0, why: overlap.length ? `검수 모드가 작성 모드와 같은 자리에 쓸 수 있음: ${overlap.join(' · ')}${raw.some((z) => CONTENT_SPLIT[z]) && !split.length ? ' (내용 정책 — 모드표 stamps — 이 없거나 겹침)' : ''}` : `검수 모드의 쓰기 자리가 작성 모드와 겹치지 않음 (보고서 자리 빼고${split.length ? ` · ${split.join(' · ')} 는 도장 종류로 갈림: 작성 ${a.stamps.join('·') || '없음'} / 검수 ${i.stamps.join('·')}` : ''})` };
  out.execution = { ok: !!i.session && !(a.sessions || []).includes(i.session), why: `검수 세션 ${i.session || '?'} · 작성 세션 ${(a.sessions || []).join('·') || '?'}` };
  if (!f.receipt) {
    out.info_access = { ok: null, estimated: true, why: '검수 세션의 영수증이 없음 — 무엇을 읽었는지 셀 수 없음' };
    out.basis = { ok: null, estimated: true, why: '영수증 없음' };
  } else {
    out.info_access = { ok: f.receipt.touches > 0, estimated: true, why: f.receipt.touches > 0 ? `원문 자리(data/fetched · 원천 응답)를 가리킨 도구 호출 ${f.receipt.touches}` : '원문 자리를 가리킨 도구 호출 없음 — 작성자의 글만 읽었을 수 있음' };
    const cited = [...new Set(f.cited || [])], seen = new Set(f.receipt.pmids || []), hit = cited.filter((p) => seen.has(p));
    out.basis = !cited.length ? { ok: null, estimated: true, why: '작성 패치에 문헌 출처가 없음 — 판단 근거를 셀 수 없음' }
      : { ok: hit.length === cited.length, estimated: true, why: `작성 패치의 출처 ${cited.length} 중 검수 영수증이 원문을 가리킨 것 ${hit.length}${hit.length < cited.length ? ` (빠짐 ${cited.filter((p) => !seen.has(p)).join('·')})` : ''}` };
  }
  const vals = Object.values(out).map((x) => x.ok);
  return { level: vals.every((v) => v === true) ? 'full' : vals.includes(false) ? 'limited' : 'unknown', factors: out };
}

// ── 최종 권고 (PLAN-116 G4 · DEC-0077) — 규칙으로 계산한다(AI 의 문장이 아님). 승인이 아니다: 병합 = 사람 ──
//   sup: 접은 상위 작업 · verdict: judge() 또는 null · kindOf: 원인 태그 → 'deny' | 'hold' · indep: independence() 또는 null
export function recommend({ sup, verdict, kindOf, indep }) {
  const r = (code, text, reasons = []) => ({ code, text, reasons });
  if (sup.state === 'cancelled') return r('cancelled', '취소됨');
  if (sup.state === 'blocked' && sup.blocked) {
    const k = kindOf(sup.blocked.cause);
    return k === 'deny' ? r('deny', `병합하지 않음 (거부) — ${sup.blocked.cause}: 필수 검증 실패 · 결함`, [sup.blocked.why]) : r('hold', `보류 — ${sup.blocked.cause}: 사람 판단 필요`, [sup.blocked.why]);
  }
  if (sup.active) return r('running', `진행 중 — ${sup.active}`);
  const failed = sup.runs.filter((x) => x.verify && x.verify.finish && x.verify.finish !== 'pass');
  if (failed.length) return r('deny', '병합하지 않음 (거부) — 끝내기 시험이 통과하지 않은 실행', failed.map((x) => x.run));
  if (sup.steps.includes('inspect') && !sup.runs.some((x) => x.mode === 'inspect' && x.result === 'handed_off')) return r('hold', '보류 — 독립 검수 전');
  // 검수 뒤에 작성이 더 넘기면 승인 대상(마지막으로 넘긴 커밋)에 검수하지 않은 바이트가 든다 (DEC-0079 ① · RULE-0543)
  if (sup.steps.includes('inspect')) {
    const lastI = sup.runs.map((x) => x.mode === 'inspect' && x.result === 'handed_off').lastIndexOf(true);
    const after = sup.runs.slice(lastI + 1).filter((x) => !['inspect', 'baseline'].includes(x.mode) && x.result === 'handed_off');
    if (after.length) return { ...r('hold', '보류 — 검수 뒤에 작성이 더 넘김: 승인 대상에 검수하지 않은 변경이 든다 (다시 검수)', after.map((x) => `${x.run} ${x.mode}`)), rule: 'RULE-0543' };
  }
  if (indep && indep.level === 'limited') return { ...r('hold', '보류 — 독립성 제한적', Object.entries(indep.factors).filter(([, v]) => v.ok === false).map(([k, v]) => `${k}: ${v.why}`)), rule: 'RULE-0543' };
  // 다섯 요소가 모두 서지 않으면(셀 수 없음 포함) 독립 검증으로 치지 않는다 — 제안서 §7.2 (DEC-0079 ②)
  if (sup.steps.includes('inspect') && (!indep || indep.level !== 'full')) return { ...r('hold', '보류 — 독립성을 다 셀 수 없음 (검수 영수증 · 인용 출처가 없어 정보 접근 · 판단 근거를 모름) — 사람이 확인', indep ? Object.entries(indep.factors).filter(([, v]) => v.ok === null).map(([k, v]) => `${k}: ${v.why}`) : ['독립성 계산 없음']), rule: 'RULE-0543' };
  if (!verdict) return r('hold', '보류 — 승인 대상을 계산하지 못함');
  if (verdict.status === 'approved') return r('approved', '이미 승인됨 — 사람이 병합');
  if (verdict.status === 'merged_ai' || verdict.status === 'merged_unguarded') return r('hold', `확인 필요 — ${verdict.text}`);
  if (verdict.status === 'empty') return r('hold', '보류 — 승인 대상 파일 없음');
  return r('mergeable', '병합해도 됨 — 사용자 결정', ['병합 = 사람 승인 (DEC-0069) · 승인 대상 바이트가 바뀌면 이 권고는 무효']);
}
