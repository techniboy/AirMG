import { useLocation } from "react-router";
import { RADIO_NAV } from "./nav";

export function RadioBillboard() {
	const { pathname } = useLocation();
	const item =
		RADIO_NAV.find((n) => n.path === pathname) ??
		RADIO_NAV.find((n) => n.path !== "/" && pathname.startsWith(n.path)) ??
		RADIO_NAV[0];
	const title = item.title;
	const head = title.slice(0, -1);
	const last = title.slice(-1);
	return (
		<div className="radio-bb">
			<div className="radio-tube">
				{head}
				<span className="x">{last}</span>
			</div>
			<div className="radio-mount">
				<div className="kana">{item.kana}</div>
				<div className="small">{item.en}</div>
			</div>
		</div>
	);
}
