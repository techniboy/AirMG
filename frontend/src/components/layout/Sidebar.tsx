import { useAtomValue } from "jotai";
import {
	Activity,
	BedDouble,
	BookText,
	HeartPulse,
	Home,
	LineChart,
	Settings,
	Sparkles,
	TrendingUp,
	Trophy,
	Zap,
} from "lucide-react";
import { NavLink } from "react-router";
import { themeAtom } from "../../atoms/theme";
import { SidebarControls } from "./SidebarControls";

const NAV_ITEMS = [
	{ path: "/", label: "Today", icon: Home },
	{ path: "/sleep", label: "Sleep", icon: BedDouble },
	{ path: "/recovery", label: "Recovery", icon: HeartPulse },
	{ path: "/strain", label: "Strain", icon: Zap },
	{ path: "/workouts", label: "Workouts", icon: Activity },
	{ path: "/trends", label: "Trends", icon: TrendingUp },
	{ path: "/insights", label: "Insights", icon: Sparkles },
	{ path: "/health-age", label: "Health Age", icon: LineChart },
	{ path: "/coach", label: "Coach", icon: Trophy },
	{ path: "/journal", label: "Journal", icon: BookText },
	{ path: "/settings", label: "Settings", icon: Settings },
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
			{NAV_ITEMS.map((item) => {
				const Icon = item.icon;
				return (
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
						<Icon size={18} className="shrink-0" />
						<span className="hidden sm:inline">{item.label}</span>
					</NavLink>
				);
			})}
			<SidebarControls />
		</nav>
	);
}
