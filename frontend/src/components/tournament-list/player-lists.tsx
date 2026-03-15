import type { TournamentPlayer } from '../../services/tournament-service';
import type { JSX as ReactJSX } from 'react';
import type { Translator } from './types';
import { useAdminStatus } from '../../auth/use-admin-status';

export type PlayerListProperties = {
  players: TournamentPlayer[];
  playersLoading: boolean;
  t: Translator;
  onEdit: (player: TournamentPlayer) => void;
  onRemove: (playerId: string) => void;
};

export type SignatureListProperties = {
  players: TournamentPlayer[];
  playersLoading: boolean;
  t: Translator;
  checkingInPlayerId: string | undefined;
  onToggleCheckIn: (player: TournamentPlayer) => void;
};

type PlayerListBaseProperties = {
  players: TournamentPlayer[];
  playersLoading: boolean;
  t: Translator;
  renderActions: (player: TournamentPlayer) => ReactJSX.Element;
};

const getCheckInLabel = (
  player: TournamentPlayer,
  checkingInPlayerId: string | undefined,
  t: Translator
) => {
  if (checkingInPlayerId === player.playerId) {
    return t('edit.saving');
  }
  if (player.checkedIn) {
    return t('edit.undo');
  }
  return t('edit.confirmCheckIn');
};

export const RegistrationPlayersList = ({ players, playersLoading, t, onEdit, onRemove }: PlayerListProperties) => {
  const { isAdmin } = useAdminStatus();
  const renderActions = (player: TournamentPlayer) => (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && player.skillLevel && (
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          {player.skillLevel}
        </span>
      )}
      <button
        onClick={() => onEdit(player)}
        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
      >
        {t('edit.edit')}
      </button>
      <button
        onClick={() => onRemove(player.playerId)}
        className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
      >
        {t('edit.remove')}
      </button>
    </div>
  );

  return (
    <PlayerListBase
      players={players}
      playersLoading={playersLoading}
      t={t}
      renderActions={renderActions}
    />
  );
};

export const SignaturePlayersList = ({
  players,
  playersLoading,
  t,
  checkingInPlayerId,
  onToggleCheckIn,
}: SignatureListProperties) => {
  const { isAdmin } = useAdminStatus();
  const renderActions = (player: TournamentPlayer) => (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && player.skillLevel && (
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          {player.skillLevel}
        </span>
      )}
      <button
        onClick={() => onToggleCheckIn(player)}
        disabled={checkingInPlayerId === player.playerId}
        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
      >
        {getCheckInLabel(player, checkingInPlayerId, t)}
      </button>
    </div>
  );

  return (
    <PlayerListBase
      players={players}
      playersLoading={playersLoading}
      t={t}
      renderActions={renderActions}
    />
  );
};

const PlayerListBase = ({
  players,
  playersLoading,
  t,
  renderActions,
}: PlayerListBaseProperties) => {
  if (playersLoading) {
    return <p className="text-sm text-slate-400">{t('edit.loadingPlayers')}</p>;
  }

  if (players.length === 0) {
    return <p className="text-sm text-slate-400">{t('edit.noPlayersRegistered')}</p>;
  }

  return (
    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
      {players.map((player) => (
        <div
          key={player.playerId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-2 text-sm"
        >
          <div>
            <p className="text-slate-100">{player.name}</p>
            <p className="text-xs text-slate-500">
              {player.email || t('edit.noEmail')}
            </p>
          </div>
          {renderActions(player)}
        </div>
      ))}
    </div>
  );
};
