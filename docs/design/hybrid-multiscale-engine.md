# Hybrid Multi-Scale Simulation Engine — Architecture & Specification (v8 proposal)

> Status: **design proposal, not implemented**. Current rules = `SCHEMA.md` (v7). This spec extends the v7 engine (`core.js simulateRate`) with a spatial tier; terms in `[brackets]` are existing v7 concepts it reuses.

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

## 3. Data Structures & Interfaces

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
| P2 | Format v8: location geometry (`locations[].volume_model`), species `diffusion_coefficient` obs property, region/agent split rule (`continuum: true` on species), R3 tier in `resolutionPlan` | `vocab.js`, `core.js`, migration 007 |
| P3 | JS reference implementation: DEVS scheduler + BoundaryEngine + DomainManager with a **finite-volume** diffusion solver (no ML) — establishes the conservation test-suite | `core.js` (or `engine/`), `tests/` |
| P4 | Surrogate service (PyTorch FNO/DeepONet) behind `SurrogateClient` gRPC; trained against P3 solver outputs; ErrorEstimator gates every step | external repo / service |
| P5 | HPC: regions sharded by MPI rank, scheduler per rank, cross-rank boundary packets = same proto | external |

Acceptance tests (all must be exact, inherit v7 style): ledger digest unchanged across 10⁴ promote/demote cycles; |Σμ − Σk| < 1 per face in residual mode; Poisson-mode transfer variance within 3σ of μ; elevation integral = count exactly; surrogate vs FV solver error ≤ ε_sur on held-out geometries; DEVS replay determinism by seed.

## 6. Open gaps (to register in `limitations.md` when P2 fields exist)

| Target (planned) | Type | Requirement |
|---|---|---|
| species diffusion coefficients D_s | Kinetic_Gap | measured D (cytosol/membrane) per species — required for Da, flux, GPR length scale |
| compartment geometry | Concentration_Gap | voxelized volumes / membrane areas per cell type (extends L000017 2D gap) |
| τ_high, τ_low, w, N_min calibration | Kinetic_Gap | benchmark against FV ground truth; thresholds are free parameters until then |
| surrogate training corpus | Structural_Gap | solver-generated trajectories over geometry/BC distribution; out-of-distribution detection |
| boundary noise model validity | Kinetic_Gap | LogNormal C̃_Γ vs particle-resolved reference at low copy number |
