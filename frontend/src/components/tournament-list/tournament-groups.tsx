import TournamentCard from './tournament-card';
import type { Tournament, TournamentListGroup, Translator } from './types';

export type TournamentGroupsProperties = {
  groups: TournamentListGroup[];
  t: Translator;
  isAdmin: boolean;
  userRegistrations: Set<string>;
  registeringTournamentId: string | undefined;
  normalizeStatus: (status?: string) => string;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => void;
  onRegister: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
};

const TournamentGroups = ({
  groups,
  t,
  isAdmin,
  userRegistrations,
  registeringTournamentId,
  normalizeStatus,
  onEdit,
  onDelete,
  onRegister,
  onUnregister,
}: TournamentGroupsProperties) => (
  <div className="space-y-8">
    {groups.map((group) => (
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
              const showWaitingSignature =
                !isAdmin && normalizedStatus === 'SIGNATURE' && userRegistrations.has(tournament.id);
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
                  t={t}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRegister={onRegister}
                  onUnregister={onUnregister}
                  registeringTournamentId={registeringTournamentId}
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

export default TournamentGroups;
