import SignInPanel from '../../auth/sign-in-panel';
import { ErrorState, LoadingState } from '../shared/async-state';
import type { Translator } from './types';

type AuthErrorDetails = {
  code?: string;
  description?: string;
  state?: string;
};

type LiveTournamentGateProperties = {
  authLoading: boolean;
  authEnabled: boolean;
  isAuthenticated: boolean;
  authError?: Error | undefined;
  tournamentId?: string | undefined;
  requireTournamentId: boolean;
  loading: boolean;
  error?: string | undefined;
  onRetry: () => void;
  t: Translator;
};

const getAuthErrorDetails = (value: unknown): AuthErrorDetails => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;

  const details: AuthErrorDetails = {};
  if (typeof record.error === 'string') {
    details.code = record.error;
  }
  if (typeof record.error_description === 'string') {
    details.description = record.error_description;
  }
  if (typeof record.state === 'string') {
    details.state = record.state;
  }
  return details;
};

const LiveTournamentGate = ({
  authLoading,
  authEnabled,
  isAuthenticated,
  authError,
  tournamentId,
  requireTournamentId,
  loading,
  error,
  onRetry,
  t,
}: LiveTournamentGateProperties) => {
  const authErrorDetails = authError ? getAuthErrorDetails(authError) : {};
  const hasRecentAuthCallback = (() => {
    if (globalThis.window === undefined) return false;
    const parameters = new URLSearchParams(globalThis.window.location.search);
    if (parameters.has('code') || parameters.has('state')) return true;
    try {
      const stored = globalThis.window.sessionStorage.getItem('auth0:callback');
      if (!stored) return false;
      const timestamp = Number(stored);
      return Number.isFinite(timestamp) && Date.now() - timestamp < 2 * 60 * 1000;
    } catch {
      return false;
    }
  })();

  if (authLoading) {
    return <LoadingState label={t('auth.checkingSession')} />;
  }

  if (authEnabled && authError) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-2">{t('auth.signInFailed')}</div>
        <div className="text-xs text-rose-100/80 space-y-1">
          <div><strong>Error:</strong> {authError.message}</div>
          {authError.name && <div><strong>Type:</strong> {authError.name}</div>}
          {authErrorDetails.code && <div><strong>Code:</strong> {authErrorDetails.code}</div>}
          {authErrorDetails.description && (
            <div><strong>Description:</strong> {authErrorDetails.description}</div>
          )}
        </div>
        <div className="mt-4 text-xs text-rose-100/60">Check browser console for detailed logs</div>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className="space-y-4">
        {hasRecentAuthCallback && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <div className="text-amber-200 mb-2">{t('auth.signInFailed')}</div>
            <div className="text-xs text-amber-100/80">Auth callback detected but session not established.</div>
          </div>
        )}
        <SignInPanel
          title={t('auth.signInToViewLive')}
          description={t('auth.protectedContinue')}
        />
      </div>
    );
  }

  if (requireTournamentId && !tournamentId) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-300">{t('live.select')}</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingState label={t('live.loading')} />;
  }

  if (error) {
    return <ErrorState message={error} actionLabel={t('common.retry')} onRetry={onRetry} />;
  }

  return null;
};

export default LiveTournamentGate;
