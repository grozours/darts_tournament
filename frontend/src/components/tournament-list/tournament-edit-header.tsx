import type { Translator } from './types';

type TournamentEditHeaderProperties = {
  t: Translator;
  tournamentId: string;
  onClose: () => void;
};

const TournamentEditHeader = ({ t, tournamentId, onClose }: TournamentEditHeaderProperties) => (
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-white">{t('edit.title')}</h3>
    <div className="flex items-center gap-3">
      <a
        href={`/?view=tournament-players&tournamentId=${tournamentId}`}
        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
      >
        {t('tournaments.registered')}
      </a>
      <button
        onClick={onClose}
        className="text-sm text-slate-400 hover:text-white"
      >
        {t('edit.close')}
      </button>
    </div>
  </div>
);

export default TournamentEditHeader;
