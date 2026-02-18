import { useCallback, useEffect, useState } from 'react';
import {
  fetchTournamentPlayers,
  registerTournamentPlayer,
  unregisterTournamentPlayer,
  type TournamentPlayer,
} from '../../services/tournament-service';
import { getErrorMessage } from './error-utilities';
import type { Tournament, Translator } from './types';

type UseTournamentListRegistrationsProperties = {
  t: Translator;
  tournaments: Tournament[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
};

type TournamentListRegistrationsResult = {
  userRegistrations: Set<string>;
  registeringTournamentId: string | undefined;
  handleRegisterSelf: (tournamentId: string) => Promise<void>;
  handleUnregisterSelf: (tournamentId: string) => Promise<void>;
};

type RegistrationState = {
  userRegistrations: Set<string>;
  registeringTournamentId: string | undefined;
};

type RegistrationStateSetters = {
  setUserRegistrations: (value: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  setRegisteringTournamentId: (value: string | undefined) => void;
};

const useRegistrationState = (): RegistrationState & RegistrationStateSetters => {
  const [userRegistrations, setUserRegistrations] = useState<Set<string>>(new Set());
  const [registeringTournamentId, setRegisteringTournamentId] = useState<string | undefined>();

  return {
    userRegistrations,
    registeringTournamentId,
    setUserRegistrations,
    setRegisteringTournamentId,
  };
};

const useRegistrationLookup = ({
  tournaments,
  isAuthenticated,
  isAdmin,
  user,
  getSafeAccessToken,
  setUserRegistrations,
}: {
  tournaments: Tournament[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
}) => {
  const checkUserRegistrations = useCallback(async (tournamentList: Tournament[]) => {
    if (!isAuthenticated || !user) return;

    const userDetails = user as { email?: string };
    const userEmail = userDetails?.email?.toLowerCase();

    if (!userEmail) return;

    const token = await getSafeAccessToken();
    const registeredTournaments = new Set<string>();

    for (const tournament of tournamentList) {
      try {
        const response = await fetch(`/api/tournaments/${tournament.id}/players`, token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {});

        if (response.ok) {
          const data = await response.json();
          const players = data.players || [];
          const isRegistered = players.some((player: TournamentPlayer) =>
            player.email?.toLowerCase() === userEmail
          );

          if (isRegistered) {
            registeredTournaments.add(tournament.id);
          }
        }
      } catch (error_) {
        console.error(`[TournamentList] Error checking registration for tournament ${tournament.id}:`, error_);
      }
    }

    setUserRegistrations(registeredTournaments);
  }, [getSafeAccessToken, isAuthenticated, setUserRegistrations, user]);

  useEffect(() => {
    if (tournaments.length > 0 && isAuthenticated && !isAdmin) {
      void checkUserRegistrations(tournaments);
    }
  }, [checkUserRegistrations, isAdmin, isAuthenticated, tournaments]);
};

const useRegisterSelfAction = ({
  t,
  isAuthenticated,
  user,
  getSafeAccessToken,
  setRegisteringTournamentId,
  setUserRegistrations,
}: {
  t: Translator;
  isAuthenticated: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  setRegisteringTournamentId: RegistrationStateSetters['setRegisteringTournamentId'];
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
}) => useCallback(async (tournamentId: string) => {
  if (!isAuthenticated) {
    alert(t('auth.signInRequired') || 'Please sign in to register');
    return;
  }

  setRegisteringTournamentId(tournamentId);
  try {
    const token = await getSafeAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

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
    alert(t('tournaments.registerSuccess') || 'Successfully registered!');
  } catch (error_) {
    console.error('Error registering for tournament:', error_);
    alert(error_ instanceof Error ? error_.message : 'Failed to register');
  } finally {
    setRegisteringTournamentId(undefined);
  }
}, [getSafeAccessToken, isAuthenticated, setRegisteringTournamentId, setUserRegistrations, t, user]);

const useUnregisterSelfAction = ({
  t,
  isAuthenticated,
  user,
  getSafeAccessToken,
  setRegisteringTournamentId,
  setUserRegistrations,
}: {
  t: Translator;
  isAuthenticated: boolean;
  user: unknown;
  getSafeAccessToken: () => Promise<string | undefined>;
  setRegisteringTournamentId: RegistrationStateSetters['setRegisteringTournamentId'];
  setUserRegistrations: RegistrationStateSetters['setUserRegistrations'];
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
    if (!token) {
      throw new Error('Authentication required');
    }

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

    alert(t('tournaments.unregisterSuccess') || 'Successfully unregistered!');
  } catch (error_) {
    console.error('Error unregistering from tournament:', error_);
    alert(getErrorMessage(error_, 'Failed to unregister'));
  } finally {
    setRegisteringTournamentId(undefined);
  }
}, [getSafeAccessToken, isAuthenticated, setRegisteringTournamentId, setUserRegistrations, t, user]);

const useTournamentListRegistrations = ({
  t,
  tournaments,
  isAuthenticated,
  isAdmin,
  user,
  getSafeAccessToken,
}: UseTournamentListRegistrationsProperties): TournamentListRegistrationsResult => {
  const {
    userRegistrations,
    registeringTournamentId,
    setUserRegistrations,
    setRegisteringTournamentId,
  } = useRegistrationState();

  useRegistrationLookup({
    tournaments,
    isAuthenticated,
    isAdmin,
    user,
    getSafeAccessToken,
    setUserRegistrations,
  });

  const handleRegisterSelf = useRegisterSelfAction({
    t,
    isAuthenticated,
    user,
    getSafeAccessToken,
    setRegisteringTournamentId,
    setUserRegistrations,
  });

  const handleUnregisterSelf = useUnregisterSelfAction({
    t,
    isAuthenticated,
    user,
    getSafeAccessToken,
    setRegisteringTournamentId,
    setUserRegistrations,
  });

  return {
    userRegistrations,
    registeringTournamentId,
    handleRegisterSelf,
    handleUnregisterSelf,
  };
};

export default useTournamentListRegistrations;
