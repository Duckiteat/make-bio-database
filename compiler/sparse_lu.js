// 컴파일러 — 희소 LU 기호 분석 (Symbolic Sparse LU). docs/design/engine-port-roadmap.md 3단계
//
// 결합 Rodas3 의 선형 단 행렬 M = I/(γh) − J (진행량 좌표, nA × nA) 의 0 아닌 자리는 IR 이 정하므로, 순서·채움(fill)을 한 번 계산해 IR 에 넣는다.
//   · 순서: 대칭화한 패턴(A + Aᵀ)의 최소 차수(minimum degree) — 같은 차수면 작은 번호. 결정론적.
//   · 채움: 그 순서에서 행 단위 가우스 소거(피벗 교환 없음)가 만드는 패턴. 행 r 의 열 k < r 마다 행 k 의 U 부분 열을 더한다.
//   · 엔진(JS·Rust)은 이 패턴의 값 배열만 다룬다: 조립(J 항의 위치 목록) → 분해(행마다 밀집 작업 벡터로 흩뿌리고 모음) → 전진·후진 대입.
//   · 피벗 교환이 없으므로 대각이 작으면(결합점 pivot_rel) 엔진은 특이로 보고 단계를 거부한다 — h 가 줄면 대각 1/(γh) 이 커져 다시 안정해진다.
// 순수 함수: 쓰기·판정·엔진 호출 없음.
'use strict';

// rows[k] = 행 k 의 0 아닌 열 목록 (원래 번호). 대각은 언제나 포함한다.
function symbolic(n, rows) {
  // 최소 차수 순서 (대칭화 그래프, 대각 제외)
  const adj = Array.from({ length: n }, () => new Set());
  rows.forEach((cols, k) => { for (const c of cols) if (c !== k) { adj[k].add(c); adj[c].add(k); } });
  const alive = new Uint8Array(n).fill(1), perm = [];
  for (let step = 0; step < n; step++) {
    let best = -1;
    for (let v = 0; v < n; v++) if (alive[v] && (best < 0 || adj[v].size < adj[best].size)) best = v;
    perm.push(best); alive[best] = 0;
    const nb = [...adj[best]];
    for (const a of nb) { adj[a].delete(best); for (const b of nb) if (a !== b) adj[a].add(b); }
    adj[best].clear();
  }
  const iperm = new Array(n); perm.forEach((old, r) => { iperm[old] = r; });
  // 채움: 순서를 바꾼 행 단위 소거
  const pat = Array.from({ length: n }, (_, r) => { const s = new Set([r]); for (const c of rows[perm[r]]) s.add(iperm[c]); return s; });
  const fill = new Array(n);
  let flops = 0;
  for (let r = 0; r < n; r++) {
    const P = pat[r];
    for (let k = 0; k < r; k++) {
      if (!P.has(k)) continue;
      flops += 1; // 배수 l = a_rk / u_kk
      for (const j of fill[k]) if (j > k) { P.add(j); flops += 2; } // a_rj −= l·u_kj
    }
    fill[r] = [...P].sort((a, b) => a - b);
  }
  const rowPtr = [0]; const col = [];
  for (let r = 0; r < n; r++) { col.push(...fill[r]); rowPtr.push(col.length); }
  const diagPos = fill.map((cols, r) => rowPtr[r] + cols.indexOf(r));
  const posOf = (k, c) => { const r = iperm[k], cc = iperm[c], cols = fill[r], q = cols.indexOf(cc); return q < 0 ? -1 : rowPtr[r] + q; }; // 원래 (행 k, 열 c) → 값 위치
  // 대입 연산 수 (전진 + 후진) 와 밀집 비교
  const solveFlops = 2 * col.length - n;
  return { n, perm, iperm, rowPtr, col, diagPos, nnz: col.length, nnzA: rows.reduce((t, c) => t + c.length, 0), flops, solveFlops, denseFlops: Math.round((2 * n ** 3) / 3), posOf };
}

module.exports = { symbolic };
