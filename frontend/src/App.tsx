import { BrowserRouter, Route, Routes } from 'react-router';
import { Shell } from './components/layout/Shell';
import Today from './pages/Today';

function Placeholder({ name }: { name: string }) {
  return <div className="text-text-secondary">{name} — coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Today />} />
          <Route path="sleep" element={<Placeholder name="Sleep" />} />
          <Route path="recovery" element={<Placeholder name="Recovery" />} />
          <Route path="strain" element={<Placeholder name="Strain" />} />
          <Route path="workouts" element={<Placeholder name="Workouts" />} />
          <Route path="trends" element={<Placeholder name="Trends" />} />
          <Route path="insights" element={<Placeholder name="Insights" />} />
          <Route path="coach" element={<Placeholder name="Coach" />} />
          <Route path="journal" element={<Placeholder name="Journal" />} />
          <Route path="settings" element={<Placeholder name="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
