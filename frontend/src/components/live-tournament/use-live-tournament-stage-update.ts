import { useCallback, useState } from 'react';
import { completePoolStageWithScores, deletePoolStage, updatePoolStage } from '../../services/tournament-service';
import type { LiveViewPoolStage, Translator } from './types';

type UseLiveTournamentStageUpdateProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  onFinishEdit: () => void;
};

type LiveTournamentStageUpdateResult = {
  updatingStageId?: string | undefined;
  handleUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
};

const useLiveTournamentStageUpdate = ({
  t,
  getSafeAccessToken,
  reloadLiveViews,
  setError,
  stageStatusDrafts,
  stagePoolCountDrafts,
  stagePlayersPerPoolDrafts,
  onFinishEdit,
}: UseLiveTournamentStageUpdateProperties): LiveTournamentStageUpdateResult => {
  const [updatingStageId, setUpdatingStageId] = useState<string | undefined>();

  const handleUpdateStage = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    const nextStatus = stageStatusDrafts[stage.id] || stage.status;
    const nextPoolCountRaw = stagePoolCountDrafts[stage.id];
    const nextPlayersPerPoolRaw = stagePlayersPerPoolDrafts[stage.id];
    const nextPoolCount = Number(nextPoolCountRaw);
    const nextPlayersPerPool = Number(nextPlayersPerPoolRaw);
    setUpdatingStageId(stage.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updatePoolStage(
        stageTournamentId,
        stage.id,
        {
          status: nextStatus,
          ...(Number.isFinite(nextPoolCount) && nextPoolCount > 0
            ? { poolCount: nextPoolCount }
            : {}),
          ...(Number.isFinite(nextPlayersPerPool) && nextPlayersPerPool > 0
            ? { playersPerPool: nextPlayersPerPool }
            : {}),
        },
        token
      );
      await reloadLiveViews({ showLoader: false });
      onFinishEdit();
    } catch (error) {
      console.error('Error updating pool stage status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update pool stage');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, onFinishEdit, reloadLiveViews, setError, stagePlayersPerPoolDrafts, stagePoolCountDrafts, stageStatusDrafts]);

  const handleDeleteStage = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (!confirm(t('live.deleteStageConfirm'))) {
      return;
    }
    setUpdatingStageId(stage.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await deletePoolStage(stageTournamentId, stage.id, token);
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      console.error('Error deleting pool stage:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete pool stage');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError, t]);

  const handleCompleteStageWithScores = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (!confirm(t('live.completeStageConfirm'))) {
      return;
    }
    setUpdatingStageId(stage.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await completePoolStageWithScores(stageTournamentId, stage.id, token);
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      console.error('Error completing pool stage:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete pool stage');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError, t]);

  return {
    updatingStageId,
    handleUpdateStage,
    handleDeleteStage,
    handleCompleteStageWithScores,
  };
};

export default useLiveTournamentStageUpdate;
