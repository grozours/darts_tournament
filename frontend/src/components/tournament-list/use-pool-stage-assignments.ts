import { useCallback, useState } from 'react';
import { AssignmentType } from '@shared/types';
import type {
  PoolAssignmentPayload,
  PoolStageConfig,
  PoolStagePool,
  TournamentPlayer,
} from '../../services/tournament-service';
import { fetchPoolStagePools, fetchTournamentPlayers, updatePoolAssignments } from '../../services/tournament-service';
import type { Tournament, Translator } from './types';

type UsePoolStageAssignmentsProperties = {
  t: Translator;
  editingTournament: Tournament | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  onStopAddingPoolStage?: () => void;
};

type UsePoolStageAssignmentsResult = {
  editingPoolStage?: PoolStageConfig;
  poolStagePools: PoolStagePool[];
  poolStagePlayers: TournamentPlayer[];
  poolStageAssignments: Record<string, string[]>;
  poolStageEditError?: string;
  isSavingAssignments: boolean;
  openPoolStageAssignments: (stage: PoolStageConfig) => Promise<void>;
  closePoolStageAssignments: () => void;
  updatePoolStageAssignment: (poolId: string, index: number, playerId: string) => void;
  savePoolStageAssignments: () => Promise<void>;
};

const usePoolStageAssignments = ({
  t,
  editingTournament,
  getSafeAccessToken,
  onStopAddingPoolStage,
}: UsePoolStageAssignmentsProperties): UsePoolStageAssignmentsResult => {
  const [editingPoolStage, setEditingPoolStage] = useState<PoolStageConfig | undefined>();
  const [poolStagePools, setPoolStagePools] = useState<PoolStagePool[]>([]);
  const [poolStagePlayers, setPoolStagePlayers] = useState<TournamentPlayer[]>([]);
  const [poolStageAssignments, setPoolStageAssignments] = useState<Record<string, string[]>>({});
  const [poolStageEditError, setPoolStageEditError] = useState<string | undefined>();
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  const closePoolStageAssignments = useCallback(() => {
    setEditingPoolStage(undefined);
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});
    setPoolStageEditError(undefined);
    setIsSavingAssignments(false);
  }, []);

  const openPoolStageAssignments = useCallback(async (stage: PoolStageConfig) => {
    if (!editingTournament) return;
    setPoolStageEditError(undefined);
    setEditingPoolStage(stage);
    setPoolStagePools([]);
    setPoolStagePlayers([]);
    setPoolStageAssignments({});
    onStopAddingPoolStage?.();
    try {
      const token = await getSafeAccessToken();
      const [playersData, poolsData] = await Promise.all([
        fetchTournamentPlayers(editingTournament.id, token),
        fetchPoolStagePools(editingTournament.id, stage.id, token),
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
  }, [editingTournament, getSafeAccessToken, onStopAddingPoolStage, t]);

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
    if (!editingTournament || !editingPoolStage) return;
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
      await updatePoolAssignments(editingTournament.id, editingPoolStage.id, assignments, token);
      closePoolStageAssignments();
    } catch (error_) {
      setPoolStageEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdatePoolAssignments'));
    } finally {
      setIsSavingAssignments(false);
    }
  }, [closePoolStageAssignments, editingPoolStage, editingTournament, getSafeAccessToken, poolStageAssignments, t]);

  return {
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

export default usePoolStageAssignments;
