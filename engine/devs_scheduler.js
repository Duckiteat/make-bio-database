// Phase P3 — Parallel-DEVS 스케줄러 + 경계 엔진 + 원자 모델(T3 영역, T2 규칙 노드). engine/hmse.js 정수 원장 위에서 돈다.
// docs/design/hybrid-multiscale-engine.md §4·§B(불변식 1·4).
//   · 동시 사건: 같은 t_next 의 출력 패킷은 (source, target, species) 로 정렬해 결정론적으로 원장에 적용.
//   · 보수적 동기화: 어떤 모델도 safeTime = min_u(tLast_u + lookahead_u) 를 넘어 진행하지 않음. 과거 시각 사건 = 오류(롤백 금지).
//   · 강성 정체 방지: 노드의 반응 통로 중 a_j·Δt_min > leap_threshold 인 것은 τ-도약(포아송, 큰 수는 CLE)으로 Δt_min 마다 진행.
//   · 원장 거래: 인접 두 원장만 (applyLedgerTx). 버전 충돌이면 다시 읽고 seq 를 올려 결정론적으로 재시도. 나머지는 고정 소수점(1e-9 정수).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hmse.js'), require('./fv_solver.js'));
  else root.DEVS = factory(root.HMSE, root.FV);
})(typeof self !== 'undefined' ? self : this, function (HMSE, FV) {
  'use strict';
  const EPS_T = 1e-12;
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // ===== 경계 엔진: 유속 패킷 → 정수 원장 거래 =====
  function makeBoundaryEngine(handle, opt) {
    const residual = {}, pending = {}, seq = {}, stats = { tx: 0, retries: 0, clamped: 0, committedOut: 0, committedIn: 0 };
    const rand = HMSE.rngOf(opt.seed || 1), mode = opt.mode || 'residual';
    function commit(from, to, items, t, cause) {
      const pk = HMSE.pairKey(from, to);
      for (let attempt = 0; attempt < 8; attempt++) {
        seq[pk] = (seq[pk] || 0) + 1;
        const tx = { from, to, seq: seq[pk], t, items, cause, base_version: { [from]: handle.state.ledgers[from].version, [to]: handle.state.ledgers[to].version } };
        const r = HMSE.applyLedgerTx(handle.state, tx);
        if (r.status === 'committed') { handle.state = r.state; stats.tx++; return r; }
        if (r.status === 'conflict') { stats.retries++; continue; } // 버전을 다시 읽고 결정론적 재시도
        throw new Error(`경계 거래 실패 ${r.status}: ${(r.errors || []).join('; ')}`);
      }
      throw new Error('경계 거래 재시도 한도 초과');
    }
    // packet: { source(영역), target(노드), species, mu_out, mu_in, t }
    function apply(packet) {
      const kOutKey = `${packet.source}>${packet.target}|${packet.species}`, kInKey = `${packet.target}>${packet.source}|${packet.species}`;
      const avOut = handle.state.ledgers[packet.source].counts[packet.species] || 0, avIn = handle.state.ledgers[packet.target].counts[packet.species] || 0;
      const o = HMSE.sampleTransferFixed(packet.mu_out + (pending[kOutKey] || 0), residual[kOutKey] || 0, mode, rand, avOut);
      const i = HMSE.sampleTransferFixed(packet.mu_in + (pending[kInKey] || 0), residual[kInKey] || 0, mode, rand, avIn);
      residual[kOutKey] = o.residualFP; residual[kInKey] = i.residualFP; pending[kOutKey] = o.pending; pending[kInKey] = i.pending;
      stats.clamped += o.pending + i.pending;
      const net = o.k - i.k; // > 0 : 영역 → 노드
      if (net !== 0) commit(packet.source, packet.target, [{ key: packet.species, dn: net }], packet.t, `flux ${packet.source}:${packet.target}`);
      stats.committedOut += o.k; stats.committedIn += i.k;
      return { species: packet.species, source: packet.source, target: packet.target, net, kOut: o.k, kIn: i.k };
    }
    // 버퍼 감사: 나머지는 언제나 [0, 1) 분자, pending 은 보내는 쪽 원장에 그대로 남아 있는 정수(질량이 따로 존재하지 않음)
    function buffers() { const r = Object.values(residual).map((x) => x / HMSE.FP); return { maxResidual: r.length ? Math.max(...r) : 0, pending: Object.values(pending).reduce((a, b) => a + b, 0) }; }
    return { apply, commit, buffers, stats };
  }

  // ===== 스케줄러 =====
  function createScheduler(handle, opt) {
    opt = Object.assign({ checkpointEvery: 1000 }, opt || {});
    const models = new Map(), influencers = new Map(), boundary = makeBoundaryEngine(handle, opt), log = { events: 0, imminentMax: 0, ties: 0, checkpoints: [] };
    function add(model, infl) { models.set(model.id, model); influencers.set(model.id, infl || []); model.tLast = 0; model.tn = model.ta(); }
    const safeTime = (m) => Math.min(...influencers.get(m.id).map((u) => models.get(u).tLast + models.get(u).lookahead), Infinity);
    function run(t_end, hooks) {
      hooks = hooks || {};
      let t = 0;
      for (;;) {
        let tNext = Infinity; for (const m of models.values()) tNext = Math.min(tNext, m.tn);
        if (!(tNext <= t_end + EPS_T) || (hooks.stop && hooks.stop())) break;
        if (tNext < t - EPS_T) throw new Error(`시간 역행 ${tNext} < ${t} — 롤백 금지 위반`);
        t = tNext;
        const imminent = [...models.values()].filter((m) => m.tn <= tNext + EPS_T).sort((a, b) => cmp(a.id, b.id));
        log.imminentMax = Math.max(log.imminentMax, imminent.length); if (imminent.length > 1) log.ties++;
        for (const m of imminent) if (t > safeTime(m) + EPS_T) throw new Error(`보수적 동기화 위반: ${m.id} 가 safeTime ${safeTime(m)} 를 넘어 ${t} 로`);
        // λ: 출력 패킷 수집 → (source, target, species) 결정론적 정렬 → 경계 엔진이 원장에 커밋
        const packets = imminent.flatMap((m) => m.output(t)).sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target) || cmp(a.species, b.species));
        const committed = packets.map((p) => boundary.apply({ ...p, t }));
        // 입력 배달: 거래 결과는 양쪽 모델에
        const inputs = new Map();
        for (const c of committed) for (const id of [c.source, c.target]) { if (!models.has(id)) continue; if (!inputs.has(id)) inputs.set(id, []); inputs.get(id).push(c); } // 모델이 없는 영역(원장만)에는 배달하지 않음
        const touched = new Set([...imminent.map((m) => m.id), ...inputs.keys()]);
        for (const id of [...touched].sort()) {
          const m = models.get(id), inp = inputs.get(id) || [], imm = m.tn <= tNext + EPS_T;
          if (imm && inp.length) m.deltaConf(t, inp); else if (imm) m.deltaInt(t); else m.deltaExt(t, t - m.tLast, inp);
          if (t < m.tLast - EPS_T) throw new Error('모델 시각 역행');
          m.tLast = t; m.tn = t + m.ta();
        }
        log.events++;
        if (hooks.afterEvent) hooks.afterEvent(t, log.events);
      }
      return { t, log, boundary };
    }
    return { add, run, safeTime, models, boundary, log };
  }

  // ===== 원자 모델: Tier 3 영역 (FV, 또는 P4 대리 모델 + OOD 대체) =====
  // cfg: { id, node(인접 노드 id), dt_macro, region(FV.createRegion 결과), D_iface, h_iface_m, nodeVolume_m3, iface_species: [키],
  //        solver?: { mode: 'fv' | 'surrogate', warmup: 단계 수(FV 로 돌며 탐지기 학습 자료 수집), executor(async_fallback_worker), detector 옵션, beforeStep(m, R) 훅 } }
  function regionModel(handle, cfg) {
    const R = cfg.region, A = R.iface.length * R.spec.h_m ** 2, ledger = { get state() { return handle.state; }, set state(v) { handle.state = v; }, domainId: cfg.id, moieties: cfg.moieties };
    const sv = Object.assign({ mode: 'fv', warmup: 200 }, cfg.solver || {});
    const P4 = sv.mode === 'surrogate' ? { FNO: require('./fno_surrogate.js'), OOD: require('./ood_detector.js') } : null;
    const m = { id: cfg.id, lookahead: cfg.dt_macro, steps: 0, lastFlux: {}, pending: null,
      p4: { surrogateSteps: 0, fvSteps: 0, fallbacks: 0, flaggedAt: [], lockWindows: 0, snapshots: [], sur: null, det: null, lastScore: null, maxScore: 0, ready: false } };
    const fvNow = (t) => { // 대체: 실행기(inline 이면 즉시, worker 면 다음 사건에서 join) — 잠금 창 [t, t+Δt]
      if (sv.executor) { m.pending = sv.executor.submit(R, cfg.dt_macro, cfg.id); m.p4.lockWindows++; if (m.pending.done) finishPending(); }
      else FV.step(R, cfg.dt_macro, ledger);
      m.p4.fvSteps++;
    };
    function finishPending() { const r = sv.executor.join(m.pending); m.pending = null; FV.reconcile(R, r.moved, ledger); }
    // 대리 한 단계: 추론 → 같은 단계 안에서 사전(입력)·사후(원 출력) 탐지 — 어느 쪽이든 OOD 면 출력을 버리고 FV (지연 0 단계).
    //   사전 검사를 추론 뒤에 하는 것은 대리 모델이 이미 계산한 입력 스펙트럼을 재사용하기 위해서다 (추가 변환 없음, 판단 시점은 같은 단계).
    function surrogateStep(t) {
      const p = m.p4, backup = Object.fromEntries(Object.entries(R.fields).map(([k, f]) => [k, Float64Array.from(f)]));
      const res = P4.FNO.integrate(p.sur, R), sp = p.sur.lastSpectra;
      const pre = P4.OOD.evaluate(p.det, R, p.sur, 'pre', { fields: backup, E: Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, v.E_in])) });
      const post = pre.ood ? pre : P4.OOD.evaluate(p.det, R, p.sur, 'post', { E: Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, v.E_out])) });
      p.lastScore = Math.max(pre.score, post.score); if (Number.isFinite(p.lastScore) && !pre.ood && !post.ood) p.maxScore = Math.max(p.maxScore, p.lastScore);
      if (!pre.ood && !post.ood) {
        for (const f of Object.values(R.fields)) for (const q of R.active) if (!(f[q] > 0)) f[q] = 0; // 비음수 투영 (재척도는 reconcile 의 anchor)
        FV.reconcile(R, res.moved, ledger); p.surrogateSteps++; return;
      }
      for (const [k, f] of Object.entries(backup)) R.fields[k].set(f); // 대리 출력 폐기
      p.fallbacks++; p.flaggedAt.push({ step: m.steps, t, score: p.lastScore, phase: pre.ood ? 'pre' : 'post', reasons: (pre.ood ? pre : post).reasons, components: (pre.ood ? pre : post).components });
      fvNow(t);
    }
    function stepNow(t) {
      if (sv.beforeStep) sv.beforeStep(m, R);
      if (!P4) { FV.step(R, cfg.dt_macro, ledger); return; }
      const p = m.p4;
      if (!p.ready && m.steps < sv.warmup) { // 학습 단계: FV 로 진행하며 스냅숏 수집
        FV.step(R, cfg.dt_macro, ledger); p.fvSteps++;
        if (m.steps % Math.max(1, Math.floor(sv.warmup / 20)) === 0) for (const f of Object.values(R.fields)) p.snapshots.push(Float64Array.from(f));
        return;
      }
      if (!p.ready) {
        try { p.sur = P4.FNO.createSurrogate(R, cfg.dt_macro); P4.FNO.calibrate(p.sur, R); } catch (e) { p.sur = null; p.unsupported = e.message; }
        p.det = P4.OOD.createDetector(sv.detector); if (p.sur) P4.OOD.train(p.det, p.snapshots, R.n, R.mask);
        p.ready = true; p.snapshots = [];
      }
      if (!p.sur) { p.fallbacks++; fvNow(t); return; } // 분포 밖 모양(구·이류 …): 대리 모델 없이 FV
      surrogateStep(t);
    }
    Object.assign(m, {
      ta: () => cfg.dt_macro,
      output: (t) => {
        if (m.pending) finishPending(); // 비동기 대체 결과를 먼저 합침 (원장 정수화) — 잠금 해제
        return cfg.iface_species.map((sp) => {
          // 지난 거시 단계 동안의 기대 이동 분자 수 (양방향 분리 — 잡음 보존): μ = D·A/h_int · c · Δt
          const cFace = FV.interfaceAmount(R, sp) / (R.iface.length * R.vox_m3), cNode = (handle.state.ledgers[cfg.node].counts[sp] || 0) / cfg.nodeVolume_m3;
          const g = cfg.D_iface * A / cfg.h_iface_m * cfg.dt_macro;
          return { source: cfg.id, target: cfg.node, species: sp, mu_out: g * cFace, mu_in: g * cNode };
        });
      },
      deltaInt: (t) => { stepNow(t); m.steps++; },
      deltaExt: (t, e, inp) => { if (m.pending) finishPending(); for (const c of inp) { FV.applyInterfaceTransfer(R, c.species, c.net); m.lastFlux[c.species] = c.net; } FV.anchor(R, ledger); },
      deltaConf: (t, inp) => { m.deltaExt(t, 0, inp); m.deltaInt(t); },
    });
    return m;
  }

  // ===== 원자 모델: Tier 2 규칙 노드 (SSA + 강성 통로 τ-도약/CLE) =====
  // cfg: { id, reactions: [{ id, reactants: {키: 화학량}, products: {키: 화학량}, k }], dt_min, leap_threshold, seed }
  //   성향 a = k · Π C(n, ν) (분자 수 기반). a·Δt_min > leap_threshold 인 통로는 '빠른 통로'로 Δt_min 마다 τ-도약.
  function nodeModel(handle, cfg) {
    const rand = HMSE.rngOf(cfg.seed || 7), counts = () => handle.state.ledgers[cfg.id].counts;
    const prop = (r) => { let a = r.k; for (const [s, nu] of Object.entries(r.reactants)) { const x = counts()[s] || 0; for (let i = 0; i < nu; i++) a *= Math.max(x - i, 0); } return a; };
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
    const m = { id: cfg.id, lookahead: cfg.dt_min, stats: { ssa: 0, leaps: 0, cle: 0, fastChannels: new Set() }, nextSlow: null, lastLeap: 0 };
    function fire(r, times) {
      if (times <= 0) return 0;
      // 실현 가능성: 반응물 수로 자름 (정수 — 원장이 음수가 되지 않게)
      for (const [s, nu] of Object.entries(r.reactants)) times = Math.min(times, Math.floor((counts()[s] || 0) / nu));
      if (times <= 0) return 0;
      const deltas = {};
      for (const [s, nu] of Object.entries(r.reactants)) deltas[s] = (deltas[s] || 0) - nu * times;
      for (const [s, nu] of Object.entries(r.products)) deltas[s] = (deltas[s] || 0) + nu * times;
      const res = HMSE.applyLocalTx(handle.state, { domain: cfg.id, base_version: handle.state.ledgers[cfg.id].version, deltas, cause: r.id }, cfg.moieties);
      if (res.status !== 'committed') throw new Error(`노드 반응 거래 실패: ${res.status} ${res.errors || ''}`);
      handle.state = res.state;
      return times;
    }
    const isFast = (r) => prop(r) * cfg.dt_min > cfg.leap_threshold;
    function schedule(t) {
      const slow = cfg.reactions.filter((r) => !isFast(r)), a0 = slow.reduce((a, r) => a + prop(r), 0);
      const tau = a0 > 0 ? -Math.log(Math.max(rand(), 1e-300)) / a0 : Infinity;
      m.nextSlow = t + tau;
    }
    m.ta = () => Math.max(Math.min((m.nextSlow == null ? 0 : m.nextSlow) - (m.tLast || 0), cfg.dt_min), 0) || cfg.dt_min; // Δt_min 하한·상한 — 시간축이 멈추지 않음
    function advance(t) {
      // 빠른 통로: 지난 도약 이후 경과 시간을 적응 τ-도약으로 진행. τ ≤ ε / max_j(k_eff,j), k_eff = a_j / (가장 적은 반응물 수)
      //   → 한 도약에 어떤 반응물도 ε(기본 3%) 넘게 바뀌지 않음 (k·τ ≥ 1 이면 과도·진동). 성향은 도약 시작에 한꺼번에 계산(동시 갱신).
      let rem = t - m.lastLeap;
      const eps = cfg.leap_epsilon || 0.03;
      while (rem > EPS_T) {
        const fast = cfg.reactions.filter(isFast); // 도약마다 다시 판정 — 성향이 바뀌면(역반응이 커지면) 빠른 통로 집합도 바뀜
        if (!fast.length) break;
        const a = fast.map(prop);
        let kmax = 0; fast.forEach((r, j) => { const xmin = Math.min(...Object.keys(r.reactants).map((sp) => counts()[sp] || 0)); if (xmin > 0) kmax = Math.max(kmax, a[j] / xmin); });
        const tau = Math.min(rem, kmax > 0 ? eps / kmax : rem);
        const K = a.map((aj) => { const mu = aj * tau; if (mu > 1000) m.stats.cle++; return mu > 1000 ? Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss())) : HMSE.poisson(rand, mu); });
        fast.forEach((r, j) => { m.stats.fastChannels.add(r.id); fire(r, K[j]); });
        m.stats.leaps++; rem -= tau;
      }
      m.lastLeap = t;
      // 느린 통로: 예정 시각이 됐으면 한 번 (SSA 직접법)
      if (m.nextSlow != null && t + EPS_T >= m.nextSlow) {
        const slow = cfg.reactions.filter((r) => !isFast(r)), a = slow.map(prop), a0 = a.reduce((x, y) => x + y, 0);
        if (a0 > 0) { let u = rand() * a0, j = 0; while (j < a.length - 1 && u > a[j]) { u -= a[j]; j++; } if (fire(slow[j], 1)) m.stats.ssa++; }
      }
      schedule(t);
    }
    m.output = () => [];
    m.deltaInt = (t) => advance(t);
    m.deltaExt = (t) => { advance(t); }; // 경계 거래로 수가 바뀌면 성향이 바뀌므로 다시 예정
    m.deltaConf = (t) => advance(t);
    schedule(0);
    return m;
  }

  return { createScheduler, makeBoundaryEngine, regionModel, nodeModel };
});
