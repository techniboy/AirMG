import { NavLink } from "react-router";

const NAV_ITEMS = [
	{ path: "/", label: "Today", icon: "◉" },
	{ path: "/sleep", label: "Sleep", icon: "◐" },
	{ path: "/recovery", label: "Recovery", icon: "♥" },
	{ path: "/strain", label: "Strain", icon: "⚡" },
	{ path: "/workouts", label: "Workouts", icon: "▶" },
	{ path: "/trends", label: "Trends", icon: "↗" },
	{ path: "/insights", label: "Insights", icon: "◇" },
	{ path: "/coach", label: "Coach", icon: "★" },
	{ path: "/journal", label: "Journal", icon: "✎" },
	{ path: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
	return (
		<nav className="flex w-56 flex-col gap-1 border-r border-hairline bg-surface-raised p-4">
			<div className="mb-6 px-2 text-xl font-bold text-accent">AirMG</div>
			{NAV_ITEMS.map((item) => (
				<NavLink
					key={item.path}
					to={item.path}
					end={item.path === "/"}
					className={({ isActive }) =>
						`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
							isActive
								? "bg-accent-muted text-accent"
								: "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
						}`
					}
				>
					<span className="w-5 text-center">{item.icon}</span>
					{item.label}
				</NavLink>
			))}
		</nav>
	);
}
