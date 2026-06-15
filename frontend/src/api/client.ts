import { demoRequest } from "./demo";

const BASE = "";
const DEMO = import.meta.env.VITE_DEMO === "1";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
	if (DEMO) {
		await new Promise((r) => setTimeout(r, 80)); // tiny latency so spinners flash naturally
		return demoRequest(path, options) as T;
	}
	const res = await fetch(`${BASE}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});
	if (res.status === 401) {
		window.location.href = "/auth/login";
		throw new Error("Session expired — redirecting to login");
	}
	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`);
	}
	return res.json();
}
