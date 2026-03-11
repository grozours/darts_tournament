import { useCallback, useEffect, useMemo, useState } from 'react';
import { SkillLevel } from '@shared/types';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';
import {
  addDoubletteMember,
  addEquipeMember,
  createDoublette,
  createEquipe,
  deleteDoublette,
  deleteEquipe,
  fetchDoublettes,
  fetchEquipes,
  type GroupSearchPlayerEntity,
  joinDoublette,
  joinEquipe,
  leaveDoublette,
  leaveEquipe,
  removeDoubletteMember,
  removeEquipeMember,
  registerDoublette,
  registerEquipe,
  registerTournamentPlayer,
  unregisterDoublette,
  unregisterEquipe,
  searchGroupPlayers,
  type TournamentGroupEntity,
  updateTournamentPlayer,
  updateDoublette,
  updateDoublettePassword,
  updateEquipe,
  updateEquipePassword,
} from '../services/tournament-service';

type GroupMode = 'doublettes' | 'equipes';

type GroupsViewProperties = {
  mode: GroupMode;
};

type GroupEditorState = {
  groupId: string;
  type: 'rename' | 'password' | 'add-member' | 'join-password';
};

type OpenTournamentSummary = {
  id: string;
  name?: string;
  format?: string;
  status?: string;
};

type GroupWithTournamentContext = TournamentGroupEntity & {
  tournamentId: string;
  tournamentName?: string;
};

type MemberEditorState = {
  groupId: string;
  playerId: string;
  firstName: string;
  lastName: string;
  surname: string;
  email: string;
};

const requiredMembersByMode: Record<GroupMode, number> = {
  doublettes: 2,
  equipes: 4,
};

const isValidEmailFormat = (value: string): boolean => {
  if (value.length === 0 || value.includes(' ')) {
    return false;
  }

  const [localPart, ...domainParts] = value.split('@');
  if (!localPart || domainParts.length !== 1) {
    return false;
  }

  const domainPart = domainParts[0] ?? '';
  if (localPart.length === 0 || domainPart.length < 3) {
    return false;
  }

  const domainSegments = domainPart.split('.');
  if (domainSegments.length < 2 || domainSegments.some((segment) => segment.length === 0)) {
    return false;
  }

  return !domainPart.startsWith('.') && !domainPart.endsWith('.') && !domainPart.includes('..');
};

const normalizeTournamentStatus = (status?: string): string => {
  if (!status) {
    return '';
  }

  const normalized = status.trim().toUpperCase();
  switch (normalized) {
    case 'REGISTRATION_OPEN':
      return 'OPEN';
    case 'IN_PROGRESS':
      return 'LIVE';
    case 'COMPLETED':
    case 'ARCHIVED':
      return 'FINISHED';
    default:
      return normalized;
  }
};

const toSkillLevelLabel = (value: SkillLevel, t: (key: string) => string): string => {
  switch (value) {
    case SkillLevel.BEGINNER:
      return t('skill.beginner');
    case SkillLevel.INTERMEDIATE:
      return t('skill.intermediate');
    case SkillLevel.ADVANCED:
      return t('skill.advanced');
    case SkillLevel.EXPERT:
      return t('skill.expert');
    default:
      return value;
  }
};

const GroupsView = ({ mode }: GroupsViewProperties) => {
  const { t } = useI18n();
  const { enabled, isAuthenticated, getAccessTokenSilently, user } = useOptionalAuth();
  const { isAdmin, adminUser } = useAdminStatus();

  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();
  const tournamentIdFromUrl = parameters.get('tournamentId') ?? '';

  const [groups, setGroups] = useState<GroupWithTournamentContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [availableTournaments, setAvailableTournaments] = useState<OpenTournamentSummary[]>([]);
  const [selectedTournamentFilterId, setSelectedTournamentFilterId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [activeEditor, setActiveEditor] = useState<GroupEditorState | undefined>();
  const [renameValue, setRenameValue] = useState('');
  const [groupSkillLevelValue, setGroupSkillLevelValue] = useState<SkillLevel | ''>('');
  const [passwordValue, setPasswordValue] = useState('');
  const [joinPasswordValue, setJoinPasswordValue] = useState('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [memberSearchResults, setMemberSearchResults] = useState<GroupSearchPlayerEntity[]>([]);
  const [quickCreateFirstName, setQuickCreateFirstName] = useState('');
  const [quickCreateLastName, setQuickCreateLastName] = useState('');
  const [quickCreateSurname, setQuickCreateSurname] = useState('');
  const [quickCreateEmail, setQuickCreateEmail] = useState('');
  const [createCaptainSearchTerm, setCreateCaptainSearchTerm] = useState('');
  const [createCaptainSearchLoading, setCreateCaptainSearchLoading] = useState(false);
  const [createCaptainSearchResults, setCreateCaptainSearchResults] = useState<GroupSearchPlayerEntity[]>([]);
  const [createCaptainPlayerId, setCreateCaptainPlayerId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournamentIdFromUrl);
  const [tournamentStatusesById, setTournamentStatusesById] = useState<Record<string, string>>({});
  const [activeMemberEditor, setActiveMemberEditor] = useState<MemberEditorState | undefined>();

  const effectiveUserEmail = useMemo(
    () => (user?.email ?? adminUser?.email)?.toLowerCase(),
    [adminUser?.email, user?.email]
  );
  const effectiveIsAuthenticated = isAuthenticated || Boolean(adminUser?.id);
  const requiredMembers = requiredMembersByMode[mode];
  const quickCreateEmailTrimmed = quickCreateEmail.trim();
  const quickCreateEmailIsValid =
    quickCreateEmailTrimmed.length === 0 || isValidEmailFormat(quickCreateEmailTrimmed);

  const title = mode === 'doublettes' ? t('groups.doublettes') : t('groups.equipes');
  const registerLabel = mode === 'doublettes' ? t('groups.registerDoublette') : t('groups.registerEquipe');

  const getToken = useCallback(async () => {
    if (!enabled || !isAuthenticated) {
      return undefined;
    }
    return await getAccessTokenSilently();
  }, [enabled, getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    setSelectedTournamentId(tournamentIdFromUrl);
  }, [tournamentIdFromUrl]);

  const fetchOpenTournaments = useCallback(async (token: string | undefined) => {
    const allowedStatuses = new Set(['OPEN', 'SIGNATURE', 'LIVE']);
    const requestOptions = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
    const toTournamentSummaries = (payload: unknown): OpenTournamentSummary[] => {
      const tournaments = Array.isArray((payload as { tournaments?: unknown[] })?.tournaments)
        ? (payload as { tournaments: Array<{ id?: string; name?: string; format?: string; status?: string }> }).tournaments
        : [];

      return tournaments
        .filter((tournament): tournament is OpenTournamentSummary => Boolean(tournament.id))
        .map((tournament) => ({
          id: tournament.id,
          ...(tournament.name ? { name: tournament.name } : {}),
          ...(tournament.format ? { format: tournament.format } : {}),
          ...(tournament.status ? { status: tournament.status } : {}),
        }));
    };

    const response = await fetch('/api/tournaments?limit=100', requestOptions);
    if (!response.ok) {
      throw new Error('Failed to fetch tournaments');
    }

    const tournaments = toTournamentSummaries(await response.json());
    const activeStatusTournaments = tournaments.filter((tournament) =>
      allowedStatuses.has((tournament.status ?? '').toUpperCase())
    );

    return activeStatusTournaments.length > 0 ? activeStatusTournaments : tournaments;
  }, []);

  const fetchTournamentStatuses = useCallback(async (token: string | undefined) => {
    const requestOptions = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
    const response = await fetch('/api/tournaments?limit=100', requestOptions);
    if (!response.ok) {
      throw new Error('Failed to fetch tournaments');
    }

    const payload = await response.json() as { tournaments?: Array<{ id?: string; status?: string }> };
    const tournaments = Array.isArray(payload.tournaments) ? payload.tournaments : [];
    return tournaments.reduce<Record<string, string>>((accumulator, tournament) => {
      if (typeof tournament.id === 'string' && tournament.id.length > 0) {
        accumulator[tournament.id] = normalizeTournamentStatus(tournament.status);
      }
      return accumulator;
    }, {});
  }, []);

  const loadGroups = useCallback(async () => { // NOSONAR
    setLoading(true);
    setError(undefined);
    try {
      const token = await getToken();
      try {
        const tournamentStatuses = await fetchTournamentStatuses(token);
        setTournamentStatusesById(tournamentStatuses);
      } catch {
        // Keep group listing functional when status lookup is unavailable.
        setTournamentStatusesById({});
      }

      if (selectedTournamentId) {
        setAvailableTournaments([]);
        const items = mode === 'doublettes'
          ? await fetchDoublettes(selectedTournamentId, token, search || undefined)
          : await fetchEquipes(selectedTournamentId, token, search || undefined);
        setGroups(items.map((group) => ({ ...group, tournamentId: selectedTournamentId })));
        return;
      }

      const tournaments = await fetchOpenTournaments(token);
      setAvailableTournaments(tournaments);

      if (selectedTournamentFilterId && !tournaments.some((tournament) => tournament.id === selectedTournamentFilterId)) {
        setSelectedTournamentFilterId('');
      }

      const tournamentsToLoad = selectedTournamentFilterId
        ? tournaments.filter((tournament) => tournament.id === selectedTournamentFilterId)
        : tournaments;

      if (tournamentsToLoad.length === 0) {
        setGroups([]);
        return;
      }

      const groupBatches = await Promise.allSettled(
        tournamentsToLoad.map(async (tournament) => {
          const tournamentGroups = mode === 'doublettes'
            ? await fetchDoublettes(tournament.id, token, search || undefined)
            : await fetchEquipes(tournament.id, token, search || undefined);
          return {
            tournament,
            groups: tournamentGroups.map((group) => ({
              ...group,
              tournamentId: tournament.id,
              ...(tournament.name ? { tournamentName: tournament.name } : {}),
            })),
          };
        })
      );

      const fulfilledBatches = groupBatches.filter(
        (result): result is PromiseFulfilledResult<{ tournament: OpenTournamentSummary; groups: GroupWithTournamentContext[] }> =>
          result.status === 'fulfilled'
      );

      if (!selectedTournamentFilterId) {
        setAvailableTournaments(fulfilledBatches.map((result) => result.value.tournament));
      }

      if (fulfilledBatches.length === 0 && tournamentsToLoad.length > 0) {
        const firstRejected = groupBatches.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );
        if (firstRejected) {
          throw firstRejected.reason;
        }
      }

      setGroups(fulfilledBatches.flatMap((result) => result.value.groups));
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [fetchOpenTournaments, fetchTournamentStatuses, getToken, mode, search, selectedTournamentFilterId, selectedTournamentId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const visibleGroups = groups;

  let content: JSX.Element;

  if (loading) {
    content = <div className="text-sm text-slate-300">{t('common.loading')}</div>;
  } else if (visibleGroups.length === 0) {
    content = (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-300">
        {t('groups.none')}
      </div>
    );
  } else {
    content = (
      <div className="grid gap-3">
        {visibleGroups.map((group) => { // NOSONAR
          const member = group.members.find((item) => item.email?.toLowerCase() === effectiveUserEmail);
          const isMember = Boolean(member);
          const isCaptain = member?.playerId === group.captainPlayerId;
          const canManageGroup = isAdmin || (isMember && isCaptain);
          const canJoin = effectiveIsAuthenticated && !isMember && !group.isRegistered && group.memberCount < requiredMembers;
          const normalizedTournamentStatus = tournamentStatusesById[group.tournamentId] ?? '';
          const isLiveOrArchivedTournament = normalizedTournamentStatus === 'LIVE' || normalizedTournamentStatus === 'FINISHED';
          const canRegister = (isCaptain || isAdmin) && !group.isRegistered && group.memberCount === requiredMembers;
          const canUnregister = group.isRegistered && (isAdmin || isCaptain) && !isLiveOrArchivedTournament;
          const canLeave = isMember && !group.isRegistered;
          const canDelete = isAdmin || (canManageGroup && !group.isRegistered);
          const canChangePassword = isAdmin || (canManageGroup && !group.isRegistered);
          const canRename = isAdmin || (canManageGroup && !group.isRegistered);
          const canAddMember = isAdmin && group.memberCount < requiredMembers;
          const canRemoveMembers = isAdmin || (canManageGroup && !group.isRegistered);
          const canEditMembers = mode === 'doublettes' && (isAdmin || (canManageGroup && !group.isRegistered));
          const registerButtonLabel = isAdmin ? 'inscrire' : registerLabel;
          const unregisterButtonLabel = isAdmin ? 'desinscrire' : t('tournaments.unregister');

          return (
            <div key={group.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{group.name}</h3>
                  <p className="text-xs text-slate-400">
                    {group.memberCount}/{requiredMembers} · {group.isRegistered ? t('groups.registered') : t('groups.notRegistered')}
                  </p>
                  {group.skillLevel && (
                    <p className="text-xs text-slate-400">{t('edit.skillLevel')}: {toSkillLevelLabel(group.skillLevel, t)}</p>
                  )}
                  {!selectedTournamentId && group.tournamentName && (
                    <p className="text-xs text-slate-500">{group.tournamentName}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canJoin && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        openJoinEditor(group.id);
                      }}
                      className="rounded-full border border-cyan-500/60 px-3 py-1 text-xs font-semibold text-cyan-200"
                    >
                      {t('groups.join')}
                    </button>
                  )}
                  {canRename && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        if (isAdmin) {
                          openAddMemberEditor(group.id, group.name, group.skillLevel ?? null);
                          return;
                        }
                        openRenameEditor(group.id, group.name);
                      }}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                    >
                      {t('common.edit')}
                    </button>
                  )}
                  {canAddMember && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        openAddMemberEditor(group.id, group.name, group.skillLevel ?? null);
                      }}
                      className="rounded-full border border-indigo-500/60 px-3 py-1 text-xs font-semibold text-indigo-200"
                    >
                      {t('groups.addMember')}
                    </button>
                  )}
                  {canRegister && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void handleRegister(group.id, group.tournamentId);
                      }}
                      className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs font-semibold text-emerald-200"
                    >
                      {registerButtonLabel}
                    </button>
                  )}
                  {canUnregister && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void handleUnregister(group.id, group.tournamentId);
                      }}
                      className="rounded-full border border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-200"
                    >
                      {unregisterButtonLabel}
                    </button>
                  )}
                  {canLeave && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void handleLeave(group.id, group.tournamentId);
                      }}
                      className="rounded-full border border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-200"
                    >
                      {t('groups.leave')}
                    </button>
                  )}
                  {canChangePassword && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        openPasswordEditor(group.id);
                      }}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                    >
                      {t('groups.changePassword')}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void handleDelete(group.id, group.tournamentId);
                      }}
                      className="rounded-full border border-rose-500/60 px-3 py-1 text-xs font-semibold text-rose-200"
                    >
                      {t('groups.delete')}
                    </button>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                {group.members.map((item) => (
                  <li key={item.playerId} className="rounded-lg border border-slate-800/70 px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.firstName} {item.lastName}</span>
                      {item.playerId === group.captainPlayerId && (
                        <span className="rounded-full border border-violet-500/60 px-2 py-0.5 text-[10px] text-violet-200">
                          {t('groups.captain')}
                        </span>
                      )}
                      {canRemoveMembers && item.playerId !== group.captainPlayerId && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            void handleRemoveMember(group.id, group.tournamentId, item.playerId);
                          }}
                          className="rounded-full border border-rose-500/60 px-2 py-0.5 text-[10px] font-semibold text-rose-200"
                        >
                          {t('groups.removeMember')}
                        </button>
                      )}
                      {canEditMembers && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setActiveMemberEditor({
                              groupId: group.id,
                              playerId: item.playerId,
                              firstName: item.firstName,
                              lastName: item.lastName,
                              surname: item.surname ?? '',
                              email: item.email ?? '',
                            });
                          }}
                          className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-200"
                        >
                          {t('common.edit')}
                        </button>
                      )}
                    </div>

                    {activeMemberEditor?.groupId === group.id && activeMemberEditor.playerId === item.playerId && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <input
                          value={activeMemberEditor.firstName}
                          onChange={(event) => {
                            setActiveMemberEditor((previous) => {
                              if (!previous || previous.groupId !== group.id || previous.playerId !== item.playerId) {
                                return previous;
                              }
                              return { ...previous, firstName: event.target.value };
                            });
                          }}
                          placeholder={t('edit.firstName')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                        />
                        <input
                          value={activeMemberEditor.lastName}
                          onChange={(event) => {
                            setActiveMemberEditor((previous) => {
                              if (!previous || previous.groupId !== group.id || previous.playerId !== item.playerId) {
                                return previous;
                              }
                              return { ...previous, lastName: event.target.value };
                            });
                          }}
                          placeholder={t('edit.lastName')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                        />
                        <input
                          value={activeMemberEditor.surname}
                          onChange={(event) => {
                            setActiveMemberEditor((previous) => {
                              if (!previous || previous.groupId !== group.id || previous.playerId !== item.playerId) {
                                return previous;
                              }
                              return { ...previous, surname: event.target.value };
                            });
                          }}
                          placeholder={t('edit.surname')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                        />
                        <input
                          value={activeMemberEditor.email}
                          onChange={(event) => {
                            setActiveMemberEditor((previous) => {
                              if (!previous || previous.groupId !== group.id || previous.playerId !== item.playerId) {
                                return previous;
                              }
                              return { ...previous, email: event.target.value };
                            });
                          }}
                          placeholder={t('edit.email')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                        />
                        <button
                          type="button"
                          disabled={
                            saving
                            || activeMemberEditor.firstName.trim().length === 0
                            || activeMemberEditor.lastName.trim().length === 0
                          }
                          onClick={() => {
                            void handleUpdateMember(group.tournamentId);
                          }}
                          className="rounded-xl border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setActiveMemberEditor(undefined);
                          }}
                          className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {activeEditor?.groupId === group.id && activeEditor.type === 'rename' && (
                <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      placeholder={t('groups.promptName')}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={saving || renameValue.trim().length === 0}
                      onClick={() => {
                        void handleRename(group.id, group.tournamentId, renameValue);
                      }}
                      className="rounded-xl border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        closeActiveEditor();
                      }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {activeEditor?.groupId === group.id && activeEditor.type === 'password' && (
                <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={passwordValue}
                      onChange={(event) => setPasswordValue(event.target.value)}
                      placeholder={t('groups.promptNewPassword')}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={saving || passwordValue.trim().length === 0}
                      onClick={() => {
                        void handleChangePassword(group.id, group.tournamentId, passwordValue);
                      }}
                      className="rounded-xl border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        closeActiveEditor();
                      }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {activeEditor?.groupId === group.id && activeEditor.type === 'add-member' && (
                <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                  {isAdmin && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        placeholder={t('groups.promptName')}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                      <button
                        type="button"
                        disabled={saving || renameValue.trim().length === 0}
                        onClick={() => {
                          void handleRename(group.id, group.tournamentId, renameValue);
                        }}
                        className="rounded-xl border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <select
                        value={groupSkillLevelValue}
                        onChange={(event) => {
                          const value = event.target.value;
                          setGroupSkillLevelValue(value ? (value as SkillLevel) : '');
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      >
                        <option value="">{t('edit.selectSkillLevelOptional')}</option>
                        <option value={SkillLevel.BEGINNER}>{t('skill.beginner')}</option>
                        <option value={SkillLevel.INTERMEDIATE}>{t('skill.intermediate')}</option>
                        <option value={SkillLevel.EXPERT}>{t('skill.expert')}</option>
                      </select>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          void handleRename(group.id, group.tournamentId, renameValue, groupSkillLevelValue);
                        }}
                        className="rounded-xl border border-emerald-500/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={memberSearchTerm}
                      onChange={(event) => setMemberSearchTerm(event.target.value)}
                      placeholder={t('groups.promptPlayerSearch')}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={saving || memberSearchLoading || memberSearchTerm.trim().length === 0}
                      onClick={() => {
                        void searchMembers();
                      }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      {t('groups.search')}
                    </button>
                    <button
                      type="button"
                      disabled={saving || memberSearchLoading}
                      onClick={() => {
                        closeActiveEditor();
                      }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>

                  {memberSearchLoading && (
                    <p className="mt-2 text-xs text-slate-400">{t('common.loading')}</p>
                  )}

                  {!memberSearchLoading && memberSearchTerm.trim().length > 0 && memberSearchResults.length === 0 && (
                    <p className="mt-2 text-xs text-slate-400">{t('groups.noPlayerFound')}</p>
                  )}

                  {memberSearchResults.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-200">
                      {memberSearchResults.slice(0, 10).map((player) => (
                        <li key={player.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/70 px-2 py-1">
                          <span>{player.firstName} {player.lastName}</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              void handleAddMember(group.id, group.tournamentId, player.id);
                            }}
                            className="rounded-full border border-indigo-500/60 px-2 py-0.5 font-semibold text-indigo-200 disabled:opacity-50"
                          >
                            {t('groups.addMember')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {isAdmin && (
                    <div className="mt-3 border-t border-slate-700/70 pt-3">
                      <p className="text-xs font-semibold text-slate-300">{t('groups.quickCreateMemberTitle')}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={quickCreateFirstName}
                          onChange={(event) => setQuickCreateFirstName(event.target.value)}
                          placeholder={t('edit.firstName')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                        <input
                          value={quickCreateLastName}
                          onChange={(event) => setQuickCreateLastName(event.target.value)}
                          placeholder={t('edit.lastName')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                        <input
                          value={quickCreateSurname}
                          onChange={(event) => setQuickCreateSurname(event.target.value)}
                          placeholder={t('edit.surname')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                        <input
                          value={quickCreateEmail}
                          onChange={(event) => setQuickCreateEmail(event.target.value)}
                          type="email"
                          aria-invalid={!quickCreateEmailIsValid}
                          placeholder={t('edit.email')}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={
                          saving
                          || quickCreateFirstName.trim().length === 0
                          || quickCreateLastName.trim().length === 0
                          || !quickCreateEmailIsValid
                        }
                        onClick={() => {
                          void handleQuickCreateAndAddMember(group.id, group.tournamentId);
                        }}
                        className="mt-2 rounded-xl border border-indigo-500/60 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/15 disabled:opacity-50"
                      >
                        {t('groups.createAndAddMember')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeEditor?.groupId === group.id && activeEditor.type === 'join-password' && (
                <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={joinPasswordValue}
                      onChange={(event) => setJoinPasswordValue(event.target.value)}
                      placeholder={t('groups.promptJoinPassword')}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={saving || joinPasswordValue.trim().length === 0}
                      onClick={() => {
                        void handleJoin(group.id, group.tournamentId, joinPasswordValue);
                      }}
                      className="rounded-xl border border-cyan-500/60 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-50"
                    >
                      {t('groups.join')}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        closeActiveEditor();
                      }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const runAction = useCallback(async (action: () => Promise<void>) => {
    let succeeded = false;
    setSaving(true);
    setError(undefined);
    try {
      await action();
      await loadGroups();
      succeeded = true;
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unexpected error');
    } finally {
      setSaving(false);
    }
    return succeeded;
  }, [loadGroups]);

  const closeActiveEditor = useCallback(() => {
    setActiveEditor(undefined);
    setRenameValue('');
    setGroupSkillLevelValue('');
    setPasswordValue('');
    setJoinPasswordValue('');
    setMemberSearchTerm('');
    setMemberSearchResults([]);
    setQuickCreateFirstName('');
    setQuickCreateLastName('');
    setQuickCreateSurname('');
    setQuickCreateEmail('');
  }, []);

  const openRenameEditor = useCallback((groupId: string, currentName: string) => {
    setActiveEditor({ groupId, type: 'rename' });
    setRenameValue(currentName);
    setGroupSkillLevelValue('');
    setPasswordValue('');
    setMemberSearchTerm('');
    setMemberSearchResults([]);
  }, []);

  const openPasswordEditor = useCallback((groupId: string) => {
    setActiveEditor({ groupId, type: 'password' });
    setRenameValue('');
    setGroupSkillLevelValue('');
    setPasswordValue('');
    setMemberSearchTerm('');
    setMemberSearchResults([]);
  }, []);

  const openAddMemberEditor = useCallback((groupId: string, currentName = '', skillLevel?: SkillLevel | null) => {
    setActiveEditor({ groupId, type: 'add-member' });
    setRenameValue(currentName);
    setGroupSkillLevelValue(skillLevel ?? '');
    setPasswordValue('');
    setJoinPasswordValue('');
    setMemberSearchTerm('');
    setMemberSearchResults([]);
  }, []);

  const openJoinEditor = useCallback((groupId: string) => {
    setActiveEditor({ groupId, type: 'join-password' });
    setRenameValue('');
    setGroupSkillLevelValue('');
    setPasswordValue('');
    setJoinPasswordValue('');
    setMemberSearchTerm('');
    setMemberSearchResults([]);
  }, []);

  const createGroupWithValues = useCallback(async (name: string, password: string, captainPlayerId?: string) => {
    if (!selectedTournamentId) {
      setError(t('groups.selectTournament'));
      return;
    }

    await runAction(async () => {
      const token = await getToken();
      if (mode === 'doublettes') {
        await createDoublette(selectedTournamentId, { name, password, ...(captainPlayerId ? { captainPlayerId } : {}) }, token);
      } else {
        await createEquipe(selectedTournamentId, { name, password, ...(captainPlayerId ? { captainPlayerId } : {}) }, token);
      }
    });
  }, [getToken, mode, runAction, selectedTournamentId, t]);

  const createGroupFromForm = useCallback(async () => {
    const name = createName.trim();
    const password = createPassword.trim();
    if (!name || !password) {
      return;
    }

    await createGroupWithValues(name, password, isAdmin ? createCaptainPlayerId : undefined);
    setCreateName('');
    setCreatePassword('');
    setCreateCaptainSearchTerm('');
    setCreateCaptainSearchResults([]);
    setCreateCaptainPlayerId(undefined);
  }, [createCaptainPlayerId, createGroupWithValues, createName, createPassword, isAdmin]);

  const searchCreateCaptain = useCallback(async () => {
    const query = createCaptainSearchTerm.trim();
    if (!query) {
      setCreateCaptainSearchResults([]);
      return;
    }

    if (!selectedTournamentId) {
      setError(t('groups.selectTournament'));
      setCreateCaptainSearchResults([]);
      return;
    }

    setCreateCaptainSearchLoading(true);
    setError(undefined);
    try {
      const token = await getToken();
      const players = await searchGroupPlayers(selectedTournamentId, query, token);
      setCreateCaptainSearchResults(players);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unexpected error');
      setCreateCaptainSearchResults([]);
    } finally {
      setCreateCaptainSearchLoading(false);
    }
  }, [createCaptainSearchTerm, getToken, selectedTournamentId, t]);

  const searchMembers = useCallback(async () => {
    const query = memberSearchTerm.trim();
    if (!query) {
      setMemberSearchResults([]);
      return;
    }

    if (!selectedTournamentId) {
      setError(t('groups.selectTournament'));
      setMemberSearchResults([]);
      return;
    }

    setMemberSearchLoading(true);
    setError(undefined);
    try {
      const token = await getToken();
      const players = await searchGroupPlayers(selectedTournamentId, query, token);
      setMemberSearchResults(players);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unexpected error');
      setMemberSearchResults([]);
    } finally {
      setMemberSearchLoading(false);
    }
  }, [getToken, memberSearchTerm, selectedTournamentId, t]);

  const executeByMode = useCallback(async (
    onDoublette: (token: string | undefined) => Promise<unknown>,
    onEquipe: (token: string | undefined) => Promise<unknown>
  ) => {
    const token = await getToken();
    if (mode === 'doublettes') {
      await onDoublette(token);
      return;
    }
    await onEquipe(token);
  }, [getToken, mode]);

  const handleJoin = useCallback(async (groupId: string, tournamentId: string, password: string) => {
    const normalizedPassword = password.trim();
    if (!normalizedPassword) {
      return;
    }
    const succeeded = await runAction(async () => {
      await executeByMode(
        async (token) => await joinDoublette(tournamentId, groupId, { password: normalizedPassword }, token),
        async (token) => await joinEquipe(tournamentId, groupId, { password: normalizedPassword }, token)
      );
    });
    if (succeeded) {
      closeActiveEditor();
    }
  }, [closeActiveEditor, executeByMode, runAction]);

  const handleRename = useCallback(async (
    groupId: string,
    tournamentId: string,
    name: string,
    skillLevel?: SkillLevel | ''
  ) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }
    const normalizedSkillLevel = skillLevel === '' ? null : skillLevel;
    const updatePayload = {
      name: normalizedName,
      ...(isAdmin && normalizedSkillLevel !== undefined ? { skillLevel: normalizedSkillLevel } : {}),
    };
    const succeeded = await runAction(async () => {
      await executeByMode(
        async (token) => await updateDoublette(
          tournamentId,
          groupId,
          updatePayload,
          token
        ),
        async (token) => await updateEquipe(
          tournamentId,
          groupId,
          updatePayload,
          token
        )
      );
    });
    if (succeeded) {
      closeActiveEditor();
    }
  }, [closeActiveEditor, executeByMode, isAdmin, runAction]);

  const handleAddMember = useCallback(async (groupId: string, tournamentId: string, playerId: string) => {
    const succeeded = await runAction(async () => {
      await executeByMode(
        async (token) => await addDoubletteMember(tournamentId, groupId, { playerId }, token),
        async (token) => await addEquipeMember(tournamentId, groupId, { playerId }, token)
      );
    });
    if (succeeded) {
      closeActiveEditor();
    }
  }, [closeActiveEditor, executeByMode, runAction]);

  const handleQuickCreateAndAddMember = useCallback(async (groupId: string, tournamentId: string) => {
    const firstName = quickCreateFirstName.trim();
    const lastName = quickCreateLastName.trim();
    const surname = quickCreateSurname.trim();
    const email = quickCreateEmail.trim();

    if (!firstName || !lastName || (email.length > 0 && !isValidEmailFormat(email))) {
      return;
    }

    const succeeded = await runAction(async () => {
      const token = await getToken();
      const createdPlayer = await registerTournamentPlayer(
        tournamentId,
        {
          firstName,
          lastName,
          ...(surname ? { surname } : {}),
          ...(email ? { email } : {}),
        },
        token
      );

      if (!createdPlayer?.id) {
        throw new Error('Failed to retrieve created player ID');
      }

      if (mode === 'doublettes') {
        await addDoubletteMember(tournamentId, groupId, { playerId: createdPlayer.id }, token);
      } else {
        await addEquipeMember(tournamentId, groupId, { playerId: createdPlayer.id }, token);
      }
    });

    if (succeeded) {
      closeActiveEditor();
    }
  }, [
    closeActiveEditor,
    getToken,
    mode,
    quickCreateFirstName,
    quickCreateLastName,
    quickCreateSurname,
    quickCreateEmail,
    runAction,
  ]);

  const handleRegister = useCallback(async (groupId: string, tournamentId: string) => {
    await runAction(async () => {
      await executeByMode(
        async (token) => await registerDoublette(tournamentId, groupId, token),
        async (token) => await registerEquipe(tournamentId, groupId, token)
      );
    });
  }, [executeByMode, runAction]);

  const handleLeave = useCallback(async (groupId: string, tournamentId: string) => {
    await runAction(async () => {
      await executeByMode(
        async (token) => await leaveDoublette(tournamentId, groupId, token),
        async (token) => await leaveEquipe(tournamentId, groupId, token)
      );
    });
  }, [executeByMode, runAction]);

  const handleUnregister = useCallback(async (groupId: string, tournamentId: string) => {
    if (!globalThis.window?.confirm(t('tournaments.unregisterConfirm'))) {
      return;
    }
    await runAction(async () => {
      await executeByMode(
        async (token) => await unregisterDoublette(tournamentId, groupId, token),
        async (token) => await unregisterEquipe(tournamentId, groupId, token)
      );
    });
  }, [executeByMode, runAction, t]);

  const handleChangePassword = useCallback(async (groupId: string, tournamentId: string, password: string) => {
    const normalizedPassword = password.trim();
    if (!normalizedPassword) {
      return;
    }
    const succeeded = await runAction(async () => {
      await executeByMode(
        async (token) => await updateDoublettePassword(tournamentId, groupId, { password: normalizedPassword }, token),
        async (token) => await updateEquipePassword(tournamentId, groupId, { password: normalizedPassword }, token)
      );
    });
    if (succeeded) {
      closeActiveEditor();
    }
  }, [closeActiveEditor, executeByMode, runAction]);

  const handleDelete = useCallback(async (groupId: string, tournamentId: string) => {
    if (!globalThis.window?.confirm(t('groups.confirmDelete'))) {
      return;
    }
    await runAction(async () => {
      await executeByMode(
        async (token) => await deleteDoublette(tournamentId, groupId, token),
        async (token) => await deleteEquipe(tournamentId, groupId, token)
      );
    });
  }, [executeByMode, runAction, t]);

  const handleRemoveMember = useCallback(async (groupId: string, tournamentId: string, playerId: string) => {
    await runAction(async () => {
      await executeByMode(
        async (token) => await removeDoubletteMember(tournamentId, groupId, playerId, token),
        async (token) => await removeEquipeMember(tournamentId, groupId, playerId, token)
      );
    });
  }, [executeByMode, runAction]);

  const handleUpdateMember = useCallback(async (tournamentId: string) => {
    if (!activeMemberEditor) {
      return;
    }

    const firstName = activeMemberEditor.firstName.trim();
    const lastName = activeMemberEditor.lastName.trim();
    const surname = activeMemberEditor.surname.trim();
    const email = activeMemberEditor.email.trim();

    if (!firstName || !lastName) {
      return;
    }

    const succeeded = await runAction(async () => {
      const token = await getToken();
      await updateTournamentPlayer(
        tournamentId,
        activeMemberEditor.playerId,
        {
          firstName,
          lastName,
          ...(surname.length > 0 ? { surname } : {}),
          ...(email.length > 0 ? { email } : {}),
        },
        token
      );
    });

    if (succeeded) {
      setActiveMemberEditor(undefined);
    }
  }, [activeMemberEditor, getToken, runAction]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400">{t('groups.requiredMembers').replace('{count}', String(requiredMembers))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!selectedTournamentId && (
            <select
              value={selectedTournamentFilterId}
              onChange={(event) => setSelectedTournamentFilterId(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">{t('live.allTournaments')}</option>
              {availableTournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name ?? tournament.id}
                </option>
              ))}
            </select>
          )}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('groups.searchPlaceholder')}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              void loadGroups();
            }}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
          >
            {t('groups.search')}
          </button>
        </div>
      </div>

      {(mode === 'doublettes' || mode === 'equipes') && effectiveIsAuthenticated && selectedTournamentId && (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            {mode === 'doublettes' ? t('groups.createDoubletteTitle') : t('groups.createEquipeTitle')}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t('groups.promptName')}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={createPassword}
              onChange={(event) => setCreatePassword(event.target.value)}
              placeholder={t('groups.promptPassword')}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              disabled={saving || createName.trim().length === 0 || createPassword.trim().length === 0}
              onClick={() => {
                void createGroupFromForm();
              }}
              className="rounded-xl border border-emerald-500/60 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {t('groups.create')}
            </button>
          </div>

          {isAdmin && (
            <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={createCaptainSearchTerm}
                  onChange={(event) => setCreateCaptainSearchTerm(event.target.value)}
                  placeholder={t('groups.promptCaptainSearch')}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
                <button
                  type="button"
                  disabled={saving || createCaptainSearchLoading || createCaptainSearchTerm.trim().length === 0}
                  onClick={() => {
                    void searchCreateCaptain();
                  }}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
                >
                  {t('groups.search')}
                </button>
              </div>

              {createCaptainSearchLoading && (
                <p className="mt-2 text-xs text-slate-400">{t('common.loading')}</p>
              )}

              {!createCaptainSearchLoading && createCaptainSearchTerm.trim().length > 0 && createCaptainSearchResults.length === 0 && (
                <p className="mt-2 text-xs text-slate-400">{t('groups.noPlayerFound')}</p>
              )}

              {createCaptainSearchResults.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-200">
                  {createCaptainSearchResults.slice(0, 10).map((player) => {
                    const isSelectedCaptain = createCaptainPlayerId === player.id;
                    return (
                      <li key={player.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/70 px-2 py-1">
                        <span>{player.firstName} {player.lastName}</span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setCreateCaptainPlayerId(player.id);
                          }}
                          className={`rounded-full px-2 py-0.5 font-semibold disabled:opacity-50 ${
                            isSelectedCaptain
                              ? 'border border-emerald-500/60 text-emerald-200'
                              : 'border border-slate-700 text-slate-200'
                          }`}
                        >
                          {isSelectedCaptain ? t('groups.selectedCaptain') : t('groups.chooseCaptain')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {content}
    </div>
  );
};

export default GroupsView;
