import { useAtomValue } from "jotai";
import { lazy, Suspense } from "react";
import { Outlet } from "react-router";
import { themeAtom } from "../../atoms/theme";
import { Sidebar } from "./Sidebar";

const OrbitalWorld = lazy(() => import("../../orbital"));

function GlassBackground() {
	return (
		<div className="lg-bg-canvas">
			<div className="lg-bg-orb o1" />
			<div className="lg-bg-orb o2" />
			<div className="lg-bg-orb o3" />
			<div className="lg-bg-orb o4" />
		</div>
	);
}

export function Shell() {
	const theme = useAtomValue(themeAtom);
	const isGlass = theme === "liquid-glass";

	if (theme === "orbital") {
		return (
			<div className="orbital">
				<Suspense fallback={<div className="h-screen w-screen bg-black" />}>
					<OrbitalWorld />
				</Suspense>
			</div>
		);
	}

	return (
		<div className={`flex h-screen text-text-primary ${isGlass ? "liquid-glass bg-transparent" : "bg-surface-base"}`}>
			{isGlass && <GlassBackground />}
			<Sidebar />
			<main className="relative z-[1] flex-1 overflow-y-auto p-6">
				<Outlet />
			</main>
		</div>
	);
}
