import TournamentCard from './tournament-card';
import type { Tournament, TournamentListGroup, Translator } from './types';

type TournamentListGroupsProperties = {
  groupedTournaments: TournamentListGroup[];
  normalizeStatus: (status?: string) => string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  t: Translator;
  userRegistrations: Set<string>;
  registeringTournamentId?: string | undefined;
  openingRegistrationId?: string | undefined;
  openingSignatureId?: string | undefined;
  onOpenRegistration: (tournamentId: string) => void;
  onOpenSignature: (tournamentId: string) => void;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => void;
  onRegister: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
};

const TournamentListGroups = ({
  groupedTournaments,
  normalizeStatus,
  isAdmin,
  isAuthenticated,
  t,
  userRegistrations,
  registeringTournamentId,
  openingRegistrationId,
  openingSignatureId,
  onEdit,
  onDelete,
  onRegister,
  onUnregister,
  onOpenRegistration,
  onOpenSignature,
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
                  onUnregister={onUnregister}
                  onOpenRegistration={onOpenRegistration}
                  onOpenSignature={onOpenSignature}
                  registeringTournamentId={registeringTournamentId}
                  openingRegistrationId={openingRegistrationId}
                  openingSignatureId={openingSignatureId}
                  userRegistrations={userRegistrations}
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
