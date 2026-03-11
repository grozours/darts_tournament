import TournamentCard from './tournament-card';
import type {
  Tournament,
  TournamentListGroup,
  Translator,
  UserTournamentGroupStatus,
} from './types';

type TournamentListGroupsProperties = {
  groupedTournaments: TournamentListGroup[];
  normalizeStatus: (status?: string) => string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  t: Translator;
  userRegistrations: Set<string>;
  userGroupStatuses: Record<string, UserTournamentGroupStatus>;
  hideOpenSignatureAction?: boolean;
  showOpenAutoFillAction?: boolean;
  showSignatureAutoConfirmAction?: boolean;
  registeringTournamentId?: string;
  openingRegistrationId?: string;
  openingSignatureId?: string;
  autoFillingTournamentId?: string;
  confirmingTournamentId?: string;
  autoFillProgressByTournament?: Partial<Record<string, { current: number; total: number }>>;
  confirmAllProgressByTournament?: Partial<Record<string, { current: number; total: number }>>;
  onOpenRegistration: (tournamentId: string) => void;
  onOpenSignature: (tournamentId: string) => void;
  onAutoFillPlayers: (tournamentId: string) => void;
  onConfirmAllPlayers: (tournamentId: string) => void;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => void;
  onRegister: (tournamentId: string) => void;
  onRegisterGroup: (tournamentId: string) => void;
  onUnregisterGroup: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
};

const TournamentListGroups = ({
  groupedTournaments,
  normalizeStatus,
  isAdmin,
  isAuthenticated,
  t,
  userRegistrations,
  userGroupStatuses,
  hideOpenSignatureAction = false,
  showOpenAutoFillAction = false,
  showSignatureAutoConfirmAction = false,
  registeringTournamentId,
  openingRegistrationId,
  openingSignatureId,
  autoFillingTournamentId,
  confirmingTournamentId,
  autoFillProgressByTournament,
  confirmAllProgressByTournament,
  onEdit,
  onDelete,
  onRegister,
  onRegisterGroup,
  onUnregisterGroup,
  onUnregister,
  onOpenRegistration,
  onOpenSignature,
  onAutoFillPlayers,
  onConfirmAllPlayers,
}: TournamentListGroupsProperties) => (
  <div className="space-y-8">
    {groupedTournaments
      .filter((group) => isAdmin || group.status !== 'DRAFT')
      .map((group) => (
      <div key={group.status} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{group.title}</h3>
          <span className="text-sm text-slate-400">{group.items.length}</span>
        </div>
        {group.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            {t('common.noCategory')}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {group.items.map((tournament) => {
              const normalizedStatus = normalizeStatus(tournament.status);
              const isRegistered = userRegistrations.has(tournament.id);
              const showWaitingSignature =
                !isAdmin && normalizedStatus === 'SIGNATURE' && isRegistered;
              const statusLabel = showWaitingSignature
                ? t('tournaments.waitingSignature')
                : tournament.status;
              return (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  normalizedStatus={normalizedStatus}
                  statusLabel={statusLabel}
                  showWaitingSignature={showWaitingSignature}
                  isAdmin={isAdmin}
                  isAuthenticated={isAuthenticated}
                  t={t}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRegister={onRegister}
                  onRegisterGroup={onRegisterGroup}
                  onUnregisterGroup={onUnregisterGroup}
                  onUnregister={onUnregister}
                  onOpenRegistration={onOpenRegistration}
                  onOpenSignature={onOpenSignature}
                  onAutoFillPlayers={onAutoFillPlayers}
                  onConfirmAllPlayers={onConfirmAllPlayers}
                  hideOpenSignatureAction={hideOpenSignatureAction}
                  showOpenAutoFillAction={showOpenAutoFillAction}
                  showSignatureAutoConfirmAction={showSignatureAutoConfirmAction}
                  registeringTournamentId={registeringTournamentId}
                  openingRegistrationId={openingRegistrationId}
                  openingSignatureId={openingSignatureId}
                  autoFillingTournamentId={autoFillingTournamentId}
                  confirmingTournamentId={confirmingTournamentId}
                  autoFillProgress={autoFillProgressByTournament?.[tournament.id]}
                  confirmAllProgress={confirmAllProgressByTournament?.[tournament.id]}
                  userRegistrations={userRegistrations}
                  userGroupStatus={userGroupStatuses[tournament.id]}
                />
              );
            })}
          </div>
        )}
      </div>
    ))}
  </div>
);

export default TournamentListGroups;
