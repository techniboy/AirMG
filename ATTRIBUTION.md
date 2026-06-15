# Attribution

AirMG is an independent, unofficial, local-first health dashboard. It is not affiliated
with, endorsed by, or connected to WHOOP, Inc., Fitbit, or Google. Those names are used
nominatively only, to identify the data sources and the product category AirMG operates in.

## NOOP — the project this builds on

AirMG's entire reason for existing is **[NOOP](https://github.com/NoopApp/noop)** (`NoopApp/noop`,
© 2026 NoopApp, PolyForm Noncommercial License 1.0.0) — a local-first companion for WHOOP straps
on macOS, Android and iOS.

NOOP proved the thesis AirMG is built on: **your strap, your data, your machine — no cloud, no
account, no subscription.** The local-first architecture, the privacy stance, the "the metrics you
already pay for should be yours" framing, the page model (Today / Recovery / Strain / Sleep /
Trends), and the recovery/strain/sleep-score vocabulary are all directly inspired by NOOP.

**What AirMG took from NOOP:** the philosophy and the product shape.
**What AirMG did *not* take:** any code. NOOP is a Swift app that talks to WHOOP hardware over BLE.
AirMG is an independent, from-scratch Python + TypeScript reimplementation for a different data
source — **Google Health** — and a different surface (a local web app). No NOOP source, assets,
binaries, or reverse-engineering work is vendored, copied, or redistributed here.

If you own a WHOOP strap and want the original, go support NOOP directly:
**https://github.com/NoopApp/noop** — ⭐ star it, file bugs, share strap logs.

### NOOP's own upstream credits (carried here for completeness)

NOOP itself stands on prior community reverse-engineering work. None of this is used by AirMG, but
credit flows upstream regardless:

- **`johnmiddleton12/my-whoop`** — WHOOP 4.0 BLE protocol + the `WhoopProtocol`/`WhoopStore` Swift packages.
- **`b-nnett/goose`** — WHOOP 5.0 / MG BLE reverse-engineering.
- **`groue/GRDB.swift`** — SQLite persistence for NOOP.

## AirMG's own dependencies

See [`NOTICE`](NOTICE) for the open-source libraries AirMG depends on (FastAPI, React, Vite,
Tailwind, three.js / React Three Fiber, TanStack Query, Jotai, Recharts, and others). Each is used
under its own license.

## Not a medical device

AirMG is **not a medical device**. All metrics (HR, HRV, recovery, strain, sleep performance, SpO₂,
respiratory rate, skin temperature, health age) are approximations derived from consumer-grade data
and are **not clinically validated**. Do not use AirMG for diagnosis or treatment decisions.
