import type { TournamentPlayer } from '../../services/tournament-service';
import type { Translator } from './types';

type TournamentEditFooterProperties = {
  t: Translator;
  normalizedStatus: string;
  isSaving: boolean;
  players: TournamentPlayer[];
  canOpenRegistration: boolean;
  onClose: () => void;
  onMoveToSignature: () => void;
  onMoveToLive: () => void;
  onOpenRegistration: () => void;
  onSaveEdit: () => void;
};

const TournamentEditFooter = ({
  t,
  normalizedStatus,
  isSaving,
  players,
  canOpenRegistration,
  onClose,
  onMoveToSignature,
  onMoveToLive,
  onOpenRegistration,
  onSaveEdit,
}: TournamentEditFooterProperties) => (
  <div className="mt-6 flex justify-end gap-3">
    <button
      onClick={onClose}
      className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
    >
      {t('common.cancel')}
    </button>
    {normalizedStatus === 'OPEN' && (
      <button
        onClick={onMoveToSignature}
        disabled={isSaving}
        className="rounded-full border border-indigo-500/70 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-300 disabled:opacity-60"
      >
        {t('edit.moveToSignature')}
      </button>
    )}
    {normalizedStatus === 'SIGNATURE' && (
      <button
        onClick={onMoveToLive}
        disabled={
          isSaving ||
          players.length === 0 ||
          !players.every((player) => player.checkedIn)
        }
        className="rounded-full border border-emerald-500/70 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
      >
        {t('edit.startLive')}
      </button>
    )}
    {normalizedStatus !== 'LIVE' && canOpenRegistration && (
      <button
        onClick={onOpenRegistration}
        disabled={isSaving || normalizedStatus === 'OPEN'}
        className="rounded-full border border-cyan-500/70 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:opacity-60"
      >
        {normalizedStatus === 'OPEN'
          ? t('edit.registrationOpen')
          : t('edit.openRegistration')}
      </button>
    )}
    <button
      onClick={onSaveEdit}
      disabled={isSaving}
      className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
    >
      {isSaving ? t('edit.saving') : t('edit.saveChanges')}
    </button>
  </div>
);

export default TournamentEditFooter;
