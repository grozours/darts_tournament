import { useCallback, useEffect, useState } from 'react';
import {
  fetchDoublettes,
  fetchEquipes,
  fetchTournamentPlayers,
  registerDoublette,
  registerEquipe,
  registerTournamentPlayer,
  unregisterDoublette,
  unregisterEquipe,
  unregisterTournamentPlayer,
} from '../../services/tournament-service';
import { getErrorMessage } from './error-utilities';
import type { Tournament, Translator, UserTournamentGroupStatus } from './types';

type UseTournamentListRegistrationsProperties = {
  t: Translator;
  tournaments: Tournament[];
  isAdmin: boolean;
  isAuthenticated: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  refreshTournaments: () => void;
};

type TournamentListRegistrationsResult = {
  userRegistrations: Set<string>;
  userGroupStatuses: Record<string, UserTournamentGroupStatus>;
  registeringTournamentId: string | undefined;
  handleRegisterSelf: (tournamentId: string) => Promise<void>;
  handleRegisterGroup: (tournamentId: string) => Promise<void>;
  handleUnregisterGroup: (tournamentId: string) => Promise<void>;
  handleUnregisterSelf: (tournamentId: string) => Promise<void>;
};

type RegistrationState = {
  userRegistrations: Set<string>;
  userGroupStatuses: Record<string, UserTournamentGroupStatus>;
  registeringTournamentId: string | undefined;
};

type RegistrationStateSetters = {
  setUserRegistrations: (value: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  setUserGroupStatuses: (value: Record<string, UserTournamentGroupStatus>) => void;
  setRegisteringTournamentId: (value: string | undefined) => void;
};

const useRegistrationState = (): RegistrationState & RegistrationStateSetters => {
  const [userRegistrations, setUserRegistrations] = useState<Set<string>>(new Set());
  const [userGroupStatuses, setUserGroupStatuses] = useState<Record<string, UserTournamentGroupStatus>>({});
  const [registeringTournamentId, setRegisteringTournamentId] = useState<string | undefined>();

  return {
    userRegistrations,
    userGroupStatuses,
    registeringTournamentId,
    setUserRegistrations,
    setUserGroupStatuses,
    setRegisteringTournamentId,
  };
};

const isGroupTournament = (format: string): format is 'DOUBLE' | 'TEAM_4_PLAYER' => (
  format === 'DOUBLE' || format === 'TEAM_4_PLAYER'
);

const buildGroupStatus = async (
  tournament: Tournament,
  userPlayerId: string | undefined,
  token?: string,
): Promise<UserTournamentGroupStatus | undefined> => {
  if (!isGroupTournament(tournament.format)) {
    return undefined;
  }

  const groups = tournament.format === 'DOUBLE'
    ? await fetchDoublettes(tournament.id, token)
    : await fetchEquipes(tournament.id, token);
  const userGroup = groups.find((group) => group.members.some((member) => member.playerId === userPlayerId));
  const requiredMembers = tournament.format === 'DOUBLE' ? 2 : 4;

  return {
    groupId: userGroup?.id,
    hasGroup: Boolean(userGroup),
    isGroupCaptain: Boolean(userGroup && userPlayerId && userGroup.captainPlayerId === userPlayerId),
    isGroupComplete: Boolean(userGroup && userGroup.memberCount >= requiredMembers),
    isGroupRegistered: Boolean(userGroup?.isRegistered),
  };
};

const useRegistrationLookup = ({
  tournaments,
  isAuthenticated,
  user,
  getSafeAccessToken,
  setUserRegistrations,
  setUserGroupStatuses,
}: {
  tournaments: Tournament[];
  isAuthenticated: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
  setUserGroupStatuses: RegistrationStateSetters['setUserGroupStatuses'];
}) => {
  const checkUserRegistrations = useCallback(async (tournamentList: Tournament[]) => {
    if (!isAuthenticated || !user) return;

    const userDetails = user as { email?: string };
    const userEmail = userDetails?.email?.toLowerCase();

    if (!userEmail) return;

    const token = await getSafeAccessToken();
    const registeredTournaments = new Set<string>();
    const nextGroupStatuses: Record<string, UserTournamentGroupStatus> = {};

    for (const tournament of tournamentList) {
      try {
        const players = await fetchTournamentPlayers(tournament.id, token);
        const userPlayer = players.find((player) => player.email?.toLowerCase() === userEmail);
        if (userPlayer) {
          registeredTournaments.add(tournament.id);
        }

        const groupStatus = await buildGroupStatus(tournament, userPlayer?.playerId, token);
        if (groupStatus) {
          nextGroupStatuses[tournament.id] = groupStatus;
        }
      } catch {
        continue;
      }
    }

    setUserRegistrations(registeredTournaments);
    setUserGroupStatuses(nextGroupStatuses);
  }, [getSafeAccessToken, isAuthenticated, setUserGroupStatuses, setUserRegistrations, user]);

  useEffect(() => {
    if (tournaments.length > 0 && isAuthenticated) {
      void checkUserRegistrations(tournaments);
      return;
    }
    setUserGroupStatuses({});
  }, [checkUserRegistrations, isAuthenticated, setUserGroupStatuses, tournaments]);
};

const useRegisterGroupAction = ({
  t,
  isAuthenticated,
  getSafeAccessToken,
  tournaments,
  userGroupStatuses,
  setRegisteringTournamentId,
  setUserRegistrations,
  setUserGroupStatuses,
  refreshTournaments,
}: {
  t: Translator;
  isAuthenticated: boolean;
  getSafeAccessToken: () => Promise<string | undefined>;
  tournaments: Tournament[];
  userGroupStatuses: Record<string, UserTournamentGroupStatus>;
  setRegisteringTournamentId: RegistrationStateSetters['setRegisteringTournamentId'];
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
  setUserGroupStatuses: RegistrationStateSetters['setUserGroupStatuses'];
  refreshTournaments: () => void;
}) => useCallback(async (tournamentId: string) => {
  if (!isAuthenticated) {
    alert(t('auth.signInRequired') || 'Please sign in to register');
    return;
  }

  const groupStatus = userGroupStatuses[tournamentId];
  if (!groupStatus?.groupId || !groupStatus.isGroupComplete || groupStatus.isGroupRegistered) {
    return;
  }

  const tournament = tournaments.find((item) => item.id === tournamentId);
  if (!tournament) {
    return;
  }

  setRegisteringTournamentId(tournamentId);
  try {
    const token = await getSafeAccessToken();

    if (tournament.format === 'DOUBLE') {
      await registerDoublette(tournamentId, groupStatus.groupId, token);
    } else if (tournament.format === 'TEAM_4_PLAYER') {
      await registerEquipe(tournamentId, groupStatus.groupId, token);
    } else {
      return;
    }

    setUserRegistrations((previous) => new Set(previous).add(tournamentId));
    setUserGroupStatuses({
      ...userGroupStatuses,
      [tournamentId]: {
        ...groupStatus,
        isGroupRegistered: true,
      },
    });
    refreshTournaments();
    alert(t('tournaments.registerSuccess') || 'Successfully registered!');
  } catch (error_) {
    const fallbackMessage = tournament.format === 'DOUBLE'
      ? 'Failed to register doublette'
      : 'Failed to register team';
    const translatedMessage = tournament.format === 'DOUBLE'
      ? t('groups.registerDoubletteError')
      : t('groups.registerEquipeError');
    alert(getErrorMessage(error_, translatedMessage || fallbackMessage));
  } finally {
    setRegisteringTournamentId(undefined);
  }
}, [
  getSafeAccessToken,
  isAuthenticated,
  refreshTournaments,
  setRegisteringTournamentId,
  setUserGroupStatuses,
  setUserRegistrations,
  t,
  tournaments,
  userGroupStatuses,
]);

const useRegisterSelfAction = ({
  t,
  isAuthenticated,
  user,
  getSafeAccessToken,
  setRegisteringTournamentId,
  setUserRegistrations,
  refreshTournaments,
}: {
  t: Translator;
  isAuthenticated: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  setRegisteringTournamentId: RegistrationStateSetters['setRegisteringTournamentId'];
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
  refreshTournaments: () => void;
}) => useCallback(async (tournamentId: string) => {
  if (!isAuthenticated) {
    alert(t('auth.signInRequired') || 'Please sign in to register');
    return;
  }

  setRegisteringTournamentId(tournamentId);
  try {
    const token = await getSafeAccessToken();

    const userDetails = user as {
      name?: string;
      email?: string;
      nickname?: string;
    };

    const email = userDetails?.email || '';
    const fullName = userDetails?.name || 'User';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'Registration';

    if (!email) {
      throw new Error('Email not found in user profile. Please ensure your account has an email address.');
    }

    await registerTournamentPlayer(
      tournamentId,
      {
        firstName,
        lastName,
        email,
      },
      token
    );

    setUserRegistrations((previous) => new Set(previous).add(tournamentId));
    refreshTournaments();
    alert(t('tournaments.registerSuccess') || 'Successfully registered!');
  } catch (error_) {
    alert(error_ instanceof Error ? error_.message : 'Failed to register');
  } finally {
    setRegisteringTournamentId(undefined);
  }
}, [getSafeAccessToken, isAuthenticated, refreshTournaments, setRegisteringTournamentId, setUserRegistrations, t, user]);

const useUnregisterSelfAction = ({
  t,
  isAuthenticated,
  user,
  getSafeAccessToken,
  setRegisteringTournamentId,
  setUserRegistrations,
  refreshTournaments,
}: {
  t: Translator;
  isAuthenticated: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  setRegisteringTournamentId: RegistrationStateSetters['setRegisteringTournamentId'];
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
  refreshTournaments: () => void;
}) => useCallback(async (tournamentId: string) => {
  if (!isAuthenticated) {
    return;
  }

  if (!confirm(t('tournaments.unregisterConfirm') || 'Are you sure you want to unregister?')) {
    return;
  }

  setRegisteringTournamentId(tournamentId);
  try {
    const token = await getSafeAccessToken();

    const userDetails = user as { email?: string };
    const userEmail = userDetails?.email?.toLowerCase();

    if (!userEmail) {
      throw new Error('Email not found in user profile');
    }

    const tournamentPlayers = await fetchTournamentPlayers(tournamentId, token);
    const userPlayer = tournamentPlayers.find(
      (player) => player.email?.toLowerCase() === userEmail
    );

    if (!userPlayer) {
      throw new Error('You are not registered for this tournament');
    }

    await unregisterTournamentPlayer(tournamentId, userPlayer.playerId, token);

    setUserRegistrations((previous) => {
      const next = new Set(previous);
      next.delete(tournamentId);
      return next;
    });

    refreshTournaments();
    alert(t('tournaments.unregisterSuccess') || 'Successfully unregistered!');
  } catch (error_) {
    alert(getErrorMessage(error_, 'Failed to unregister'));
  } finally {
    setRegisteringTournamentId(undefined);
  }
}, [getSafeAccessToken, isAuthenticated, refreshTournaments, setRegisteringTournamentId, setUserRegistrations, t, user]);

const useUnregisterGroupAction = ({
  t,
  isAdmin,
  isAuthenticated,
  getSafeAccessToken,
  tournaments,
  userGroupStatuses,
  setRegisteringTournamentId,
  setUserRegistrations,
  setUserGroupStatuses,
  refreshTournaments,
}: {
  t: Translator;
  isAdmin: boolean;
  isAuthenticated: boolean;
  getSafeAccessToken: () => Promise<string | undefined>;
  tournaments: Tournament[];
  userGroupStatuses: Record<string, UserTournamentGroupStatus>;
  setRegisteringTournamentId: RegistrationStateSetters['setRegisteringTournamentId'];
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
  setUserGroupStatuses: RegistrationStateSetters['setUserGroupStatuses'];
  refreshTournaments: () => void;
}) => useCallback(async (tournamentId: string) => {
  if (!isAuthenticated) {
    return;
  }

  if (!confirm(t('tournaments.unregisterConfirm') || 'Are you sure you want to unregister?')) {
    return;
  }

  const groupStatus = userGroupStatuses[tournamentId];
  if (!groupStatus?.groupId || !groupStatus.isGroupRegistered || (!groupStatus.isGroupCaptain && !isAdmin)) {
    return;
  }

  const tournament = tournaments.find((item) => item.id === tournamentId);
  if (!tournament) {
    return;
  }

  setRegisteringTournamentId(tournamentId);
  try {
    const token = await getSafeAccessToken();

    if (tournament.format === 'DOUBLE') {
      await unregisterDoublette(tournamentId, groupStatus.groupId, token);
    } else if (tournament.format === 'TEAM_4_PLAYER') {
      await unregisterEquipe(tournamentId, groupStatus.groupId, token);
    } else {
      return;
    }

    setUserRegistrations((previous) => {
      const next = new Set(previous);
      next.delete(tournamentId);
      return next;
    });
    setUserGroupStatuses({
      ...userGroupStatuses,
      [tournamentId]: {
        ...groupStatus,
        isGroupRegistered: false,
      },
    });
    refreshTournaments();
    alert(t('tournaments.unregisterSuccess') || 'Successfully unregistered!');
  } catch (error_) {
    const fallbackMessage = tournament.format === 'DOUBLE'
      ? 'Failed to unregister doublette'
      : 'Failed to unregister team';
    alert(getErrorMessage(error_, fallbackMessage));
  } finally {
    setRegisteringTournamentId(undefined);
  }
}, [
  getSafeAccessToken,
  isAdmin,
  isAuthenticated,
  refreshTournaments,
  setRegisteringTournamentId,
  setUserGroupStatuses,
  setUserRegistrations,
  t,
  tournaments,
  userGroupStatuses,
]);

const useTournamentListRegistrations = ({
  t,
  tournaments,
  isAdmin,
  isAuthenticated,
  user,
  getSafeAccessToken,
  refreshTournaments,
}: UseTournamentListRegistrationsProperties): TournamentListRegistrationsResult => {
  const {
    userRegistrations,
    userGroupStatuses,
    registeringTournamentId,
    setUserRegistrations,
    setUserGroupStatuses,
    setRegisteringTournamentId,
  } = useRegistrationState();

  useRegistrationLookup({
    tournaments,
    isAuthenticated,
    user,
    getSafeAccessToken,
    setUserRegistrations,
    setUserGroupStatuses,
  });

  const handleRegisterSelf = useRegisterSelfAction({
    t,
    isAuthenticated,
    user,
    getSafeAccessToken,
    setRegisteringTournamentId,
    setUserRegistrations,
    refreshTournaments,
  });

  const handleRegisterGroup = useRegisterGroupAction({
    t,
    isAuthenticated,
    getSafeAccessToken,
    tournaments,
    userGroupStatuses,
    setRegisteringTournamentId,
    setUserRegistrations,
    setUserGroupStatuses,
    refreshTournaments,
  });

  const handleUnregisterSelf = useUnregisterSelfAction({
    t,
    isAuthenticated,
    user,
    getSafeAccessToken,
    setRegisteringTournamentId,
    setUserRegistrations,
    refreshTournaments,
  });

  const handleUnregisterGroup = useUnregisterGroupAction({
    t,
    isAdmin,
    isAuthenticated,
    getSafeAccessToken,
    tournaments,
    userGroupStatuses,
    setRegisteringTournamentId,
    setUserRegistrations,
    setUserGroupStatuses,
    refreshTournaments,
  });

  return {
    userRegistrations,
    userGroupStatuses,
    registeringTournamentId,
    handleRegisterSelf,
    handleRegisterGroup,
    handleUnregisterGroup,
    handleUnregisterSelf,
  };
};

export default useTournamentListRegistrations;
