// 컴파일러 — 수식 테이프 (Expression Tape). docs/design/engine-port-roadmap.md 0.5단계
//
// IR 의 속도식·기호 도함수는 평평한 숫자 배열(스택 기계 명령)로 저장된다 — JSON 으로 직렬화되고, Rust/WASM 엔진이
// 같은 명령표를 해석한다. 이 파일은 명령표와 참조 해석기다(순수, 할당 없음 — 스택은 미리 잡은 버퍼).
//
// 명령 (인자 수):
//   CONST v (1)   · CONC i (1) 농도 c_i = min(buf_i, max(0,N_i)·cinv_i), cinv_i = 1/(N_A·V_i) 는 컴파일러가 접은 상수 (V_i = 0 이면 0 → 농도 0)
//   DCONC i (1)   ∂c_i/∂N_i = cinv_i  (N_i > 0 이고 완충 상한 아래일 때, 아니면 0 — 꺾인 곳은 현재 가지의 한쪽 도함수)
//   CNT i (1)     max(0, N_i) · DCNT i (1) N_i > 0 ? 1 : 0
//   FAC (0)       이 규칙의 고정 조절 배율 f (뉴턴 한 단계 안에서 상수)
//   MUL (0) · ADD (0)   스택 위 둘
//   POW n (1) a^n · DPOW n (1) n·a^(n−1)
//   SAT K (1) a/(a+K) · DSAT K (1) K/(a+K)²
//   HILL e K n fmax fmin (5)       힐 배율 (e = 1 활성화, 0 억제) — model.hillFactor 와 같은 식
//   DHILL e K n fmax fmin smin (6) 힐 배율의 s 도함수 (n < 1 이면 s < smin 에서 smin 으로 기울기를 자름)
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DefDBTape = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const OP = { CONST: 0, CONC: 1, DCONC: 2, CNT: 3, DCNT: 4, FAC: 5, MUL: 6, ADD: 7, POW: 8, DPOW: 9, SAT: 10, DSAT: 11, HILL: 12, DHILL: 13 };
  const ARITY = [1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 5, 6];
  const NAMES = Object.keys(OP);

  // 힐 점유율과 그 도함수 (s ≥ 0)
  const occOf = (s, K, n) => { const x = s > 0 ? Math.pow(s / K, n) : 0; return x / (1 + x); };
  const docc = (s, K, n, smin) => {
    if (n < 1 && s < smin) s = smin;
    if (s <= 0) return n > 1 ? 0 : n === 1 ? 1 / K : 0;
    const x = Math.pow(s / K, n); return n * x / (s * (1 + x) * (1 + x));
  };

  // ctx: { cinv: Float64Array(nB) (IR species[i].cinv), buf: Float64Array(nB) (완충 상한 M, 없으면 Infinity), stack: Float64Array }
  function evalTape(t, N, f, ctx) {
    const st = ctx.stack; let sp = 0;
    for (let p = 0; p < t.length;) {
      const op = t[p++];
      switch (op) {
        case 0: st[sp++] = t[p++]; break;
        case 1: { const i = t[p++], q = ctx.cinv[i]; let c = q > 0 ? Math.max(0, N[i]) * q : 0; if (c > ctx.buf[i]) c = ctx.buf[i]; st[sp++] = c; break; }
        case 2: { const i = t[p++], q = ctx.cinv[i]; st[sp++] = q > 0 && N[i] > 0 && Math.max(0, N[i]) * q < ctx.buf[i] ? q : 0; break; }
        case 3: st[sp++] = Math.max(0, N[t[p++]]); break;
        case 4: st[sp++] = N[t[p++]] > 0 ? 1 : 0; break;
        case 5: st[sp++] = f; break;
        case 6: sp--; st[sp - 1] *= st[sp]; break;
        case 7: sp--; st[sp - 1] += st[sp]; break;
        case 8: st[sp - 1] = Math.pow(st[sp - 1], t[p++]); break;
        case 9: { const n = t[p++], a = st[sp - 1]; st[sp - 1] = n === 1 ? 1 : n * Math.pow(a, n - 1); break; }
        case 10: { const K = t[p++], a = st[sp - 1]; st[sp - 1] = a / (a + K); break; }
        case 11: { const K = t[p++], a = st[sp - 1]; st[sp - 1] = K / ((a + K) * (a + K)); break; }
        case 12: { const e = t[p], K = t[p + 1], n = t[p + 2], fmax = t[p + 3], fmin = t[p + 4]; p += 5; const o = occOf(st[sp - 1], K, n); st[sp - 1] = e ? 1 + (fmax - 1) * o : fmin + (1 - fmin) * (1 - o); break; }
        case 13: { const e = t[p], K = t[p + 1], n = t[p + 2], fmax = t[p + 3], fmin = t[p + 4], smin = t[p + 5]; p += 6; const d = docc(st[sp - 1], K, n, smin); st[sp - 1] = e ? (fmax - 1) * d : -(1 - fmin) * d; break; }
        default: throw new Error(`알 수 없는 테이프 명령 ${op} @ ${p - 1}`);
      }
    }
    return sp ? st[sp - 1] : 0;
  }
  // 사람이 읽는 표기 (보고서·디버그)
  function disasm(t) { const out = []; for (let p = 0; p < t.length;) { const op = t[p++], a = t.slice(p, p + ARITY[op]); p += ARITY[op]; out.push(a.length ? `${NAMES[op]} ${a.join(' ')}` : NAMES[op]); } return out.join(' ; '); }

  return Object.freeze({ OP, ARITY, NAMES, evalTape, disasm });
});
