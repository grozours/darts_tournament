import type { ReactNode } from 'react';
import type { Translator } from './types';

export type TournamentListStateGateProperties = {
  authLoading: boolean;
  isEditPage: boolean;
  loading: boolean;
  error: string | undefined;
  refreshTournaments: () => void;
  t: Translator;
  children: ReactNode;
};

const TournamentListStateGate = ({
  authLoading,
  isEditPage,
  loading,
  error,
  refreshTournaments,
  t,
  children,
}: TournamentListStateGateProperties) => {
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('auth.checkingSession')}</span>
      </div>
    );
  }

  if (!isEditPage && loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('tournaments.loading')}</span>
      </div>
    );
  }

  if (!isEditPage && error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={refreshTournaments}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default TournamentListStateGate;
