# Cell Fate Engine — Lineage Commitment as a State Transition (format v9)

> 삼권 분립 이후(2026-10-09, `docs/design/tripartite-governance.md`): 이 문서의 '사후 분석·분화 정지·질량 감사·과정 보고서' 는 엔진이 아니라 사법부(`judicial/fate_audit.js`·`judicial/verifier.js`·`judicial/process_report.js`)가 엔진 원자료로 판정한다. 엔진은 궤적·원장(N·LO·누적 진행량)·사건·결정 탐침 결과만 내고, 수치 결합점은 `engine/coupling.js` 에서 읽는다. 4단계 ③(2026-10-09)부터 사건·도달·결정 시각은 관찰 격자에 묶이지 않는다 — 근 찾기·연속 이분 탐색 (`docs/textbook/04-알고리즘.md` §4.9E).

> Status (2026-10-08): **implemented**: format v9 (`cell_state`, `modulation` rules, `hill` law, `saturating` cofactors, `Regulatory_Gap`), runtime `engine/fate_engine.js`, command `node dbtool.mjs fate`, Fate-Test suite `tests/fate_suite.js` (54 checks), first lineage program (activated CD8 T cell → short-lived effector | memory precursor). Every rate, volume, threshold and Hill constant in the runs below is **hypothetical** (`examples/scenarios/fate-*-hypothetical.json`). They were chosen so the regulatory circuit is bistable, not measured. The results show what the mechanism *can* do and which fate is reached. They are not quantitative predictions.

## 1. Mission and scope

From *metabolic engine* (TCA, P5 dynamic gate) to *multi-scale cell-identity simulator*. A cell state is defined by the intersection of:

| Layer | Representation in this repository | Time scale |
|---|---|---|
| Metabolic landscape | finite reservoirs + `supply` / `degradation` rules (v7), moiety ledger | seconds |
| Signal-driven regulation | `modulation` rules: a modulator's concentration multiplies another rule's rate (Hill) | — (instantaneous factor) |
| Lineage commitment | transcription-factor markers (zero-order synthesis × modulation, first-order turnover); bistable mutual antagonism + autoactivation; `cell_state.signature` | hours |

**About the "B cell → NK T cell" example in the brief.** That is not a physiological lineage path. Invariant NKT cells come from CD4⁺CD8⁺ thymocytes through CD1d/SLAM selection and PLZF, not from B cells. A B → NKT program would have to be labelled reprogramming, with no mechanistic evidence chain to cite. The engine is lineage-agnostic: states, signals and rules are data. The first program therefore uses a decision with an established signal → metabolism → fate chain that uses exactly the two cytokines the brief names. **IL-12** drives effector fate (mTORC1 → glycolysis, T-bet). **IL-15** drives memory fate (STAT5 → CPT1A → fatty-acid oxidation, Eomes). Another lineage, B → plasma cell (IRF4/BLIMP-1 vs PAX5/BCL6), would be a data patch with no engine change.

## 2. Format v9 (knowledge layer, `data/db.json`)

```
IL-12 ──modulation──▶ glycolysis supply rule ──▶ pyruvate ──modulation──▶ T-bet synthesis ◀──┐ autoactivation
  │                         ▲                                    │                         │
  └──modulation (⊣)──▶ Eomes synthesis                            └──modulation──▶ glycolysis (maintenance)
IL-15 ──modulation──▶ β-oxidation supply rule ──▶ acetyl-CoA ──modulation──▶ Eomes synthesis ◀──┐ autoactivation
                            ▲                                    │                          │
                            └──────────── Eomes (maintenance) ◀───┘     T-bet ⊣ Eomes, Eomes ⊣ T-bet (toggle)
```

* `cell_state` D: `signature` (marker · high|low · location), `metabolome` (supply rules), `transitions` (to · signals · commitment criterion). States: D000174 activated (T-bet low, Eomes low), D000175 effector (T-bet high, Eomes low; glycolysis/LDH high), D000176 memory precursor (Eomes high, T-bet low; β-oxidation/TCA/ETC high).
* `modulation` rules (12) are owned by the modulator (IL-12, IL-15, T-bet, Eomes, pyruvate, acetyl-CoA). Mediators that are not modelled are named in `text` and registered as `Regulatory_Gap`: IL-12R/STAT4/mTORC1, STAT5/CPT1A, GAPDH-translation / histone acetylation, spare respiratory capacity / AMPK.
* Metabolism (all moiety-balanced, cofactors `saturating`):
  * glycolysis: glucose + 2 NAD⁺ + 2 ADP + 2 Pi → 2 pyruvate + 2 NADH + 2 ATP;
  * LDH: pyruvate + NADH → lactate + NAD⁺;
  * ATP demand;
  * lactate export;
  * β-oxidation: palmitoyl-CoA + 7 CoA + 7 NAD⁺ + 7 FAD → 8 acetyl-CoA + 7 NADH + 7 FADH₂ (carbon 16 = 16, CoA 8 = 8);
  * TCA net reaction: acetyl-CoA → 2 CO₂ + CoA + 3 NADH + FADH₂, with the GTP of succinyl-CoA synthetase omitted (Structural_Gap);
  * existing NADH/FADH₂ reoxidation;
  * CO₂ efflux.
* `saturating` cofactors keep the lumped reactions first-order in their carbon substrate. Without them the mass-action order would be 7 for glycolysis and 22 for β-oxidation. The cofactors still balance stoichiometrically and switch the rate off smoothly when exhausted, via c/(c + K_sat), with K_sat = 1 µM as a numerical regularization.
* Limitations L000049–L000068 cover:
  * 8 Regulatory_Gap: every abstracted mediator and each set of unknown Hill constants;
  * Kinetic_Gap: basal synthesis and turnover, metabolic rates;
  * Structural_Gap: translation stoichiometry, glycolytic carbon, FAO activation and CPT1 entry, OXPHOS coupling;
  * Concentration_Gap: CD8 compartment volumes;
  * Identity_Gap: ChEBI for pyruvate, lactate and palmitoyl-CoA;
  * Resource_Gap: glucose uptake (GLUT1) and fatty-acid uptake.
* UniProt accessions (P29459, P29460, P40933, Q9UL17, O95936), GO (0006096, 0006635), EC 1.1.1.27 and the three DOIs (Pearce 2009, van der Windt 2012, Joshi 2007) were entered from memory as `asserted` / curated. The container could not reach UniProt or ChEBI to verify them. ChEBI numbers were left `unmapped` (Identity_Gap), following the repository's convention.

## 3. Engine (`engine/fate_engine.js`)

1. **Assembly.** Starting state → closure over `transitions` gives the states. Rules = the states' metabolomes + the supply rules owned by marker molecules + degradation rules of every bundle in the system. Modulations = every `modulation` rule targeting an included rule. Rules that make or remove a marker are labelled the *slow layer*; everything else is the *fast layer*. Since engine-port phase 1.5 the layers are only labels for reports and post-mortems; integration treats them as one system.
2. **Extent formulation.** Unknowns are the reaction extents ξ_r of every active rule. The state is N = N₀ + S·ξ, and the ledger is written from ξ. Moiety conservation therefore holds by construction: the audit compares the moiety totals against start + source − lost at every observation step, with a worst relative deviation of 1e-14.
3. **Coupled Rodas3 (phase 1.5).** dξ/dt = rate(N₀ + S·ξ) is integrated with Rodas3: a 4-stage, 3rd-order, L-stable Rosenbrock method with an embedded 2nd-order error estimate.
   * The Jacobian (∂rate/∂N)·S comes from the IR's symbolic derivatives, including the modulation factors' ∂f/∂s. Factors are not frozen.
   * A step is rejected when the error norm max_i |e_i|/(atol + rtol·max(|N_i|,|N_i'|)) exceeds 1, or when any state goes negative (positivity).
   * Defaults are rtol 1e-6 and atol 1e-2 molecules, from the coupling registry.
   * Stiffness is absorbed by the L-stable implicit stages. The h range is 4·10⁻⁴–60 s in the runs below.
   * The P5 gate is therefore no longer used here. The earlier operator splitting (backward Euler on the fast layer, frozen-factor exponential update on the slow layer, explicit fallback) had a first-order error of 6e-4–1e-2 (L000069) and was removed.
4. **Observation grid.** Δ = `dt_slow` (60 s) is where signals (boundary conditions) are set, and where records, events and probe snapshots are taken. It does not set the integration error. Reported reach, commitment and exhaustion times are the first grid point after the true crossing (registered limitation).
5. **States.** The distance to a state is the mean over its markers of the log-shortfall beyond the high/low thresholds, clipped to [0, 1]; 0 means the cell is in that state. Arrest detection uses the unclipped log distance.
6. **Commitment (withdrawal test).**
   * From a snapshot, set every signal to 0 and integrate for 24 h. The cell is committed if it ends in the target state.
   * A coarse grid every 2 h checks monotonicity; bisection then finds the first slow step that passes.
   * This is the operational definition of irreversibility: the regulatory/metabolic loop sustains itself once the separatrix is crossed.
7. **Differentiation arrest and post-mortem.** This reuses the v7 death-detection idea of progress stalling over a window.
   * Failing markers → the marker's synthesis rule → modulation occupancies → the weakest activator → breadth-first trace through the fast rules that make it → the exhausted reservoir, with its exhaustion time as the failure point.
   * Causes: `resource_exhaustion`, `signal_insufficient`, `antagonist_dominance`, `alternative_fate`, `kinetic_stall`.
   * Suggestions cite open limitations of the right type, or the format for registering a new one.
8. **Buffered reservoir.** For medium plus transporter: the concentration stays fixed at c₀ while at least one compartment-full remains, then decreases with the amount. Mass decreases exactly. The abstraction is registered as Resource_Gap L000067/L000068.

## 4. Fate-Test results (`node tests/fate_suite.js`, 48 h, hypothetical constants)

| Test | Scenario | Result | Commitment (withdrawal) | Post-mortem |
|---|---|---|---|---|
| Lineage fidelity | IL-12, glucose ample | effector at 2.00 h | 1.30 h | — |
| Lineage fidelity | IL-15, fatty acid ample | memory precursor at 6.83 h | 4.27 h | — |
| Competition | IL-12 + IL-15, ample | effector at 2.02 h (Eomes 234) | 1.32 h | — |
| Irreversibility | IL-12 pulse 0–1 h (before 1.30 h) | reverts to activated | none | `signal_insufficient` (IL-12) |
| Irreversibility | IL-12 pulse 0–2 h (after 1.30 h) | effector at 2.00 h, stays | 1.30 h | — |
| Stress arrest | IL-12, glucose 2·10⁹ molecules | undetermined, T-bet stalls at about 2.7k (< 12k) | none | `resource_exhaustion`: T-bet → pyruvate licensing → glycolysis → **glucose, exhausted at 1.23 h** → L000067 |
| Stress arrest | IL-15, palmitoyl-CoA 10⁶ | stays activated | none | `resource_exhaustion`: palmitoyl-CoA, exhausted at 0.02 h → L000068 |
| Stress mis-differentiation | IL-12 + IL-15, glucose 2·10⁹ | **memory precursor at 21.68 h** (optimal: effector) | memory 12.83 h | `alternative_fate`, root glucose (1.23 h) |

Times are from the coupled Rodas3 engine (phase 1.5) and are quoted at the 60 s observation-grid resolution. The split engine reported 2–14 min later; for example the 2 h pulse reached effector at 2.23 h instead of 2.00 h, and glucose ran out at 1.38 h instead of 1.23 h. Shrinking its Δ moves its times to these values, as shown in `docs/design/engine-port-roadmap.md` §7.

The last row matches the qualitative literature direction (limiting glycolysis favours memory over effector). It is not a quantitative prediction.

Accuracy against a reference that runs the same coupled integrator at 1/1000 of the tolerance (rtol 1e-9). An independent 2nd-order Rosenbrock (ROS2) agrees with this reference to 1e-8. Rust engine:

| Scenario | L2 vs reference | Same final state | Steps (reference) | h range | Default | Reference | Speedup |
|---|---|---|---|---|---|---|---|
| IL-15, 12 h | 4.4e-9 | yes | 985 (18890) | 1.6·10⁵ | 31 ms | 200 ms | 6.6× |
| IL-12, 2.5 h | 3.3e-8 | yes | 1465 (30711) | 1.6·10⁵ | 44 ms | 323 ms | 7.3× |

The earlier table (dynamic gate L2 1.1e-3 / 3.3e-4 against explicit 1% substeps) used a reference whose own error was about 1e-3.

Mass: in all eight 48 h runs the moiety ledger deviation was ≤ 6.1e-14 relative with plain float arithmetic. Since 2026-10-09 the state, channels and totals use compensated arithmetic (TwoSum/TwoProduct, double-double), so the deviation is ≤ 1e-27, inside the protocol's 1e-14. It is also faster than before: balanced rules skip the ledger path and the hot loop no longer allocates (dynamic 470 → 440 ms, converged reference 3469 → 1557 ms for the 3 h effector run).

## 5. Honest scope

* **Constants are hypothetical.** Every number that matters (Hill K/n/fmax, synthesis, half-lives, volumes, thresholds) lives in scenarios and is listed as a limitation. Commitment times (1.3 h effector, 4.3 h memory) are properties of these numbers, not of CD8 T cells.
* **Abstracted mediators.** Signal transduction (receptors, STATs, mTORC1), chromatin and the T-bet ⊣ Eomes toggle are modulation rules with `abstracted` evidence. They are the first candidates to expand into steps.
* **The metabolic layer is stiff.** Step sizes span 4·10⁻⁴–60 s, and a signal withdrawal forces the step down again (3 → 166 steps in the withdrawal interval). The L-stable Rodas3 absorbs this without a separate stiffness gate. Times are resolved to the 60 s observation grid.
* **One cell, deterministic.** No proliferation, division-linked dilution, asymmetric division or noise. A population or stochastic layer (Gillespie over markers, cell division) is the natural next step, and the P3 node model already provides SSA/τ-leap.
* **Translation cost is not drawn from reservoirs.** Marker synthesis is `source: true` (L000058), so the regulatory layer does not compete with metabolism for ATP or amino acids yet.

## 6. Adding a lineage (data only)

1. `cell_state` for each state, with signature markers (molecular senses), metabolome (supply rules) and transitions (signals, criterion).
2. Supply rules for marker synthesis and degradation rules for turnover on the marker senses.
3. `modulation` rules: signal → metabolic rule, metabolite → marker synthesis, marker ⊣/→ marker. Use evidence `curated` with a DOI where you have one, otherwise `abstracted` with a basis. Register a `Regulatory_Gap` for every abstraction.
4. A scenario with volumes, amounts, buffered fuels, signals, thresholds and kinetics (`hypothetical: true` unless measured), then `node dbtool.mjs fate <state> --scenario …`.
