/** Small fixed badge shown only in the static demo build (VITE_DEMO). */
export function DemoBanner() {
	return (
		<div className="pointer-events-none fixed bottom-3 left-3 z-[9998] rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white/80 shadow-lg backdrop-blur-sm">
			<span className="text-cyan-300">DEMO</span> · sample data, no backend
		</div>
	);
}
