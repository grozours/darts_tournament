import { useCallback, useEffect, useMemo, useState } from 'react';
import { TournamentFormat } from '@shared/types';
import { useOptionalAuth } from '../auth/optional-auth';
import SignInPanel from '../auth/sign-in-panel';
import {
  fetchDoublettes,
  fetchEquipes,
  fetchTournamentPlayers,
  type TournamentGroupEntity,
  type TournamentPlayer,
} from '../services/tournament-service';
import { useI18n } from '../i18n';

interface TournamentSummary {
  id: string;
  name: string;
  format: TournamentFormat | string;
  status: string;
  totalParticipants: number;
}

function RegistrationPlayers() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading: authLoading,
    getAccessTokenSilently,
  } = useOptionalAuth();

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [playersByTournament, setPlayersByTournament] = useState<Record<string, TournamentPlayer[]>>({});
  const [doublettesByTournament, setDoublettesByTournament] = useState<Record<string, TournamentGroupEntity[]>>({});
  const [equipesByTournament, setEquipesByTournament] = useState<Record<string, TournamentGroupEntity[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const formatSections = useMemo(
    () => [
      {
        title: t('registration.single'),
        format: TournamentFormat.SINGLE,
      },
      {
        title: t('registration.double'),
        format: TournamentFormat.DOUBLE,
      },
      {
        title: t('registration.team'),
        format: TournamentFormat.TEAM_4_PLAYER,
      },
    ],
    [t]
  );

  const visibleTournaments = useMemo(() => {
    return tournaments.filter((tournament) =>
      formatSections.some((section) => section.format === tournament.format)
    );
  }, [formatSections, tournaments]);

  // Helper to safely get access token, falling back to undefined if it fails
  const getSafeAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!authEnabled) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (error_) {
      console.warn('Failed to get access token, proceeding without auth:', error_);
      return undefined;
    }
  }, [authEnabled, getAccessTokenSilently]);

  const fetchRegistrationPlayers = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const token = await getSafeAccessToken();
      const requestOptions: RequestInit = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
      const response = await fetch('/api/tournaments?status=OPEN&limit=100', requestOptions);

      if (!response.ok) {
        throw new Error('Failed to fetch registration tournaments');
      }

      const data = await response.json();
      const registrationTournaments = (data.tournaments || []) as TournamentSummary[];

      const filtered = registrationTournaments.filter((tournament) =>
        formatSections.some((section) => section.format === tournament.format)
      );

      setTournaments(filtered);

      const singleTournaments = filtered.filter((tournament) => tournament.format === TournamentFormat.SINGLE);
      const doubleTournaments = filtered.filter((tournament) => tournament.format === TournamentFormat.DOUBLE);
      const teamTournaments = filtered.filter((tournament) => tournament.format === TournamentFormat.TEAM_4_PLAYER);

      const playersEntries = await Promise.all(
        singleTournaments.map(async (tournament) => {
          const players = await fetchTournamentPlayers(tournament.id, token);
          return [tournament.id, players] as const;
        })
      );

      const doubletteEntries = await Promise.all(
        doubleTournaments.map(async (tournament) => {
          const doublettes = await fetchDoublettes(tournament.id, token);
          return [tournament.id, doublettes.filter((doublette) => doublette.isRegistered)] as const;
        })
      );

      const equipeEntries = await Promise.all(
        teamTournaments.map(async (tournament) => {
          const equipes = await fetchEquipes(tournament.id, token);
          return [tournament.id, equipes.filter((equipe) => equipe.isRegistered)] as const;
        })
      );

      setPlayersByTournament(Object.fromEntries(playersEntries));
      setDoublettesByTournament(Object.fromEntries(doubletteEntries));
      setEquipesByTournament(Object.fromEntries(equipeEntries));
    } catch (error_) {
      console.error('Error fetching registration players:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to load registration players');
    } finally {
      setLoading(false);
    }
  }, [formatSections, getSafeAccessToken]);

  useEffect(() => {
    if (!authEnabled || isAuthenticated) {
      fetchRegistrationPlayers();
    }
  }, [authEnabled, isAuthenticated, fetchRegistrationPlayers]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('auth.checkingSession')}</span>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <SignInPanel
        title={t('auth.signInToViewRegistrationPlayers')}
        description={t('auth.protectedContinue')}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('registration.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={fetchRegistrationPlayers}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const getSlotCapacity = (tournament: TournamentSummary) => {
    return tournament.totalParticipants;
  };

  const renderGroupCards = (groups: TournamentGroupEntity[]) => {
    if (groups.length === 0) {
      return <p className="mt-4 text-sm text-slate-400">{t('registration.noneRegisteredGroups')}</p>;
    }

    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-100">{group.name}</p>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                {group.memberCount}
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {group.members.map((member) => (
                <li key={member.playerId} className="flex items-center gap-2">
                  <span>{member.firstName} {member.lastName}</span>
                  {member.playerId === group.captainPlayerId && (
                    <span className="rounded-full border border-violet-500/60 px-2 py-0.5 text-[10px] text-violet-200">
                      {t('groups.captain')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('registration.title')}</p>
          <h2 className="text-2xl font-semibold text-white mt-2">{t('registration.subtitle')}</h2>
        </div>
        <button
          onClick={fetchRegistrationPlayers}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          {t('common.refresh')}
        </button>
      </div>

      {visibleTournaments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-300">
          <p className="text-lg font-semibold text-white">{t('registration.none')}</p>
          <p className="mt-2">{t('registration.none.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {formatSections.map((section) => {
            const sectionTournaments = visibleTournaments.filter(
              (tournament) => tournament.format === section.format
            );

            return (
              <div key={section.format} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <span className="text-sm text-slate-400">{sectionTournaments.length}</span>
                </div>
                {sectionTournaments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                    {t('common.noCategory')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sectionTournaments.map((tournament) => {
                      const players = playersByTournament[tournament.id] || [];
                      const doublettes = doublettesByTournament[tournament.id] || [];
                      const equipes = equipesByTournament[tournament.id] || [];
                      const isSingleTournament = tournament.format === TournamentFormat.SINGLE;
                      const isDoubleTournament = tournament.format === TournamentFormat.DOUBLE;
                      const slots = getSlotCapacity(tournament);
                      let currentCount = equipes.length;
                      if (isSingleTournament) {
                        currentCount = players.length;
                      } else if (isDoubleTournament) {
                        currentCount = doublettes.length;
                      }
                      const countLabel = isSingleTournament
                        ? t('registration.playersCount')
                        : t('registration.slotsCount');
                      const groupsToRender = isDoubleTournament ? doublettes : equipes;

                      let registeredContent: JSX.Element;
                      if (isSingleTournament) {
                        if (players.length === 0) {
                          registeredContent = (
                            <p className="mt-4 text-sm text-slate-400">{t('registration.noneRegisteredPlayers')}</p>
                          );
                        } else {
                          registeredContent = (
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                              {players.map((player) => (
                                <div
                                  key={player.playerId}
                                  className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-2 text-sm"
                                >
                                  <div>
                                    <p className="text-slate-100">{player.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {player.email || t('registration.noEmail')}
                                    </p>
                                  </div>
                                  {player.skillLevel && (
                                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                                      {player.skillLevel}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                      } else {
                        registeredContent = renderGroupCards(groupsToRender);
                      }

                      return (
                        <div
                          key={tournament.id}
                          className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-lg font-semibold text-white">{tournament.name}</h4>
                              <p className="text-sm text-slate-400">
                                {currentCount} / {slots} {countLabel}
                              </p>
                            </div>
                            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                              {tournament.format}
                            </span>
                          </div>
                          {registeredContent}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RegistrationPlayers;
