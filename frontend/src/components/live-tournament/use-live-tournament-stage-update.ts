import { useCallback, useState } from 'react';
import {
  completePoolStageWithScores,
  deletePoolStage,
  updatePoolStage,
  recomputeDoubleStageProgression,
} from '../../services/tournament-service';
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
  updatingStageId: string | undefined;
  handleLaunchStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleResetStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
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

  const handleLaunchStage = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    setUpdatingStageId(stage.id);
    setError(undefined);
    try {
      const hasPoolAssignments = (stage.pools ?? []).some((pool) => (pool.assignments?.length ?? 0) > 0);
      const targetStatus = hasPoolAssignments ? 'IN_PROGRESS' : 'EDITION';
      const token = await getSafeAccessToken();
      await updatePoolStage(
        stageTournamentId,
        stage.id,
        { status: targetStatus },
        token
      );
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to launch pool stage');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError]);

  const handleResetStage = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (!confirm(t('live.resetStageConfirm'))) {
      return;
    }
    setUpdatingStageId(stage.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updatePoolStage(
        stageTournamentId,
        stage.id,
        { status: 'NOT_STARTED' },
        token
      );
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset pool stage');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError, t]);

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
      setError(error instanceof Error ? error.message : 'Failed to complete pool stage');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError, t]);

  const handleRecomputeDoubleStage = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    if (!confirm(t('live.recomputeDoubleStageConfirm'))) {
      return;
    }
    setUpdatingStageId(stage.id);
    setError(undefined);
    try {
      const token = await getSafeAccessToken();
      await recomputeDoubleStageProgression(stageTournamentId, stage.id, token);
      await reloadLiveViews({ showLoader: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to recompute double-stage progression');
    } finally {
      setUpdatingStageId(undefined);
    }
  }, [getSafeAccessToken, reloadLiveViews, setError, t]);

  return {
    updatingStageId,
    handleLaunchStage,
    handleResetStage,
    handleUpdateStage,
    handleDeleteStage,
    handleCompleteStageWithScores,
    handleRecomputeDoubleStage,
  };
};

export default useLiveTournamentStageUpdate;
