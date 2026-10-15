//! 운명 엔진 (행정부, Rust) — JS 기준 구현(engine/fate_engine.js)과 같은 알고리즘 (engine-port-roadmap 1.5단계):
//!   결합 적분: 두 층(대사·표지)과 조절 배율을 한 계로, 진행량 좌표 dξ/dt = rate(N₀ + S·ξ) 를 Rodas3(Rosenbrock 4 단, 3차, L-안정)
//!   + 내장 2차 오차 추정·단계 거부(오차 > 1 또는 음수 상태)로 푼다. 야코비안 J = (∂rate/∂N)·S, ∂rate_j/∂N_i = f_j·∂g_j/∂N_i + g_j·∂f_j/∂N_i (IR 테이프).
//!   원장: 상태 N(hi)+LO, 규칙별 누적 진행량(double-double). 받아들인 진행량만 원장에 적용한다.
//! 법칙은 모두 IR 테이프로 해석한다(tape.rs). 판정·파일 쓰기 없음. 모든 버퍼는 `Engine::new` 에서 한 번 잡는다(루프 안 할당 0).
//! 연산 순서(J 를 쌓는 순서·희소 LU·단 계산·오차 노름)는 JS 와 같게 둔다 — 엔진 사이 차이를 libm 마지막 ulp 로만 남기려고.
//! 선형 단: 컴파일러가 정한 희소 패턴(최소 차수 순서·채움)의 값 배열 LU (3단계) — 밀집 nA³ 대신 패턴만큼.
//! 4단계 ③ advance(사건 근 찾기의 다시 적분), ⑤ 혼성 확률 층(정확 SSA·τ-도약·Rodas3 — JS 기준 구현 integrateSto 와 같은 순서, 난수 rng.rs).
//!   확률이 꺼져 있으면 가림(disc)이 모두 0 이라 결정론 경로의 산술이 그대로다.

use crate::tape;
use crate::rng::Rng;

// Rodas3 (Sandu 외 1997, KPP 형식): γ, 새 함수 값 여부, A, C, M, E
const GAMMA: f64 = 0.5;
const NEW_F: [bool; 4] = [true, false, true, true];
const RA: [[f64; 3]; 4] = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [2.0, 0.0, 0.0], [2.0, 0.0, 1.0]];
const RC: [[f64; 3]; 4] = [[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, -1.0, 0.0], [1.0, -1.0, -8.0 / 3.0]];
const RM: [f64; 4] = [2.0, 0.0, 1.0, 1.0];
const RE: [f64; 4] = [0.0, 0.0, 0.0, 1.0];

struct Rule {
    cons: Vec<(usize, f64)>,
    prods: Vec<(usize, f64)>,
    rate: Vec<f64>,
    factor: Vec<f64>,
    drate: Vec<(usize, Vec<f64>)>,   // [(묶음, ∂rate/∂N 테이프 — FAC = f)]
    dfactor: Vec<(usize, Vec<f64>)>, // [(묶음, ∂f/∂N 테이프)]
}

struct Signal { idx: usize, ev: Vec<(f64, f64)> }

// 혼성 확률 층 결합점 (4단계 ⑤ — engine/coupling.js 의 sto_*·leap_eps·ssa_tol)
struct StoParams { ssa_max: f64, ode_min: f64, fast: f64, hyst: f64, leap_eps: f64, atol: f64, ssa_tol: f64 }

// 단계 제어 (결합점 등록부 값)
struct Ctl { rtol: f64, atol: f64, h0: f64, h_min: f64, safety: f64, fac_min: f64, fac_max: f64, neg_shrink: f64, pivot_rel: f64 }

// 희소 LU (3단계, compiler/sparse_lu.js 가 정한 순서·채움): 값 배열 위치 목록과 패턴
struct Sparse {
    diag_of: Vec<usize>,                 // 활성 규칙 k → 대각 값 위치
    rate: Vec<Vec<Vec<(usize, f64)>>>,   // k → dRate 항 d → [(위치, 화학량)]
    factor: Vec<Vec<Vec<(usize, f64)>>>, // k → dFactor 항 d → [(위치, 화학량)]
    perm: Vec<usize>, row_ptr: Vec<usize>, col: Vec<usize>, diag: Vec<usize>,
}

pub struct Engine {
    // 차원·설정
    pub nb: usize, pub nr: usize, pub na_: usize, pub nsig: usize, pub nres: usize,
    pub dt: f64, pub t_end: f64, pub horizon: f64, ctl: Ctl, record_every: usize,
    pub n_steps: usize, pub n_rec_max: usize,
    // 데이터 (IR)
    pub n0: Vec<f64>, cinv: Vec<f64>, buf: Vec<f64>, // cinv = 1/(N_A·V) — 컴파일러가 접은 상수 (IR 4)
    rules: Vec<Rule>, act: Vec<usize>,
    s_act: Vec<Vec<(usize, f64)>>, // 묶음 → [(활성 규칙 위치, 화학량)]
    sp: Sparse,
    signals: Vec<Signal>, res_idx: Vec<usize>,
    // 작업 버퍼
    n: Vec<f64>, pub lo: Vec<f64>, pub cum: Vec<f64>,
    f0: Vec<f64>, fy: Vec<f64>, kst: Vec<f64>, xs: Vec<f64>, xn: Vec<f64>, xe: Vec<f64>, bv: Vec<f64>,
    y: Vec<f64>, yn: Vec<f64>, vals: Vec<f64>, wrk: Vec<f64>, ys: Vec<f64>,
    stack: Vec<f64>, sig: Vec<f64>,
    res_start: Vec<f64>, res_min: Vec<f64>, res_ok: Vec<bool>, res_watch: Vec<bool>,
    // 구간 사이 단계 제어 상태
    h: f64, iv_steps: f64, iv_rej: f64, iv_hmin: f64, iv_hmax: f64,
    // 4단계 ⑤ 확률 층 (sto = false 면 모두 쓰이지 않음 — disc 는 0)
    sto: bool, stp: StoParams, rng: Rng,
    disc: Vec<u8>, mode: Vec<u8>, tq: Vec<f64>, pq: Vec<f64>, pub fired_ssa: Vec<f64>, pub fired_leap: Vec<f64>,
    col_of: Vec<usize>, spec: Vec<Vec<(usize, f64)>>, is_sig: Vec<bool>, mu: Vec<f64>, s2: Vec<f64>,
    save_n: Vec<f64>, save_lo: Vec<f64>, save_t: Vec<f64>, save_cum: Vec<f64>, kl: Vec<f64>, nc: Vec<f64>, n_leap: usize,
    /// switches, ssaFires, ssaBlocked, leapRejects, rootEvals, draws, 사건 버퍼 넘침
    pub sto_stats: [f64; 7],
    reach_def: Vec<Vec<(usize, bool, f64, f64)>>, pub reach_t: Vec<f64>, pub mode_out: Vec<f64>,
    // 출력 (본 실행)
    pub rec_t: Vec<f64>, pub rec_n: Vec<f64>, pub rec_lo: Vec<f64>, pub rec_cum: Vec<f64>, pub rec_sig: Vec<f64>, pub rec_meta: Vec<f64>,
    pub snap_t: Vec<f64>, pub snap_n: Vec<f64>,
    pub events: Vec<f64>, pub res_out: Vec<f64>,
    pub n_rec: usize, pub n_snap: usize, pub n_events: usize,
    // rhs, jac, steps, rejected, rejectedNeg, hMinHits, singular (모든 실행 누적)
    pub stats: [f64; 7],
    // 본 실행: steps, rejected, rejectedNeg, hMinHits, h min, h max, Δ 당 단계 min, max
    pub run_info: [f64; 8],
    pub probe_n: Vec<f64>,
    pub probe_in: Vec<f64>, // 2단계: 다른 인스턴스(워커·스레드)가 넘긴 탐침 시작 상태
    // 본 실행 끝 상태 (탐침이 작업 버퍼를 덮어쓰기 전에 고정)
    pub fin_n: Vec<f64>, pub fin_lo: Vec<f64>, pub fin_cum: Vec<f64>,
}

struct Cursor<'a> { d: &'a [f64], p: usize }
impl<'a> Cursor<'a> {
    fn f(&mut self) -> f64 { let x = self.d[self.p]; self.p += 1; x }
    fn u(&mut self) -> usize { self.f() as usize }
    fn vecf(&mut self, n: usize) -> Vec<f64> { let v = self.d[self.p..self.p + n].to_vec(); self.p += n; v }
    fn tapes(&mut self) -> Vec<(usize, Vec<f64>)> { let nd = self.u(); let mut d = Vec::with_capacity(nd); for _ in 0..nd { let i = self.u(); let l = self.u(); d.push((i, self.vecf(l))); } d }
}

#[inline(always)]
fn fmax(a: f64, b: f64) -> f64 { if a > b { a } else { b } } // JS Math.max 의 순서·NaN 이외 의미
#[inline(always)]
fn fmin(a: f64, b: f64) -> f64 { if a < b { a } else { b } }

impl Engine {
    /// IR 직렬 덩어리(engine/fate_rust.js pack)에서 엔진을 만든다. 모든 할당은 여기서 끝난다.
    pub fn new(blob: &[f64]) -> Result<Engine, &'static str> {
        let mut c = Cursor { d: blob, p: 0 };
        if c.f() != 5.0 { return Err("blob version"); }
        let (nb, nr, na_, nsig, nres) = (c.u(), c.u(), c.u(), c.u(), c.u());
        let (dt, t_end, horizon) = (c.f(), c.f(), c.f());
        let ctl = Ctl { rtol: c.f(), atol: c.f(), h0: c.f(), h_min: c.f(), safety: c.f(), fac_min: c.f(), fac_max: c.f(), neg_shrink: c.f(), pivot_rel: c.f() };
        let record_every = c.u().max(1);
        let n0 = c.vecf(nb); let cinv = c.vecf(nb); let buf = c.vecf(nb);
        let mut rules = Vec::with_capacity(nr);
        for _ in 0..nr {
            let (nc, np) = (c.u(), c.u());
            let mut cons = Vec::with_capacity(nc); for _ in 0..nc { let i = c.u(); let n = c.f(); cons.push((i, n)); }
            let mut prods = Vec::with_capacity(np); for _ in 0..np { let i = c.u(); let n = c.f(); prods.push((i, n)); }
            let lr = c.u(); let rate = c.vecf(lr); let lf = c.u(); let factor = c.vecf(lf);
            let drate = c.tapes(); let dfactor = c.tapes();
            rules.push(Rule { cons, prods, rate, factor, drate, dfactor });
        }
        if c.u() != na_ { return Err("active count"); }
        let act: Vec<usize> = (0..na_).map(|_| c.u()).collect();
        if act.iter().any(|&j| j >= nr) { return Err("active index"); }
        let mut s_act = Vec::with_capacity(nb);
        for _ in 0..nb { let cnt = c.u(); let mut s = Vec::with_capacity(cnt); for _ in 0..cnt { let k = c.u(); let co = c.f(); s.push((k, co)); } s_act.push(s); }
        let mut signals = Vec::with_capacity(nsig);
        for _ in 0..nsig { let idx = c.u(); let ne = c.u(); let mut ev = Vec::with_capacity(ne); for _ in 0..ne { let t = c.f(); let n = c.f(); ev.push((t, n)); } signals.push(Signal { idx, ev }); }
        let res_idx: Vec<usize> = (0..nres).map(|_| c.u()).collect();
        let mut sp = Sparse { diag_of: Vec::with_capacity(na_), rate: Vec::with_capacity(na_), factor: Vec::with_capacity(na_), perm: Vec::new(), row_ptr: Vec::new(), col: Vec::new(), diag: Vec::new() };
        for k in 0..na_ {
            sp.diag_of.push(c.u());
            let j = act[k];
            let list = |m: usize, c: &mut Cursor| -> Vec<Vec<(usize, f64)>> { (0..m).map(|_| { let l = c.u(); (0..l).map(|_| { let p = c.u(); let s = c.f(); (p, s) }).collect() }).collect() };
            let (nd, nf) = (rules[j].drate.len(), rules[j].dfactor.len());
            let r = list(nd, &mut c); sp.rate.push(r);
            let f = list(nf, &mut c); sp.factor.push(f);
        }
        let nnz = c.u();
        sp.perm = (0..na_).map(|_| c.u()).collect();
        sp.row_ptr = (0..na_ + 1).map(|_| c.u()).collect();
        sp.col = (0..nnz).map(|_| c.u()).collect();
        sp.diag = (0..na_).map(|_| c.u()).collect();
        if sp.row_ptr[na_] != nnz || sp.diag_of.iter().any(|&p| p >= nnz) { return Err("lu pattern"); }
        // 4단계 ⑤: 확률 블록 — 켬, seed, 궤적, 결합점 7, 상태별 도달 표지 [(묶음, high, 문턱 high, 문턱 low)]
        let sto = c.f() != 0.0;
        let (seed, traj) = (c.f(), c.f());
        let stp = StoParams { ssa_max: c.f(), ode_min: c.f(), fast: c.f(), hyst: c.f(), leap_eps: c.f(), atol: c.f(), ssa_tol: c.f() };
        let ns = c.u();
        let reach_def: Vec<Vec<(usize, bool, f64, f64)>> = (0..ns).map(|_| { let m = c.u(); (0..m).map(|_| { let i = c.u(); let hi = c.f() != 0.0; let th = c.f(); let tl = c.f(); (i, hi, th, tl) }).collect() }).collect();
        if c.p != blob.len() { return Err("blob length"); }
        let mut is_sig = vec![false; nb]; for s in &signals { is_sig[s.idx] = true; }
        // 규칙별 참여 분자(신호 제외)의 알짜 화학량 — JS SPEC 과 같은 순서(소비 다음 생성, 처음 나온 자리)
        let spec: Vec<Vec<(usize, f64)>> = act.iter().map(|&j| {
            let mut m: Vec<(usize, f64)> = Vec::new();
            for &(i, n) in &rules[j].cons { match m.iter_mut().find(|x| x.0 == i) { Some(x) => x.1 -= n, None => m.push((i, -n)) } }
            for &(i, n) in &rules[j].prods { match m.iter_mut().find(|x| x.0 == i) { Some(x) => x.1 += n, None => m.push((i, n)) } }
            m.into_iter().filter(|x| !is_sig[x.0]).collect()
        }).collect();
        let col_of: Vec<usize> = sp.col.iter().map(|&cc| sp.perm[cc]).collect();
        // 관찰 격자 수: JS 와 같은 누적 t 루프로 센다
        let mut n_steps = 0usize; { let mut t = 0.0; while t < t_end - 1e-9 { n_steps += 1; t += dt; } }
        let n_rec_max = (n_steps + record_every - 1) / record_every;
        let max_ev = if sto { n_steps * nres.max(1) * 8 + 64 } else { n_steps * nres.max(1) };
        let h0 = ctl.h0;
        Ok(Engine {
            nb, nr, na_, nsig, nres, dt, t_end, horizon, ctl, record_every, n_steps, n_rec_max,
            n0, cinv, buf, rules, act, s_act, sp, signals, res_idx,
            n: vec![0.0; nb], lo: vec![0.0; nb], cum: vec![0.0; 2 * nr],
            f0: vec![0.0; na_], fy: vec![0.0; na_], kst: vec![0.0; 4 * na_], xs: vec![0.0; na_], xn: vec![0.0; na_], xe: vec![0.0; na_], bv: vec![0.0; na_],
            y: vec![0.0; nb], yn: vec![0.0; nb], vals: vec![0.0; nnz], wrk: vec![0.0; na_], ys: vec![0.0; na_],
            stack: vec![0.0; 64], sig: vec![0.0; nsig],
            res_start: vec![0.0; nres], res_min: vec![0.0; nres], res_ok: vec![false; nres], res_watch: vec![false; nres],
            h: h0, iv_steps: 0.0, iv_rej: 0.0, iv_hmin: f64::INFINITY, iv_hmax: 0.0,
            rec_t: vec![0.0; n_rec_max], rec_n: vec![0.0; n_rec_max * nb], rec_lo: vec![0.0; n_rec_max * nb], rec_cum: vec![0.0; n_rec_max * 2 * nr],
            rec_sig: vec![0.0; n_rec_max * nsig], rec_meta: vec![0.0; n_rec_max * 2],
            snap_t: vec![0.0; n_steps], snap_n: vec![0.0; n_steps * nb],
            events: vec![0.0; 3 * max_ev], res_out: vec![0.0; 5 * nres],
            n_rec: 0, n_snap: 0, n_events: 0, stats: [0.0; 7], run_info: [0.0; 8], probe_n: vec![0.0; nb], probe_in: vec![0.0; nb], fin_n: vec![0.0; nb], fin_lo: vec![0.0; nb], fin_cum: vec![0.0; 2 * nr],
            sto, stp, rng: Rng::new(seed, traj),
            disc: vec![0; na_], mode: vec![0; na_], tq: vec![0.0; na_], pq: vec![0.0; na_], fired_ssa: vec![0.0; na_], fired_leap: vec![0.0; na_],
            col_of, spec, is_sig, mu: vec![0.0; nb], s2: vec![0.0; nb],
            save_n: vec![0.0; nb], save_lo: vec![0.0; nb], save_t: vec![0.0; na_], save_cum: vec![0.0; 2 * nr], kl: vec![0.0; na_], nc: vec![0.0; nb], n_leap: 0,
            sto_stats: [0.0; 7], reach_t: vec![f64::NAN; ns], reach_def, mode_out: vec![0.0; na_],
        })
    }

    #[inline]
    fn cum_add(&mut self, j: usize, x: f64) {
        let a = self.cum[2 * j]; let s1 = a + x; let bb = s1 - a;
        self.cum[2 * j] = s1; self.cum[2 * j + 1] += (a - (s1 - bb)) + (x - bb);
    }
    #[inline]
    fn add_prod_n(&mut self, i: usize, n: f64, x: f64) {
        let p = n * x; let c1 = 134217729.0 * n; let nh = c1 - (c1 - n); let nl = n - nh; let c2 = 134217729.0 * x; let xh = c2 - (c2 - x); let xl = x - xh;
        let e = ((nh * xh - p) + nh * xl + nl * xh) + nl * xl; let a = self.n[i]; let s1 = a + p; let bb = s1 - a;
        self.n[i] = s1; self.lo[i] += ((a - (s1 - bb)) + (p - bb)) + e;
    }
    fn apply_extent(&mut self, j: usize, x: f64) {
        self.cum_add(j, x);
        for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; self.add_prod_n(i, -n, x); }
        for q in 0..self.rules[j].prods.len() { let (i, n) = self.rules[j].prods[q]; self.add_prod_n(i, n, x); }
    }
    /// 속도 rate(N) → out (src: false = n, true = y)
    fn rhs(&mut self, use_y: bool, to_f0: bool) {
        self.stats[0] += 1.0;
        for k in 0..self.na_ {
            let j = self.act[k];
            let n: &[f64] = if use_y { &self.y } else { &self.n };
            let f = tape::eval(&self.rules[j].factor, n, 1.0, &self.cinv, &self.buf, &mut self.stack);
            let r = tape::eval(&self.rules[j].rate, n, f, &self.cinv, &self.buf, &mut self.stack);
            if to_f0 { self.f0[k] = r; } else { self.fy[k] = r; }
        }
    }
    /// M = I/(γh) − J(N) 를 희소 패턴의 값 배열에 조립하고 제자리 LU (피벗 교환 없음, IR 순서). 대각이 작으면(pivot_rel) false — JS 와 같은 순서.
    fn build_m(&mut self, h: f64) -> bool {
        self.stats[1] += 1.0;
        let na_ = self.na_;
        for x in self.vals.iter_mut() { *x = 0.0; }
        for k in 0..na_ {
            let j = self.act[k];
            let f = tape::eval(&self.rules[j].factor, &self.n, 1.0, &self.cinv, &self.buf, &mut self.stack);
            let g = tape::eval(&self.rules[j].rate, &self.n, 1.0, &self.cinv, &self.buf, &mut self.stack);
            for d in 0..self.rules[j].drate.len() {
                let val = tape::eval(&self.rules[j].drate[d].1, &self.n, f, &self.cinv, &self.buf, &mut self.stack);
                if val != 0.0 { for q in 0..self.sp.rate[k][d].len() { let (p, co) = self.sp.rate[k][d][q]; if self.disc[self.col_of[p]] == 0 { self.vals[p] -= val * co; } } }
            }
            for d in 0..self.rules[j].dfactor.len() {
                let val = tape::eval(&self.rules[j].dfactor[d].1, &self.n, 1.0, &self.cinv, &self.buf, &mut self.stack) * g;
                if val != 0.0 { for q in 0..self.sp.factor[k][d].len() { let (p, co) = self.sp.factor[k][d][q]; if self.disc[self.col_of[p]] == 0 { self.vals[p] -= val * co; } } }
            }
        }
        let d0 = 1.0 / (GAMMA * h);
        for k in 0..na_ { let p = self.sp.diag_of[k]; self.vals[p] += d0; }
        for r in 0..na_ {
            let (a, b) = (self.sp.row_ptr[r], self.sp.row_ptr[r + 1]);
            let mut rmax = 0.0;
            for p in a..b { let c = self.sp.col[p]; self.wrk[c] = self.vals[p]; rmax = fmax(rmax, self.vals[p].abs()); }
            for p in a..b {
                let k = self.sp.col[p]; if k >= r { break; }
                let l = self.wrk[k] / self.vals[self.sp.diag[k]]; self.wrk[k] = l;
                if l != 0.0 { for q in (self.sp.diag[k] + 1)..self.sp.row_ptr[k + 1] { let c = self.sp.col[q]; self.wrk[c] -= l * self.vals[q]; } }
            }
            for p in a..b { self.vals[p] = self.wrk[self.sp.col[p]]; }
            if !(self.vals[self.sp.diag[r]].abs() >= self.ctl.pivot_rel * rmax) { return false; }
        }
        true
    }
    fn lu_solve(&mut self) {
        let na_ = self.na_;
        for r in 0..na_ { self.ys[r] = self.bv[self.sp.perm[r]]; }
        for r in 0..na_ { let mut s = self.ys[r]; for p in self.sp.row_ptr[r]..self.sp.diag[r] { s -= self.vals[p] * self.ys[self.sp.col[p]]; } self.ys[r] = s; }
        for r in (0..na_).rev() { let mut s = self.ys[r]; for p in (self.sp.diag[r] + 1)..self.sp.row_ptr[r + 1] { s -= self.vals[p] * self.ys[self.sp.col[p]]; } self.ys[r] = s / self.vals[self.sp.diag[r]]; }
        for r in 0..na_ { self.bv[self.sp.perm[r]] = self.ys[r]; }
    }
    /// out = N + S·x (which: 0 = xs → y, 1 = xn → yn)
    fn plus_s(&mut self, which: u8) {
        for i in 0..self.nb {
            let mut v = self.n[i];
            for s in 0..self.s_act[i].len() { let (k, c) = self.s_act[i][s]; if self.disc[k] == 0 { v += c * if which == 0 { self.xs[k] } else { self.xn[k] }; } }
            if which == 0 { self.y[i] = v; } else { self.yn[i] = v; }
        }
    }
    /// 시도 단계 하나: 오차 노름(≤ 1 이면 받아들일 수 있음), 음수 상태면 -1, 특이 행렬이면 ∞ — 진행량은 xn
    fn try_step(&mut self, h: f64) -> f64 {
        let na_ = self.na_;
        self.rhs(false, true);
        if !self.build_m(h) { self.stats[6] += 1.0; return f64::INFINITY; }
        for s in 0..4 {
            if s == 0 { self.fy.copy_from_slice(&self.f0); }
            else if NEW_F[s] {
                for k in 0..na_ { let mut v = 0.0; for q in 0..s { v += RA[s][q] * self.kst[q * na_ + k]; } self.xs[k] = v; }
                self.plus_s(0); self.rhs(true, false);
            }
            for k in 0..na_ { let mut v = self.fy[k]; for q in 0..s { v += (RC[s][q] / h) * self.kst[q * na_ + k]; } self.bv[k] = v; }
            self.lu_solve();
            self.kst[s * na_..(s + 1) * na_].copy_from_slice(&self.bv);
        }
        for k in 0..na_ {
            let (mut a, mut e) = (0.0, 0.0);
            for s in 0..4 { a += RM[s] * self.kst[s * na_ + k]; e += RE[s] * self.kst[s * na_ + k]; }
            self.xn[k] = a; self.xe[k] = e;
        }
        self.plus_s(1);
        let (mut err, mut neg) = (0.0, false);
        for i in 0..self.nb {
            let mut e = 0.0;
            for s in 0..self.s_act[i].len() { let (k, c) = self.s_act[i][s]; if self.disc[k] == 0 { e += c * self.xe[k]; } }
            if self.yn[i] < 0.0 { neg = true; }
            let w = self.ctl.atol + self.ctl.rtol * fmax(self.n[i].abs(), self.yn[i].abs());
            let r = e.abs() / w;
            if r > err { err = r; }
        }
        // 이산 규칙의 성분은 적분 성향 — 그 오차도 노름에
        if self.sto { for k in 0..na_ { if self.disc[k] != 0 { let r = self.xe[k].abs() / (self.stp.atol + self.ctl.rtol * self.xn[k].abs()); if r > err { err = r; } } } }
        if neg { -1.0 } else { err }
    }
    /// 구간 [t0, t1] 적분 (h 는 구간 사이에 이어짐)
    fn integrate(&mut self, t0: f64, t1: f64) {
        let mut tt = t0; let mut h = self.h; let mut last_rej = false;
        self.iv_steps = 0.0; self.iv_rej = 0.0;
        while tt < t1 {
            let clip = h >= t1 - tt; let hu = if clip { t1 - tt } else { h };
            let err = self.try_step(hu);
            let ok = err >= 0.0 && err <= 1.0;
            if ok || hu <= self.ctl.h_min {
                if !ok { self.stats[5] += 1.0; }
                for k in 0..self.na_ { let x = self.xn[k]; if x != 0.0 { let j = self.act[k]; self.apply_extent(j, x); } }
                self.stats[2] += 1.0; self.iv_steps += 1.0; self.iv_hmin = fmin(self.iv_hmin, hu); self.iv_hmax = fmax(self.iv_hmax, hu);
                tt = if clip { t1 } else { tt + hu };
                let fac = fmin(if last_rej { 1.0 } else { self.ctl.fac_max }, fmax(self.ctl.fac_min, self.ctl.safety * libm::pow(fmax(err, 1e-10), -1.0 / 3.0)));
                let hn = hu * fac; h = if clip { fmax(h, hn) } else { hn }; last_rej = false;
            } else {
                self.stats[3] += 1.0; self.iv_rej += 1.0; if err < 0.0 { self.stats[4] += 1.0; }
                let sh = if err < 0.0 { self.ctl.neg_shrink } else { fmax(self.ctl.fac_min, self.ctl.safety * libm::pow(err, -1.0 / 3.0)) };
                h = fmax(self.ctl.h_min, hu * sh); last_rej = true;
            }
        }
        self.h = h;
    }
    // ----- 4단계 ⑤ 혼성 확률 층 (JS integrateSto·partition·caoTau·promote·ssaOver 와 같은 순서) -----
    #[inline]
    fn rate_at(&mut self, k: usize) -> f64 {
        let j = self.act[k];
        let f = tape::eval(&self.rules[j].factor, &self.n, 1.0, &self.cinv, &self.buf, &mut self.stack);
        tape::eval(&self.rules[j].rate, &self.n, f, &self.cinv, &self.buf, &mut self.stack)
    }
    #[inline]
    fn count(&self, k: usize) -> f64 { let mut c = f64::INFINITY; for &(i, _) in &self.spec[k] { c = fmin(c, self.n[i]); } c }
    fn partition(&mut self, first: bool) {
        self.rhs(false, true);
        let h = self.stp.hyst; self.n_leap = 0;
        for k in 0..self.na_ {
            let cnt = self.count(k); let a = self.f0[k].abs(); let cur = self.mode[k];
            let coarse = |x: f64| cnt >= self.stp.ode_min * x || a >= self.stp.fast * x;
            let m: u8 = if first || cur == 0 { if coarse(1.0) { 0 } else if cnt < self.stp.ssa_max { 2 } else { 1 } }
                else if coarse(h) { 0 } else if cur == 1 { if cnt < self.stp.ssa_max { 2 } else { 1 } }
                else if cnt >= self.stp.ssa_max * h { 1 } else { 2 };
            if m != cur || first { if !first { self.sto_stats[0] += 1.0; } if m == 2 { self.tq[k] = 0.0; self.pq[k] = self.rng.exp1(); } }
            self.mode[k] = m; self.disc[k] = if m > 0 { 1 } else { 0 }; if m == 1 { self.n_leap += 1; }
        }
    }
    fn cao_tau(&mut self) -> f64 {
        for i in 0..self.nb { self.mu[i] = 0.0; self.s2[i] = 0.0; }
        for k in 0..self.na_ {
            if self.mode[k] != 1 { continue; }
            let a = fmax(0.0, self.rate_at(k));
            for q in 0..self.spec[k].len() { let (i, v) = self.spec[k][q]; self.mu[i] += v * a; self.s2[i] += v * v * a; }
        }
        let mut tau = f64::INFINITY;
        for i in 0..self.nb {
            if self.s2[i] == 0.0 { continue; }
            let b = fmax(self.stp.leap_eps * self.n[i], 1.0);
            if self.mu[i] != 0.0 { tau = fmin(tau, b / self.mu[i].abs()); }
            tau = fmin(tau, (b * b) / self.s2[i]);
        }
        tau
    }
    fn promote(&mut self) {
        for k in 0..self.na_ {
            if self.disc[k] == 0 { continue; }
            let cnt = self.count(k); let a = self.rate_at(k).abs();
            if cnt >= self.stp.ode_min * self.stp.hyst || a >= self.stp.fast * self.stp.hyst { if self.mode[k] == 1 { self.n_leap -= 1; } self.mode[k] = 0; self.disc[k] = 0; self.sto_stats[0] += 1.0; }
        }
    }
    #[inline]
    fn ssa_over(&self) -> f64 { let mut m = f64::NEG_INFINITY; for k in 0..self.na_ { if self.mode[k] == 2 { m = fmax(m, self.tq[k] + self.xn[k] - self.pq[k]); } } m }
    fn reach_g(&self, s: usize) -> f64 {
        if self.reach_def[s].is_empty() { return f64::INFINITY; }
        let mut g = f64::NEG_INFINITY;
        for &(i, hi, th, tl) in &self.reach_def[s] { let x = fmax(self.n[i], 1e-9); g = fmax(g, if hi { libm::log(th / x) } else { libm::log(x / tl) }); }
        g
    }
    /// 확률 실행의 단계마다: 저장소 고갈·재생 사건과 상태 도달 (본 실행만)
    fn on_step(&mut self, tt: f64) {
        for r in 0..self.nres {
            let i = self.res_idx[r]; let x = self.n[i];
            self.res_min[r] = fmin(self.res_min[r], x);
            if !self.res_watch[r] { continue; }
            let ty = if self.res_ok[r] && x < 1.0 { self.res_ok[r] = false; 0.0 } else if !self.res_ok[r] && x >= 1.0 { self.res_ok[r] = true; 1.0 } else { -1.0 };
            if ty >= 0.0 {
                let k = self.n_events;
                if 3 * k + 2 < self.events.len() { self.events[3 * k] = tt; self.events[3 * k + 1] = ty; self.events[3 * k + 2] = i as f64; self.n_events += 1; } else { self.sto_stats[6] += 1.0; }
            }
        }
        for s in 0..self.reach_t.len() { if self.reach_t[s].is_nan() && self.reach_g(s) <= 0.0 { self.reach_t[s] = tt; } }
    }
    fn integrate_sto(&mut self, t0: f64, t1: f64, main: bool) {
        let na_ = self.na_;
        let mut tt = t0; let mut h = self.h; let mut last_rej = false;
        self.iv_steps = 0.0; self.iv_rej = 0.0;
        while tt < t1 {
            let mut clip = h >= t1 - tt; let mut hu = if clip { t1 - tt } else { h };
            if self.n_leap > 0 { let tl = fmax(self.cao_tau(), self.ctl.h_min); if tl < hu { hu = tl; clip = false; } }
            let mut err = self.try_step(hu);
            let ok = err >= 0.0 && err <= 1.0;
            if !ok && hu > self.ctl.h_min {
                self.stats[3] += 1.0; self.iv_rej += 1.0; if err < 0.0 { self.stats[4] += 1.0; }
                let sh = if err < 0.0 { self.ctl.neg_shrink } else { fmax(self.ctl.fac_min, self.ctl.safety * libm::pow(err, -1.0 / 3.0)) };
                h = fmax(self.ctl.h_min, hu * sh); last_rej = true; continue;
            }
            if !ok { self.stats[5] += 1.0; }
            // SSA: 이 단계 안에서 다음 발화에 닿으면 그 단계 길이를 근 찾기(Illinois)로
            let mut fire: isize = -1; let over = self.ssa_over();
            if over > 0.0 {
                let (mut a, mut fa, mut b, mut fb, mut side) = (0.0, f64::NEG_INFINITY, hu, over, 0i32);
                for k in 0..na_ { if self.mode[k] == 2 { fa = fmax(fa, self.tq[k] - self.pq[k]); } }
                let mut it = 0;
                while it < 100 && fb > self.stp.ssa_tol && b - a > 1e-12 * fmax(1.0, tt) {
                    let mut c = b - (fb * (b - a)) / (fb - fa);
                    if !(c > a && c < b) { c = (a + b) / 2.0; }
                    self.try_step(c); self.sto_stats[4] += 1.0; let fc = self.ssa_over();
                    if fc >= 0.0 { b = c; fb = fc; if side == -1 { fa /= 2.0; } side = -1; } else { a = c; fa = fc; if side == 1 { fb /= 2.0; } side = 1; }
                    it += 1;
                }
                hu = b; clip = false; err = self.try_step(hu);
                let mut best = f64::NEG_INFINITY;
                for k in 0..na_ { if self.mode[k] == 2 && self.tq[k] + self.xn[k] - self.pq[k] > best { best = self.tq[k] + self.xn[k] - self.pq[k]; fire = k as isize; } }
            }
            if self.n_leap > 0 { self.save_n.copy_from_slice(&self.n); self.save_lo.copy_from_slice(&self.lo); self.save_t.copy_from_slice(&self.tq); self.save_cum.copy_from_slice(&self.cum); }
            for k in 0..na_ { if self.disc[k] == 0 { let x = self.xn[k]; if x != 0.0 { let j = self.act[k]; self.apply_extent(j, x); } } else { self.tq[k] += self.xn[k]; } }
            if self.n_leap > 0 {
                self.nc.copy_from_slice(&self.n);
                for k in 0..na_ { self.kl[k] = 0.0; if self.mode[k] == 1 { let kk = self.rng.poisson(self.xn[k]); if kk != 0.0 { let j = self.act[k]; self.apply_extent(j, kk); self.kl[k] = kk; } } }
                let mut neg = false;
                for i in 0..self.nb { if !self.is_sig[i] && self.n[i] < 0.0 && self.n[i] < self.nc[i] { neg = true; break; } }
                if neg {
                    self.n.copy_from_slice(&self.save_n); self.lo.copy_from_slice(&self.save_lo); self.tq.copy_from_slice(&self.save_t); self.cum.copy_from_slice(&self.save_cum);
                    self.sto_stats[3] += 1.0; self.stats[3] += 1.0; self.iv_rej += 1.0; h = fmax(self.ctl.h_min, hu / 2.0); last_rej = true; continue;
                }
                for k in 0..na_ { self.fired_leap[k] += self.kl[k]; }
            }
            if fire >= 0 {
                let k = fire as usize; let j = self.act[k];
                let mut avail = true;
                for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; if !(self.is_sig[i] || self.n[i] >= n) { avail = false; break; } }
                if avail { self.apply_extent(j, 1.0); self.fired_ssa[k] += 1.0; self.sto_stats[1] += 1.0; } else { self.sto_stats[2] += 1.0; }
                self.pq[k] += self.rng.exp1();
            }
            self.promote();
            self.stats[2] += 1.0; self.iv_steps += 1.0; self.iv_hmin = fmin(self.iv_hmin, hu); self.iv_hmax = fmax(self.iv_hmax, hu);
            tt = if clip { t1 } else { tt + hu };
            let fac = fmin(if last_rej { 1.0 } else { self.ctl.fac_max }, fmax(self.ctl.fac_min, self.ctl.safety * libm::pow(fmax(err, 1e-10), -1.0 / 3.0)));
            let hn = hu * fac; h = if clip { fmax(h, hn) } else { hn }; last_rej = false;
            if main { self.on_step(tt); }
        }
        self.h = h;
        self.sto_stats[5] = self.rng.draws;
    }
    fn signal_at(&mut self, t: f64, zero: bool) {
        for q in 0..self.nsig {
            let mut v = 0.0;
            if !zero { for e in &self.signals[q].ev { if e.0 <= t + 1e-9 { v = e.1; } } }
            self.sig[q] = v;
        }
    }

    /// 한 번의 적분 (본 실행·결정 탐침 공유). main = 기록·스냅숏·사건을 남김, zero_signal = 신호 철회.
    fn run(&mut self, t0: f64, t1: f64, main: bool, zero_signal: bool) {
        for i in 0..self.nb { self.lo[i] = 0.0; }
        for k in 0..2 * self.nr { self.cum[k] = 0.0; }
        self.h = self.ctl.h0; self.iv_hmin = f64::INFINITY; self.iv_hmax = 0.0;
        let s0 = self.stats;
        for r in 0..self.nres { let i = self.res_idx[r]; self.res_start[r] = self.n[i]; self.res_min[r] = self.n[i]; self.res_ok[r] = self.n[i] >= 1.0; self.res_watch[r] = self.n[i] >= 1.0; }
        let (mut per_min, mut per_max) = (f64::INFINITY, 0.0);
        let mut step = 0usize; let mut t = t0;
        if main { self.n_rec = 0; self.n_snap = 0; self.n_events = 0; }
        if self.sto && main { for s in 0..self.reach_t.len() { self.reach_t[s] = if self.reach_g(s) <= 0.0 { t0 } else { f64::NAN }; } }
        while t < t1 - 1e-9 {
            self.signal_at(t, zero_signal);
            for q in 0..self.nsig { let i = self.signals[q].idx; self.n[i] = self.sig[q]; }
            let te = if t1 - t < self.dt - 1e-9 { t1 } else { t + self.dt }; // 마지막 구간이 Δ 보다 짧으면 t1 에서 (사건 근 찾기의 다시 적분 — 격자 정렬 실행은 그대로)
            if self.sto { self.partition(step == 0); self.integrate_sto(t, te, main); } else { self.integrate(t, te); }
            per_min = fmin(per_min, self.iv_steps); per_max = fmax(per_max, self.iv_steps);
            for r in 0..self.nres {
                let i = self.res_idx[r]; let x = self.n[i];
                self.res_min[r] = fmin(self.res_min[r], x);
                if !self.res_watch[r] || self.sto { continue; } // 확률 실행은 단계마다 (on_step)
                if self.res_ok[r] && x < 1.0 { self.res_ok[r] = false; if main { let k = self.n_events; self.events[3 * k] = t + self.dt; self.events[3 * k + 1] = 0.0; self.events[3 * k + 2] = i as f64; self.n_events += 1; } }
                else if !self.res_ok[r] && x >= 1.0 { self.res_ok[r] = true; if main { let k = self.n_events; self.events[3 * k] = t + self.dt; self.events[3 * k + 1] = 1.0; self.events[3 * k + 2] = i as f64; self.n_events += 1; } }
            }
            if main {
                if step % self.record_every == 0 {
                    let k = self.n_rec; let (nb, nr, ns) = (self.nb, self.nr, self.nsig);
                    self.rec_t[k] = t + self.dt;
                    self.rec_n[k * nb..(k + 1) * nb].copy_from_slice(&self.n);
                    self.rec_lo[k * nb..(k + 1) * nb].copy_from_slice(&self.lo);
                    self.rec_cum[k * 2 * nr..(k + 1) * 2 * nr].copy_from_slice(&self.cum);
                    self.rec_sig[k * ns..(k + 1) * ns].copy_from_slice(&self.sig);
                    self.rec_meta[2 * k] = self.iv_steps; self.rec_meta[2 * k + 1] = self.iv_rej;
                    self.n_rec += 1;
                }
                let k = self.n_snap; let nb = self.nb;
                self.snap_t[k] = t + self.dt; self.snap_n[k * nb..(k + 1) * nb].copy_from_slice(&self.n); self.n_snap += 1;
            }
            t += self.dt; step += 1;
        }
        if main {
            self.run_info = [self.stats[2] - s0[2], self.stats[3] - s0[3], self.stats[4] - s0[4], self.stats[5] - s0[5], self.iv_hmin, self.iv_hmax, per_min, per_max];
            self.fin_n.copy_from_slice(&self.n); self.fin_lo.copy_from_slice(&self.lo); self.fin_cum.copy_from_slice(&self.cum);
            for k in 0..self.na_ { self.mode_out[k] = self.mode[k] as f64; }
            for r in 0..self.nres { let i = self.res_idx[r]; self.res_out[5 * r] = self.res_start[r]; self.res_out[5 * r + 1] = self.res_min[r]; self.res_out[5 * r + 2] = self.n[i]; self.res_out[5 * r + 3] = if self.res_ok[r] { 1.0 } else { 0.0 }; self.res_out[5 * r + 4] = if self.res_watch[r] { 1.0 } else { 0.0 }; }
        }
    }

    /// 본 실행: N₀ 에서 신호 일정대로, 기록·스냅숏·사건
    pub fn run_main(&mut self) {
        self.n.copy_from_slice(&self.n0);
        let t_end = self.t_end;
        self.run(0.0, t_end, true, false);
    }
    /// 결정 탐침: 스냅숏 k 에서 모든 신호를 끊고 horizon 동안 — 끝 상태는 probe_n
    pub fn probe(&mut self, k: usize) -> bool {
        if k >= self.n_snap { return false; }
        let nb = self.nb;
        let t0 = self.snap_t[k];
        for i in 0..nb { self.n[i] = self.snap_n[k * nb + i]; }
        self.probe_run(t0);
        true
    }
    /// 결정 탐침 (2단계 병렬): 넘겨받은 시작 상태(probe_in)에서 — 본 실행 없이 다른 인스턴스·스레드가 같은 탐침을 돈다.
    /// 탐침은 (시작 상태, t0) 만의 순수 함수다(원장·단계 제어 상태를 run 이 새로 잡음) → 어느 인스턴스에서 돌든 비트 단위로 같다.
    pub fn probe_from(&mut self, t0: f64) {
        self.n.copy_from_slice(&self.probe_in);
        self.probe_run(t0);
    }
    /// 다시 적분 (4단계 ③ 사건 근 찾기·결정 시각 정밀화): probe_in 상태에서 t0 → t1, 신호는 선언된 일정대로 — 결과는 probe_n.
    /// 탐침처럼 (시작 상태, t0, t1) 만의 순수 함수 (원장·단계 제어 상태를 run 이 새로 잡음). 본 실행의 기록·스냅숏은 건드리지 않는다.
    pub fn advance(&mut self, t0: f64, t1: f64) {
        self.n.copy_from_slice(&self.probe_in);
        self.run(t0, t1, false, false);
        self.probe_n.copy_from_slice(&self.n);
    }
    fn probe_run(&mut self, t0: f64) {
        let h = self.horizon;
        self.run(t0, t0 + h, false, true);
        self.probe_n.copy_from_slice(&self.n);
    }
}
