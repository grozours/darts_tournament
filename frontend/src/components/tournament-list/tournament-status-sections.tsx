import type { CreatePlayerPayload, TournamentPlayer } from '../../services/tournament-service';
import type { Translator } from './types';
import RegistrationSection from './registration-section';
import SignatureSection from './signature-section';
import type { UnregisteredAccountOption } from './tournament-players-types';

type TournamentStatusSectionsProperties = {
  t: Translator;
  normalizedStatus: string;
  editingTournament: {
    format: string;
    totalParticipants: number;
  };
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError: string | undefined;
  playerForm: CreatePlayerPayload;
  editingPlayerId: string | undefined;
  checkingInPlayerId: string | undefined;
  playerActionLabel: string;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  isConfirmingAll: boolean;
  autoFillProgress: { current: number; total: number } | undefined;
  confirmAllProgress: { current: number; total: number } | undefined;
  skillLevelOptions: Array<{ value: string; label: string }>;
  onPlayerFormChange: (next: CreatePlayerPayload) => void;
  onStartEditPlayer: (player: TournamentPlayer) => void;
  onCancelEditPlayer: () => void;
  onSubmitPlayer: () => void;
  onAutoFillPlayers: () => void;
  onRemovePlayer: (playerId: string) => void;
  onFetchPlayers: () => void;
  onConfirmAllPlayers: () => void;
  onTogglePlayerCheckIn: (player: TournamentPlayer) => void;
  onSearchUnregisteredAccounts: (searchTerm: string) => Promise<UnregisteredAccountOption[]>;
  onRegisterPlayerFromAccount: (account: UnregisteredAccountOption) => void;
};

const TournamentStatusSections = ({
  t,
  normalizedStatus,
  editingTournament,
  players,
  playersLoading,
  playersError,
  playerForm,
  editingPlayerId,
  checkingInPlayerId,
  playerActionLabel,
  isRegisteringPlayer,
  isAutoFillingPlayers,
  isConfirmingAll,
  autoFillProgress,
  confirmAllProgress,
  skillLevelOptions,
  onPlayerFormChange,
  onStartEditPlayer,
  onCancelEditPlayer,
  onSubmitPlayer,
  onAutoFillPlayers,
  onRemovePlayer,
  onFetchPlayers,
  onConfirmAllPlayers,
  onTogglePlayerCheckIn,
  onSearchUnregisteredAccounts,
  onRegisterPlayerFromAccount,
}: TournamentStatusSectionsProperties) => (
  <>
    {normalizedStatus === 'OPEN' && (
      <RegistrationSection
        t={t}
        editingTournament={editingTournament}
        players={players}
        playersLoading={playersLoading}
        playersError={playersError}
        playerForm={playerForm}
        editingPlayerId={editingPlayerId}
        playerActionLabel={playerActionLabel}
        isRegisteringPlayer={isRegisteringPlayer}
        isAutoFillingPlayers={isAutoFillingPlayers}
        autoFillProgress={autoFillProgress}
        skillLevelOptions={skillLevelOptions}
        onPlayerFormChange={onPlayerFormChange}
        onStartEditPlayer={onStartEditPlayer}
        onCancelEditPlayer={onCancelEditPlayer}
        onSubmitPlayer={onSubmitPlayer}
        onAutoFillPlayers={onAutoFillPlayers}
        onRemovePlayer={onRemovePlayer}
        onFetchPlayers={onFetchPlayers}
        onSearchUnregisteredAccounts={onSearchUnregisteredAccounts}
        onRegisterPlayerFromAccount={onRegisterPlayerFromAccount}
      />
    )}
    {normalizedStatus === 'SIGNATURE' && (
      <SignatureSection
        t={t}
        players={players}
        playersLoading={playersLoading}
        playersError={playersError}
        checkingInPlayerId={checkingInPlayerId}
        isConfirmingAll={isConfirmingAll}
        confirmAllProgress={confirmAllProgress}
        onConfirmAllPlayers={onConfirmAllPlayers}
        onFetchPlayers={onFetchPlayers}
        onTogglePlayerCheckIn={onTogglePlayerCheckIn}
      />
    )}
  </>
);

export default TournamentStatusSections;
