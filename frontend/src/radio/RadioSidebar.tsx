import { NavLink } from "react-router";
import { RADIO_LOGO, RADIO_NAV } from "./nav";

export function RadioSidebar() {
	return (
		<nav className="radio-rail">
			<div className="radio-logo">{RADIO_LOGO}</div>
			{RADIO_NAV.map((item) => {
				const Icon = item.icon;
				return (
					<NavLink
						key={item.path}
						to={item.path}
						end={item.path === "/"}
						className={({ isActive }) => `radio-sign${isActive ? " on" : ""}`}
					>
						<span className="kn">{item.kanji}</span>
						<Icon />
						<span className="en">{item.en}</span>
					</NavLink>
				);
			})}
		</nav>
	);
}
