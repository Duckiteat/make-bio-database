"""Hybrid Multi-Scale Simulation Engine (HMSE) — Python interface specification, format v8.

Design: docs/design/hybrid-multiscale-engine.md · wire schemas: schemas/v8/*.schema.json
Reference semantics: engine/hmse.js (tested in tests/rules.test.mjs). This module declares the
abstract interfaces (ABCs) and ships a concrete, dependency-free ``DictIntegerLedger`` whose behaviour
must match ``applyLedgerTx`` exactly. Run ``python3 engine/interfaces/hmse.py --selftest``.
"""
from __future__ import annotations

import abc
import enum
import math
import random
import sys
from dataclasses import dataclass, field
from typing import Callable, Mapping, Optional, Sequence

DomainId = str
SpeciesKey = str  # v7 bundle key "D000032|cytosol"
R_GAS = 8.314462618  # J/(mol·K)
T_REF = 310.15       # K  (vocab.js thermo.T_ref)


class Tier(enum.Enum):
    T1 = "T1"  # thermodynamic field / continuous clearing
    T2 = "T2"  # rule-based network (DEVS)
    T3 = "T3"  # spatial 3D domain (surrogate + FV fallback) — domain state only


class TxStatus(enum.Enum):
    COMMITTED = "committed"; DUPLICATE = "duplicate"; CONFLICT = "conflict"
    NOT_ADJACENT = "not_adjacent"; INFEASIBLE = "infeasible"; INVALID = "invalid"


class Action(enum.Enum):
    HOLD = "hold"; PROMOTE = "promote"; DEMOTE = "demote"


@dataclass(frozen=True)
class TxItem:
    key: SpeciesKey
    dn: int  # > 0: from -> to; never 0; integers only


@dataclass(frozen=True)
class LedgerTransaction:  # schemas/v8/ledger-transaction.schema.json
    from_: DomainId
    to: DomainId
    seq: int
    t: float
    base_version: Mapping[DomainId, int]
    items: Sequence[TxItem]
    residual: Mapping[SpeciesKey, float] = field(default_factory=dict)
    pending: Mapping[SpeciesKey, int] = field(default_factory=dict)
    mode: str = "stochastic"
    cause: str = ""


@dataclass
class SpeciesFlux:
    key: SpeciesKey
    mu_out: float
    mu_in: float
    var_c_boundary: float = 0.0
    k_out: int = 0
    k_in: int = 0
    residual: float = 0.0
    pending: int = 0


@dataclass
class BoundaryFluxPacket:  # schemas/v8/boundary-flux-packet.schema.json
    region_id: DomainId
    node_id: DomainId
    face_set: str
    t0: float
    t1: float
    seq: int
    mode: str
    flux: list[SpeciesFlux]


@dataclass
class DomainMetrics:  # schemas/v8/domain-metrics.schema.json
    domain_id: DomainId
    t: float
    score: float
    laplacian: float
    entropy: float
    dSdt: float
    action: Action


@dataclass(frozen=True)
class MetricsConfig:
    w1: float; w2: float; tau_high: float; tau_low: float; t_min: float
    def __post_init__(self) -> None:
        if not (0 <= self.tau_low < self.tau_high and self.t_min > 0 and self.w1 >= 0 and self.w2 >= 0 and self.w1 + self.w2 > 0):
            raise ValueError("MetricsConfig: 0 ≤ tau_low < tau_high, t_min > 0, w ≥ 0")


# ---------------- Invariant 1: integer ledger (Adjacent Boundary Transactions) ----------------
class IntegerLedger(abc.ABC):
    """Contract: non-negative integer counts; apply() touches only the two ledgers of an adjacent pair;
    per-key totals invariant; idempotent per (pair, seq); optimistic version check -> CONFLICT (no global lock)."""

    @abc.abstractmethod
    def count(self, domain: DomainId, key: SpeciesKey) -> int: ...
    @abc.abstractmethod
    def version(self, domain: DomainId) -> int: ...
    @abc.abstractmethod
    def adjacent(self, a: DomainId, b: DomainId) -> bool: ...
    @abc.abstractmethod
    def apply(self, tx: LedgerTransaction) -> tuple[TxStatus, list[str]]: ...
    @abc.abstractmethod
    def totals(self) -> dict[SpeciesKey, int]: ...


def _pair(a: str, b: str) -> str:
    return f"{a}::{b}" if a < b else f"{b}::{a}"


def validate_tx(tx: LedgerTransaction) -> list[str]:
    e: list[str] = []
    if not tx.from_ or not tx.to or tx.from_ == tx.to: e.append("from·to must be two different domains")
    if not isinstance(tx.seq, int) or tx.seq < 1: e.append("seq ≥ 1 integer")
    if not (isinstance(tx.t, (int, float)) and math.isfinite(tx.t) and tx.t >= 0): e.append("t ≥ 0")
    if not tx.items: e.append("items empty")
    for it in tx.items:
        if not isinstance(it.dn, int) or isinstance(it.dn, bool) or it.dn == 0: e.append(f"{it.key}: dn must be a non-zero integer")
    for k, r in tx.residual.items():
        if not (math.isfinite(r) and abs(r) < 1): e.append(f"residual {k}: |r| < 1")
    if set(tx.base_version) != {tx.from_, tx.to}: e.append("base_version must name exactly from and to")
    return e


class DictIntegerLedger(IntegerLedger):
    """Reference implementation (single process). A concurrent implementation locks only the pair's two ledgers."""

    def __init__(self, counts: Mapping[DomainId, Mapping[SpeciesKey, int]], adjacency: Sequence[tuple[DomainId, DomainId]]):
        self._c = {d: dict(v) for d, v in counts.items()}
        self._v = {d: 0 for d in self._c}
        self._adj = {_pair(a, b) for a, b in adjacency}
        self._seq: dict[str, int] = {}
        for d, v in self._c.items():
            for k, n in v.items():
                if not isinstance(n, int) or n < 0: raise ValueError(f"{d}/{k}: non-negative integer required")

    def count(self, domain, key): return self._c[domain].get(key, 0)
    def version(self, domain): return self._v[domain]
    def adjacent(self, a, b): return _pair(a, b) in self._adj

    def apply(self, tx):
        errs = validate_tx(tx)
        if errs: return TxStatus.INVALID, errs
        pk = _pair(tx.from_, tx.to)
        if pk not in self._adj: return TxStatus.NOT_ADJACENT, [f"{tx.from_}–{tx.to} not adjacent"]
        if self._seq.get(pk, 0) >= tx.seq: return TxStatus.DUPLICATE, []
        if self._v[tx.from_] != tx.base_version[tx.from_] or self._v[tx.to] != tx.base_version[tx.to]: return TxStatus.CONFLICT, []
        a, b = dict(self._c[tx.from_]), dict(self._c[tx.to])
        for it in tx.items:
            a[it.key] = a.get(it.key, 0) - it.dn; b[it.key] = b.get(it.key, 0) + it.dn
            if a[it.key] < 0 or b[it.key] < 0: return TxStatus.INFEASIBLE, [f"{it.key}: negative after transfer"]
        assert sum(a.values()) + sum(b.values()) == sum(self._c[tx.from_].values()) + sum(self._c[tx.to].values())
        self._c[tx.from_], self._c[tx.to] = a, b
        self._v[tx.from_] += 1; self._v[tx.to] += 1; self._seq[pk] = tx.seq
        return TxStatus.COMMITTED, []

    def totals(self):
        t: dict[str, int] = {}
        for v in self._c.values():
            for k, n in v.items(): t[k] = t.get(k, 0) + n
        return t


def sample_transfer(mu: float, residual: float, mode: str, rng: random.Random, available: Optional[int] = None) -> tuple[int, float, int]:
    """Returns (k, residual, pending). Residual mode: |Σμ − Σk| < 1 forever. Stochastic: Poisson(μ) (CLE limit for μ > 1e3)."""
    if mode == "residual":
        k = math.floor(mu + residual + 1e-12); r = mu + residual - k
    else:
        k = round(mu + math.sqrt(mu) * rng.gauss(0, 1)) if mu > 1e3 else _poisson(rng, mu); k = max(k, 0); r = 0.0
    pending = 0
    if available is not None and k > available: pending, k = k - available, available
    return k, r, pending


def _poisson(rng: random.Random, mu: float) -> int:
    if mu <= 0: return 0
    L, k, p = math.exp(-mu), 0, 1.0
    while True:
        k += 1; p *= rng.random()
        if p <= L: return k - 1


# ---------------- Tier 1: thermodynamic field (Invariant 5) ----------------
@dataclass(frozen=True)
class Kinetics:
    k0: Optional[float] = None; dG_act: Optional[float] = None; k: Optional[float] = None
    k_r: Optional[float] = None; dG0: Optional[float] = None
    pH_ref: float = 7.0; dG_dpH: float = 0.0; eps_ref: float = 80.0; dG_dinv_eps: float = 0.0


def rate_at(kin: Kinetics, pH: Optional[float] = None, eps: Optional[float] = None) -> tuple[float, float, float]:
    """(kf, kr, dG_env). kr is derived from dG0 so kf/kr = exp(−ΔG°/RT) holds in every environment."""
    rt = R_GAS * T_REF
    g = (kin.dG_dpH * (pH - kin.pH_ref) if pH is not None else 0.0) + (kin.dG_dinv_eps * (1 / eps - 1 / kin.eps_ref) if eps else 0.0)
    kf = kin.k0 * math.exp(-(kin.dG_act + g) / rt) if kin.k0 and kin.dG_act is not None else (kin.k or 0.0) * math.exp(-g / rt)
    kr = kf * math.exp(kin.dG0 / rt) if kin.dG0 is not None else (kin.k_r or 0.0) * math.exp(-g / rt)
    return kf, kr, g


class ThermodynamicField(abc.ABC):
    @abc.abstractmethod
    def environment(self, domain: DomainId, r: tuple[float, float, float]) -> Mapping[str, float]: ...
    @abc.abstractmethod
    def cle_step(self, domain: DomainId, dt: float, ledger: IntegerLedger, normal: Callable[[], float]) -> None:
        """Chemical Langevin step for fast, high-copy reactions; result projected to integers through ledger transactions."""


# ---------------- Tier 3: surrogate + fallback ----------------
class SpatialSolver(abc.ABC):
    @abc.abstractmethod
    def step(self, field: Sequence[float], n: int, h_m: float, dt: float, template: str) -> list[float]: ...
    @abc.abstractmethod
    def error_estimate(self, before: Sequence[float], after: Sequence[float]) -> float: ...


class SurrogateSolver(SpatialSolver):
    @abc.abstractmethod
    def in_distribution(self, template: str, field: Sequence[float]) -> bool:
        """Invariant 3: only canonical geometry templates; otherwise caller falls back to FV without inference."""


class FiniteVolumeSolver(SpatialSolver):
    """Conservative by construction; executed asynchronously on fallback (Invariant 4)."""


# ---------------- Domain management (Invariant 2) ----------------
class DomainManager(abc.ABC):
    @abc.abstractmethod
    def evaluate(self, domain: DomainId, t: float) -> DomainMetrics:
        """S = w1·⟨|∇²C|⟩ + w2·∂S_spatial/∂t."""
    @abc.abstractmethod
    def normalize_geometry(self, node: DomainId) -> str: ...
    @abc.abstractmethod
    def elevate(self, node: DomainId) -> list[float]:
        """Constrained GPR with spatial smoothing; Σ c·N_A·h³ equals the ledger count exactly after projection."""
    @abc.abstractmethod
    def collapse(self, region: DomainId) -> None: ...

    @staticmethod
    def decide(cur_tier: Tier, since: float, score: float, t: float, m: MetricsConfig) -> tuple[Tier, float, Action]:
        if t - since < m.t_min: return cur_tier, since, Action.HOLD
        if cur_tier != Tier.T3 and score >= m.tau_high: return Tier.T3, t, Action.PROMOTE
        if cur_tier == Tier.T3 and score <= m.tau_low: return Tier.T2, t, Action.DEMOTE
        return cur_tier, since, Action.HOLD


class BoundaryEngine(abc.ABC):
    @abc.abstractmethod
    def integrate(self, region: DomainId, node: DomainId, t0: float, t1: float) -> BoundaryFluxPacket: ...
    @abc.abstractmethod
    def discretize(self, packet: BoundaryFluxPacket, rng: random.Random) -> LedgerTransaction: ...
    @abc.abstractmethod
    def commit(self, tx: LedgerTransaction, ledger: IntegerLedger, max_retries: int = 8) -> TxStatus: ...


class AtomicModel(abc.ABC):
    @abc.abstractmethod
    def ta(self) -> float: ...
    @abc.abstractmethod
    def delta_int(self) -> None: ...
    @abc.abstractmethod
    def delta_ext(self, elapsed: float, inputs: Sequence[object]) -> None: ...
    @abc.abstractmethod
    def delta_conf(self, inputs: Sequence[object]) -> None: ...
    @abc.abstractmethod
    def output(self) -> list[object]: ...
    @abc.abstractmethod
    def lookahead(self) -> float: ...


class DEVSScheduler(abc.ABC):
    @abc.abstractmethod
    def add(self, model: AtomicModel, influencers: Sequence[DomainId]) -> None: ...
    @abc.abstractmethod
    def safe_time(self, model: AtomicModel) -> float: ...
    @abc.abstractmethod
    def run(self, t_end: float, until_death: bool = False) -> None: ...
    @abc.abstractmethod
    def schedule_fallback(self, region: DomainId, window: float) -> None: ...
    @abc.abstractmethod
    def barrier(self, t: float) -> None: ...


def _selftest() -> None:
    led = DictIntegerLedger({"cyt": {"X": 1000}, "node": {"X": 5}, "reg": {}}, [("cyt", "node"), ("node", "reg")])
    tx = LedgerTransaction("cyt", "node", 1, 0.1, {"cyt": 0, "node": 0}, [TxItem("X", 7)])
    assert led.apply(tx)[0] is TxStatus.COMMITTED
    assert led.apply(tx)[0] is TxStatus.DUPLICATE
    assert led.apply(LedgerTransaction("cyt", "node", 2, 0.2, {"cyt": 0, "node": 0}, [TxItem("X", 1)]))[0] is TxStatus.CONFLICT
    assert led.apply(LedgerTransaction("cyt", "reg", 1, 0.2, {"cyt": 1, "reg": 0}, [TxItem("X", 1)]))[0] is TxStatus.NOT_ADJACENT
    assert led.apply(LedgerTransaction("cyt", "node", 2, 0.2, {"cyt": 1, "node": 1}, [TxItem("X", -100)]))[0] is TxStatus.INFEASIBLE
    rng, total, seq = random.Random(42), led.totals()["X"], 2
    for i in range(1000):
        dn = rng.randint(-10, 10) or 1
        st, _ = led.apply(LedgerTransaction("cyt", "node", seq, float(i), {"cyt": led.version("cyt"), "node": led.version("node")}, [TxItem("X", dn)]))
        if st is TxStatus.COMMITTED: seq += 1
    assert led.totals()["X"] == total
    r = s_mu = s_k = 0.0
    for _ in range(10000):
        mu = rng.random() * 3.7; k, r, _p = sample_transfer(mu, r, "residual", rng); s_mu += mu; s_k += k
        assert abs(s_mu - s_k) < 1 + 1e-9
    for pH, eps in ((7.0, 80.0), (6.2, 30.0)):
        kf, kr, _g = rate_at(Kinetics(k0=1e12, dG_act=60000, dG0=-8000, dG_dpH=3000, dG_dinv_eps=2e5), pH, eps)
        assert abs(math.log(kf / kr) - 8000 / (R_GAS * T_REF)) < 1e-9
    m = MetricsConfig(1, 1, 0.5, 0.1, 1.0); tier, since, flips = Tier.T2, 0.0, []
    for i in range(1, 41):
        tier, since, a = DomainManager.decide(tier, since, 0.9 if i % 2 else 0.0, i * 0.1, m)
        if a is not Action.HOLD: flips.append(i * 0.1)
    assert all(b - a >= m.t_min - 1e-9 for a, b in zip(flips, flips[1:]))
    print("hmse.py selftest ok")


if __name__ == "__main__" and "--selftest" in sys.argv:
    _selftest()
