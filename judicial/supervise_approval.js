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
