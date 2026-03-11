import type { Tournament, Translator } from './types';
import { normalizeTournamentStatus } from './tournament-status-helpers';

export type TournamentListHeaderProperties = {
  isEditPage: boolean;
  editingTournament: Tournament | undefined;
  tournamentsCount: number;
  t: Translator;
};

const TournamentListHeader = ({
  isEditPage,
  editingTournament,
  tournamentsCount,
  t,
}: TournamentListHeaderProperties) => {
  if (isEditPage) {
    const normalizedStatus = normalizeTournamentStatus(editingTournament?.status);
    const editingTournamentId = editingTournament?.id;
    const canShowLiveLinks = Boolean(
      editingTournamentId && ['OPEN', 'SIGNATURE', 'LIVE'].includes(normalizedStatus)
    );
    return (
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('edit.title')}</p>
          <h2 className="text-2xl font-semibold text-white mt-2">
            {t('edit.title')}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canShowLiveLinks && (
            <a
              href={`/?view=pool-stages&tournamentId=${editingTournamentId}`}
              className="rounded-full border border-emerald-400/70 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300"
            >
              {t('nav.poolStagesRunning')}
            </a>
          )}
          {canShowLiveLinks && (
            <a
              href={`/?view=brackets&tournamentId=${editingTournamentId}`}
              className="rounded-full border border-amber-400/70 px-4 py-2 text-xs font-semibold text-amber-200 hover:border-amber-300"
            >
              {t('nav.bracketsRunning')}
            </a>
          )}
          {canShowLiveLinks && (
            <a
              href={`/?view=brackets&tournamentId=${editingTournamentId}&status=FINISHED`}
              className="rounded-full border border-slate-600/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              {t('nav.bracketsFinished')}
            </a>
          )}
          <a
            href="/?status=DRAFT"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            {t('common.cancel')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('tournaments.hub')}</p>
        <h2 className="text-2xl font-semibold text-white mt-2">
          {t('tournaments.hub')} <span className="text-slate-400">({tournamentsCount})</span>
        </h2>
      </div>
    </div>
  );
};

export default TournamentListHeader;
