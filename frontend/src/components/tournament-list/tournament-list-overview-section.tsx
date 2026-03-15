import TournamentListGroups from './tournament-list-groups';
import { normalizeTournamentStatus } from './tournament-status-helpers';
import type {
  Tournament,
  TournamentListGroup,
  Translator,
  UserTournamentGroupStatus,
} from './types';

export type TournamentListOverviewSectionProperties = {
  isEditPage: boolean;
  visibleTournaments: Tournament[];
  groupedTournaments: TournamentListGroup[];
  isAdmin: boolean;
  isAuthenticated: boolean;
  t: Translator;
  userRegistrations: Set<string>;
  userGroupStatuses: Record<string, UserTournamentGroupStatus>;
  registeringTournamentId: string | undefined;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => Promise<void>;
  onRegister: (tournamentId: string) => Promise<void>;
  onRegisterGroup: (tournamentId: string) => Promise<void>;
  onUnregisterGroup: (tournamentId: string) => Promise<void>;
  onUnregister: (tournamentId: string) => Promise<void>;
  onOpenDraft: (tournamentId: string) => Promise<void>;
  onOpenLive: (tournamentId: string) => Promise<void>;
  onOpenRegistration: (tournamentId: string) => Promise<void>;
  onOpenSignature: (tournamentId: string) => Promise<void>;
  onAutoFillPlayers: (tournamentId: string) => Promise<void>;
  onConfirmAllPlayers: (tournamentId: string) => Promise<void>;
  hideOpenSignatureAction: boolean;
  showOpenAutoFillAction: boolean;
  showSignatureAutoConfirmAction: boolean;
  openingDraftId: string | undefined;
  openingLiveId: string | undefined;
  openingRegistrationId: string | undefined;
  openingSignatureId: string | undefined;
  autoFillingTournamentId: string | undefined;
  confirmingTournamentId: string | undefined;
  autoFillProgressByTournament: Record<string, { current: number; total: number } | undefined>;
  confirmAllProgressByTournament: Record<string, { current: number; total: number } | undefined>;
};

const TournamentListOverviewSection = ({
  isEditPage,
  visibleTournaments,
  groupedTournaments,
  isAdmin,
  isAuthenticated,
  t,
  userRegistrations,
  userGroupStatuses,
  registeringTournamentId,
  onEdit,
  onDelete,
  onRegister,
  onRegisterGroup,
  onUnregisterGroup,
  onUnregister,
  onOpenDraft,
  onOpenLive,
  onOpenRegistration,
  onOpenSignature,
  onAutoFillPlayers,
  onConfirmAllPlayers,
  hideOpenSignatureAction,
  showOpenAutoFillAction,
  showSignatureAutoConfirmAction,
  openingDraftId,
  openingLiveId,
  openingRegistrationId,
  openingSignatureId,
  autoFillingTournamentId,
  confirmingTournamentId,
  autoFillProgressByTournament,
  confirmAllProgressByTournament,
}: TournamentListOverviewSectionProperties) => {
  if (isEditPage) {
    return null;
  }

  if (visibleTournaments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
        <p className="text-lg font-semibold text-white">{t('tournaments.none')}</p>
        <p className="mt-2">{t('tournaments.none.subtitle')}</p>
      </div>
    );
  }

  return (
    <TournamentListGroups
      groupedTournaments={groupedTournaments}
      normalizeStatus={normalizeTournamentStatus}
      isAdmin={isAdmin}
      isAuthenticated={isAuthenticated}
      t={t}
      userRegistrations={userRegistrations}
      userGroupStatuses={userGroupStatuses}
      registeringTournamentId={registeringTournamentId}
      onEdit={onEdit}
      onDelete={onDelete}
      onRegister={onRegister}
      onRegisterGroup={onRegisterGroup}
      onUnregisterGroup={onUnregisterGroup}
      onUnregister={onUnregister}
      onOpenDraft={onOpenDraft}
      onOpenLive={onOpenLive}
      onOpenRegistration={onOpenRegistration}
      onOpenSignature={onOpenSignature}
      onAutoFillPlayers={onAutoFillPlayers}
      onConfirmAllPlayers={onConfirmAllPlayers}
      hideOpenSignatureAction={hideOpenSignatureAction}
      showOpenAutoFillAction={showOpenAutoFillAction}
      showSignatureAutoConfirmAction={showSignatureAutoConfirmAction}
      openingDraftId={openingDraftId}
      openingLiveId={openingLiveId}
      openingRegistrationId={openingRegistrationId}
      openingSignatureId={openingSignatureId}
      autoFillingTournamentId={autoFillingTournamentId}
      confirmingTournamentId={confirmingTournamentId}
      autoFillProgressByTournament={autoFillProgressByTournament}
      confirmAllProgressByTournament={confirmAllProgressByTournament}
    />
  );
};

export default TournamentListOverviewSection;
