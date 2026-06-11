import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { SleepStagesChart } from '../components/charts/SleepStagesChart';
import { MetricCard } from '../components/shared/MetricCard';
import { Card } from '@/components/ui/card';
import { formatMinutes, formatScore } from '../lib/format';
import type { SleepSession, DailyMetrics } from '../lib/types';

interface SleepApiResponse {
  session: SleepSession;
  metrics: DailyMetrics;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDay(base: string, delta: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function Sleep() {
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const { data, loading, error } = useApi<SleepApiResponse>(`/api/sleep/${selectedDay}`);

  const session = data?.session ?? null;
  const metrics = data?.metrics ?? null;

  const deepMin = metrics?.deep_minutes ?? null;
  const remMin = metrics?.rem_minutes ?? null;
  const lightMin = metrics?.light_minutes ?? null;
  const wakeMin = metrics?.wake_minutes ?? null;
  const totalMin = metrics?.sleep_minutes ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header + date nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sleep</h1>
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
            className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-accent hover:opacity-80 transition-opacity"
            onClick={() => setSelectedDay(todayStr())}
          >
            Today
          </button>
        </div>
      </div>

      {loading && <div className="text-text-secondary">Loading…</div>}
      {error && <div className="text-status-critical text-sm">{error}</div>}

      {!loading && !data && (
        <Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
          No sleep data for {selectedDay}.
        </Card>
      )}

      {data && (
        <>
          {/* Hero: stage breakdown */}
          <Card className="border-hairline bg-surface-raised p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-text-tertiary">Sleep</div>
                <div className="text-base font-semibold text-text-primary">Stage Breakdown</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-accent tabular-nums">
                  {formatMinutes(totalMin)}
                </div>
                <div className="text-xs text-text-tertiary">asleep</div>
              </div>
            </div>
            <SleepStagesChart
              stages={session?.stages ?? null}
              totalMinutes={totalMin}
              deepMinutes={deepMin}
              remMinutes={remMin}
              lightMinutes={lightMin}
              wakeMinutes={wakeMin}
            />
          </Card>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Sleep Performance"
              value={metrics?.sleep_performance != null ? `${Math.round(metrics.sleep_performance)}` : '--'}
              unit="%"
              color="text-accent"
            />
            <MetricCard
              label="Efficiency"
              value={session?.efficiency != null ? `${Math.round(session.efficiency <= 1 ? session.efficiency * 100 : session.efficiency)}` : '--'}
              unit="%"
              color="text-status-positive"
            />
            <MetricCard
              label="Resting HR"
              value={formatScore(session?.resting_hr ?? null)}
              unit="bpm"
              color="text-metric-rose"
            />
            <MetricCard
              label="HRV"
              value={formatScore(session?.avg_hrv ?? null, 0)}
              unit="ms"
              color="text-metric-purple"
            />
          </div>

          {/* Stage duration cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Deep" value={formatMinutes(deepMin)} color="text-sleep-deep" />
            <MetricCard label="REM" value={formatMinutes(remMin)} color="text-sleep-rem" />
            <MetricCard label="Light" value={formatMinutes(lightMin)} color="text-sleep-light" />
            <MetricCard label="Awake" value={formatMinutes(wakeMin)} color="text-sleep-awake" />
          </div>

          {/* Session times */}
          {session && (
            <Card className="border-hairline bg-surface-raised p-4">
              <div className="flex gap-6 text-sm text-text-secondary">
                <div>
                  <span className="mr-1 text-text-tertiary">Onset:</span>
                  {new Date(session.start_ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div>
                  <span className="mr-1 text-text-tertiary">Wake:</span>
                  {new Date(session.end_ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
