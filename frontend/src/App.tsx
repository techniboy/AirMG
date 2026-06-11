import { BrowserRouter, Route, Routes } from 'react-router';
import { Shell } from './components/layout/Shell';
import Today from './pages/Today';
import Sleep from './pages/Sleep';
import Recovery from './pages/Recovery';
import Strain from './pages/Strain';
import Workouts from './pages/Workouts';
import Trends from './pages/Trends';
import Insights from './pages/Insights';
import Coach from './pages/Coach';
import Journal from './pages/Journal';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';

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
          <Route path="coach" element={<Coach />} />
          <Route path="journal" element={<Journal />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
