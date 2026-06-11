import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Step = 'connect' | 'sync' | 'done';

interface AuthStatus {
  authenticated: boolean;
  email?: string;
}

interface SyncStatus {
  status: 'running' | 'done' | 'error';
  message?: string;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('connect');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    api<AuthStatus>('/auth/status')
      .then((s) => {
        setAuthStatus(s);
        if (s.authenticated) setStep('sync');
      })
      .catch(() => {
        // Not authenticated yet — stay on connect step
        setAuthStatus({ authenticated: false });
      });
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await api('/sync/start', { method: 'POST' });
      setSyncStatus({ status: 'running', message: 'Syncing your health data…' });

      // Poll for completion
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const status = await api<SyncStatus>('/sync/status');
          setSyncStatus(status);
          if (status.status === 'done') {
            clearInterval(poll);
            setSyncing(false);
            setStep('done');
          } else if (status.status === 'error') {
            clearInterval(poll);
            setSyncing(false);
            setError(status.message ?? 'Sync failed');
          }
        } catch {
          // ignore poll errors for a while
          if (attempts > 20) {
            clearInterval(poll);
            setSyncing(false);
            setError('Sync timed out. You can proceed and retry from Settings.');
          }
        }
      }, 2000);
    } catch (err) {
      setSyncing(false);
      setError(err instanceof Error ? err.message : 'Could not start sync');
    }
  }

  const steps: Array<{ key: Step; label: string; number: number }> = [
    { key: 'connect', label: 'Connect', number: 1 },
    { key: 'sync', label: 'Sync data', number: 2 },
    { key: 'done', label: 'Dashboard', number: 3 },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 py-12">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="text-3xl font-bold text-accent">AirMG</div>
        <div className="mt-1 text-sm text-text-secondary">Personal health intelligence</div>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i < currentIndex
                    ? 'bg-accent text-surface-base'
                    : i === currentIndex
                    ? 'border-2 border-accent text-accent'
                    : 'border border-hairline text-text-tertiary'
                }`}
              >
                {i < currentIndex ? '✓' : s.number}
              </div>
              <span
                className={`text-sm ${
                  i === currentIndex ? 'text-text-primary font-medium' : 'text-text-tertiary'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-8 ${i < currentIndex ? 'bg-accent' : 'bg-hairline'}`}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="w-full max-w-md border-hairline bg-surface-raised p-8 space-y-6">
        {/* Step 1: Connect */}
        {step === 'connect' && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-primary">Connect Google Health</h2>
              <p className="text-sm text-text-secondary">
                AirMG reads your health data from Google Fit / Health Connect.
                Sign in with Google to grant access — your data stays on your device.
              </p>
            </div>
            {error && <p className="text-sm text-status-critical">{error}</p>}
            <Button
              className="w-full bg-accent text-surface-base hover:bg-accent-hover font-semibold"
              onClick={() => {
                window.location.href = '/auth/login';
              }}
            >
              Sign in with Google
            </Button>
            <p className="text-xs text-center text-text-tertiary">
              Read-only access. You can revoke this at any time from your Google account.
            </p>
          </>
        )}

        {/* Step 2: Sync */}
        {step === 'sync' && (
          <>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-primary">Sync your data</h2>
              {authStatus?.email && (
                <p className="text-sm text-text-secondary">
                  Connected as <span className="text-accent">{authStatus.email}</span>
                </p>
              )}
              <p className="text-sm text-text-secondary">
                Pull your sleep, recovery, workouts and vitals from the last 90 days.
              </p>
            </div>

            {syncStatus && (
              <div className={`rounded-lg p-3 text-sm ${
                syncStatus.status === 'error'
                  ? 'bg-status-critical/10 text-status-critical'
                  : 'bg-accent-muted text-accent'
              }`}>
                {syncStatus.message ?? (syncStatus.status === 'running' ? 'Syncing…' : 'Done!')}
              </div>
            )}

            {error && <p className="text-sm text-status-critical">{error}</p>}

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-accent text-surface-base hover:bg-accent-hover font-semibold"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-surface-base border-t-transparent animate-spin" />
                    Syncing…
                  </span>
                ) : (
                  'Start sync'
                )}
              </Button>
              {error && (
                <Button
                  variant="outline"
                  className="border-hairline text-text-secondary"
                  onClick={() => setStep('done')}
                >
                  Skip
                </Button>
              )}
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <>
            <div className="space-y-2 text-center">
              <div className="text-4xl">✓</div>
              <h2 className="text-xl font-bold text-text-primary">You're all set!</h2>
              <p className="text-sm text-text-secondary">
                Your health data has been synced. Head to the dashboard to explore your recovery,
                sleep and strain trends.
              </p>
            </div>
            <Button
              className="w-full bg-accent text-surface-base hover:bg-accent-hover font-semibold"
              onClick={() => navigate('/')}
            >
              Go to dashboard
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
