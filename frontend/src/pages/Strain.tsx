import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { StrainGauge } from '../components/charts/StrainGauge';
import { TrendLine } from '../components/charts/TrendLine';
import { MetricCard } from '../components/shared/MetricCard';
import { Card } from '@/components/ui/card';
import { formatScore } from '../lib/format';
import type { DailyMetrics } from '../lib/types';

interface StrainDetail {
  day: string;
  strain: number | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
}

interface WeekResponse {
  days: DailyMetrics[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDay(base: string, delta: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function Strain() {
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const { data, loading, error } = useApi<StrainDetail>(`/api/strain/${selectedDay}`);
  const { data: weekData } = useApi<WeekResponse>('/api/week');

  const trendPoints =
    weekData?.days?.map((d) => ({ day: d.day, value: d.strain })) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header + date nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Strain</h1>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setSelectedDay((d) => offsetDay(d, -1))}
          >
            ←
          </button>
          <span className="min-w-[100px] text-center text-sm text-text-secondary">{selectedDay}</span>
          <button
            className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setSelectedDay((d) => offsetDay(d, 1))}
            disabled={selectedDay >= todayStr()}
          >
            →
          </button>
          <button
            className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-accent hover:opacity-80"
            onClick={() => setSelectedDay(todayStr())}
          >
            Today
          </button>
        </div>
      </div>

      {loading && <div className="text-text-secondary">Loading…</div>}
      {error && <div className="text-sm text-status-critical">{error}</div>}

      {!loading && !data && (
        <Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
          No strain data for {selectedDay}.
        </Card>
      )}

      {data && (
        <>
          {/* Hero: gauge */}
          <Card className="border-hairline bg-surface-raised p-8">
            <div className="flex flex-col items-center gap-4">
              <StrainGauge strain={data.strain} size={220} />
              <div className="text-sm text-text-tertiary">Day strain for {selectedDay}</div>
            </div>
          </Card>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Calories"
              value={data.calories != null ? Math.round(data.calories).toLocaleString() : '--'}
              unit="kcal"
              color="text-metric-amber"
            />
            <MetricCard
              label="Avg HR"
              value={formatScore(data.avg_hr, 0)}
              unit="bpm"
              color="text-metric-rose"
            />
            <MetricCard
              label="Max HR"
              value={formatScore(data.max_hr, 0)}
              unit="bpm"
              color="text-status-critical"
            />
          </div>

          {/* 7-day strain trend */}
          {trendPoints.length >= 2 && (
            <Card className="border-hairline bg-surface-raised p-4 space-y-2">
              <div className="text-sm font-medium text-text-secondary">7-Day Strain Trend</div>
              <TrendLine data={trendPoints} color="#E8743B" domain={[0, 21]} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
