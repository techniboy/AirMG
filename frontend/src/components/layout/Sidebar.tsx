import { useAtomValue } from "jotai";
import { NavLink } from "react-router";
import { themeAtom } from "../../atoms/theme";
import { SidebarControls } from "./SidebarControls";

const NAV_ITEMS = [
	{ path: "/", label: "Today", icon: "◉" },
	{ path: "/sleep", label: "Sleep", icon: "◐" },
	{ path: "/recovery", label: "Recovery", icon: "♥" },
	{ path: "/strain", label: "Strain", icon: "⚡" },
	{ path: "/workouts", label: "Workouts", icon: "▶" },
	{ path: "/trends", label: "Trends", icon: "↗" },
	{ path: "/insights", label: "Insights", icon: "◇" },
	{ path: "/health-age", label: "Health Age", icon: "∞" },
	{ path: "/coach", label: "Coach", icon: "★" },
	{ path: "/journal", label: "Journal", icon: "✎" },
	{ path: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
	const theme = useAtomValue(themeAtom);
	const isGlass = theme === "liquid-glass";

	return (
		<nav className={`relative z-[1] flex w-16 flex-col gap-1 border-r border-hairline p-2 sm:w-56 sm:p-4 ${isGlass ? "lg-sidebar" : "bg-surface-raised"}`}>
			<div className="mb-6 px-2 text-center text-xl font-bold text-accent sm:text-left">
				<span className="sm:hidden">A</span>
				<span className="hidden sm:inline">AirMG</span>
			</div>
			{NAV_ITEMS.map((item) => (
				<NavLink
					key={item.path}
					to={item.path}
					end={item.path === "/"}
					className={({ isActive }) =>
						`flex items-center justify-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors sm:justify-start sm:px-3 ${
							isActive
								? isGlass
									? "lg-nav-active text-accent"
									: "bg-accent-muted text-accent"
								: "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
						}`
					}
				>
					<span className="w-5 text-center">{item.icon}</span>
					<span className="hidden sm:inline">{item.label}</span>
				</NavLink>
			))}
			<SidebarControls />
		</nav>
	);
}
