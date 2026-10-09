//! 운명 엔진 (행정부, Rust) — JS 기준 구현(engine/fate_engine.js)과 같은 알고리즘:
//!   빠른 층: P5 관문이 고른 경로 — 명시 부분 단계(N_sub) 또는 역방향 오일러(진행량 뉴턴, 해석적 J = I − h·(∂rate/∂N)·S)
//!   느린 층: 배율 고정, 정확한 지수 해. 원장: 상태 N(hi)+LO, 규칙별 누적 진행량(double-double).
//! 법칙은 모두 IR 테이프로 해석한다(tape.rs). 판정·파일 쓰기 없음. 모든 버퍼는 `Engine::new` 에서 한 번 잡는다(루프 안 할당 0).

use crate::tape;

pub const PATH_FV: f64 = 0.0;
pub const PATH_SUR: f64 = 1.0;
pub const EV_NONE: f64 = 0.0;
pub const EV_PROMOTE: f64 = 1.0;
pub const EV_DEMOTE_STIFF: f64 = 2.0;
pub const EV_DEMOTE_PREFILTER: f64 = 3.0;
pub const EV_COOLDOWN: f64 = 4.0;

struct Rule {
    degradation: bool,
    slow: bool,
    active: bool,
    kdeg: f64,
    cons: Vec<(usize, f64)>,
    prods: Vec<(usize, f64)>,
    rate: Vec<f64>,
    factor: Vec<f64>,
}

struct Signal { idx: usize, ev: Vec<(f64, f64)> }

struct Gate {
    k_up: f64, k_down: f64, m: f64, w: f64, gamma_max: f64,
    promoted: bool, up: f64, cooldown_until: f64,
    // promotions, demotions, forced, prefilterTrips, oodTrips, cooldownSteps, fvSteps, surSteps
    stats: [f64; 8],
}

pub struct Engine {
    // 차원·설정
    pub nb: usize, pub nr: usize, pub nf: usize, pub nsig: usize, pub nres: usize,
    pub dt: f64, pub t_end: f64, pub horizon: f64, mode: u32, explicit_fraction: f64, shock: f64,
    gate_opt: [f64; 4], newton_tol: f64, newton_iters: usize, na: f64, record_every: usize, nsub_margin: f64,
    pub n_steps: usize, pub n_rec_max: usize,
    // 데이터 (IR)
    pub n0: Vec<f64>, v: Vec<f64>, buf: Vec<f64>,
    rules: Vec<Rule>, fast: Vec<usize>, slow: Vec<usize>,
    drate: Vec<Vec<(usize, Vec<f64>)>>, // 빠른 규칙 위치 → [(묶음, 도함수 테이프)]
    s_fast: Vec<Vec<(usize, f64)>>,     // 묶음 → [(빠른 규칙 위치, 화학량)]
    signals: Vec<Signal>, res_idx: Vec<usize>, deg_count: Vec<u32>,
    // 작업 버퍼
    n: Vec<f64>, pub lo: Vec<f64>, pub cum: Vec<f64>, n0v: Vec<f64>, tmp: Vec<f64>,
    xi: Vec<f64>, r0: Vec<f64>, cand: Vec<f64>, dx: Vec<f64>, jac: Vec<f64>, lu: Vec<f64>, rhs: Vec<f64>,
    ff: Vec<f64>, fs: Vec<f64>, rs: Vec<f64>, prod: Vec<f64>, kd: Vec<f64>, before: Vec<f64>, made: Vec<f64>, applied: Vec<f64>,
    stack: Vec<f64>, sig: Vec<f64>, prev_sig: Vec<f64>,
    res_start: Vec<f64>, res_min: Vec<f64>, res_ok: Vec<bool>, res_watch: Vec<bool>,
    // 출력 (본 실행)
    pub rec_t: Vec<f64>, pub rec_n: Vec<f64>, pub rec_lo: Vec<f64>, pub rec_cum: Vec<f64>, pub rec_sig: Vec<f64>, pub rec_meta: Vec<f64>,
    pub snap_t: Vec<f64>, pub snap_n: Vec<f64>,
    pub gate_log: Vec<f64>, pub events: Vec<f64>, pub res_out: Vec<f64>,
    pub n_rec: usize, pub n_snap: usize, pub n_log: usize, pub n_events: usize,
    // newton, newtonFail, substeps, implicitSteps, explicitSteps, residEvals, jacEvals (모든 실행 누적)
    pub stats: [f64; 7],
    // 본 실행의 관문·경로: path fv, surrogate, fv_shock, fv_newton · nsub min, max · 관문 통계 8
    pub run_info: [f64; 14],
    pub probe_n: Vec<f64>,
    // 본 실행 끝 상태 (탐침이 작업 버퍼를 덮어쓰기 전에 고정)
    pub fin_n: Vec<f64>, pub fin_lo: Vec<f64>, pub fin_cum: Vec<f64>,
}

struct Cursor<'a> { d: &'a [f64], p: usize }
impl<'a> Cursor<'a> {
    fn f(&mut self) -> f64 { let x = self.d[self.p]; self.p += 1; x }
    fn u(&mut self) -> usize { self.f() as usize }
    fn vecf(&mut self, n: usize) -> Vec<f64> { let v = self.d[self.p..self.p + n].to_vec(); self.p += n; v }
}

#[inline(always)]
fn max0(x: f64) -> f64 { if x > 0.0 { x } else { 0.0 } }
#[inline(always)]
fn fmax(a: f64, b: f64) -> f64 { if a > b { a } else { b } } // JS Math.max 의 순서·NaN 이외 의미
#[inline(always)]
fn fmin(a: f64, b: f64) -> f64 { if a < b { a } else { b } }

impl Engine {
    /// IR 직렬 덩어리(engine/fate_rust.js packIR)에서 엔진을 만든다. 모든 할당은 여기서 끝난다.
    pub fn new(blob: &[f64]) -> Result<Engine, &'static str> {
        let mut c = Cursor { d: blob, p: 0 };
        if c.f() != 1.0 { return Err("blob version"); }
        let (nb, nr, nf, nsig, nres) = (c.u(), c.u(), c.u(), c.u(), c.u());
        let (dt, t_end, horizon) = (c.f(), c.f(), c.f());
        let mode = c.f() as u32;
        let (explicit_fraction, shock) = (c.f(), c.f());
        let gate_opt = [c.f(), c.f(), c.f(), c.f()];
        let (newton_tol, newton_iters, na, record_every) = (c.f(), c.u(), c.f(), c.u().max(1));
        let nsub_margin = c.f();
        let n0 = c.vecf(nb); let v = c.vecf(nb); let buf = c.vecf(nb); let _is_marker = c.vecf(nb);
        let mut rules = Vec::with_capacity(nr);
        for _ in 0..nr {
            let degradation = c.f() == 1.0; let slow = c.f() == 1.0; let active = c.f() == 1.0; let kdeg = c.f();
            let (nc, np) = (c.u(), c.u());
            let mut cons = Vec::with_capacity(nc); for _ in 0..nc { let i = c.u(); let n = c.f(); cons.push((i, n)); }
            let mut prods = Vec::with_capacity(np); for _ in 0..np { let i = c.u(); let n = c.f(); prods.push((i, n)); }
            let lr = c.u(); let rate = c.vecf(lr); let lf = c.u(); let factor = c.vecf(lf);
            rules.push(Rule { degradation, slow, active, kdeg, cons, prods, rate, factor });
        }
        let nf_ir = c.u(); if nf_ir != nf { return Err("fast count"); }
        let fast: Vec<usize> = (0..nf).map(|_| c.u()).collect();
        let mut drate = Vec::with_capacity(nf);
        for _ in 0..nf { let nd = c.u(); let mut d = Vec::with_capacity(nd); for _ in 0..nd { let i = c.u(); let l = c.u(); d.push((i, c.vecf(l))); } drate.push(d); }
        let mut s_fast = Vec::with_capacity(nb);
        for _ in 0..nb { let cnt = c.u(); let mut s = Vec::with_capacity(cnt); for _ in 0..cnt { let k = c.u(); let co = c.f(); s.push((k, co)); } s_fast.push(s); }
        let mut signals = Vec::with_capacity(nsig);
        for _ in 0..nsig { let idx = c.u(); let ne = c.u(); let mut ev = Vec::with_capacity(ne); for _ in 0..ne { let t = c.f(); let n = c.f(); ev.push((t, n)); } signals.push(Signal { idx, ev }); }
        let res_idx: Vec<usize> = (0..nres).map(|_| c.u()).collect();
        if c.p != blob.len() { return Err("blob length"); }
        // 엔진 빠른 층 = IR 빠른 층 (느리지 않고 속도 상수 있음) — 같은지 확인
        let fast_chk: Vec<usize> = (0..nr).filter(|&j| !rules[j].slow && rules[j].active).collect();
        if fast_chk != fast { return Err("fast layer mismatch"); }
        let slow: Vec<usize> = (0..nr).filter(|&j| rules[j].slow && rules[j].active).collect();
        let mut deg_count = vec![0u32; nb];
        for r in &rules { if r.degradation && r.slow { deg_count[r.cons[0].0] += 1; } }
        // 단계 수: JS 와 같은 누적 t 루프로 센다
        let mut n_steps = 0usize; { let mut t = 0.0; while t < t_end - 1e-9 { n_steps += 1; t += dt; } }
        let n_rec_max = (n_steps + record_every - 1) / record_every;
        let max_ev = n_steps * nres.max(1);
        Ok(Engine {
            nb, nr, nf, nsig, nres, dt, t_end, horizon, mode, explicit_fraction, shock, gate_opt, newton_tol, newton_iters, na, record_every, nsub_margin, n_steps, n_rec_max,
            n0, v, buf, rules, fast, slow, drate, s_fast, signals, res_idx, deg_count,
            n: vec![0.0; nb], lo: vec![0.0; nb], cum: vec![0.0; 2 * nr], n0v: vec![0.0; nb], tmp: vec![0.0; nb],
            xi: vec![0.0; nf], r0: vec![0.0; nf], cand: vec![0.0; nf], dx: vec![0.0; nf], jac: vec![0.0; nf * nf], lu: vec![0.0; nf * nf], rhs: vec![0.0; nf],
            ff: vec![0.0; nf], fs: vec![0.0; nr], rs: vec![0.0; nr], prod: vec![0.0; nb], kd: vec![0.0; nb], before: vec![0.0; nb], made: vec![0.0; nb], applied: vec![0.0; nb],
            stack: vec![0.0; 64], sig: vec![0.0; nsig], prev_sig: vec![0.0; nsig],
            res_start: vec![0.0; nres], res_min: vec![0.0; nres], res_ok: vec![false; nres], res_watch: vec![false; nres],
            rec_t: vec![0.0; n_rec_max], rec_n: vec![0.0; n_rec_max * nb], rec_lo: vec![0.0; n_rec_max * nb], rec_cum: vec![0.0; n_rec_max * 2 * nr],
            rec_sig: vec![0.0; n_rec_max * nsig], rec_meta: vec![0.0; n_rec_max * 4],
            snap_t: vec![0.0; n_steps], snap_n: vec![0.0; n_steps * nb],
            gate_log: vec![0.0; 3 * n_steps], events: vec![0.0; 3 * max_ev], res_out: vec![0.0; 5 * nres],
            n_rec: 0, n_snap: 0, n_log: 0, n_events: 0, stats: [0.0; 7], run_info: [0.0; 14], probe_n: vec![0.0; nb], fin_n: vec![0.0; nb], fin_lo: vec![0.0; nb], fin_cum: vec![0.0; 2 * nr],
        })
    }

    #[inline]
    fn rate(&mut self, j: usize, use_tmp: bool, f: f64) -> f64 {
        let n: &[f64] = if use_tmp { &self.tmp } else { &self.n };
        tape::eval(&self.rules[j].rate, n, f, &self.v, &self.buf, self.na, &mut self.stack)
    }
    #[inline]
    fn rate_at(&mut self, j: usize, which: u8, f: f64) -> f64 {
        let n: &[f64] = match which { 0 => &self.n, 1 => &self.tmp, _ => &self.n0v };
        tape::eval(&self.rules[j].rate, n, f, &self.v, &self.buf, self.na, &mut self.stack)
    }
    #[inline]
    fn factor(&mut self, j: usize) -> f64 {
        tape::eval(&self.rules[j].factor, &self.n, 1.0, &self.v, &self.buf, self.na, &mut self.stack)
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
    #[inline]
    fn add_n(&mut self, i: usize, d: f64) {
        let a = self.n[i]; let s = a + d; let bb = s - a;
        self.n[i] = s; self.lo[i] += (a - (s - bb)) + (d - bb);
    }
    fn apply_extent(&mut self, j: usize, x: f64) {
        self.cum_add(j, x);
        for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; self.add_prod_n(i, -n, x); }
        for q in 0..self.rules[j].prods.len() { let (i, n) = self.rules[j].prods[q]; self.add_prod_n(i, n, x); }
    }
    fn lambda(&mut self) -> f64 {
        let mut lam = 0.0;
        for a in 0..self.nf {
            let j = self.fast[a]; let f = self.ff[a];
            let r = self.rate(j, false, f);
            if !(r > 0.0) { continue; }
            for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; lam = fmax(lam, n * r / fmax(self.n[i], 1.0)); }
        }
        lam
    }
    fn explicit_fast(&mut self, h: f64, nsub: usize) {
        for _ in 0..nsub {
            for a in 0..self.nf {
                let j = self.fast[a]; let f = self.ff[a];
                let mut x = if self.rules[j].degradation { let i0 = self.rules[j].cons[0].0; max0(self.n[i0]) * (1.0 - libm::exp(-self.rules[j].kdeg * f * h)) } else { self.rate(j, false, f) * h };
                for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; x = fmin(x, max0(self.n[i]) / n); }
                if x > 0.0 { self.apply_extent(j, x); }
            }
        }
    }
    fn state_at(&mut self, use_cand: bool) {
        self.tmp.copy_from_slice(&self.n0v);
        for a in 0..self.nf {
            let j = self.fast[a]; let x = if use_cand { self.cand[a] } else { self.xi[a] };
            for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; self.tmp[i] -= n * x; }
            for q in 0..self.rules[j].prods.len() { let (i, n) = self.rules[j].prods[q]; self.tmp[i] += n * x; }
        }
    }
    /// 가우스 소거 (부분 피벗) — JS solve 와 같은 순서. 결과는 dx, 특이하면 false.
    fn solve(&mut self) -> bool {
        let n = self.nf;
        self.lu.copy_from_slice(&self.jac);
        for k in 0..n { self.dx[k] = self.rhs[k]; }
        for c in 0..n {
            let mut p = c;
            for r in (c + 1)..n { if self.lu[r * n + c].abs() > self.lu[p * n + c].abs() { p = r; } }
            if p != c { for k in 0..n { self.lu.swap(c * n + k, p * n + k); } self.dx.swap(c, p); }
            if self.lu[c * n + c].abs() < 1e-300 { return false; }
            for r in (c + 1)..n {
                let f = self.lu[r * n + c] / self.lu[c * n + c];
                if f == 0.0 { continue; }
                for k in c..n { self.lu[r * n + k] -= f * self.lu[c * n + k]; }
                self.dx[r] -= f * self.dx[c];
            }
        }
        for c in (0..n).rev() {
            let mut s = self.dx[c];
            for k in (c + 1)..n { s -= self.lu[c * n + k] * self.dx[k]; }
            self.dx[c] = s / self.lu[c * n + c];
        }
        true
    }
    fn implicit_fast(&mut self, h: f64) -> bool {
        let nf = self.nf;
        self.n0v.copy_from_slice(&self.n);
        for a in 0..nf {
            let j = self.fast[a]; let f = self.ff[a];
            let mut x = h * self.rate_at(j, 2, f);
            for q in 0..self.rules[j].cons.len() { let (i, n) = self.rules[j].cons[q]; x = fmin(x, max0(self.n0v[i]) / n); }
            self.xi[a] = fmax(0.0, x);
        }
        let mut ok = false;
        for _ in 0..self.newton_iters {
            self.stats[0] += 1.0;
            // 잔차 r = ξ − h·rate(N0 + Sξ)
            self.stats[5] += 1.0;
            self.state_at(false);
            let mut norm = f64::NEG_INFINITY;
            for a in 0..nf { let j = self.fast[a]; let f = self.ff[a]; let r = self.xi[a] - h * self.rate_at(j, 1, f); self.r0[a] = r; norm = fmax(norm, r.abs() / (self.xi[a].abs() + 1.0)); }
            if norm < self.newton_tol { ok = true; break; }
            // 해석적 J (tmp = 현재 반복점)
            self.stats[6] += 1.0;
            for r in 0..nf { for k in 0..nf { self.jac[r * nf + k] = if r == k { 1.0 } else { 0.0 }; } }
            for a in 0..nf {
                let f = self.ff[a];
                for d in 0..self.drate[a].len() {
                    let i = self.drate[a][d].0;
                    let val = tape::eval(&self.drate[a][d].1, &self.tmp, f, &self.v, &self.buf, self.na, &mut self.stack);
                    if val != 0.0 { for s in 0..self.s_fast[i].len() { let (k, co) = self.s_fast[i][s]; self.jac[a * nf + k] -= h * val * co; } }
                }
            }
            for a in 0..nf { self.rhs[a] = -self.r0[a]; }
            if !self.solve() { break; }
            let mut lam = 1.0;
            for _ in 0..40 {
                for a in 0..nf { self.cand[a] = self.xi[a] + lam * self.dx[a]; }
                self.state_at(true);
                let mut good = true;
                for a in 0..nf { if !(self.cand[a] >= -1e-9) { good = false; break; } }
                if good { for i in 0..self.nb { if !(self.tmp[i] >= -1e-6 * fmax(1.0, self.n0v[i])) { good = false; break; } } }
                if good { for a in 0..nf { self.xi[a] = fmax(0.0, self.cand[a]); } break; }
                lam /= 2.0;
            }
        }
        if !ok { self.stats[1] += 1.0; return false; }
        for a in 0..nf { let j = self.fast[a]; let x = self.xi[a]; self.apply_extent(j, x); }
        true
    }
    fn slow_step(&mut self, h: f64) {
        for i in 0..self.nb { self.prod[i] = 0.0; self.kd[i] = 0.0; self.made[i] = 0.0; self.applied[i] = 0.0; }
        for s in 0..self.slow.len() { let j = self.slow[s]; self.fs[j] = self.factor(j); }
        for s in 0..self.slow.len() {
            let j = self.slow[s]; let f = self.fs[j];
            if self.rules[j].degradation { let i0 = self.rules[j].cons[0].0; self.kd[i0] += self.rules[j].kdeg * f; }
            else { let r = self.rate(j, false, f); for q in 0..self.rules[j].prods.len() { let (i, n) = self.rules[j].prods[q]; self.prod[i] += n * r; } self.rs[j] = r; }
        }
        self.before.copy_from_slice(&self.n);
        for i in 0..self.nb {
            if self.prod[i] == 0.0 && self.kd[i] == 0.0 { continue; }
            let k = self.kd[i]; let s = self.prod[i];
            let v = if k > 0.0 { self.n[i] * libm::exp(-k * h) + (s / k) * (1.0 - libm::exp(-k * h)) } else { self.n[i] + s * h };
            let d = v - self.n[i]; self.add_n(i, d); self.applied[i] = d; self.made[i] = s * h;
        }
        for s in 0..self.slow.len() {
            let j = self.slow[s];
            if self.rules[j].degradation {
                let i = self.rules[j].cons[0].0;
                if self.deg_count[i] == 1 { let (m, a) = (self.made[i], self.applied[i]); self.cum_add(j, m); self.cum_add(j, -a); }
                else { let lost = self.before[i] + self.made[i] - self.n[i]; let share = if self.kd[i] != 0.0 { self.rules[j].kdeg * self.fs[j] / self.kd[i] } else { 0.0 }; self.cum_add(j, lost * share); }
            } else { let x = self.rs[j] * h; self.cum_add(j, x); }
        }
    }
    fn signal_at(&mut self, t: f64, zero: bool) {
        for q in 0..self.nsig {
            let mut v = 0.0;
            if !zero { for e in &self.signals[q].ev { if e.0 <= t + 1e-9 { v = e.1; } } }
            self.sig[q] = v;
        }
    }
    fn decide(&mut self, g: &mut Gate, step: usize, nsub: usize, gamma: f64, log: bool) -> (f64, f64) {
        let ns = nsub as f64; let st = step as f64;
        let push = |e: &mut Engine, ev: f64| { if log { let k = e.n_log; e.gate_log[3 * k] = st; e.gate_log[3 * k + 1] = ev; e.gate_log[3 * k + 2] = ns; e.n_log += 1; } };
        if g.promoted {
            if ns < g.k_down { g.promoted = false; g.up = 0.0; g.stats[1] += 1.0; push(self, EV_DEMOTE_STIFF); return (PATH_FV, EV_DEMOTE_STIFF); }
            if gamma > g.gamma_max {
                g.promoted = false; g.up = 0.0; g.cooldown_until = st + 1.0 + g.w; g.stats[2] += 1.0; g.stats[1] += 1.0; g.stats[3] += 1.0;
                push(self, EV_DEMOTE_PREFILTER); return (PATH_FV, EV_DEMOTE_PREFILTER);
            }
            return (PATH_SUR, EV_NONE);
        }
        if st < g.cooldown_until { g.stats[5] += 1.0; g.up = 0.0; return (PATH_FV, EV_COOLDOWN); }
        if ns >= g.k_up {
            if gamma <= g.gamma_max { g.up += 1.0; } else { g.up = 0.0; }
            if g.up >= g.m { g.promoted = true; g.stats[0] += 1.0; push(self, EV_PROMOTE); return (PATH_SUR, EV_PROMOTE); }
        } else { g.up = 0.0; }
        (PATH_FV, EV_NONE)
    }

    /// 한 번의 적분 (본 실행·결정 탐침 공유). main = 기록·스냅숏·사건·관문 로그를 남김, zero_signal = 신호 철회.
    fn run(&mut self, t0: f64, t1: f64, main: bool, zero_signal: bool) {
        for i in 0..self.nb { self.lo[i] = 0.0; }
        for k in 0..2 * self.nr { self.cum[k] = 0.0; }
        let mut g = Gate { k_up: self.gate_opt[0], k_down: self.gate_opt[1], m: self.gate_opt[2], w: self.gate_opt[3], gamma_max: self.shock, promoted: false, up: 0.0, cooldown_until: -1.0, stats: [0.0; 8] };
        for r in 0..self.nres { let i = self.res_idx[r]; self.res_start[r] = self.n[i]; self.res_min[r] = self.n[i]; self.res_ok[r] = self.n[i] >= 1.0; self.res_watch[r] = self.n[i] >= 1.0; }
        let (mut path_fv, mut path_sur, mut path_shock, mut path_newton) = (0.0, 0.0, 0.0, 0.0);
        let (mut nsub_min, mut nsub_max) = (f64::INFINITY, f64::NEG_INFINITY);
        let mut have_prev = false; let mut exhausted_now = false;
        let mut step = 0usize; let mut t = t0;
        if main { self.n_rec = 0; self.n_snap = 0; self.n_log = 0; self.n_events = 0; }
        while t < t1 - 1e-9 {
            self.signal_at(t, zero_signal);
            for q in 0..self.nsig { let i = self.signals[q].idx; self.n[i] = self.sig[q]; }
            let mut gamma = 0.0;
            if have_prev {
                gamma = if exhausted_now { 1.0 } else { 0.0 };
                for q in 0..self.nsig { let (v, p) = (self.sig[q], self.prev_sig[q]); gamma = fmax(gamma, (v - p).abs() / (fmax(v, p) + 1e-12)); }
            }
            self.prev_sig.copy_from_slice(&self.sig); have_prev = true; exhausted_now = false;
            for a in 0..self.nf { let j = self.fast[a]; self.ff[a] = self.factor(j); }
            let lam = self.lambda();
            let nsub = { let x = libm::ceil(lam * self.dt / self.explicit_fraction * (1.0 - self.nsub_margin)); if x > 1.0 { x as usize } else { 1 } };
            nsub_min = fmin(nsub_min, nsub as f64); nsub_max = fmax(nsub_max, nsub as f64);
            let (path, ev) = match self.mode { 1 => (PATH_FV, EV_NONE), 2 => (PATH_SUR, EV_NONE), _ => self.decide(&mut g, step, nsub, gamma, main) };
            let h = self.dt;
            if path == PATH_SUR && self.implicit_fast(h) { path_sur += 1.0; self.stats[3] += 1.0; }
            else if path == PATH_SUR { self.explicit_fast(h / nsub as f64, nsub); path_newton += 1.0; self.stats[4] += 1.0; self.stats[2] += nsub as f64; }
            else { self.explicit_fast(h / nsub as f64, nsub); if ev == EV_DEMOTE_PREFILTER { path_shock += 1.0 } else { path_fv += 1.0 }; self.stats[4] += 1.0; self.stats[2] += nsub as f64; }
            self.slow_step(h);
            for r in 0..self.nres {
                let i = self.res_idx[r]; let x = self.n[i];
                self.res_min[r] = fmin(self.res_min[r], x);
                if !self.res_watch[r] { continue; }
                if self.res_ok[r] && x < 1.0 { self.res_ok[r] = false; if main { let k = self.n_events; self.events[3 * k] = t + self.dt; self.events[3 * k + 1] = 0.0; self.events[3 * k + 2] = i as f64; self.n_events += 1; } exhausted_now = true; }
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
                    self.rec_meta[4 * k] = path; self.rec_meta[4 * k + 1] = nsub as f64; self.rec_meta[4 * k + 2] = if g.promoted { 1.0 } else { 0.0 }; self.rec_meta[4 * k + 3] = ev;
                    self.n_rec += 1;
                }
                let k = self.n_snap; let nb = self.nb;
                self.snap_t[k] = t + self.dt; self.snap_n[k * nb..(k + 1) * nb].copy_from_slice(&self.n); self.n_snap += 1;
            }
            t += self.dt; step += 1;
        }
        if main {
            self.run_info[0] = path_fv; self.run_info[1] = path_sur; self.run_info[2] = path_shock; self.run_info[3] = path_newton;
            self.run_info[4] = nsub_min; self.run_info[5] = nsub_max;
            for k in 0..8 { self.run_info[6 + k] = g.stats[k]; }
            self.fin_n.copy_from_slice(&self.n); self.fin_lo.copy_from_slice(&self.lo); self.fin_cum.copy_from_slice(&self.cum);
            for r in 0..self.nres { let i = self.res_idx[r]; self.res_out[5 * r] = self.res_start[r]; self.res_out[5 * r + 1] = self.res_min[r]; self.res_out[5 * r + 2] = self.n[i]; self.res_out[5 * r + 3] = if self.res_ok[r] { 1.0 } else { 0.0 }; self.res_out[5 * r + 4] = if self.res_watch[r] { 1.0 } else { 0.0 }; }
        }
    }

    /// 본 실행: N₀ 에서 신호 일정대로, 기록·스냅숏·사건·관문 로그
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
        let h = self.horizon;
        self.run(t0, t0 + h, false, true);
        self.probe_n.copy_from_slice(&self.n);
        true
    }
}
