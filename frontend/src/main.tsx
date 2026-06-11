import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { queryClient } from "./atoms/query.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<JotaiProvider>
				<App />
			</JotaiProvider>
		</QueryClientProvider>
	</StrictMode>,
);
