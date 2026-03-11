import { useCallback, useState } from 'react';
import type { LiveViewPoolStage } from './types';

type LiveTournamentStageDraftsResult = {
  editingStageId: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  handleEditStage: (stage: LiveViewPoolStage) => void;
  handleStageStatusChange: (stageId: string, status: string) => void;
  handleStagePoolCountChange: (stageId: string, value: string) => void;
  handleStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  cancelEditStage: () => void;
};

const useLiveTournamentStageDrafts = (): LiveTournamentStageDraftsResult => {
  const [editingStageId, setEditingStageId] = useState<string | undefined>();
  const [stageStatusDrafts, setStageStatusDrafts] = useState<Record<string, string>>({});
  const [stagePoolCountDrafts, setStagePoolCountDrafts] = useState<Record<string, string>>({});
  const [stagePlayersPerPoolDrafts, setStagePlayersPerPoolDrafts] = useState<Record<string, string>>({});

  const handleEditStage = useCallback((stage: LiveViewPoolStage) => {
    setEditingStageId(stage.id);
    setStageStatusDrafts((current) => ({
      ...current,
      [stage.id]: stage.status,
    }));
    setStagePoolCountDrafts((current) => ({
      ...current,
      [stage.id]: String(stage.pools?.length ?? ''),
    }));
    setStagePlayersPerPoolDrafts((current) => ({
      ...current,
      [stage.id]: String(stage.playersPerPool ?? ''),
    }));
  }, []);

  const cancelEditStage = useCallback(() => {
    setEditingStageId(undefined);
  }, []);

  const handleStageStatusChange = useCallback((stageId: string, status: string) => {
    setStageStatusDrafts((current) => ({
      ...current,
      [stageId]: status,
    }));
  }, []);

  const handleStagePoolCountChange = useCallback((stageId: string, value: string) => {
    setStagePoolCountDrafts((current) => ({
      ...current,
      [stageId]: value,
    }));
  }, []);

  const handleStagePlayersPerPoolChange = useCallback((stageId: string, value: string) => {
    setStagePlayersPerPoolDrafts((current) => ({
      ...current,
      [stageId]: value,
    }));
  }, []);

  return {
    editingStageId,
    stageStatusDrafts,
    stagePoolCountDrafts,
    stagePlayersPerPoolDrafts,
    handleEditStage,
    handleStageStatusChange,
    handleStagePoolCountChange,
    handleStagePlayersPerPoolChange,
    cancelEditStage,
  };
};

export default useLiveTournamentStageDrafts;
