import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

export function Shell() {
	return (
		<div className="flex h-screen bg-surface-base text-text-primary">
			<Sidebar />
			<main className="flex-1 overflow-y-auto p-6">
				<Outlet />
			</main>
		</div>
	);
}
