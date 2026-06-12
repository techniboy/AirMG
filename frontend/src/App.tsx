import { BrowserRouter, Route, Routes } from "react-router";
import { Shell } from "./components/layout/Shell";
import Coach from "./pages/Coach";
import HealthAge from "./pages/HealthAge";
import Insights from "./pages/Insights";
import Journal from "./pages/Journal";
import Onboarding from "./pages/Onboarding";
import Recovery from "./pages/Recovery";
import Settings from "./pages/Settings";
import Sleep from "./pages/Sleep";
import Strain from "./pages/Strain";
import Today from "./pages/Today";
import Trends from "./pages/Trends";
import Workouts from "./pages/Workouts";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="onboarding" element={<Onboarding />} />
				<Route element={<Shell />}>
					<Route index element={<Today />} />
					<Route path="sleep" element={<Sleep />} />
					<Route path="recovery" element={<Recovery />} />
					<Route path="strain" element={<Strain />} />
					<Route path="workouts" element={<Workouts />} />
					<Route path="trends" element={<Trends />} />
					<Route path="insights" element={<Insights />} />
					<Route path="health-age" element={<HealthAge />} />
					<Route path="coach" element={<Coach />} />
					<Route path="journal" element={<Journal />} />
					<Route path="settings" element={<Settings />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
