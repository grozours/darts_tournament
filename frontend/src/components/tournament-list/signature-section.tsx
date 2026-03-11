import type { TournamentPlayer } from '../../services/tournament-service';
import type { Translator } from './types';
import { SignaturePlayersList } from './player-lists';

type SignatureSectionProperties = {
  t: Translator;
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError?: string;
  checkingInPlayerId?: string;
  isConfirmingAll: boolean;
  confirmAllProgress?: { current: number; total: number };
  onConfirmAllPlayers: () => void;
  onFetchPlayers: () => void;
  onTogglePlayerCheckIn: (player: TournamentPlayer) => void;
};

const SignatureSection = ({
  t,
  players,
  playersLoading,
  playersError,
  checkingInPlayerId,
  isConfirmingAll,
  confirmAllProgress,
  onConfirmAllPlayers,
  onFetchPlayers,
  onTogglePlayerCheckIn,
}: SignatureSectionProperties) => {
  let confirmAllLabel = t('edit.confirmAll');
  if (isConfirmingAll) {
    const progressLabel = confirmAllProgress
      ? ` (${confirmAllProgress.current}/${confirmAllProgress.total})`
      : '';
    confirmAllLabel = `${t('edit.confirming')}${progressLabel}`;
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-white">{t('edit.signatureCheckIn')}</h4>
          <p className="text-sm text-slate-400">
            {t('edit.confirmPresence')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onConfirmAllPlayers}
            disabled={isConfirmingAll || players.every((player) => player.checkedIn)}
            className="rounded-full border border-emerald-500/70 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
          >
            {confirmAllLabel}
          </button>
          <button
            onClick={onFetchPlayers}
            className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {playersError && <p className="mt-3 text-sm text-rose-300">{playersError}</p>}

      <div className="mt-6 space-y-2">
        <h5 className="text-sm font-semibold text-slate-200">{t('edit.registeredPlayers')}</h5>
        <SignaturePlayersList
          players={players}
          playersLoading={playersLoading}
          t={t}
          checkingInPlayerId={checkingInPlayerId}
          onToggleCheckIn={onTogglePlayerCheckIn}
        />
      </div>
    </div>
  );
};

export default SignatureSection;
