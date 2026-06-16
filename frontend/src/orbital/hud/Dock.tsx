import {
  Activity,
  BookText,
  LineChart,
  Orbit,
  Settings,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router";

// console destinations — icons match Sidebar.tsx so both themes agree
const DOCK_ITEMS = [
  { path: "/workouts", label: "Workouts", icon: Activity },
  { path: "/trends", label: "Trends", icon: TrendingUp },
  { path: "/insights", label: "Insights", icon: Sparkles },
  { path: "/coach", label: "Coach", icon: Trophy },
  { path: "/journal", label: "Journal", icon: BookText },
  { path: "/health-age", label: "Health Age", icon: LineChart },
  { path: "/settings", label: "Settings", icon: Settings },
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
            <Orbit size={16} className="hud-dock-icon" />
            Orbit
          </button>
          <span className="hud-dock-divider" />
        </>
      )}
      {DOCK_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `hud-dock-item${isActive ? " is-active" : ""}`
            }
          >
            <Icon size={16} className="hud-dock-icon" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
