from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum


class BaselineStatus(StrEnum):
    CALIBRATING = "calibrating"
    PROVISIONAL = "provisional"
    TRUSTED = "trusted"
    STALE = "stale"


@dataclass(frozen=True, slots=True)
class MetricCfg:
    min_val: float
    max_val: float
    floor_spread: float
    half_life_b: float
    half_life_s: float


@dataclass(frozen=True, slots=True)
class BaselineState:
    baseline: float
    spread: float
    n_valid: int
    nights_since_update: int
    status: BaselineStatus

    @property
    def usable(self) -> bool:
        return self.status in (BaselineStatus.PROVISIONAL, BaselineStatus.TRUSTED)


class Baselines:
    WINSOR_K = 3.0
    HARD_OUTLIER_K = 5.0
    MIN_NIGHTS_SEED = 4
    MIN_NIGHTS_TRUST = 14
    STALE_DAYS = 14

    HRV_CFG = MetricCfg(min_val=5.0, max_val=250.0, floor_spread=5.0, half_life_b=14.0, half_life_s=21.0)
    RHR_CFG = MetricCfg(min_val=30.0, max_val=120.0, floor_spread=2.0, half_life_b=14.0, half_life_s=21.0)
    RESP_CFG = MetricCfg(min_val=4.0, max_val=40.0, floor_spread=0.5, half_life_b=14.0, half_life_s=21.0)

    @staticmethod
    def lambda_half_life(half_life: float) -> float:
        return 1.0 - math.pow(0.5, 1.0 / half_life)

    @staticmethod
    def _compute_status(n_valid: int, nights_since_update: int) -> BaselineStatus:
        if nights_since_update > Baselines.STALE_DAYS and n_valid >= Baselines.MIN_NIGHTS_SEED:
            return BaselineStatus.STALE
        if n_valid < Baselines.MIN_NIGHTS_SEED:
            return BaselineStatus.CALIBRATING
        if n_valid < Baselines.MIN_NIGHTS_TRUST:
            return BaselineStatus.PROVISIONAL
        return BaselineStatus.TRUSTED

    @staticmethod
    def update(state: BaselineState | None, value: float | None, cfg: MetricCfg) -> BaselineState:
        lb = Baselines.lambda_half_life(cfg.half_life_b)
        ls = Baselines.lambda_half_life(cfg.half_life_s)

        if state is None:
            if value is not None and cfg.min_val <= value <= cfg.max_val:
                return BaselineState(
                    baseline=value,
                    spread=cfg.floor_spread,
                    n_valid=1,
                    nights_since_update=0,
                    status=BaselineStatus.CALIBRATING,
                )
            seed = (cfg.min_val + cfg.max_val) / 2.0
            return BaselineState(
                baseline=seed,
                spread=cfg.floor_spread,
                n_valid=0,
                nights_since_update=1,
                status=BaselineStatus.CALIBRATING,
            )

        if value is None:
            m = state.nights_since_update + 1
            return BaselineState(
                baseline=state.baseline,
                spread=state.spread,
                n_valid=state.n_valid,
                nights_since_update=m,
                status=Baselines._compute_status(state.n_valid, m),
            )

        if not (cfg.min_val <= value <= cfg.max_val):
            m = state.nights_since_update + 1
            return BaselineState(
                baseline=state.baseline,
                spread=state.spread,
                n_valid=state.n_valid,
                nights_since_update=m,
                status=Baselines._compute_status(state.n_valid, m),
            )

        if state.n_valid >= Baselines.MIN_NIGHTS_SEED:
            dev = abs(value - state.baseline)
            if dev > Baselines.HARD_OUTLIER_K * state.spread:
                return BaselineState(
                    baseline=state.baseline,
                    spread=state.spread,
                    n_valid=state.n_valid,
                    nights_since_update=0,
                    status=Baselines._compute_status(state.n_valid, 0),
                )

        if state.n_valid == 0:
            return BaselineState(
                baseline=value,
                spread=cfg.floor_spread,
                n_valid=1,
                nights_since_update=0,
                status=BaselineStatus.CALIBRATING,
            )

        lo = state.baseline - Baselines.WINSOR_K * state.spread
        hi = state.baseline + Baselines.WINSOR_K * state.spread
        clamped = max(lo, min(hi, value))
        new_baseline = lb * clamped + (1.0 - lb) * state.baseline

        abs_dev = abs(value - new_baseline)
        new_spread = max(cfg.floor_spread, ls * abs_dev + (1.0 - ls) * state.spread)
        new_n = state.n_valid + 1

        return BaselineState(
            baseline=new_baseline,
            spread=new_spread,
            n_valid=new_n,
            nights_since_update=0,
            status=Baselines._compute_status(new_n, 0),
        )
