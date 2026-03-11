import { useCallback, useState } from 'react';
import { fetchTournamentPlayers, updateTournamentStatus } from '../../services/tournament-service';
import { autoFillTournamentPlayers, confirmAllTournamentPlayers } from './tournament-players-actions';
import { navigateWithinApp } from './navigation-helpers';
import type { Tournament, Translator } from './types';

type ProgressState = Record<string, { current: number; total: number } | undefined>;

type UseTournamentListCardActionsProperties = {
  t: Translator;
  visibleTournaments: Tournament[];
  getSafeAccessToken: () => Promise<string | undefined>;
  fetchTournaments: () => Promise<void>;
};

const useTournamentListCardActions = ({
  t,
  visibleTournaments,
  getSafeAccessToken,
  fetchTournaments,
}: UseTournamentListCardActionsProperties) => {
  const [openingRegistrationId, setOpeningRegistrationId] = useState<string | undefined>();
  const [openingSignatureId, setOpeningSignatureId] = useState<string | undefined>();
  const [autoFillingTournamentId, setAutoFillingTournamentId] = useState<string | undefined>();
  const [confirmingTournamentId, setConfirmingTournamentId] = useState<string | undefined>();
  const [autoFillProgressByTournament, setAutoFillProgressByTournament] = useState<ProgressState>({});
  const [confirmAllProgressByTournament, setConfirmAllProgressByTournament] = useState<ProgressState>({});

  const openRegistrationFromCard = useCallback(async (tournamentId: string) => {
    setOpeningRegistrationId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      await updateTournamentStatus(tournamentId, 'OPEN', token);
      navigateWithinApp('/?status=OPEN');
      await fetchTournaments();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedOpenRegistration'));
    } finally {
      setOpeningRegistrationId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t]);

  const openSignatureFromCard = useCallback(async (tournamentId: string) => {
    setOpeningSignatureId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      await updateTournamentStatus(tournamentId, 'SIGNATURE', token);
      navigateWithinApp('/?status=SIGNATURE');
      await fetchTournaments();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedMoveToSignature'));
    } finally {
      setOpeningSignatureId(undefined);
    }
  }, [fetchTournaments, getSafeAccessToken, t]);

  const autoFillTournamentFromCard = useCallback(async (tournamentId: string) => {
    const tournament = visibleTournaments.find((item) => item.id === tournamentId);
    if (!tournament) {
      return;
    }

    setAutoFillingTournamentId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      const tournamentPlayers = await fetchTournamentPlayers(tournamentId, token);
      await autoFillTournamentPlayers({
        tournament,
        players: tournamentPlayers,
        token,
        onProgress: (progress) => {
          setAutoFillProgressByTournament((current) => ({
            ...current,
            [tournamentId]: progress,
          }));
        },
      });
      await fetchTournaments();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedAutoFillPlayers'));
    } finally {
      setAutoFillingTournamentId(undefined);
      setAutoFillProgressByTournament((current) => ({
        ...current,
        [tournamentId]: undefined,
      }));
    }
  }, [fetchTournaments, getSafeAccessToken, t, visibleTournaments]);

  const confirmAllFromCard = useCallback(async (tournamentId: string) => {
    const tournament = visibleTournaments.find((item) => item.id === tournamentId);
    if (!tournament) {
      return;
    }

    setConfirmingTournamentId(tournamentId);
    try {
      const token = await getSafeAccessToken();
      const tournamentPlayers = await fetchTournamentPlayers(tournamentId, token);
      await confirmAllTournamentPlayers({
        tournament,
        players: tournamentPlayers,
        token,
        onProgress: (progress) => {
          setConfirmAllProgressByTournament((current) => ({
            ...current,
            [tournamentId]: progress,
          }));
        },
      });
      await fetchTournaments();
    } catch (error_) {
      alert(error_ instanceof Error ? error_.message : t('edit.error.failedConfirmAllPlayers'));
    } finally {
      setConfirmingTournamentId(undefined);
      setConfirmAllProgressByTournament((current) => ({
        ...current,
        [tournamentId]: undefined,
      }));
    }
  }, [fetchTournaments, getSafeAccessToken, t, visibleTournaments]);

  return {
    openingRegistrationId,
    openingSignatureId,
    autoFillingTournamentId,
    confirmingTournamentId,
    autoFillProgressByTournament,
    confirmAllProgressByTournament,
    openRegistrationFromCard,
    openSignatureFromCard,
    autoFillTournamentFromCard,
    confirmAllFromCard,
  };
};

export default useTournamentListCardActions;
