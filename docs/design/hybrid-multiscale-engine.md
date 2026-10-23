# Hybrid Multi-Scale Simulation Engine — 3-Tier Architecture & Specification (format v8)

> Status (2026-10-08): **format v8 implemented** (data fields, thermodynamic checks, migration 007), **runtime reference layer implemented** (`engine/hmse.js`: integer ledger + adjacent boundary transactions, transfer sampling, domain score/hysteresis, conservative projection, integer distribution), **interfaces specified** (`engine/interfaces/hmse.hpp`, `engine/interfaces/hmse.py`), wire schemas `schemas/v8/*.schema.json`. **P3 implemented**: Parallel-DEVS scheduler (`engine/devs_scheduler.js`), 3D FV solver (`engine/fv_solver.js`), τ-leap/CLE for stiff channels, end-to-end test (`tests/p3_end_to_end.js`). **P4 implemented**: spectral neural-operator surrogate (`engine/fno_surrogate.js`), OOD/stability detector (`engine/ood_detector.js`), conservative async FV fallback (`engine/async_fallback_worker.js`, inline or `worker_threads`), tests `tests/p4_end_to_end.js`, `tests/p4_benchmark.js`. **P5 implemented**: dynamic promotion/demotion gate (`engine/p5_dynamic_gate.js`: O(1) stiffness N_sub, hysteresis K_up 15 / K_down 8 / M 5, O(N) shock pre-filter γ, forced demotion + W 20 cool-down, exact transition anchoring), closed-form spectral gains (`fno_surrogate.analyticGains`), test `tests/p5_dynamic_promotion.js`. **Not implemented**: GPR elevation, deep/nonlinear FNO layers.
> Terms in `[brackets]` are existing v7 concepts that are reused.

## A. Three tiers

| Tier | Scope | State | Solver | Existing anchor |
|---|---|---|---|---|
| **T1 Thermodynamic potential field & continuous clearing** | environment (pH, ionic strength, ε_r) + high-copy metabolites (ATP, NAD⁺, CO₂ …) | continuous fields per domain (compartment-level today, voxel-level with T3) | rate laws with local k(r), D(r); **CLE** above `cle_threshold` copies (avoids SSA stalling on stiff fast reactions) | sense `tier: "T1"`, obs `pH`/`ionic_strength`/`relative_permittivity`/`diffusion_coefficient`, kinetics `k0`/`dG_act`/`dG0`/`env`, `rateAt` |
| **T2 Discrete contextual network** | multi-site proteins, complexes (PKA, Myddosome) | rule agents with site:feature state [bundle keys] | network-free rule evaluation + Parallel-DEVS events (SSA per node) | sense `tier: "T2"`, [transition rules, steps] |
| **T3 3D spatial core** | domains with steep gradients / active transport | voxel grid C ∈ R^{S×n³} + integer ledger | FNO/DeepONet surrogate, O(N log N) per macro-step; async 3D FV fallback when error > ε_max | domain config `tier: "T3"`, `geometry_template`, `grid` |

T1 rate law (transition-state theory, environment-shifted barrier):
  **k(r) = k₀ · exp(−(ΔG‡ + ΔG_env(pH(r), ε(r))) / RT)**, ΔG_env = (∂G/∂pH)(pH − pH_ref) + (∂G/∂ε⁻¹)(1/ε − 1/ε_ref), T_ref = 310.15 K.
Reverse constant is never independent: **k_r(r) = k_f(r) · exp(ΔG°/RT)** — the environment moves the barrier, not the equilibrium (Invariant 5). `rateAt` implements both; `simulateRate` applies them per compartment using scenario `environment` or location obs.

## B. Core invariants (normative)

| # | Invariant | Mechanism | Where enforced now |
|---|---|---|---|
| 1 | **Integer mass ledger is ground truth**; inter-tier exchange = integer stochastic sampling with remainder carry-forward; mutations isolated to **adjacent boundary pairs** | `applyLedgerTx`: touches only `ledgers[from]`, `ledgers[to]`; optimistic per-ledger versions (CONFLICT → re-read/retry), idempotent per (pair, seq), integer `dn` only, fractional remainder |r|<1 and clamped `pending` carried | `engine/hmse.js`, `hmse.py DictIntegerLedger`, tests (1000 random tx conserve totals) |
| 2 | **Promotion/demotion score with flapping control**: S = w₁·⟨|∇²C|⟩ + w₂·∂S_spatial/∂t, hysteresis τ_low < τ_high, dwell ≥ t_min, GPR smoothing on elevation | `domainScore`, `decideTransition`, `conservativeProject`, `distributeCounts` | engine + tests (alternating score never flips within t_min) |
| 3 | **FNO OOD guard**: promoted boundaries are mapped to canonical templates {box, slab, sphere, spherical_shell, cylinder}; non-template geometry is never sent to the surrogate | `DomainManager.normalizeGeometry`, `SurrogateSolver.inDistribution`; domain config requires `geometry_template` for T3 | schema + `validateDomainConfig` |
| 4 | **Conservative, rollback-free DEVS; async fallback** | no event beyond safeTime = min_u(tLast_u + lookahead_u); a failing T3 step is re-solved by FV on a worker, its region's lookahead becomes the fallback's committed window (≥ `window_min_s`), other models advance up to that window | interfaces (`DEVSScheduler.scheduleFallback`) — implementation P3 |
| 5 | **Thermodynamic consistency**: microscopic reversibility per rule (k/k_r = e^{−ΔG°/RT}), ΣΔG° = 0 over closed loops (Wegscheider) | `thermoIssues` (validate), `thermoLoops` + `AUDIT_THERMO` (audit-run), `rateAt` derives k_r from ΔG° | core + tests |

## 0. Scope, reuse, and claim corrections

| Requirement | v7 asset reused | Correction / constraint |
|---|---|---|
| Network-free rule engine | [bundle key `D|site:feature|loc`] = species *pattern*, never an enumerated state; [rule] = transition on site features; [moieties] + entity ledger = conservation | Cost per event is O(R·m) (R rules, m local matches), **not O(1)**; it removes the O(2^N) *pre-generation*, not per-event matching cost |
| FNO / DeepONet surrogate | [R0/R1/R2 resolution] → add **R3 spatial** tier | Inference is O(N log N) per macro-step on an N-voxel grid (FFT), constant w.r.t. *physical time span inside the step*, not O(1) in N. Surrogates are **not conservative by construction** → mandatory projection (§2.3) + error estimator + fallback solver |
| Strict conservation across the interface | [entity ledger, moiety audit every Δt, AUDIT_MASS] | Exact conservation is enforced by **integer ledger accounting**; the continuous field is projected to match the ledger, never the reverse |
| Domain promotion/demotion | [T1–T3 resolution thresholds, `resolutionPlan`] | Add spatial thresholds τ_high/τ_low with hysteresis + dwell time; promotion also requires copy number ≥ N_min (otherwise particle/stochastic, not continuum) |
| DEVS scheduler | [`simulateRate` fixed-Δt loop] | Replaced by Parallel-DEVS coordinator with **conservative lookahead** (no rollback: rollback would have to undo ledger entries) |

## 1. End-to-End Architecture

```
                         ┌──────────────────────── DEVSScheduler (Parallel DEVS root coordinator) ───────────────────────┐
                         │  event queue (t, prio, seq) · lookahead table · global ledger clock · checkpoint barrier     │
                         └───────▲───────────────────────▲────────────────────────▲─────────────────────▲───────────────┘
                     ta/δint/λ   │           ta/δint/λ   │               ta/δext  │              δext   │
┌────────────────────────────────┴───┐  ┌────────────────┴───────────────┐  ┌──────┴─────────────────┐  ┌─┴──────────────────────┐
│ SpatialRegion[k] (atomic, R3)      │  │ GraphNode[j] (atomic, R0–R2)    │  │ BoundaryEngine         │  │ DomainManager          │
│  grid C_k ∈ R^{S×n³}               │  │  rule-based NFSim-style agents   │  │  flux integration      │  │  metric M_k every Δt_m │
│  SurrogateClient → FNO/DeepONet    │  │  site:feature patterns (bundles) │  │  discretization (int)  │  │  promote / demote      │
│  ConservativeProjector             │  │  Gillespie / τ-leap per node     │  │  noise injection       │  │  hysteresis + dwell    │
│  ErrorEstimator → FallbackSolver   │  │  Ledger (integer counts)         │  │  ledger reconciliation │  │  StateElevator (GPR)   │
└──────────┬─────────────────────────┘  └──────────────┬──────────────────┘  └──────────▲─────────────┘  └───────────▲────────────┘
           │ BoundaryFluxPacket (Φ, Var, seq)          │ DiscreteTransferPacket        │                         │
           └────────────────────────────►──────────────┴──────────────────────────────┘     RegionMetrics ───────┘
                                     ▼
                     ConservationAuditor (moiety matrix · entity ledger · probability mass) → AUDIT_MASS / limitations
```

**Data flow per macro-interval [t_n, t_n+Δt_macro]**
1. `SpatialRegion.δint`: surrogate advances `C_k` by Δt_macro (internally Δt_spatial ≪ Δt_macro), reactions inside region via operator splitting (reaction kernel = v7 rate laws on voxels).
2. `ConservativeProjector` corrects `C_k` to the region ledger; `ErrorEstimator` checks residual → if > ε_sur, recompute step with `FallbackSolver` (FV/FFT diffusion) and log a surrogate-miss.
3. `λ` emits `BoundaryFluxPacket` per interface face set Γ_kj (time-integrated flux + variance).
4. `BoundaryEngine` converts to integer molecule transfers (§2.4), posts `DiscreteTransferPacket` as external events to graph nodes (δext) and debits the region ledger.
5. `GraphNode` executes rule events (stochastic SSA/τ-leap) between external events; outbound transfers go back via BoundaryEngine into region source terms.
6. `DomainManager` (periodic atomic, period Δt_m) evaluates metrics, issues `PromotionEvent`/`DemotionEvent`; elevation/collapse happen at a **checkpoint barrier** (all models at same t).
7. `ConservationAuditor` verifies invariants at every barrier and every packet; violation → halt + post-mortem [v7 AUDIT_MASS semantics].

## 2. Mathematical Formulation

### 2.1 Region metric (promotion/demotion)

**Normative v8 score (Invariant 2, implemented in `domainScore`)**: S = w₁·⟨|∇²C|⟩·h²/C̄ + w₂·|∂S_spatial/∂t|, S_spatial = normalized Shannon entropy of the voxel distribution (1 = uniform). The terms below (variance, Damköhler, flux steadiness) are optional diagnostics recorded in `DomainMetrics`; the decision uses S with hysteresis and t_min.

Region Ω_k (coarse block, n³ voxels, voxel size h), species s with field C_s, mean C̄_s, copy number N_s = N_A Σ C_s h³.

| Term | Definition | Meaning |
|---|---|---|
| Normalized variance | V_s = Var_Ω(C_s) / (C̄_s² + ε) | heterogeneity |
| Curvature energy | L_s = h⁴ ⟨(∇²C_s)²⟩_Ω / (C̄_s² + ε) | active diffusion fronts (∇²C ≠ 0 ⇒ ∂C/∂t ≠ 0 from diffusion) |
| Spatial entropy deficit | H_s = 1 − (−Σ_i p_i ln p_i)/ln(n³), p_i = C_{s,i}/Σ C_s | 0 = uniform (well-mixed) |
| Damköhler | Da_s = (ℓ²/D_s) / τ_rxn,s, τ_rxn = N_s / |R_s| | Da ≫ 1 ⇒ reaction faster than mixing ⇒ well-mixed assumption invalid |
| Flux steadiness | F_k = ‖Φ_k(t) − Φ_k(t−Δt_m)‖ / (‖Φ_k‖ + ε) | boundary flux steady state |

Score: **M_k = max_s [ w_V V_s + w_L L_s + w_H H_s + w_D log(1+Da_s) ]**, s over species with N_s ≥ N_min (continuum validity, default N_min = 10³; below → stay discrete).

- **Promote** graph node j → region if M_k ≥ τ_high for ≥ d_up consecutive evaluations (and node volume ≥ (n h)³).
- **Demote** region k → node if M_k ≤ τ_low **and** F_k ≤ τ_flux **and** ∀s |dN_s/dt| ≤ ε_N, for ≥ d_down evaluations. Hysteresis τ_low < τ_high (default τ_low = 0.25 τ_high), d_down > d_up.
- Thresholds are per-model parameters; their calibration data are a registered gap (§6).

### 2.2 Invariants (conservation)
Let n ∈ Z^E be integer entity counts over the whole system (graph nodes + regions, regions counted by ledger L_k ∈ Z^E), A ∈ Z^{M×E} the moiety matrix [v7 `moieties`].

1. **Particle/entity**: n(t) = n(0) + Σ created − Σ destroyed (degradation, supply) — exact integer equality.
2. **Moiety**: A·n(t) = A·n(0) + Σ_channels Δ_c (covalent, source, lost, recycle) [v7 channels].
3. **Region–field consistency**: N_A h³ Σ_i C_{s,i} = L_{k,s} (to float tolerance after projection).
4. **Probability**: for each stochastic node, Σ_x P(x,t) = 1 is preserved by construction (SSA samples trajectories); at elevation/collapse, sampling is exact multinomial ⇒ distribution of counts is preserved in expectation and variance.

### 2.3 Conservative projection of surrogate output
Surrogate gives Ĉ. Target total T_s = L_{k,s}/(N_A h³). Positivity-preserving multiplicative-additive correction:
- if Σ Ĉ⁺ > 0: C_s = Ĉ⁺_s · (T_s / Σ Ĉ⁺_s) where Ĉ⁺ = max(Ĉ, 0)  (preserves shape, exact total, non-negative)
- error estimator: e_k = ‖Ĉ − Ĉ⁺‖₁/T + |Σ Ĉ − T|/T + ‖R(Ĉ)‖ (PDE residual on a coarse stencil); e_k > ε_sur ⇒ fallback.
- Boundary-consistent variant: projection weights w_i = 1 for interior voxels, 0 on Γ-adjacent voxels when the boundary flux for that interval is already committed (prevents double counting).

### 2.4 Boundary flux mapping (continuous → discrete)
Face set Γ_kj, outward normal ν, interval [t_n, t_{n+1}]:
- Mean transfer (molecules): μ_s = N_A ∫_{t_n}^{t_{n+1}} ∫_Γ (−D_s ∇C_s · ν + v C_s·ν) dA dt
- Split by direction: μ⁺ (region→node), μ⁻ (node→region) from the positive/negative parts of the integrand (keeps bidirectional noise; net-only would suppress fluctuations).
- **Stochastic discretization**: K⁺ ~ Poisson(μ⁺ + r⁺), K⁻ ~ Poisson(μ⁻ + r⁻) where r = carried residual from §2.5 when deterministic mode is used; in high-count regime (μ > 10³) use K ≈ round(μ + √μ ξ), ξ ~ N(0,1) (chemical Langevin limit).
- Feasibility clamp: K⁺ ≤ L_{k,s}, K⁻ ≤ n_{j,s}; clamped excess is not lost — it is re-queued as r and reported (`clamped` field).
- Ledger update (atomic): L_k −= K⁺ − K⁻ ; n_j += K⁺ − K⁻ ; field gets source term −(K⁺−K⁻)/(N_A h³) distributed over Γ-adjacent voxels by the same weights used to compute μ.

### 2.5 Residual carry (deterministic mode)
r_{s}(t_{n+1}) = r_s(t_n) + μ_s − K_s with K_s = floor(μ_s + r_s(t_n)) ⇒ |Σ_n μ_s − Σ_n K_s| < 1 for all time (bounded discretization error; nothing leaks).

### 2.6 Discrete-node transition with boundary noise
For a rule ρ in node j whose rate depends on boundary concentration C_Γ: hazard a_ρ = k_ρ · h_ρ(x_j, C_Γ). C_Γ is not deterministic: use the boundary packet's variance σ²_Γ, draw C̃_Γ ~ LogNormal(m, s²) matched to (C_Γ, σ²_Γ) once per macro-interval (keeps C̃ > 0), then run SSA with a_ρ(C̃_Γ). This propagates field fluctuations into discrete transitions instead of averaging them away.

### 2.7 State elevation (node → 3D field)
Given node j with integer counts n_{j,s} and context (neighbor boundary values b on Γ, source sites x_q from bundles with location/face):
- **Constrained GPR**: prior f ~ GP(m(x), k_Matérn-5/2(ℓ_s = √(D_s τ_rxn,s))). Observations: boundary values b (Dirichlet points), integral constraint ∫_Ω f = n_{j,s}/N_A (linear functional). Posterior mean μ* = m + K_{*O}(K_{OO}+Σ)^{-1}(y − m_O) with O including the integral functional (its kernel rows are ∫k(x,·)dx). Positivity: fit log-GP on C+ε, then re-project with §2.3.
- **Inverse diffusion alternative**: find C₀ minimizing ‖G_τ * C₀ − C_obs‖² + α‖∇C₀‖² s.t. Σ C₀ = T, C₀ ≥ 0 (projected gradient), G_τ heat kernel with τ = time since last spatial snapshot.
- **Counts → field consistency**: elevation never invents mass — the integral constraint pins Σ C to the ledger; sampled realisations (for stochastic mode) use multinomial(n_{j,s}, p_i ∝ μ*_i).
- **Collapse (demotion)**: n_{j,s} = L_{k,s} (exact); site/feature distribution of rule agents is kept from the region's agent pool (agents carry site:feature state through both tiers — the field only holds unmodified/abundant species; modified states stay as agents) [v7 bundle keys preserved].

## 2.8 Async fallback timeline (Invariant 4)
1. T3 region k emits surrogate step [t, t+Δ]; `errorEstimate` > ε_max or `inDistribution` false → step is **not committed**.
2. Scheduler sets lookahead_k := w = max(window_min_s, Δ) and posts an FV job (worker thread) for [t, t+w]; boundary packets from k for that window are produced only when the job completes.
3. All other models continue while their safeTime allows (influencers of k see lookahead_k, so they advance up to t+w without waiting). No model ever receives a packet with timestamp < its tLast → no rollback.
4. If the job exceeds wall-clock budget, w is shrunk for the next window (dynamic conservative window); the ledger is untouched until commit, so failure costs time, never mass.

## 3. Data Structures & Interfaces

**v8 artefacts**: JSON Schemas `schemas/v8/{ledger-transaction, boundary-flux-packet, domain-config, domain-metrics}.schema.json` (canonical wire form, mirrors the proto below); C++20 `engine/interfaces/hmse.hpp` (`IntegerLedger`, `ThermodynamicField`, `SpatialSolver`/`SurrogateSolver`/`FiniteVolumeSolver`, `DomainManager`, `BoundaryEngine`, `AtomicModel`, `DEVSScheduler`); Python `engine/interfaces/hmse.py` (same ABCs + `DictIntegerLedger` reference, `--selftest`).


### 3.1 Protocol Buffers
```proto
syntax = "proto3";
package hmse.v1;

message SpeciesKey { string bundle = 1; }          // v7 bundle key "D…|site:feature|loc"
message Interval { double t0 = 1; double t1 = 2; }

message BoundaryFluxPacket {
  string region_id = 1;  string node_id = 2;  string face_set = 3;   // Γ_kj
  Interval interval = 4;  uint64 seq = 5;                          // per (region,node) monotone
  repeated SpeciesFlux flux = 6;
  bytes rng_state = 7;                                             // reproducibility of K sampling
  LedgerDigest digest = 8;                                         // sender ledger after debit
  enum Mode { STOCHASTIC = 0; DETERMINISTIC_RESIDUAL = 1; } Mode mode = 9;
}
message SpeciesFlux {
  SpeciesKey key = 1;
  double mu_out = 2; double mu_in = 3;        // expected molecules region→node / node→region
  double var_c_boundary = 4;                  // σ²_Γ for §2.6
  int64 k_out = 5;  int64 k_in = 6;           // committed integer transfers
  double residual = 7;  int64 clamped = 8;
}
message DiscreteTransferPacket { string node_id = 1; double t = 2; uint64 seq = 3; repeated SpeciesDelta delta = 4; string cause_packet = 5; }
message SpeciesDelta { SpeciesKey key = 1; int64 dn = 2; }
message LedgerDigest { int64 total_entities = 1; repeated MoietyTotal moiety = 2; fixed64 hash = 3; }
message MoietyTotal { string moiety_id = 1; int64 count = 2; }
message RegionMetrics { string region_id = 1; double t = 2; double score = 3; repeated double v = 4; repeated double l = 5; repeated double h = 6; repeated double da = 7; double flux_steadiness = 8; }
message DomainTransition { enum Kind { PROMOTE = 0; DEMOTE = 1; } Kind kind = 1; string id = 2; double t = 3; double score = 4; string elevation_method = 5; LedgerDigest before = 6; LedgerDigest after = 7; }
```
JSON wire form = proto3 canonical JSON (int64 as strings). Every packet is idempotent by `(region_id,node_id,seq)`.

### 3.2 Class specifications
```text
class DomainManager
  state: regions: Map<RegionId, SpatialRegion>, nodes: Map<NodeId, GraphNode>, history: Map<Id, MetricWindow>
  params: τ_high, τ_low, τ_flux, ε_N, d_up, d_down, N_min, Δt_m, weights w
  computeMetrics(region) -> RegionMetrics                      // §2.1, O(n³) per region (FFT Laplacian)
  candidateFromNode(node) -> RegionMetrics                     // proxy: Da from rules + boundary gradients
  decide(t) -> List<DomainTransition>                          // hysteresis + dwell; never both ways in one barrier
  promote(nodeId, t) / demote(regionId, t)                     // executed only inside Scheduler.barrier()
  invariant: every voxel and every agent belongs to exactly one domain; ledger digest unchanged by transitions

class BoundaryEngine
  state: residual: Map<(Face,Species), double>, seq: Map<(RegionId,NodeId), uint64>, rng: PCG64 per face
  integrate(region, Γ, interval) -> BoundaryFluxPacket          // §2.4 (μ±, σ²)
  discretize(packet) -> (packet with k_out/k_in), DiscreteTransferPacket   // Poisson / CLE / residual
  commit(packet)                                                // atomic: region ledger, node counts, field source term
  reconcile(digestA, digestB) -> ok | AUDIT_MASS                // exact integer comparison
  invariant: Σ committed k (both sides) equal; |Σμ − Σk| < 1 in residual mode

class DEVSScheduler  (Parallel DEVS, conservative)
  state: fel: PriorityQueue<(t, prio, seq, ModelId)>, lookahead: Map<ModelId, double>, tNext, tLast
  models: AtomicModel { ta(): double; δint(); δext(e, inputs); δconf(inputs); λ(): Outputs }
  run(t_end, untilDeath=false)
  safeTime(model) = min over upstream influencers (tLast_u + lookahead_u)       // Chandy–Misra–Bryant bound
  barrier(t)                                                    // align all models at t: transitions, checkpoints, audit
  priorities: barrier > boundary commit > region step > node event   (ties broken by seq → deterministic replay)
  invariant: no model processes an event with timestamp > safeTime (no rollback); audit at every barrier

AtomicModel implementations:
  SpatialRegion: ta = Δt_macro (≥ Δt_spatial·m); δint = surrogate step + projection; λ = BoundaryFluxPacket[]
  GraphNode:     ta = next SSA reaction time (or next external-event horizon); δext = apply DiscreteTransferPacket
  DomainManager: ta = Δt_m; λ = DomainTransition[] → scheduler opens barrier
```

## 4. Pseudocode

### 4.1 Scheduler main loop
```text
function run(t_end, untilDeath):
  for m in models: fel.push(m.tLast + m.ta(), prio(m), nextSeq(), m)
  while fel.nonEmpty() and fel.peek().t <= t_end:
    t = fel.peek().t
    imminent = fel.popAll(t)                                     // Parallel DEVS bag
    for m in imminent: assert t <= safeTime(m)                   // conservative sync
    outputs = [ (m, m.λ()) for m in imminent ]
    inputs  = route(outputs)                                     // couplings: region→BoundaryEngine→node, DM→scheduler
    for m in imminent ∪ receivers(inputs):
      if m in imminent and m has inputs: m.δconf(inputs[m])
      elif m in imminent:                 m.δint()
      else:                               m.δext(t - m.tLast, inputs[m])
      m.tLast = t; fel.push(t + m.ta(), prio(m), nextSeq(), m)
    if any DomainTransition in outputs or t >= nextCheckpoint: barrier(t)
    if untilDeath and Auditor.dead(): break                      // v7 post-mortem semantics
  return Auditor.postMortem()
```

### 4.2 Promotion / demotion loop (inside barrier)
```text
function barrier(t):
  for m in models: m.advanceTo(t)                                // regions: partial step via fallback solver; nodes: SSA up to t
  before = Ledger.digest()
  for tr in DomainManager.decide(t):
    if tr.kind == PROMOTE:
      node = nodes[tr.id]
      region = SpatialRegion.allocate(node.volume, h)
      for s in node.continuumSpecies(N_min):                    // abundant, unmodified species only
        C = StateElevator.gpr(node.n[s], boundaryValues(node, s), sources(node, s))   // §2.7
        C = Projector.project(C, total = node.n[s])             // exact ledger match
        region.field[s] = C; region.ledger[s] = node.n[s]; node.n[s] = 0
      region.agents = node.agents                                 // modified site:feature states stay agents
      rewireBoundaries(node → region); nodes.remove(node); regions.add(region)
    else:  // DEMOTE
      region = regions[tr.id]
      node = GraphNode.from(region.volume)
      for s in region.species: node.n[s] = region.ledger[s]     // exact, no rounding (ledger is integer)
      node.agents = region.agents
      rewireBoundaries(region → node); BoundaryEngine.flushResidual(region)  // residual r carried to node-level faces
      regions.remove(region); nodes.add(node)
  after = Ledger.digest()
  assert after == before          else AUDIT_MASS("transition leak", tr) and halt
  Auditor.checkInvariants(t)      // §2.2 (1)–(3)
  Checkpoint.save(t)
```

### 4.3 Asynchronous boundary event handling
```text
function SpatialRegion.λ():
  packets = []
  for (node, Γ) in faces:
    p = BoundaryEngine.integrate(self, Γ, [tLast, tLast + Δt_macro])
    packets.append(p)
  return packets

function BoundaryEngine.onPacket(p):                              // routed by scheduler at time p.interval.t1
  if seen(p.region_id, p.node_id, p.seq): return                  // idempotent
  for f in p.flux:
    key = (p.face_set, f.key)
    if p.mode == STOCHASTIC:
      kOut = poisson(rng[key], f.mu_out); kIn = poisson(rng[key], f.mu_in)
    else:
      kOut = floor(f.mu_out + residual[key].out); residual[key].out += f.mu_out - kOut
      kIn  = floor(f.mu_in  + residual[key].in);  residual[key].in  += f.mu_in  - kIn
    kOut = min(kOut, region.ledger[f.key]); kIn = min(kIn, node.n[f.key])        // feasibility; excess → clamped
    f.clamped = (requested - committed); f.k_out = kOut; f.k_in = kIn
  atomically:
    region.ledger -= (kOut - kIn); node.n += (kOut - kIn)
    region.addBoundarySource(Γ, -(kOut - kIn) / (N_A h³))
  emit DiscreteTransferPacket(node, t = p.interval.t1, delta = kOut - kIn) as external event to node
  node.setBoundaryNoise(f.key, mean = Cboundary, var = f.var_c_boundary)          // §2.6
  reconcile(region.digest(), node.digest())
```

## 5. Integration plan with this repository

| Phase | Deliverable | Where |
|---|---|---|
| P1 | Spec (this file) + gap registration once data fields exist | `docs/design/` |
| P2 ✅ | Format v8 (migration 007): sense `tier` (T1/T2), obs `diffusion_coefficient`/`pH`/`ionic_strength`/`relative_permittivity`, kinetics `k0`/`dG_act`/`dG0`/`env`, microscopic-reversibility + Wegscheider checks, env-aware rates; runtime ledger/transfer/score layer + schemas + interfaces | `vocab.js`, `core.js`, `engine/`, `schemas/v8/` |
| P3 ✅ | Parallel-DEVS coordinator (deterministic (source, target, species) packet order, safeTime check, time-reversal = error), BoundaryEngine (fixed-point 1e-9 remainders, pending carry, version-retry ABT), T3 region model on masked FV (central-difference diffusion, MUSCL/minmod-limited advection, first-order reactions, ledger-anchored rescaling, integer reaction reconciliation via moiety-checked local tx), T2 node model (SSA + adaptive τ-leap ε=0.03, CLE when μ>10³, Δt_min floor). 10⁴-step test: |ΔN| = 0 | `engine/devs_scheduler.js`, `engine/fv_solver.js`, `tests/p3_end_to_end.js` |

**P3 measured (hypothetical scenario, residual mode)**: 10,000 region steps (t = 10 s), ~45k DEVS events (~6k simultaneous), ~3.4k ABT commits, 0 retries; N_initial = N_final = 20500 (A 20000, R 500); worst |∫C dΩ − N_ledger| ≈ 5e-12; max residual < 1, pending 0; steady state reproduces k-ratios (Ax/A ≈ 1.25, B/A ≈ 2.5) and, with zero advection, equal region/interface/node concentrations (≤ 3 %).

| P4 ✅ | Surrogate = one linear FNO layer in the cosine basis: per-mode gain g_s(k) **learned by least squares from P3 FV trajectories** (on a closed box the FV Laplacian is exactly DCT-II-diagonal, so the learned operator reproduces FV diffusion to ~1e-16), Strang-split exact matrix exponential for first-order reaction pairs, Makhoul DCT via radix-2 FFT → O(N log N) per macro-step, independent of Δt. Mass operator: max(0,·) → rescale to N_ledger (uniform integer distribution if ∫ = 0). OOD: S = w₁E_spec/E_ref + w₂V_grad/V_ref + w₃ΔG_drift/ln1.1, τ = 1, refs = 1.5 × max over warmup FV snapshots; hard OOD for non-box template, advection, overlapping reaction pairs, non-finite or >1 % negative output. Pre- and post-checks happen in the same step (pre reuses the surrogate's input spectrum) → latency 0 steps. Fallback: inline FV or worker thread on SharedArrayBuffer, joined (Atomics.wait) at the region's next event; region lookahead window [t, t+Δt] locks influencers, ledger reconciled only at join | `engine/fno_surrogate.js`, `engine/ood_detector.js`, `engine/async_fallback_worker.js` |

**P4 measured** (`node tests/p4_benchmark.js`; JS single thread; same initial field, L2 after K steps):

| n (N) | Δt | FV substeps | FV ms/step | surrogate+detector ms/step | speedup | rel. L2 |
|---|---|---|---|---|---|---|
| 16 (4096) | 1e-3 | 2 | 0.84 | 2.60 | 0.3× | 3.6e-4 |
| 16 | 1e-2 | 16 | 9.1 | 2.0 | 4.5× | 7.9e-4 |
| 16 | 5e-2 | 76 | 25.4 | 1.7 | **15.3×** | 8.6e-4 |
| 16 | 2e-1 | 301 | 90.2 | 1.6 | **55.8×** | 8.7e-4 |
| 32 (32768) | 1e-3 | 2 | 5.1 | 16.2 | 0.3× | 8.1e-5 |
| 32 | 5e-2 | 76 | 189 | 16.8 | **11.2×** | 7.8e-4 |
| 32 | 2e-1 | 301 | 812 | 20.4 | **39.8×** | 2.5e-3 |

Reading: the ≥10× target holds where FV is stability-limited (substeps ≳ 70, i.e. D·Δt/h² ≳ 12); at FV's non-stiff point (2 substeps) the surrogate is ~3× *slower* in JS (4 DCTs + checks vs 2 explicit sweeps). FV cost per macro-step is O(N·n_sub) with n_sub ∝ DΔt/h² (not O(N³)); surrogate cost is flat in Δt and scales N log N (n 16→32: ~8–10×).
End-to-end (`tests/p4_end_to_end.js`, 10⁴ steps, Δt 1e-3): |ΔN| = 0; 9,780 surrogate / 220 FV steps (200 warmup + 20 fallback); Dirac shock at step 5000 flagged in the same step (S_ood ≈ 1.4×10³), surrogate resumes after 20 FV steps; 0 false positives before the shock (in-distribution S_ood ≈ 0.03); worker and inline fallbacks give identical ledgers.

**P4 scope (honest)**: the surrogate's distribution is *linear* physics — box geometry, no advection, first-order reaction pairs. Inside it, a single learned spectral layer is exact up to splitting error, so no deep network was trained; nonlinear kinetics, advection and other templates are OOD by construction and run on FV. A deep/nonlinear FNO (P5) would plug into the same `createSurrogate/calibrate/integrate` interface and detector.

| P5 ✅ | Dynamic gate per macro-step, `regionModel` `solver.mode: 'dynamic'`. (A) Stiffness O(1): K_est = D_max·Δt/h², N_sub = ⌈C_CFL·K_est⌉ with **C_CFL = 6/0.4 = 15** (P3's actual stability bound Δt_sub ≤ 0.4h²/6D, evaluated in the same float order as `FV.substepsFor` → equal to the real substep count, tested at boundaries; the spec's "≈ 2" would mis-gate). (B) State machine FV_ONLY →(N_sub ≥ K_up for M consecutive steps and γ ≤ γ_max)→ PROMOTED →(N_sub < K_down)→ FV_ONLY; band 8 ≤ N_sub < 15 holds the current state. (C) Pre-filter γ = max\|∇²u\|/(ū + ε) on active cells, O(N), evaluated only when promoted or a promotion candidate; γ_max = 3 × max over warmup snapshots. γ > γ_max or OOD (surrogate's post check) → same-step demotion, output discarded, FV that step, cool-down W = 20 steps with no promotion attempt. (D) Transition mass protocol `exactAnchor`: clamp negatives → Kahan sum → rescale to N_ledger → put the float remainder on the largest cell → verify by Kahan sum ⇒ \|Σu − N_ledger\|/N ≤ 1e-15; run at promotion (drift measured then removed), demotion, and after every dynamic step. (E) Gains in closed form g_s(k) = (1 + Δt_sub·D_s·λ_k)^{n_sub}, λ_k = −(2/h²)Σ_d(1 − cos πk_d/n) — equals the least-squares gains to ~1e-14, recomputed in O(N) when D changes (no re-training). Lean surrogate check: input-side spatial shocks are already caught by γ, so the pre S_ood is skipped and the post S_ood uses E = max(E_in, E_out) | `engine/p5_dynamic_gate.js`, `engine/fno_surrogate.js` (`analyticGains`), `engine/devs_scheduler.js` (`dynamicStep`) |

**P5 measured** (`node tests/p5_dynamic_promotion.js`; n = 16, Δt 1e-3, h 1e-7, D(t) schedule as a Tier-1 environment change; region coupled to a T2 node; hypothetical values). FV-only column = 8-step clone of the same fields and D schedule per phase, same machine; JS timings vary run to run (±20 %):

| phase (steps) | N_sub | dynamic ms/step | FV-only ms/step | speedup | path |
|---|---|---|---|---|---|
| non-stiff (200–2000) | 4 | 1.28 | 2.92 | 2.3× (JIT warm-up in the FV sample; steady ≈ 1×) | FV 1800 |
| stiff (2000–4500) | 76 | 1.73 | 25.95 | **15.0×** | surrogate 2496, FV 4 (promotion latency M−1) |
| hysteresis while promoted (4500–5500) | 10–18 | 2.21 | 3.27 | 1.5× | surrogate 1000, 0 flips |
| stiff + shock @ 6000 | 76 | 1.90 | 19.70 | 10.4× | surrogate 1975, FV 25 (prefilter demotion @ 6000, cool-down, re-promote @ 6025) |
| non-stiff return (7500–8500) | 4 | 1.15 | 1.06 | 0.9× | FV 1000 |
| adversarial alternation N_sub 4↔31 (8500–9000) | 4–31 | 4.37 | 4.14 | 0.9× | FV 500, 0 flips |
| hysteresis while demoted (9000–10000) | 10–14 | 2.89 | 2.80 | 1.0× | FV 1000, 0 flips |

Invariants: N_initial = N_final = 20500 (\|ΔN\| = 0, moieties exact); field–ledger max deviation 0 (≤ 1e-15, Kahan-measured); promotion drift 5.5e-11 removed at promotion; 0 negative cells; L2 vs pure FV 9.3e-5 (n = 8 compressed schedule incl. shock, checked every 100 steps). P3 mode bit-identical (P3 end-to-end final-state SHA-256 unchanged vs the P4 commit; `mode: 'fv'` region = raw `FV.step` loop bit for bit, tested).

**P5 scope (honest)**: (1) "P3 path bit-for-bit" holds for `mode: 'fv'`. Inside `mode: 'dynamic'` the FV branch is `FV.step` + `exactAnchor`, because P3's own anchor leaves ~1e-13 relative drift (measured) and Invariant 1 demands 1e-15; the difference vs pure FV is ≤ 1e-12·N per cell and the integer ledger is identical (tested). (2) FV-only per-phase cost is sampled, not a full FV-only 10⁴-step run (that run takes minutes at N_sub 76). (3) In the dynamic FV phases the gate overhead is within timing noise (0.9–1.0×); the spec's "no slowdown when N_sub < 5" is checked as dynamic ≤ 1.25 × FV. (4) The gate inherits P4's surrogate distribution (box, no advection, first-order pairs); outside it `p.sur` is null and the gate stays FV_ONLY.

**P3 known limits**: explicit FV (sub-stepping by 0.4·h²/6D and Courant 0.4 — stiff diffusion is slow); interface conductance uses a single h_int; region reactions reconciled to integers by carry (rescale deviation per step ≲ 1 %, absorbed by anchoring, never by the ledger); single-threaded — async fallback windows (Invariant 4) still interface-only.
| P4 | Surrogate service (PyTorch FNO/DeepONet) behind `SurrogateClient` gRPC; trained against P3 solver outputs; ErrorEstimator gates every step | external repo / service |
| P5 | HPC: regions sharded by MPI rank, scheduler per rank, cross-rank boundary packets = same proto | external |

Acceptance tests (all must be exact, inherit v7 style): ledger digest unchanged across 10⁴ promote/demote cycles; |Σμ − Σk| < 1 per face in residual mode; Poisson-mode transfer variance within 3σ of μ; elevation integral = count exactly; surrogate vs FV solver error ≤ ε_sur on held-out geometries; DEVS replay determinism by seed.

## 6. Open gaps (fields now exist — registered in `limitations.md`: see L-entries referencing diffusion_coefficient / pH; the rest remain design-level)

| Target (planned) | Type | Requirement |
|---|---|---|
| species diffusion coefficients D_s | Kinetic_Gap | measured D (cytosol/membrane) per species — required for Da, flux, GPR length scale |
| compartment geometry | Concentration_Gap | voxelized volumes / membrane areas per cell type (extends L000017 2D gap) |
| τ_high, τ_low, w, N_min calibration | Kinetic_Gap | benchmark against FV ground truth; thresholds are free parameters until then |
| surrogate training corpus | Structural_Gap | solver-generated trajectories over geometry/BC distribution; out-of-distribution detection |
| boundary noise model validity | Kinetic_Gap | LogNormal C̃_Γ vs particle-resolved reference at low copy number |
