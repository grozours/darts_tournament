import type { Tournament, Translator } from './types';

export type TournamentCardProperties = {
  tournament: Tournament;
  normalizedStatus: string;
  statusLabel: string;
  showWaitingSignature: boolean;
  isAdmin: boolean;
  t: Translator;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => void;
  onRegister: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
  registeringTournamentId?: string | undefined;
  userRegistrations: Set<string>;
};

const TournamentCard = ({
  tournament,
  normalizedStatus,
  statusLabel,
  showWaitingSignature,
  isAdmin,
  t,
  onEdit,
  onDelete,
  onRegister,
  onUnregister,
  registeringTournamentId,
  userRegistrations,
}: TournamentCardProperties) => (
  <div
    className="group relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)] transition hover:border-cyan-400/50 hover:shadow-[0_20px_60px_-40px_rgba(34,211,238,0.8)]"
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {tournament.name}
        </h3>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tournament.format}</p>
        <p className="mt-1 break-all text-xs text-slate-500">ID: {tournament.id}</p>
      </div>
      <span className="w-fit rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
        {statusLabel}
      </span>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.players')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{tournament.totalParticipants}</p>
      </div>
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.status')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{statusLabel}</p>
      </div>
    </div>

    {!showWaitingSignature && (
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <a
          href={`/?view=tournament-players&tournamentId=${tournament.id}`}
          className="w-full rounded-full border border-cyan-500/60 px-4 py-1.5 text-center text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 sm:w-auto"
        >
          {t('tournaments.registered')}
        </a>
        <a
          href={`/?view=pool-stages&tournamentId=${tournament.id}${normalizedStatus === 'FINISHED' ? '&status=FINISHED' : ''}`}
          className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
        >
          {t('nav.poolStagesShort')}
        </a>
        <a
          href={`/?view=brackets&tournamentId=${tournament.id}${normalizedStatus === 'FINISHED' ? '&status=FINISHED' : ''}`}
          className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
        >
          {t('nav.bracketsShort')}
        </a>
        {normalizedStatus === 'LIVE' && (
          <a
            href={`/?view=live&tournamentId=${tournament.id}`}
            className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 sm:w-auto"
          >
            {t('tournaments.viewLive')}
          </a>
        )}
        {isAdmin ? (
          <>
            <button
              onClick={() => onEdit(tournament)}
              className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
            >
              {t('tournaments.edit')}
            </button>
            <button
              onClick={() => onDelete(tournament.id)}
              className="w-full rounded-full border border-rose-500/60 px-4 py-1.5 text-center text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 sm:w-auto"
            >
              {t('tournaments.delete')}
            </button>
          </>
        ) : (
          <>
            {userRegistrations.has(tournament.id) ? (
              <button
                onClick={() => onUnregister(tournament.id)}
                disabled={registeringTournamentId === tournament.id}
                className="w-full rounded-full border border-amber-500/60 px-4 py-1.5 text-center text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {registeringTournamentId === tournament.id
                  ? t('common.loading')
                  : t('tournaments.unregister')}
              </button>
            ) : (
              <button
                onClick={() => onRegister(tournament.id)}
                disabled={registeringTournamentId === tournament.id}
                className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {registeringTournamentId === tournament.id
                  ? t('common.loading')
                  : t('tournaments.register')}
              </button>
            )}
          </>
        )}
      </div>
    )}
  </div>
);

export default TournamentCard;
