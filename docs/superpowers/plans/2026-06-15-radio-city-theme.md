# Radio City Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth app theme "Radio City" — a Halt-and-Catch-Fire / neon City-Pop skin with a living gradient sky, 看板 signboard sidebar, neon-tube billboard headers, subtle CRT, and the locked HACF viz vocabulary replacing the generic charts — themed across all pages via shared components, leaving the existing dark / liquid-glass / orbital themes untouched.

**Architecture:** New code under `frontend/src/radio/`. A phase engine derives `sunrise|day|dusk|night` from the existing `solarClock.ts` and exposes a token bundle. `RadioShell` renders backdrop + signboard sidebar + billboard header + CRT overlays around the existing page `<Outlet/>`. Each existing chart component gains a `theme === "radio"` branch that renders a ported gallery viz form driven by the phase tokens. Pages are unchanged — they inherit the theme through the shell + the theme-aware charts.

**Tech Stack:** React 19, react-router 7, jotai, Tailwind v4, lucide-react (installed), DOM/CSS/SVG only (no WebGL, no new deps). Tests via vitest (logic only; visuals verified in the running app).

**Reference:** Design spec `docs/superpowers/specs/2026-06-14-radio-city-theme-design.md`. Locked viz source `docs/mockups/hacf-viz-gallery.html`. Final shell look `.superpowers/brainstorm/60596-1781474756/content/direction-A-v10.html`.

---

## File structure

**Create:**
- `frontend/src/radio/phase.ts` — phase derivation + token bundle (reuses solarClock)
- `frontend/src/radio/phase.test.ts` — phase mapping tests
- `frontend/src/radio/radio.css` — `.radio` scope: palette + phase vars + shell/sign/billboard/CRT styles
- `frontend/src/radio/RadioShell.tsx` — top-level layout for the theme
- `frontend/src/radio/RadioBackdrop.tsx` — sky layers (gradient/bloom/stars/aurora/shoot/dust/rain)
- `frontend/src/radio/RadioSidebar.tsx` — signboard nav
- `frontend/src/radio/RadioBillboard.tsx` — neon-tube page header
- `frontend/src/radio/nav.ts` — shared route → {label, kanji, icon, billboard, kana} config
- `frontend/src/radio/viz/Dial.tsx` — segmented 80s dial primitive
- `frontend/src/radio/viz/Skyline.tsx` — trend towers + Spire silhouette
- `frontend/src/radio/viz/EQ.tsx` — equalizer (intraday HR)
- `frontend/src/radio/viz/ZoneStack.tsx` — HR zone floors
- `frontend/src/radio/viz/Facade.tsx` — recovery-year window grid
- `frontend/src/radio/viz/Hypnogram.tsx` — styled real sleep hypnogram

**Modify:**
- `frontend/src/atoms/theme.ts` — add `"radio"` to `Theme`
- `frontend/src/components/layout/Shell.tsx` — add radio branch
- `frontend/src/pages/Settings.tsx` — add Radio City to theme picker
- `frontend/src/components/charts/RecoveryGauge.tsx` — radio branch → Dial
- `frontend/src/components/charts/StrainGauge.tsx` — radio branch → Dial
- `frontend/src/components/charts/TrendLine.tsx` — radio branch → Skyline
- `frontend/src/components/charts/Sparkline.tsx` — radio branch → Spire
- `frontend/src/components/charts/HRChart.tsx` — radio branch → EQ
- `frontend/src/components/charts/HRZonesBar.tsx` — radio branch → ZoneStack
- `frontend/src/components/charts/YearHeatStrip.tsx` — radio branch → Facade
- `frontend/src/components/charts/SleepStagesChart.tsx` — radio branch → Hypnogram

---

## Task 1: Register the theme

**Files:**
- Modify: `frontend/src/atoms/theme.ts`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add the type value**

In `frontend/src/atoms/theme.ts`, change:

```ts
export type Theme = "dark" | "liquid-glass" | "orbital";
```

to:

```ts
export type Theme = "dark" | "liquid-glass" | "orbital" | "radio";
```

- [ ] **Step 2: Add it to the Settings theme picker**

Open `frontend/src/pages/Settings.tsx`, find the array/list of selectable themes (search for `"orbital"`). Add an entry mirroring the existing ones, e.g. if themes are objects:

```tsx
{ value: "radio", label: "Radio City" },
```

Match the exact shape used by the neighboring entries (label/description/value keys as present in that file).

- [ ] **Step 3: Verify build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new type errors. (`Theme` is now a 4-member union; the Settings list includes "radio".)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/atoms/theme.ts frontend/src/pages/Settings.tsx
git commit -m "feat(radio): register Radio City theme value + settings entry"
```

---

## Task 2: Phase engine

**Files:**
- Create: `frontend/src/radio/phase.ts`
- Test: `frontend/src/radio/phase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/radio/phase.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { phaseForFraction, PHASE_TOKENS } from "./phase";

describe("phaseForFraction", () => {
	it("maps midnight to night", () => {
		expect(phaseForFraction(0.0)).toBe("night");
		expect(phaseForFraction(0.98)).toBe("night");
	});
	it("maps early morning to sunrise", () => {
		expect(phaseForFraction(0.27)).toBe("sunrise");
	});
	it("maps midday to day", () => {
		expect(phaseForFraction(0.5)).toBe("day");
	});
	it("maps evening to dusk", () => {
		expect(phaseForFraction(0.79)).toBe("dusk");
	});
	it("every phase has a full token bundle", () => {
		for (const p of ["sunrise", "day", "dusk", "night"] as const) {
			const t = PHASE_TOKENS[p];
			expect(t.acc).toMatch(/^#/);
			expect(t.g1).toMatch(/^#/);
			expect(typeof t.glow).toBe("number");
			expect(typeof t.cp).toBe("boolean");
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/radio/phase.test.ts`
Expected: FAIL — cannot find module `./phase`.

- [ ] **Step 3: Implement the phase engine**

Create `frontend/src/radio/phase.ts`:

```ts
import { useMemo } from "react";
import { solarDayFraction, useSolarClock } from "../orbital/solarClock";

export type RadioPhase = "sunrise" | "day" | "dusk" | "night";

export interface PhaseTokens {
	/** gradient stops (top → bottom) */
	g1: string;
	g2: string;
	g3: string;
	/** bloom radial colors (rgba hex with alpha) */
	bloomA: string;
	bloomB: string;
	/** accent color for this phase */
	acc: string;
	/** 0..1 emissive strength (drives glow radii / opacity) */
	glow: number;
	/** City-Pop grade (chrome bezels, stars off) vs HACF night */
	cp: boolean;
}

// Boundaries on the 0..1 local-day fraction (0 = midnight, 0.5 = noon).
// sunrise 05:00–08:00, day 08:00–17:00, dusk 17:00–20:00, else night.
export function phaseForFraction(f: number): RadioPhase {
	if (f >= 5 / 24 && f < 8 / 24) return "sunrise";
	if (f >= 8 / 24 && f < 17 / 24) return "day";
	if (f >= 17 / 24 && f < 20 / 24) return "dusk";
	return "night";
}

export const PHASE_TOKENS: Record<RadioPhase, PhaseTokens> = {
	sunrise: { g1: "#3a1838", g2: "#1c0f28", g3: "#0a0612", bloomA: "#ff7a3344", bloomB: "#ffb34722", acc: "#ff9ec4", glow: 0.5, cp: true },
	day: { g1: "#0e3a44", g2: "#0a2630", g3: "#06141c", bloomA: "#16d8e833", bloomB: "#ffd24a22", acc: "#22e0d0", glow: 0.25, cp: true },
	dusk: { g1: "#2a1248", g2: "#491a3e", g3: "#6e2a2a", bloomA: "#ff7a3344", bloomB: "#ffb34733", acc: "#ff7aa8", glow: 0.7, cp: false },
	night: { g1: "#1a1130", g2: "#0a0818", g3: "#04030a", bloomA: "#8a4dff2e", bloomB: "#ff2d7822", acc: "#16d8e8", glow: 1, cp: false },
};

export interface RadioPhaseState {
	phase: RadioPhase;
	tokens: PhaseTokens;
}

/** Live phase, ticks each minute via solarClock; frozen under ?timeFixture=. */
export function useRadioPhase(): RadioPhaseState {
	const { warmth } = useSolarClock(); // subscribe so we re-render on the minute tick
	void warmth;
	const phase = useMemo(() => phaseForFraction(solarDayFraction(new Date())), [warmth]);
	return { phase, tokens: PHASE_TOKENS[phase] };
}

/** prefers-reduced-motion (read once; fine for theme-level gating). */
export function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/radio/phase.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/radio/phase.ts frontend/src/radio/phase.test.ts
git commit -m "feat(radio): phase engine derived from solarClock"
```

---

## Task 3: Tokens + CSS scope

**Files:**
- Create: `frontend/src/radio/radio.css`
- Modify: `frontend/src/radio/RadioShell.tsx` is created later (Task 7) and imports this.

- [ ] **Step 1: Write the stylesheet**

Create `frontend/src/radio/radio.css`. Port the locked styles from the brainstorm mock `direction-A-v10.html` (palette, gradient app, sky layers, signboards, billboard tube, CRT). Key blocks:

```css
.radio {
	--mag: #ff2d78; --cy: #16d8e8; --ind: #8a4dff; --amb: #ffb347;
	--txt: #cdd1e0; --mut: #6f6a82;
	/* phase vars (set inline by RadioShell from PhaseTokens): */
	--g1: #1a1130; --g2: #0a0818; --g3: #04030a;
	--bloomA: #8a4dff2e; --bloomB: #ff2d7822; --acc: var(--cy); --glow: 1;
	font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
	color: var(--txt);
}
.radio-app {
	position: relative; height: 100vh; display: flex; overflow: hidden;
	background: radial-gradient(125% 85% at var(--bx,50%) 6%, var(--g1) 0%, var(--g2) 44%, var(--g3) 100%);
	transition: background 1.4s; animation: radio-drift 26s ease-in-out infinite alternate;
}
@keyframes radio-drift { 0%{--bx:40%} 100%{--bx:60%} }
@keyframes radio-tw { 0%,100%{opacity:var(--o)} 50%{opacity:calc(var(--o)*.25)} }
@keyframes radio-flick { 0%,93%,100%{opacity:1} 94%{opacity:.45} 95%{opacity:1} 97%{opacity:.7} 98%{opacity:1} }
@keyframes radio-flk { 0%,92%,100%{opacity:1} 93%{opacity:.25} 94%{opacity:1} 96%{opacity:.5} 97%{opacity:1} }
@keyframes radio-breathe { 0%,100%{opacity:.8} 50%{opacity:1} }
@keyframes radio-float { 0%{transform:translateY(20px);opacity:0} 10%{opacity:.55} 100%{transform:translateY(-260px);opacity:0} }
@keyframes radio-drop { to{transform:translateY(130vh)} }
@keyframes radio-au1 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(18%,8%) scale(1.25)} }
@keyframes radio-au2 { 0%{transform:translate(0,0) scale(1.1)} 100%{transform:translate(-16%,4%) scale(.85)} }
@keyframes radio-shoot { 0%,100%{opacity:0;left:-5%;top:8%} 2%{opacity:1} 9%{opacity:0;left:60%;top:30%} }

/* backdrop layers */
.radio-stars{position:absolute;inset:0 0 30% 0;z-index:0;pointer-events:none;transition:opacity 1s}
.radio-app.cp .radio-stars{opacity:0}
.radio-stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;box-shadow:0 0 3px #fff;animation:radio-tw 4s ease-in-out infinite}
.radio-aurora{position:absolute;left:-20%;right:-20%;top:-10%;height:75%;z-index:0;pointer-events:none;filter:blur(36px);opacity:.5;mix-blend-mode:screen}
.radio-aurora b{position:absolute;border-radius:50%;width:50%;height:80%}
.radio-aurora .a1{left:6%;top:0;background:radial-gradient(closest-side,var(--acc),transparent);animation:radio-au1 18s ease-in-out infinite alternate}
.radio-aurora .a2{right:4%;top:8%;background:radial-gradient(closest-side,var(--mag),transparent);animation:radio-au2 22s ease-in-out infinite alternate}
.radio-shoot{position:absolute;top:12%;left:-5%;width:90px;height:1.5px;z-index:0;background:linear-gradient(90deg,transparent,#fff);box-shadow:0 0 8px #fff;opacity:0;transform:rotate(14deg);animation:radio-shoot 13s ease-in infinite}
.radio-bloom{position:absolute;left:0;right:0;bottom:-40px;height:280px;z-index:0;pointer-events:none;transition:background 1.4s;background:radial-gradient(75% 100% at 50% 100%,var(--bloomA),transparent 72%),radial-gradient(55% 100% at 28% 100%,var(--bloomB),transparent 70%);animation:radio-breathe 9s ease-in-out infinite}
.radio-dust{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.radio-dust i{position:absolute;width:2px;height:2px;border-radius:50%;background:#bdfff0;box-shadow:0 0 5px var(--acc);opacity:.5;animation:radio-float linear infinite}
.radio-rain{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;opacity:0;transition:.8s}
.radio-app.rain .radio-rain{opacity:1}
.radio-rain i{position:absolute;top:-14%;width:1px;height:60px;background:linear-gradient(transparent,#b9d4ff66);animation:radio-drop linear infinite}

/* sidebar signboards */
.radio-rail{width:96px;flex:0 0 96px;display:flex;flex-direction:column;align-items:center;gap:9px;padding:14px 0;z-index:5;border-right:1px solid #ffffff08;overflow-y:auto}
.radio-logo{width:32px;height:32px;border:1.5px solid var(--mag);border-radius:7px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:var(--mag);font-size:17px;text-shadow:0 0 8px var(--mag);box-shadow:0 0 10px #ff2d7677}
.radio-sign{width:74px;border-radius:7px;padding:8px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;border:1px solid #241f3a;background:#0c0a18cc;color:#4f4a63;transition:.18s;text-decoration:none}
.radio-sign .kn{font-size:16px;line-height:1}
.radio-sign .en{font-size:7.5px;letter-spacing:.14em;text-transform:uppercase}
.radio-sign svg{width:15px;height:15px}
.radio-sign:hover{color:#a99fc4;border-color:#3a3358}
.radio-sign.on{color:#fff;border-color:var(--acc);background:linear-gradient(#101b2acc,#0a1320cc);box-shadow:0 0 0 1px var(--acc),0 0 14px color-mix(in srgb,var(--acc) 40%,transparent),inset 0 0 12px color-mix(in srgb,var(--acc) 18%,transparent)}
.radio-sign.on .kn{text-shadow:0 0 8px var(--acc),0 0 16px var(--acc)}

/* main + billboard */
.radio-main{flex:1;padding:18px 26px;position:relative;z-index:4;overflow-y:auto}
.radio-bb{margin:6px 0 18px;display:flex;align-items:center;gap:16px}
.radio-tube{font-size:48px;line-height:.9;font-weight:800;letter-spacing:.04em;color:#fff;-webkit-text-stroke:1px #bfeff5;text-shadow:0 0 6px var(--acc),0 0 14px var(--acc),0 0 30px color-mix(in srgb,var(--acc) 67%,transparent),0 0 60px color-mix(in srgb,var(--acc) 40%,transparent)}
.radio-tube .x{animation:radio-flk 6s infinite}
.radio-mount{border-left:2px solid #2a2545;padding-left:14px}
.radio-mount .kana{font-size:22px;color:var(--mag);text-shadow:0 0 10px var(--mag);line-height:1}
.radio-mount .small{font-size:8px;letter-spacing:.22em;text-transform:uppercase;color:var(--mut);margin-top:6px}

/* CRT overlays */
.radio-scan{position:absolute;inset:0;pointer-events:none;z-index:8;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.05) 3px 4px);mix-blend-mode:multiply}
.radio-grain{position:absolute;inset:0;pointer-events:none;z-index:9;opacity:.06;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.radio-vig{position:absolute;inset:0;pointer-events:none;z-index:8;background:radial-gradient(125% 95% at 50% 35%,transparent 58%,rgba(0,0,0,.55))}

/* reduced motion: freeze ambient animation */
@media (prefers-reduced-motion: reduce) {
	.radio-app, .radio-bloom, .radio-aurora b, .radio-shoot, .radio-stars i, .radio-dust i, .radio-rain i, .radio-tube .x { animation: none !important; }
}

/* themed-card surface for content pages */
.radio .radio-card{border:1px solid #1c1a2c;border-radius:11px;padding:13px;background:#0a0815c2;backdrop-filter:blur(2px)}
```

- [ ] **Step 2: Verify it parses (imported in Task 7).**

No standalone test. Confirmed when RadioShell renders in Task 7's manual check.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/radio/radio.css
git commit -m "feat(radio): token scope + shell/sky/CRT styles"
```

---

## Task 4: Nav config

**Files:**
- Create: `frontend/src/radio/nav.ts`

- [ ] **Step 1: Write the config**

Create `frontend/src/radio/nav.ts`. Mirror the routes in `components/layout/Sidebar.tsx` (`NAV_ITEMS`), adding accurate kanji + a lucide icon name + billboard copy. Use `lucide-react` icon components.

```ts
import { Activity, BookText, BedDouble, HeartPulse, Home, LineChart, Settings, Sparkles, TrendingUp, Trophy, Zap } from "lucide-react";
import type { ComponentType } from "react";

export interface RadioNavItem {
	path: string;
	en: string;       // sidebar english label
	kanji: string;    // sidebar signboard glyphs (verified meaning)
	icon: ComponentType<{ className?: string }>;
	title: string;    // billboard headline
	kana: string;     // billboard kana mount
}

export const RADIO_NAV: RadioNavItem[] = [
	{ path: "/", en: "Today", kanji: "今日", icon: Home, title: "TODAY", kana: "今日" },
	{ path: "/sleep", en: "Sleep", kanji: "睡眠", icon: BedDouble, title: "SLEEP", kana: "睡眠" },
	{ path: "/recovery", en: "Recovery", kanji: "回復", icon: HeartPulse, title: "RECOVERY", kana: "回復" },
	{ path: "/strain", en: "Strain", kanji: "負荷", icon: Zap, title: "STRAIN", kana: "負荷" },
	{ path: "/workouts", en: "Workouts", kanji: "運動", icon: Activity, title: "WORKOUTS", kana: "運動" },
	{ path: "/trends", en: "Trends", kanji: "傾向", icon: TrendingUp, title: "TRENDS", kana: "傾向" },
	{ path: "/insights", en: "Insights", kanji: "洞察", icon: Sparkles, title: "INSIGHTS", kana: "洞察" },
	{ path: "/health-age", en: "Health Age", kanji: "年齢", icon: LineChart, title: "HEALTH AGE", kana: "年齢" },
	{ path: "/coach", en: "Coach", kanji: "指導", icon: Trophy, title: "COACH", kana: "指導" },
	{ path: "/journal", en: "Journal", kanji: "日記", icon: BookText, title: "JOURNAL", kana: "日記" },
	{ path: "/settings", en: "Settings", kanji: "設定", icon: Settings, title: "SETTINGS", kana: "設定" },
];

export const RADIO_LOGO = "空"; // air
```

- [ ] **Step 2: Verify lucide icon names exist**

Run: `cd frontend && node -e "const l=require('lucide-react');['Activity','BookText','BedDouble','HeartPulse','Home','LineChart','Settings','Sparkles','TrendingUp','Trophy','Zap'].forEach(n=>console.log(n, !!l[n]))"`
Expected: every line prints `true`. If any prints `false`, pick the nearest existing lucide name and update.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/radio/nav.ts
git commit -m "feat(radio): nav + billboard config"
```

---

## Task 5: Backdrop component

**Files:**
- Create: `frontend/src/radio/RadioBackdrop.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/radio/RadioBackdrop.tsx`. Generates the sky layers once with stable random positions (useMemo), gated by reduced-motion.

```tsx
import { useMemo } from "react";
import { prefersReducedMotion } from "./phase";

export function RadioBackdrop() {
	const reduced = prefersReducedMotion();
	const stars = useMemo(
		() => Array.from({ length: reduced ? 30 : 54 }, () => ({
			left: Math.random() * 100, top: Math.random() * 100,
			o: 0.3 + Math.random() * 0.7, big: Math.random() > 0.85,
			delay: -Math.random() * 4, dur: 3 + Math.random() * 3,
		})),
		[reduced],
	);
	const dust = useMemo(
		() => reduced ? [] : Array.from({ length: 24 }, () => ({
			left: Math.random() * 100, dur: 7 + Math.random() * 9, delay: -Math.random() * 12,
		})),
		[reduced],
	);
	return (
		<>
			<div className="radio-stars">
				{stars.map((s, i) => (
					<i key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, opacity: s.o,
						["--o" as string]: s.o, width: s.big ? 3 : 2, height: s.big ? 3 : 2,
						animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
				))}
			</div>
			<div className="radio-aurora"><b className="a1" /><b className="a2" /></div>
			<div className="radio-shoot" />
			<div className="radio-bloom" />
			<div className="radio-dust">
				{dust.map((d, i) => (
					<i key={i} style={{ left: `${d.left}%`, bottom: -10,
						animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />
				))}
			</div>
		</>
	);
}
```

- [ ] **Step 2: Verify compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors referencing `RadioBackdrop`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/radio/RadioBackdrop.tsx
git commit -m "feat(radio): living-sky backdrop"
```

---

## Task 6: Signboard sidebar + billboard

**Files:**
- Create: `frontend/src/radio/RadioSidebar.tsx`
- Create: `frontend/src/radio/RadioBillboard.tsx`

- [ ] **Step 1: Write the sidebar**

Create `frontend/src/radio/RadioSidebar.tsx`:

```tsx
import { NavLink } from "react-router";
import { RADIO_LOGO, RADIO_NAV } from "./nav";

export function RadioSidebar() {
	return (
		<nav className="radio-rail">
			<div className="radio-logo">{RADIO_LOGO}</div>
			{RADIO_NAV.map((item) => {
				const Icon = item.icon;
				return (
					<NavLink key={item.path} to={item.path} end={item.path === "/"}
						className={({ isActive }) => `radio-sign${isActive ? " on" : ""}`}>
						<span className="kn">{item.kanji}</span>
						<Icon className="" />
						<span className="en">{item.en}</span>
					</NavLink>
				);
			})}
		</nav>
	);
}
```

- [ ] **Step 2: Write the billboard**

Create `frontend/src/radio/RadioBillboard.tsx`. Picks the current route's copy; flickers the last glyph of the title.

```tsx
import { useLocation } from "react-router";
import { RADIO_NAV } from "./nav";

export function RadioBillboard() {
	const { pathname } = useLocation();
	const item = RADIO_NAV.find((n) => n.path === pathname) ?? RADIO_NAV.find((n) => n.path !== "/" && pathname.startsWith(n.path)) ?? RADIO_NAV[0];
	const title = item.title;
	const head = title.slice(0, -1);
	const last = title.slice(-1);
	return (
		<div className="radio-bb">
			<div className="radio-tube">{head}<span className="x">{last}</span></div>
			<div className="radio-mount">
				<div className="kana">{item.kana}</div>
				<div className="small">{item.en}</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Verify compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/radio/RadioSidebar.tsx frontend/src/radio/RadioBillboard.tsx
git commit -m "feat(radio): signboard sidebar + neon billboard header"
```

---

## Task 7: RadioShell + wire into Shell

**Files:**
- Create: `frontend/src/radio/RadioShell.tsx`
- Modify: `frontend/src/components/layout/Shell.tsx`

- [ ] **Step 1: Write RadioShell**

Create `frontend/src/radio/RadioShell.tsx`. Sets phase vars inline, applies `cp`/`rain` classes, renders backdrop + sidebar + billboard + `<Outlet/>` + CRT overlays.

```tsx
import { Outlet } from "react-router";
import type { CSSProperties } from "react";
import "./radio.css";
import { useRadioPhase } from "./phase";
import { RadioBackdrop } from "./RadioBackdrop";
import { RadioSidebar } from "./RadioSidebar";
import { RadioBillboard } from "./RadioBillboard";

export function RadioShell() {
	const { tokens } = useRadioPhase();
	const style: CSSProperties = {
		// phase vars consumed by radio.css
		["--g1" as string]: tokens.g1, ["--g2" as string]: tokens.g2, ["--g3" as string]: tokens.g3,
		["--bloomA" as string]: tokens.bloomA, ["--bloomB" as string]: tokens.bloomB,
		["--acc" as string]: tokens.acc, ["--glow" as string]: tokens.glow,
	};
	return (
		<div className="radio">
			<div className={`radio-app${tokens.cp ? " cp" : ""}`} style={style}>
				<RadioBackdrop />
				<div className="radio-rain">{/* rain disabled v1 (no weather source) */}</div>
				<RadioSidebar />
				<main className="radio-main">
					<RadioBillboard />
					<Outlet />
				</main>
				<div className="radio-scan" />
				<div className="radio-grain" />
				<div className="radio-vig" />
			</div>
		</div>
	);
}
```

Note: rain layer is present but inert in v1 (no weather). Leaving the hook in keeps the future weather task to a class toggle.

- [ ] **Step 2: Wire the branch into Shell**

In `frontend/src/components/layout/Shell.tsx`, add a lazy import beside `OrbitalWorld`:

```tsx
const RadioShell = lazy(() => import("../../radio/RadioShell").then((m) => ({ default: m.RadioShell })));
```

And add a branch before the final return (mirror the orbital branch):

```tsx
if (theme === "radio") {
	return (
		<Suspense fallback={<div className="h-screen w-screen bg-black" />}>
			<RadioShell />
		</Suspense>
	);
}
```

- [ ] **Step 3: Manual verify in the app**

Run: `cd frontend && npm run dev`
In the app: Settings → choose Radio City. Expected: gradient sky with stars/aurora, signboard sidebar, neon "TODAY" billboard, page content renders below it. Navigate between pages → billboard title + active signboard update. Append `?timeFixture=noon` to the URL → backdrop shifts to the day (aqua) grade, stars fade.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/radio/RadioShell.tsx frontend/src/components/layout/Shell.tsx
git commit -m "feat(radio): RadioShell + Shell wiring"
```

---

## Task 8: Dial primitive + gauge branches

**Files:**
- Create: `frontend/src/radio/viz/Dial.tsx`
- Modify: `frontend/src/components/charts/RecoveryGauge.tsx`
- Modify: `frontend/src/components/charts/StrainGauge.tsx`

- [ ] **Step 1: Write the Dial primitive**

Create `frontend/src/radio/viz/Dial.tsx`. Ported from the gallery `dial()` (hacf-viz-gallery.html lines 130-141), parameterized.

```tsx
import { useRadioPhase } from "../phase";

export interface DialProps {
	frac: number;                 // 0..1 fill
	colAt: (f: number) => string; // segment color by position 0..1
	tip: string;                  // word color
	lcd: string;                  // readout color (night)
	label: string;                // big readout text
	word: string;                 // status word
	size?: number;
}

function polar(cx: number, cy: number, r: number, deg: number) {
	const rad = (deg * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcP(cx: number, cy: number, r: number, a0: number, a1: number) {
	const s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1);
	const la = a1 - a0 > 180 ? 1 : 0;
	return `M ${s.x} ${s.y} A ${r} ${r} 0 ${la} 1 ${e.x} ${e.y}`;
}

export function Dial({ frac, colAt, tip, lcd, label, word, size = 120 }: DialProps) {
	const { tokens } = useRadioPhase();
	const day = tokens.cp;
	const cx = size / 2, cy = size / 2;
	const START = 150, SPAN = 240, N = 26, r = size * 0.4;
	const lit = Math.round(N * Math.min(Math.max(frac, 0), 1));
	const segs = Array.from({ length: N }, (_, i) => {
		const a0 = START + (SPAN * (i + 0.12)) / N, a1 = START + (SPAN * (i + 0.88)) / N;
		const f = i / (N - 1), on = i < lit, c = colAt(f);
		return on
			? <path key={i} d={arcP(cx, cy, r, a0, a1)} fill="none" stroke={c} strokeWidth={size * 0.085} opacity={day ? 0.95 : 1} style={day ? undefined : { filter: `drop-shadow(0 0 4px ${c})` }} />
			: <path key={i} d={arcP(cx, cy, r, a0, a1)} fill="none" stroke={day ? "#b9c6d2" : "#241a30"} strokeWidth={size * 0.085} opacity={day ? 0.6 : 0.8} />;
	});
	const lw = label.length * 12 + 12, lh = 26;
	const lcdc = day ? "#7fd0ea" : lcd;
	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
			<circle cx={cx} cy={cy} r={size * 0.49} fill={day ? "#dfe7ef" : "#0d0a16"} stroke={day ? "#aab8c6" : "#2a1f38"} strokeWidth={3} />
			<circle cx={cx} cy={cy} r={size * 0.455} fill="none" stroke={day ? "#fff" : "#1a1228"} strokeWidth={1.5} opacity={0.7} />
			{segs}
			<rect x={cx - lw / 2} y={cy - lh / 2} width={lw} height={lh} rx={3} fill={day ? "#0a2233" : "#0a0f0a"} stroke={day ? "#1a5fa8" : "#1a2a1a"} strokeWidth={1.5} opacity={0.92} />
			<text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontFamily="ui-monospace,monospace" fontSize={19} fontWeight={800} fontStyle="italic" letterSpacing={2} fill={lcdc} style={day ? undefined : { filter: `drop-shadow(0 0 5px ${lcdc})` }}>{label}</text>
			<text x={cx} y={cy + size * 0.17} textAnchor="middle" fontSize={8} fontWeight={700} letterSpacing={2} fill={day ? "#0e3a66" : tip} style={day ? undefined : { filter: `drop-shadow(0 0 5px ${tip})` }}>{word}</text>
		</svg>
	);
}
```

- [ ] **Step 2: Branch RecoveryGauge**

In `frontend/src/components/charts/RecoveryGauge.tsx`, import the theme atom + Dial and add a radio branch at the top of the component body (before the existing SVG return). Reuse `recoveryState` for the word.

```tsx
import { useAtomValue } from "jotai";
import { themeAtom } from "../../atoms/theme";
import { Dial } from "../../radio/viz/Dial";
// ...inside RecoveryGauge, after computing fraction/state/displayScore:
const theme = useAtomValue(themeAtom);
if (theme === "radio") {
	return (
		<Dial
			frac={fraction}
			colAt={(f) => (f < 0.25 ? "#FF4F73" : f < 0.5 ? "#F5A623" : f < 0.7 ? "#E8C24B" : f < 0.88 ? "#18C98B" : "#2FE6A8")}
			tip="#2FE6A8" lcd="#39ffae"
			label={displayScore} word={score !== null ? state.toUpperCase() : "--"}
			size={size * 0.6}
		/>
	);
}
```

(`fraction`, `displayScore`, `state`, `size` already exist in the component.)

- [ ] **Step 3: Branch StrainGauge**

Open `frontend/src/components/charts/StrainGauge.tsx`, read its existing props (strain value, max — typically 21 — and any state word). Add the same pattern:

```tsx
import { useAtomValue } from "jotai";
import { themeAtom } from "../../atoms/theme";
import { Dial } from "../../radio/viz/Dial";
// inside, with `value` = strain (0..21):
const theme = useAtomValue(themeAtom);
if (theme === "radio") {
	const frac = Math.min(Math.max(value / 21, 0), 1);
	return (
		<Dial
			frac={frac}
			colAt={(f) => (f < 0.33 ? "#E8B04B" : f < 0.66 ? "#E8743B" : f < 0.85 ? "#E0476B" : "#C13AC1")}
			tip="#E0476B" lcd="#ff7aa0"
			label={value.toFixed(1)} word={frac > 0.66 ? "HIGH" : frac > 0.33 ? "MOD" : "LOW"}
			size={(size ?? 200) * 0.6}
		/>
	);
}
```

Adjust `value`/`size` to the actual prop names in StrainGauge.

- [ ] **Step 4: Verify compile + visual**

Run: `cd frontend && npx tsc --noEmit` → no errors.
Run dev, Radio theme, open Today + Recovery + Strain → gauges show as segmented LED dials with LCD readouts. `?timeFixture=noon` → chrome bezel.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/radio/viz/Dial.tsx frontend/src/components/charts/RecoveryGauge.tsx frontend/src/components/charts/StrainGauge.tsx
git commit -m "feat(radio): segmented Dial for recovery/strain gauges"
```

---

## Task 9: Skyline + Spire (TrendLine / Sparkline)

**Files:**
- Create: `frontend/src/radio/viz/Skyline.tsx`
- Modify: `frontend/src/components/charts/TrendLine.tsx`
- Modify: `frontend/src/components/charts/Sparkline.tsx`

- [ ] **Step 1: Write Skyline + Spire**

Create `frontend/src/radio/viz/Skyline.tsx`. `Skyline` renders a series as lit-window towers; `Spire` renders a compact neon silhouette polygon. Both take `data: number[]` and an optional `color`.

```tsx
import { useRadioPhase } from "../phase";

const REC = ["#FF4F73", "#F5A623", "#E8C24B", "#18C98B", "#2FE6A8"];

export function Skyline({ data, height = 140 }: { data: number[]; height?: number }) {
	const { tokens } = useRadioPhase();
	const max = Math.max(1, ...data);
	return (
		<div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, padding: "0 4px" }}>
			{data.map((v, i) => {
				const h = (v / max) * height;
				const c = REC[Math.min(4, Math.floor((v / max) * 5))];
				const rows = Math.max(2, Math.round(h / 9));
				return (
					<div key={i} style={{ flex: 1, height: h, border: `1px solid ${tokens.cp ? "#5a6a86" : "#241634"}`, borderBottom: "none", borderRadius: "2px 2px 0 0", background: tokens.cp ? "#2a3a52" : "#0a0616", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 2, padding: 3, alignContent: "start" }}>
						{Array.from({ length: rows * 2 }, (_, k) => {
							const on = Math.random() < (tokens.cp ? 0.4 : 0.85);
							return <span key={k} style={{ aspectRatio: "1", borderRadius: 1, background: on ? c : "#1a1228", opacity: on ? 0.5 + 0.5 * tokens.glow : 0.4, boxShadow: on && tokens.glow > 0.3 ? `0 0 ${(2 + 4 * tokens.glow).toFixed(0)}px ${c}` : "none" }} />;
						})}
					</div>
				);
			})}
		</div>
	);
}

export function Spire({ data, width = 200, height = 80 }: { data: number[]; width?: number; height?: number }) {
	const { tokens } = useRadioPhase();
	const max = Math.max(1, ...data);
	const step = width / Math.max(1, data.length - 1);
	const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
	const id = `spire-${Math.round(max * 100)}`;
	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
			<defs>
				<linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
					<stop offset="0" stopColor="#8a4dff" /><stop offset=".5" stopColor="#ff2d78" /><stop offset="1" stopColor="#16d8e8" />
				</linearGradient>
				<filter id={`f${id}`}><feGaussianBlur stdDeviation={(0.6 + 1.4 * tokens.glow).toFixed(1)} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
			</defs>
			<polyline points={pts} fill="none" stroke={`url(#${id})`} strokeWidth={2} opacity={0.6 + 0.38 * tokens.glow} filter={`url(#f${id})`} />
		</svg>
	);
}
```

- [ ] **Step 2: Branch TrendLine**

In `frontend/src/components/charts/TrendLine.tsx` (already imports `themeAtom`), extract the numeric series it plots into a `number[]` and add:

```tsx
import { Skyline } from "../../radio/viz/Skyline";
// after reading `const theme = useAtomValue(themeAtom);`
if (theme === "radio") {
	return <Skyline data={/* the series values as number[] */} />;
}
```

Use the same data array the existing line uses (map points → their y value).

- [ ] **Step 3: Branch Sparkline**

In `frontend/src/components/charts/Sparkline.tsx`, add the theme atom + Spire and a radio branch returning `<Spire data={values} />` using its existing series.

- [ ] **Step 4: Verify compile + visual**

`npx tsc --noEmit` clean. Dev → Trends/Today show window-tower skylines; sparklines show neon silhouettes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/radio/viz/Skyline.tsx frontend/src/components/charts/TrendLine.tsx frontend/src/components/charts/Sparkline.tsx
git commit -m "feat(radio): Skyline + Spire for trends/sparklines"
```

---

## Task 10: EQ (HRChart)

**Files:**
- Create: `frontend/src/radio/viz/EQ.tsx`
- Modify: `frontend/src/components/charts/HRChart.tsx`

- [ ] **Step 1: Write EQ**

Create `frontend/src/radio/viz/EQ.tsx`. Columns of stacked cells colored by HR zone, peak cap on top. Takes `data: number[]` (bpm or normalized) and `zoneAt(value)→0..4`.

```tsx
import { useRadioPhase } from "../phase";
const ZONE = ["#16d8e8", "#5BD3A0", "#E8C24B", "#E8743B", "#ff2d78"];

export function EQ({ data, height = 100, rows = 13 }: { data: number[]; height?: number; rows?: number }) {
	const { tokens } = useRadioPhase();
	const max = Math.max(1, ...data);
	return (
		<div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, width: "100%" }}>
			{data.map((v, c) => {
				const lit = Math.round((v / max) * rows);
				return (
					<div key={c} style={{ flex: 1, display: "flex", flexDirection: "column-reverse", gap: 2, height: "100%" }}>
						{Array.from({ length: rows }, (_, i) => {
							const on = i < lit, peak = i === lit;
							const z = ZONE[Math.min(4, Math.floor((i / rows) * 5))];
							return <span key={i} style={{ height: 6, borderRadius: 1, background: peak ? "#fff" : on ? z : "#ffffff10", boxShadow: peak ? "0 0 6px #fff" : on && tokens.glow > 0.3 ? `0 0 ${(3 + 3 * tokens.glow).toFixed(0)}px ${z}` : "none", opacity: on ? 0.5 + 0.5 * tokens.glow : 1 }} />;
						})}
					</div>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 2: Branch HRChart**

`frontend/src/components/charts/HRChart.tsx` already imports `themeAtom`. Add `import { EQ } from "../../radio/viz/EQ";` and:

```tsx
if (theme === "radio") {
	return <EQ data={/* hr samples as number[], downsampled to ~18 buckets */} />;
}
```

Downsample the existing HR series to ~18 columns (average per bucket) before passing.

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; dev → intraday HR shows the equalizer.

```bash
git add frontend/src/radio/viz/EQ.tsx frontend/src/components/charts/HRChart.tsx
git commit -m "feat(radio): EQ equalizer for intraday HR"
```

---

## Task 11: ZoneStack (HRZonesBar)

**Files:**
- Create: `frontend/src/radio/viz/ZoneStack.tsx`
- Modify: `frontend/src/components/charts/HRZonesBar.tsx`

- [ ] **Step 1: Write ZoneStack**

Create `frontend/src/radio/viz/ZoneStack.tsx`. Floors sized by minutes-per-zone.

```tsx
import { useRadioPhase } from "../phase";
const ZC: Record<number, string> = { 1: "#A3D9F5", 2: "#7EC8E3", 3: "#F5A623", 4: "#E8743B", 5: "#FF4F73" };

export function ZoneStack({ minutes, height = 124, width = 52 }: { minutes: Record<1 | 2 | 3 | 4 | 5, number>; height?: number; width?: number }) {
	const { tokens } = useRadioPhase();
	const tot = Math.max(1, (Object.values(minutes) as number[]).reduce((a, b) => a + b, 0));
	return (
		<div style={{ display: "flex", flexDirection: "column-reverse", gap: 3, width, height, justifyContent: "flex-end" }}>
			{[1, 2, 3, 4, 5].map((z) => {
				const h = (minutes[z as 1] / tot) * height;
				const c = ZC[z];
				return (
					<div key={z} style={{ height: h, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, background: c, color: z >= 3 ? "#fff" : "#0009", boxShadow: tokens.cp ? "inset 0 1px 0 #ffffff66,0 1px 2px #0003" : `0 0 8px ${c}88,inset 0 0 10px #ffffff22`, opacity: tokens.cp ? 1 : 0.92 }}>
						{h > 13 ? `Z${z}` : ""}
					</div>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 2: Branch HRZonesBar**

In `frontend/src/components/charts/HRZonesBar.tsx`, add theme atom + ZoneStack. Build the `minutes` map from its existing zone data:

```tsx
import { useAtomValue } from "jotai";
import { themeAtom } from "../../atoms/theme";
import { ZoneStack } from "../../radio/viz/ZoneStack";
// inside:
const theme = useAtomValue(themeAtom);
if (theme === "radio") {
	return <ZoneStack minutes={{ 1: z1, 2: z2, 3: z3, 4: z4, 5: z5 }} />;
}
```

Map `z1..z5` to the component's actual per-zone minute values.

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; dev → Workouts shows zone floors.

```bash
git add frontend/src/radio/viz/ZoneStack.tsx frontend/src/components/charts/HRZonesBar.tsx
git commit -m "feat(radio): ZoneStack for HR zones"
```

---

## Task 12: Facade (YearHeatStrip)

**Files:**
- Create: `frontend/src/radio/viz/Facade.tsx`
- Modify: `frontend/src/components/charts/YearHeatStrip.tsx`

- [ ] **Step 1: Write Facade**

Create `frontend/src/radio/viz/Facade.tsx`. A grid of window cells, each colored by its recovery value, glow graded by phase. Takes `weeks: number[][]` (or a flat `values: {v:number}[]` — adapt to YearHeatStrip's data shape; the gallery uses recovery index 0..4).

```tsx
import { useRadioPhase } from "../phase";
const REC = ["#FF4F73", "#F5A623", "#E8C24B", "#18C98B", "#2FE6A8"];

/** values: array of cells, each 0..100 recovery (or null for no-data). */
export function Facade({ values, cols = 53 }: { values: (number | null)[]; cols?: number }) {
	const { tokens } = useRadioPhase();
	return (
		<div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 2, padding: 6, border: `1px solid ${tokens.cp ? "#5a6a86" : "#241634"}`, borderRadius: 2 }}>
			{values.map((v, i) => {
				if (v === null) return <span key={i} style={{ aspectRatio: "1", borderRadius: 1, background: "#1a1228", opacity: 0.4 }} />;
				const c = REC[Math.min(4, Math.floor((v / 100) * 5))];
				return <span key={i} style={{ aspectRatio: "1", borderRadius: 1, background: c, opacity: 0.5 + 0.45 * tokens.glow, boxShadow: tokens.glow > 0.3 ? `0 0 ${(2 + 4 * tokens.glow).toFixed(0)}px ${c}` : "none" }} />;
			})}
		</div>
	);
}
```

- [ ] **Step 2: Branch YearHeatStrip**

In `frontend/src/components/charts/YearHeatStrip.tsx`, add theme atom + Facade and pass its existing day-cell values flattened to `(number|null)[]` (recovery 0..100, null when missing):

```tsx
if (theme === "radio") {
	return <Facade values={/* flat (number|null)[] of daily recovery */} cols={53} />;
}
```

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; dev → Trends recovery-year shows the glowing facade grid.

```bash
git add frontend/src/radio/viz/Facade.tsx frontend/src/components/charts/YearHeatStrip.tsx
git commit -m "feat(radio): Facade for recovery-year heat strip"
```

---

## Task 13: Hypnogram (SleepStagesChart)

**Files:**
- Create: `frontend/src/radio/viz/Hypnogram.tsx`
- Modify: `frontend/src/components/charts/SleepStagesChart.tsx`

- [ ] **Step 1: Write the styled hypnogram**

Create `frontend/src/radio/viz/Hypnogram.tsx`. A real stage timeline: x = time, y = stage band (Wake/REM/Light/Deep), neon-emissive segments connected as a step line. Takes `segments: { stage: "wake"|"rem"|"light"|"deep"; minutes: number }[]`.

```tsx
import { useRadioPhase } from "../phase";

const STAGE = { wake: { y: 0, c: "#E0476B" }, rem: { y: 1, c: "#5BE0C7" }, light: { y: 2, c: "#5C6FB1" }, deep: { y: 3, c: "#2C3A7A" } } as const;
type Stage = keyof typeof STAGE;

export function Hypnogram({ segments, width = 640, height = 160 }: { segments: { stage: Stage; minutes: number }[]; width?: number; height?: number }) {
	const { tokens } = useRadioPhase();
	const total = Math.max(1, segments.reduce((a, s) => a + s.minutes, 0));
	const bandH = height / 4;
	const yFor = (s: Stage) => STAGE[s].y * bandH + bandH / 2;
	// build step path + colored segments
	let x = 0;
	const rects = segments.map((seg, i) => {
		const w = (seg.minutes / total) * width;
		const y = STAGE[seg.stage].y * bandH + bandH * 0.25;
		const c = STAGE[seg.stage].c;
		const r = <rect key={i} x={x} y={y} width={Math.max(1, w - 1)} height={bandH * 0.5} rx={2} fill={c} opacity={0.55 + 0.45 * tokens.glow} style={tokens.glow > 0.3 ? { filter: `drop-shadow(0 0 5px ${c})` } : undefined} />;
		x += w;
		return r;
	});
	// connecting step line
	x = 0;
	let d = "";
	segments.forEach((seg, i) => {
		const y = yFor(seg.stage);
		d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
		x += (seg.minutes / total) * width;
		d += ` L ${x} ${y}`;
	});
	return (
		<svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
			{(["wake", "rem", "light", "deep"] as Stage[]).map((s) => (
				<text key={s} x={2} y={yFor(s) + 3} fontSize={8} fontFamily="ui-monospace,monospace" letterSpacing={1} fill={tokens.cp ? "#3a6b78" : "#6f6a82"} textTransform="uppercase">{s.toUpperCase()}</text>
			))}
			<path d={d} fill="none" stroke={tokens.cp ? "#7fd0ea" : "#16d8e8"} strokeWidth={1} opacity={0.4} />
			{rects}
		</svg>
	);
}
```

- [ ] **Step 2: Branch SleepStagesChart**

In `frontend/src/components/charts/SleepStagesChart.tsx`, add theme atom + Hypnogram and map its stage data to `{stage, minutes}[]` (normalize the chart's existing stage names to wake/rem/light/deep):

```tsx
if (theme === "radio") {
	return <Hypnogram segments={/* mapped segments */} />;
}
```

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; dev → Sleep shows the neon hypnogram with stage bands.

```bash
git add frontend/src/radio/viz/Hypnogram.tsx frontend/src/components/charts/SleepStagesChart.tsx
git commit -m "feat(radio): styled real hypnogram for sleep stages"
```

---

## Task 14: Content-page polish + verification pass

**Files:**
- Modify: `frontend/src/radio/radio.css` (add any per-content tweaks discovered)

- [ ] **Step 1: Walk every page in Radio theme**

Run dev, select Radio City, visit each route: `/ /sleep /recovery /strain /workouts /trends /insights /health-age /coach /journal /settings`.
For each: confirm (a) billboard title + active signboard correct, (b) charts render the Radio form, (c) text is legible against the gradient, (d) no layout overflow/clipping.

- [ ] **Step 2: Fix legibility issues in radio.css**

For any content-only page where default text is low-contrast on the gradient, add a `.radio .radio-card`-style wrapper or bump `--txt`/muted values. Keep changes in `radio.css` only.

- [ ] **Step 3: Reduced-motion check**

In OS settings enable "reduce motion" (or emulate in devtools). Reload Radio theme → confirm sky/dust/flicker are frozen, layout intact.

- [ ] **Step 4: Phase check across the day**

Visit `?timeFixture=dawn`, `?timeFixture=noon`, `?timeFixture=dusk`, `?timeFixture=night` → confirm gradient, accent, glow, and viz grade (cp chrome vs neon) change per phase and stay legible.

- [ ] **Step 5: Full test + typecheck**

Run: `cd frontend && npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/radio/radio.css
git commit -m "feat(radio): content-page legibility + verification pass"
```

---

## Self-review notes (spec coverage)

- Theme registration → Task 1 ✓
- Phase engine (solarClock, tokens, reduced-motion) → Task 2 ✓
- Shell (backdrop/sidebar/billboard/CRT) → Tasks 3–7 ✓
- 8 theme-aware viz (Dial×2, Skyline, Spire, EQ, ZoneStack, Facade, Hypnogram) → Tasks 8–13 ✓
- Tokens + content pages inherit → Tasks 3, 14 ✓
- Perf/reduced-motion + a11y/contrast → Tasks 2, 3, 14 ✓
- Out of scope (weather, manual override, hero scene, sleep canyon) → not built; rain layer left inert ✓

**Data-shape caveat for the executor:** Tasks 9–13 say "use the existing series / map to the shape." The exact prop/field names inside each chart component aren't quoted here because they must be read from the actual file at implementation time. Before writing each branch, open the chart file, identify the numeric series / per-zone / per-stage / per-day values it already computes, and pass those — do not invent new data fetching.
