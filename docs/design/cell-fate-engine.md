# Cell Fate Engine — Lineage Commitment as a State Transition (format v9)

> 삼권 분립 이후(2026-10-09, `docs/design/tripartite-governance.md`): 이 문서의 '사후 분석·분화 정지·질량 감사·과정 보고서' 는 엔진이 아니라 사법부(`judicial/fate_audit.js`·`judicial/verifier.js`·`judicial/process_report.js`)가 엔진 원자료로 판정한다. 엔진은 궤적·원장(N·LO·누적 진행량)·사건·결정 탐침 결과만 내고, 수치 결합점은 `engine/coupling.js` 에서 읽는다.

> Status (2026-10-08): **implemented**: format v9 (`cell_state`, `modulation` rules, `hill` law, `saturating` cofactors, `Regulatory_Gap`), runtime `engine/fate_engine.js`, command `node dbtool.mjs fate`, Fate-Test suite `tests/fate_suite.js` (30 checks), first lineage program (activated CD8 T cell → short-lived effector | memory precursor). Every rate, volume, threshold and Hill constant in the runs below is **hypothetical** (`examples/scenarios/fate-*-hypothetical.json`). They were chosen so the regulatory circuit is bistable, not measured. The results show what the mechanism *can* do and which fate is reached. They are not quantitative predictions.

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

1. **Assembly.** Starting state → closure over `transitions` gives the states. Rules = the states' metabolomes + the supply rules owned by marker molecules + degradation rules of every bundle in the system. Modulations = every `modulation` rule targeting an included rule. Rules that make or remove a marker form the *slow layer*; everything else is the *fast layer*.
2. **Fast layer, extent formulation.** Unknowns are reaction extents ξ_r. The state is N = N₀ + S·ξ, and the ledger is written from ξ. Moiety conservation therefore holds by construction: the audit compares the moiety totals against start + source − lost at every slow step, with a worst relative deviation of 1e-14.
3. **P5 gate reuse.** Per slow step Δ = 60 s, the stiffness is N_sub = ⌈λ_max·Δ / 0.1⌉, where λ_max is the fastest per-second consumption fraction of any input.
   * FV_ONLY → N_sub explicit substeps.
   * PROMOTED → one backward-Euler step solved by damped Newton on ξ. This is unconditionally stable and equals the fast layer's quasi-steady state.
   * Hysteresis uses K_up 15, K_down 8, M 5.
   * A shock (a signal changing by more than 20%, or a reservoir exhausted in the previous step) forces same-step demotion plus a W = 20 cool-down.
   * Newton non-convergence → that step falls back to explicit, counted as `fv_newton`.
4. **Slow layer.** Modulation factors are frozen for the step, and each marker is updated with the exact solution N' = N·e^{−kΔ} + (s/k)(1 − e^{−kΔ}).
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
| Lineage fidelity | IL-12, glucose ample | effector at 2.02 h | 1.32 h | — |
| Lineage fidelity | IL-15, fatty acid ample | memory precursor at 6.87 h | 4.28 h | — |
| Competition | IL-12 + IL-15, ample | effector at 2.03 h (Eomes 234) | 1.33 h | — |
| Irreversibility | IL-12 pulse 0–1 h (before 1.32 h) | reverts to activated | none | `signal_insufficient` (IL-12) |
| Irreversibility | IL-12 pulse 0–2 h (after 1.32 h) | effector at 2.23 h, stays | 1.32 h | — |
| Stress arrest | IL-12, glucose 2·10⁹ molecules | undetermined, T-bet stalls at about 2.7k (< 12k) | none | `resource_exhaustion`: T-bet → pyruvate licensing → glycolysis → **glucose, exhausted at 1.38 h** → L000067 |
| Stress arrest | IL-15, palmitoyl-CoA 10⁶ | stays activated | none | `resource_exhaustion`: palmitoyl-CoA, exhausted at 0.02 h → L000068 |
| Stress mis-differentiation | IL-12 + IL-15, glucose 2·10⁹ | **memory precursor at 21.75 h** (optimal: effector) | memory 12.90 h | `alternative_fate`, root glucose (1.38 h) |

The last row matches the qualitative literature direction (limiting glycolysis favours memory over effector). It is not a quantitative prediction.

Gate and accuracy, with the reference being explicit substeps at 1% consumption per substep (converged):

| Scenario | Dynamic-gate L2 | Explicit 10% path L2 | Same final state | N_sub | Dynamic | Converged reference | Speedup |
|---|---|---|---|---|---|---|---|
| IL-15, 12 h | 1.1e-3 | 1.3e-2 | yes | 1200 | 58 ms | 15.6 s | 266× |
| IL-12, 2.5 h | 3.3e-4 | 6.7e-3 | yes | 1200–28617 | 29 ms | 17.1 s | 587× |

Mass: in all eight 48 h runs the moiety ledger deviation was ≤ 6.1e-14 relative with plain float arithmetic. Since 2026-10-09 the state, channels and totals use compensated arithmetic (TwoSum/TwoProduct, double-double), so the deviation is ≤ 1e-27, inside the protocol's 1e-14. It is also faster than before: balanced rules skip the ledger path and the hot loop no longer allocates (dynamic 470 → 440 ms, converged reference 3469 → 1557 ms for the 3 h effector run).

## 5. Honest scope

* **Constants are hypothetical.** Every number that matters (Hill K/n/fmax, synthesis, half-lives, volumes, thresholds) lives in scenarios and is listed as a limitation. Commitment times (1.3 h effector, 4.3 h memory) are properties of these numbers, not of CD8 T cells.
* **Abstracted mediators.** Signal transduction (receptors, STATs, mTORC1), chromatin and the T-bet ⊣ Eomes toggle are modulation rules with `abstracted` evidence. They are the first candidates to expand into steps.
* **The fast layer is always stiff here.** Relative to Δ = 60 s, N_sub ≥ 1200, so the gate stays promoted except in shock windows. Its observable role in this program is shock handling and the Newton fallback. The explicit path at 10% per substep has 0.7–1.3% splitting error, larger than the implicit path's error, and is used only for those windows.
* **One cell, deterministic.** No proliferation, division-linked dilution, asymmetric division or noise. A population or stochastic layer (Gillespie over markers, cell division) is the natural next step, and the P3 node model already provides SSA/τ-leap.
* **Translation cost is not drawn from reservoirs.** Marker synthesis is `source: true` (L000058), so the regulatory layer does not compete with metabolism for ATP or amino acids yet.

## 6. Adding a lineage (data only)

1. `cell_state` for each state, with signature markers (molecular senses), metabolome (supply rules) and transitions (signals, criterion).
2. Supply rules for marker synthesis and degradation rules for turnover on the marker senses.
3. `modulation` rules: signal → metabolic rule, metabolite → marker synthesis, marker ⊣/→ marker. Use evidence `curated` with a DOI where you have one, otherwise `abstracted` with a basis. Register a `Regulatory_Gap` for every abstraction.
4. A scenario with volumes, amounts, buffered fuels, signals, thresholds and kinetics (`hypothetical: true` unless measured), then `node dbtool.mjs fate <state> --scenario …`.
