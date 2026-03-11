import { useCallback, useState } from 'react';
import { AssignmentType } from '@shared/types';
import type {
  PoolAssignmentPayload,
  PoolStagePool,
  TournamentPlayer,
} from '../../services/tournament-service';
import {
  fetchPoolStagePools,
  fetchTournamentPlayers,
  updatePoolAssignments,
} from '../../services/tournament-service';
import type { LiveViewPoolStage, Translator } from './types';

type EditablePoolStage = {
  id: string;
  name: string;
  playersPerPool: number;
};

type UseLiveTournamentPoolStageAssignmentsProperties = {
  t: Translator;
  getSafeAccessToken: () => Promise<string | undefined>;
  reloadLiveViews: (options?: { showLoader?: boolean }) => Promise<void>;
  setError: (value: string | undefined) => void;
};

type UseLiveTournamentPoolStageAssignmentsResult = {
  editingTournamentId: string | undefined;
  editingPoolStage: EditablePoolStage | undefined;
  poolStagePools: PoolStagePool[];
  poolStagePlayers: TournamentPlayer[];
  poolStageAssignments: Record<string, string[]>;
  poolStageEditError: string | undefined;
  isSavingAssignments: boolean;
  openPoolStageAssignments: (stageTournamentId: string, stage: LiveViewPoolStage) => Promise<void>;
  closePoolStageAssignments: () => void;
  updatePoolStageAssignment: (poolId: string, index: number, playerId: string) => void;
  savePoolStageAssignments: () => Promise<void>;
};

const useLiveTournamentPoolStageAssignments = ({
  t,
  getSafeAccessToken,
  reloadLiveViews,
  setError,
}: UseLiveTournamentPoolStageAssignmentsProperties): UseLiveTournamentPoolStageAssignmentsResult => {
  const [editingTournamentId, setEditingTournamentId] = useState<string | undefined>();
  const [editingPoolStage, setEditingPoolStage] = useState<EditablePoolStage | undefined>();
  const [poolStagePools, setPoolStagePools] = useState<PoolStagePool[]>([]);
  const [poolStagePlayers, setPoolStagePlayers] = useState<TournamentPlayer[]>([]);
  const [poolStageAssignments, setPoolStageAssignments] = useState<Record<string, string[]>>({});
  const [poolStageEditError, setPoolStageEditError] = useState<string | undefined>();
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  const closePoolStageAssignments = useCallback(() => {
    setEditingTournamentId(undefined);
    setEditingPoolStage(undefined);
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});
    setPoolStageEditError(undefined);
    setIsSavingAssignments(false);
  }, []);

  const openPoolStageAssignments = useCallback(async (stageTournamentId: string, stage: LiveViewPoolStage) => {
    setError(undefined);
    setPoolStageEditError(undefined);
    setEditingTournamentId(stageTournamentId);
    setEditingPoolStage({
      id: stage.id,
      name: stage.name,
      playersPerPool: stage.playersPerPool ?? 0,
    });
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});

    try {
      const token = await getSafeAccessToken();
      const [playersData, poolsData] = await Promise.all([
        fetchTournamentPlayers(stageTournamentId, token),
        fetchPoolStagePools(stageTournamentId, stage.id, token),
      ]);
      setPoolStagePlayers(playersData);
      setPoolStagePools(poolsData);

      const initialAssignments: Record<string, string[]> = {};
      for (const pool of poolsData) {
        const poolAssignments = (pool.assignments || []).map((assignment) => assignment.playerId);
        initialAssignments[pool.id] = poolAssignments;
      }
      setPoolStageAssignments(initialAssignments);
    } catch (error_) {
      setPoolStageEditError(error_ instanceof Error ? error_.message : t('edit.error.failedLoadPoolAssignments'));
    }
  }, [getSafeAccessToken, setError, t]);

  const updatePoolStageAssignment = useCallback((poolId: string, index: number, playerId: string) => {
    setPoolStageAssignments((current) => {
      const next = { ...current };
      const poolAssignments = [...(next[poolId] || [])];
      poolAssignments[index] = playerId;
      next[poolId] = poolAssignments;
      return next;
    });
  }, []);

  const savePoolStageAssignments = useCallback(async () => {
    if (!editingTournamentId || !editingPoolStage) {
      return;
    }
    setPoolStageEditError(undefined);
    setIsSavingAssignments(true);
    try {
      const assignments: PoolAssignmentPayload[] = [];
      for (const [poolId, playerIds] of Object.entries(poolStageAssignments)) {
        const assignedPlayerIds = playerIds.filter(Boolean);
        for (const [index, playerId] of assignedPlayerIds.entries()) {
          assignments.push({
            poolId,
            playerId,
            assignmentType: AssignmentType.RANDOM,
            seedNumber: index + 1,
          });
        }
      }

      const token = await getSafeAccessToken();
      await updatePoolAssignments(editingTournamentId, editingPoolStage.id, assignments, token);
      closePoolStageAssignments();
      await reloadLiveViews({ showLoader: false });
    } catch (error_) {
      setPoolStageEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdatePoolAssignments'));
    } finally {
      setIsSavingAssignments(false);
    }
  }, [closePoolStageAssignments, editingPoolStage, editingTournamentId, getSafeAccessToken, poolStageAssignments, reloadLiveViews, t]);

  return {
    editingTournamentId,
    editingPoolStage,
    poolStagePools,
    poolStagePlayers,
    poolStageAssignments,
    poolStageEditError,
    isSavingAssignments,
    openPoolStageAssignments,
    closePoolStageAssignments,
    updatePoolStageAssignment,
    savePoolStageAssignments,
  };
};

export default useLiveTournamentPoolStageAssignments;