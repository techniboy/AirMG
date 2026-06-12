import { NavLink, useNavigate } from "react-router";

// console destinations — icons match Sidebar.tsx so both themes agree
const DOCK_ITEMS = [
  { path: "/workouts", label: "Workouts", icon: "▶" },
  { path: "/trends", label: "Trends", icon: "↗" },
  { path: "/insights", label: "Insights", icon: "◇" },
  { path: "/coach", label: "Coach", icon: "★" },
  { path: "/journal", label: "Journal", icon: "✎" },
  { path: "/health-age", label: "Health Age", icon: "∞" },
  { path: "/settings", label: "Settings", icon: "⚙" },
];

export default function Dock({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const inOrbit = pathname === "/";

  return (
    <nav className="hud-dock" aria-label="Console navigation">
      {!inOrbit && (
        <>
          <button
            type="button"
            className="hud-dock-item hud-dock-orbit"
            onClick={() => navigate("/")}
          >
            <span className="hud-dock-icon">◉</span>
            Orbit
          </button>
          <span className="hud-dock-divider" />
        </>
      )}
      {DOCK_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `hud-dock-item${isActive ? " is-active" : ""}`
          }
        >
          <span className="hud-dock-icon">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
