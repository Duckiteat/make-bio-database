// Hybrid Multi-Scale Simulation Engine (HMSE) — C++20 interface specification, format v8.
// Design: docs/design/hybrid-multiscale-engine.md · wire schemas: schemas/v8/*.schema.json
// Reference semantics (executable, tested): engine/hmse.js. This header declares interfaces only;
// IntegerLedger contracts are normative (any implementation must pass the same invariants as tests/rules.test.mjs).
#pragma once
#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <variant>
#include <vector>

namespace hmse::v8 {

using DomainId = std::string;
using SpeciesKey = std::string;   // v7 bundle key "D000032|cytosol"
using Count = std::int64_t;        // integer particle counts — the ground truth (Invariant 1)
using Seconds = double;

enum class Tier : std::uint8_t { T1_Field, T2_RuleNetwork, T3_Spatial };
enum class Action : std::uint8_t { Hold, Promote, Demote };
enum class TxStatus : std::uint8_t { Committed, Duplicate, Conflict, NotAdjacent, Infeasible, Invalid };
enum class TransferMode : std::uint8_t { Stochastic, Residual };
enum class GeometryTemplate : std::uint8_t { Box, Slab, Sphere, SphericalShell, Cylinder };

// ---------- data (mirrors schemas/v8) ----------
struct TxItem { SpeciesKey key; Count dn; };                      // dn > 0 : from -> to ; dn != 0
struct LedgerTransaction {
  DomainId from, to; std::uint64_t seq; Seconds t;
  std::map<DomainId, std::uint64_t> base_version;                  // exactly {from, to}
  std::vector<TxItem> items;
  std::map<SpeciesKey, double> residual;                           // |r| < 1
  std::map<SpeciesKey, Count> pending;                             // clamped counts carried to next window
  TransferMode mode{TransferMode::Stochastic};
  std::string cause;
};
struct TxResult { TxStatus status; std::vector<std::string> errors; };
struct LedgerDigest { Count total_entities; std::map<std::string, Count> moiety; std::uint64_t hash; };

struct SpeciesFlux { SpeciesKey key; double mu_out, mu_in, var_c_boundary; Count k_out{0}, k_in{0}; double residual{0}; Count pending{0}; };
struct BoundaryFluxPacket { DomainId region_id, node_id; std::string face_set; Seconds t0, t1; std::uint64_t seq; TransferMode mode; std::vector<SpeciesFlux> flux; LedgerDigest digest; };

struct DomainMetrics { DomainId domain_id; Seconds t; double score, laplacian, entropy, dSdt; Action action; };
struct MetricsConfig { double w1, w2, tau_high, tau_low; Seconds t_min; double gp_length_scale_m{0}; };
struct SolverConfig { double epsilon_max; Seconds window_min_s; bool async_fallback{true}; double cle_threshold{1e3}; };
struct Grid3D { int n; double h_m; std::vector<double> c; };  // c.size() == n*n*n, mol/L
struct LocalEnvironment { std::optional<double> pH, relative_permittivity, ionic_strength_M; };

// ---------- Invariant 1: integer ledger with Adjacent Boundary Transactions ----------
// Contract: (a) counts are non-negative integers; (b) apply() touches only ledgers[from], ledgers[to];
// (c) sum over all ledgers of every key is invariant under apply(); (d) idempotent per (pair, seq);
// (e) optimistic concurrency: base_version mismatch -> Conflict (caller re-reads, retries) — no global lock.
class IntegerLedger {
 public:
  virtual ~IntegerLedger() = default;
  virtual Count count(const DomainId&, const SpeciesKey&) const = 0;
  virtual std::uint64_t version(const DomainId&) const = 0;
  virtual bool adjacent(const DomainId&, const DomainId&) const = 0;
  virtual TxResult apply(const LedgerTransaction&) = 0;           // atomic over the pair only
  virtual LedgerDigest digest() const = 0;                        // global audit (barrier only)
  virtual std::map<SpeciesKey, Count> totals() const = 0;
};

// ---------- Tier 1: thermodynamic field ----------
// k(r) = k0 exp(-(dG_act + dG_env(pH, eps)) / RT); k_r(r) = k_f(r) exp(dG0/RT)  (microscopic reversibility, Invariant 5)
struct RatePair { double kf, kr, dG_env; };
class ThermodynamicField {
 public:
  virtual ~ThermodynamicField() = default;
  virtual LocalEnvironment at(const DomainId&, std::span<const double, 3> r) const = 0;
  virtual RatePair rate(const std::string& rule_ref, const LocalEnvironment&) const = 0;
  // CLE step for fast/high-copy reactions: dN = nu * a dt + nu * sqrt(a) dW ; returns integer-projected counts
  virtual void cleStep(const DomainId&, Seconds dt, IntegerLedger&, std::function<double()> normal) = 0;
};

// ---------- Tier 3: surrogate + fallback ----------
class SpatialSolver {
 public:
  virtual ~SpatialSolver() = default;
  virtual Grid3D step(const Grid3D& c, Seconds dt, GeometryTemplate tpl) = 0;
  virtual double errorEstimate(const Grid3D& before, const Grid3D& after) const = 0;  // residual + mass + positivity
};
class SurrogateSolver : public SpatialSolver {                    // FNO / DeepONet, O(N log N) per step
 public:
  virtual bool inDistribution(GeometryTemplate tpl, const Grid3D& c) const = 0;   // Invariant 3 OOD guard
};
class FiniteVolumeSolver : public SpatialSolver {};                // fallback, conservative by construction

// ---------- Domain management (Invariant 2) ----------
class DomainManager {
 public:
  virtual ~DomainManager() = default;
  virtual DomainMetrics evaluate(const DomainId&, Seconds t) = 0;  // S = w1 <|lap C|> + w2 dS_spatial/dt
  virtual Action decide(const DomainId&, const DomainMetrics&) = 0; // hysteresis + t_min dwell
  virtual GeometryTemplate normalizeGeometry(const DomainId& node) const = 0;   // map promoted boundary to canonical template
  virtual Grid3D elevate(const DomainId& node, const Grid3D& prior) = 0;        // constrained GPR; sum(c)*N_A*h^3 == ledger
  virtual void collapse(const DomainId& region) = 0;                             // exact ledger copy back to T2
};

// ---------- Boundary (Invariant 1) ----------
class BoundaryEngine {
 public:
  virtual ~BoundaryEngine() = default;
  virtual BoundaryFluxPacket integrate(const DomainId& region, const DomainId& node, Seconds t0, Seconds t1) = 0;
  virtual LedgerTransaction discretize(BoundaryFluxPacket&, std::function<double()> uniform) = 0;  // Poisson / residual carry
  virtual TxResult commit(const LedgerTransaction&, IntegerLedger&) = 0;                          // retries on Conflict
};

// ---------- DEVS (Invariant 4) ----------
using Packet = std::variant<BoundaryFluxPacket, LedgerTransaction, DomainMetrics>;
class AtomicModel {                                                  // Parallel DEVS atomic model
 public:
  virtual ~AtomicModel() = default;
  virtual const std::string& id() const = 0;
  virtual Seconds ta() const = 0;                                    // time advance
  virtual void deltaInt() = 0;
  virtual void deltaExt(Seconds elapsed, const std::vector<Packet>& inputs) = 0;
  virtual void deltaConf(const std::vector<Packet>& inputs) = 0;     // imminent + inputs
  virtual std::vector<Packet> output() const = 0;                   // lambda
  virtual Seconds lookahead() const = 0;                             // conservative bound on output timestamps
};
class DEVSScheduler {
 public:
  virtual ~DEVSScheduler() = default;
  virtual void add(std::shared_ptr<AtomicModel>, std::vector<DomainId> influencers) = 0;
  virtual Seconds safeTime(const AtomicModel&) const = 0;           // min_u (tLast_u + lookahead_u)
  virtual void run(Seconds t_end, bool until_death) = 0;            // no event beyond safeTime -> rollback-free
  // Async fallback: a T3 step that fails errorEstimate is re-solved by FiniteVolumeSolver on a worker;
  // the region's lookahead becomes the fallback's committed window (>= window_min_s), other models keep advancing.
  virtual void scheduleFallback(const DomainId& region, Seconds window) = 0;
  virtual void barrier(Seconds t) = 0;                              // promote/demote + global digest check
};

}  // namespace hmse::v8
