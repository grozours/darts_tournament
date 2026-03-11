import type { LiveViewPoolStage, Translator } from './types';
import useLiveTournamentStageDrafts from './use-live-tournament-stage-drafts';
import useLiveTournamentStageUpdate from './use-live-tournament-stage-update';

type UseLiveTournamentStageActionsProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
};

type LiveTournamentStageActionsResult = {
  editingStageId?: string;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  updatingStageId?: string;
  handleLaunchStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleResetStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleEditStage: (stage: LiveViewPoolStage) => void;
  handleStageStatusChange: (stageId: string, status: string) => void;
  handleStagePoolCountChange: (stageId: string, value: string) => void;
  handleStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  handleUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  handleRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  cancelEditStage: () => void;
};

const useLiveTournamentStageActions = ({
  t,
  getSafeAccessToken,
  reloadLiveViews,
  setError,
}: UseLiveTournamentStageActionsProperties): LiveTournamentStageActionsResult => {
  const {
    editingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    handleEditStage,
    handleStageStatusChange,
    handleStagePoolCountChange,
    handleStagePlayersPerPoolChange,
    cancelEditStage,
  } = useLiveTournamentStageDrafts();
  const {
    updatingStageId,
    handleLaunchStage,
    handleResetStage,
    handleUpdateStage,
    handleDeleteStage,
    handleCompleteStageWithScores,
    handleRecomputeDoubleStage,
  } = useLiveTournamentStageUpdate({
    t,
    getSafeAccessToken,
    reloadLiveViews,
    setError,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    onFinishEdit: cancelEditStage,
  });

  return {
    editingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    updatingStageId,
    handleLaunchStage,
    handleResetStage,
    handleEditStage,
    handleStageStatusChange,
    handleStagePoolCountChange,
    handleStagePlayersPerPoolChange,
    handleUpdateStage,
    handleDeleteStage,
    handleCompleteStageWithScores,
    handleRecomputeDoubleStage,
    cancelEditStage,
  };
};

export default useLiveTournamentStageActions;
