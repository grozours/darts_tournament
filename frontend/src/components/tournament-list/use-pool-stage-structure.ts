import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { PoolStageConfig, PoolStageDestinationType } from '../../services/tournament-service';
import {
  createPoolStage,
  deletePoolStage,
  fetchPoolStages,
  updatePoolStage,
} from '../../services/tournament-service';
import type { PoolStageDraft, TournamentStructureBaseProperties } from './tournament-structure-types';

type PoolStageStructureResult = {
  poolStages: PoolStageConfig[];
  poolStagesError: string | undefined;
  isAddingPoolStage: boolean;
  newPoolStage: PoolStageDraft;
  loadPoolStages: (tournamentId: string) => Promise<void>;
  handlePoolStageNumberChange: (stageId: string, value: number) => void;
  handlePoolStageNameChange: (stageId: string, value: string) => void;
  handlePoolStagePoolCountChange: (stageId: string, value: number) => void;
  handlePoolStagePlayersPerPoolChange: (stageId: string, value: number) => void;
  handlePoolStageAdvanceCountChange: (stageId: string, value: number) => void;
  handlePoolStageMatchFormatChange: (stageId: string, value: string | undefined) => void;
  handlePoolStageLosersAdvanceChange: (stageId: string, value: boolean) => void;
  handlePoolStageRankingDestinationChange: (
    stageId: string,
    position: number,
    destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
  ) => void;
  handlePoolStageStatusChange: (stage: PoolStageConfig, nextStatus: string) => void;
  addPoolStage: () => Promise<boolean>;
  savePoolStage: (stage: PoolStageConfig) => Promise<void>;
  removePoolStage: (stageId: string) => Promise<void>;
  startAddPoolStage: () => void;
  cancelAddPoolStage: () => void;
  handleNewPoolStageStageNumberChange: (value: number) => void;
  handleNewPoolStageNameChange: (value: string) => void;
  handleNewPoolStagePoolCountChange: (value: number) => void;
  handleNewPoolStagePlayersPerPoolChange: (value: number) => void;
  handleNewPoolStageAdvanceCountChange: (value: number) => void;
  handleNewPoolStageMatchFormatChange: (value: string | undefined) => void;
  handleNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  handleNewPoolStageRankingDestinationChange: (
    position: number,
    destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
  ) => void;
  resetPoolStageState: () => void;
};

type PoolStageState = {
  poolStages: PoolStageConfig[];
  poolStagesError: string | undefined;
  newPoolStage: PoolStageDraft;
  isAddingPoolStage: boolean;
};

type PoolStageStateSetters = {
  setPoolStages: Dispatch<SetStateAction<PoolStageConfig[]>>;
  setPoolStagesError: Dispatch<SetStateAction<string | undefined>>;
  setNewPoolStage: Dispatch<SetStateAction<PoolStageDraft>>;
  setIsAddingPoolStage: Dispatch<SetStateAction<boolean>>;
};

const initialPoolStageDraft: PoolStageDraft = {
  stageNumber: 1,
  name: '',
  poolCount: 2,
  playersPerPool: 4,
  advanceCount: 2,
  matchFormatKey: 'BO3',
  losersAdvanceToBracket: false,
  rankingDestinations: [
    { position: 1, destinationType: 'ELIMINATED' },
    { position: 2, destinationType: 'ELIMINATED' },
    { position: 3, destinationType: 'ELIMINATED' },
    { position: 4, destinationType: 'ELIMINATED' },
  ],
};

const usePoolStageState = (): PoolStageState & PoolStageStateSetters & {
  resetPoolStageState: () => void;
} => {
  const [poolStages, setPoolStages] = useState<PoolStageConfig[]>([]);
  const [poolStagesError, setPoolStagesError] = useState<string | undefined>();
  const [newPoolStage, setNewPoolStage] = useState<PoolStageDraft>(initialPoolStageDraft);
  const [isAddingPoolStage, setIsAddingPoolStage] = useState(false);

  const resetPoolStageState = useCallback(() => {
    setPoolStages([]);
    setPoolStagesError(undefined);
    setNewPoolStage(initialPoolStageDraft);
    setIsAddingPoolStage(false);
  }, []);

  return {
    poolStages,
    poolStagesError,
    newPoolStage,
    isAddingPoolStage,
    setPoolStages,
    setPoolStagesError,
    setNewPoolStage,
    setIsAddingPoolStage,
    resetPoolStageState,
  };
};

const validateRankingDestinations = (
  stage: {
    playersPerPool: number;
    rankingDestinations?: Array<{
      position: number;
      destinationType: PoolStageDestinationType;
      bracketId?: string;
      poolStageId?: string;
    }>;
  },
  t: TournamentStructureBaseProperties['t']
): string | undefined => {
  const destinations = stage.rankingDestinations;
  if (!destinations || destinations.length === 0) {
    return t('edit.error.poolDestinationsIncomplete');
  }
  const positions = new Set(destinations.map((destination) => destination.position));
  if (positions.size !== stage.playersPerPool) {
    return t('edit.error.poolDestinationsIncomplete');
  }
  for (const destination of destinations) {
    if (destination.destinationType === 'BRACKET' && !destination.bracketId) {
      return t('edit.error.poolDestinationsMissingBracket');
    }
    if (destination.destinationType === 'POOL_STAGE' && !destination.poolStageId) {
      return t('edit.error.poolDestinationsMissingPoolStage');
    }
  }
  return undefined;
};

const usePoolStageLoaders = ({
  t,
  getSafeAccessToken,
  setPoolStages,
  setPoolStagesError,
  setNewPoolStage,
}: Pick<TournamentStructureBaseProperties, 't' | 'getSafeAccessToken'>
  & Pick<PoolStageStateSetters, 'setPoolStages' | 'setPoolStagesError' | 'setNewPoolStage'>) =>
  useCallback(async (tournamentId: string) => {
    setPoolStagesError(undefined);
    try {
      const token = await getSafeAccessToken();
      const data = await fetchPoolStages(tournamentId, token);
      setPoolStages(data);
      const nextStageNumber = data.length > 0
        ? Math.max(...data.map((stage) => stage.stageNumber)) + 1
        : 1;
      setNewPoolStage((current) => ({ ...current, stageNumber: nextStageNumber }));
    } catch (error_) {
      setPoolStagesError(error_ instanceof Error ? error_.message : t('edit.error.failedLoadPoolStages'));
    }
  }, [getSafeAccessToken, setNewPoolStage, setPoolStages, setPoolStagesError, t]);

const usePoolStageMutations = ({
  t,
  editingTournament,
  getSafeAccessToken,
  newPoolStage,
  loadPoolStages,
  setPoolStagesError,
  setNewPoolStage,
  setIsAddingPoolStage,
}: {
  t: TournamentStructureBaseProperties['t'];
  editingTournament?: TournamentStructureBaseProperties['editingTournament'];
  getSafeAccessToken: TournamentStructureBaseProperties['getSafeAccessToken'];
  newPoolStage: PoolStageDraft;
  loadPoolStages: (tournamentId: string) => Promise<void>;
  setPoolStagesError: PoolStageStateSetters['setPoolStagesError'];
  setNewPoolStage: PoolStageStateSetters['setNewPoolStage'];
  setIsAddingPoolStage: PoolStageStateSetters['setIsAddingPoolStage'];
}) => {
  const addPoolStage = useCallback(async () => {
    if (!editingTournament) return false;
    if (!newPoolStage.name.trim()) {
      setPoolStagesError(t('edit.error.stageNameRequired'));
      return false;
    }
    const routingError = validateRankingDestinations(newPoolStage, t);
    if (routingError) {
      setPoolStagesError(routingError);
      return false;
    }
    setPoolStagesError(undefined);
    try {
      const token = await getSafeAccessToken();
      await createPoolStage(editingTournament.id, newPoolStage, token);
      await loadPoolStages(editingTournament.id);
      setNewPoolStage((current) => ({ ...current, name: '' }));
      setIsAddingPoolStage(false);
      return true;
    } catch (error_) {
      setPoolStagesError(error_ instanceof Error ? error_.message : t('edit.error.failedAddPoolStage'));
      return false;
    }
  }, [editingTournament, getSafeAccessToken, loadPoolStages, newPoolStage, setIsAddingPoolStage, setNewPoolStage, setPoolStagesError, t]);

  const savePoolStage = useCallback(async (stage: PoolStageConfig) => {
    if (!editingTournament) return;
    const routingError = validateRankingDestinations(stage, t);
    if (routingError) {
      setPoolStagesError(routingError);
      return;
    }
    setPoolStagesError(undefined);
    try {
      const token = await getSafeAccessToken();
      const payload: Partial<Omit<PoolStageConfig, 'id' | 'tournamentId'>> = {
        stageNumber: stage.stageNumber,
        name: stage.name,
        poolCount: stage.poolCount,
        playersPerPool: stage.playersPerPool,
        advanceCount: stage.advanceCount,
        losersAdvanceToBracket: stage.losersAdvanceToBracket,
        status: stage.status,
      };
      if (stage.matchFormatKey) {
        payload.matchFormatKey = stage.matchFormatKey;
      }
      if (stage.rankingDestinations) {
        payload.rankingDestinations = stage.rankingDestinations;
      }
      await updatePoolStage(editingTournament.id, stage.id, payload, token);
      await loadPoolStages(editingTournament.id);
    } catch (error_) {
      setPoolStagesError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdatePoolStage'));
    }
  }, [editingTournament, getSafeAccessToken, loadPoolStages, setPoolStagesError, t]);

  const removePoolStage = useCallback(async (stageId: string) => {
    if (!editingTournament) return;
    if (!confirm('Delete this pool stage?')) return;
    setPoolStagesError(undefined);
    try {
      const token = await getSafeAccessToken();
      await deletePoolStage(editingTournament.id, stageId, token);
      await loadPoolStages(editingTournament.id);
    } catch (error_) {
      setPoolStagesError(error_ instanceof Error ? error_.message : t('edit.error.failedDeletePoolStage'));
    }
  }, [editingTournament, getSafeAccessToken, loadPoolStages, setPoolStagesError, t]);

  return { addPoolStage, savePoolStage, removePoolStage };
};

const buildRankingDestination = (
  position: number,
  destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
) => {
  if (destination.destinationType === 'BRACKET') {
    return {
      position,
      destinationType: 'BRACKET' as const,
      ...(destination.bracketId ? { bracketId: destination.bracketId } : {}),
    };
  }
  if (destination.destinationType === 'POOL_STAGE') {
    return {
      position,
      destinationType: 'POOL_STAGE' as const,
      ...(destination.poolStageId ? { poolStageId: destination.poolStageId } : {}),
    };
  }
  return {
    position,
    destinationType: 'ELIMINATED' as const,
  };
};

const usePoolStageFieldHandlers = ({
  setPoolStages,
  savePoolStage,
}: {
  setPoolStages: PoolStageStateSetters['setPoolStages'];
  savePoolStage: (stage: PoolStageConfig) => Promise<void>;
}) => {
  const normalizeDestinations = useCallback(
    (destinations: PoolStageConfig['rankingDestinations'] | undefined, playersPerPool: number) => {
      const map = new Map((destinations ?? []).map((destination) => [destination.position, destination]));
      const next: NonNullable<PoolStageConfig['rankingDestinations']> = [];
      for (let position = 1; position <= playersPerPool; position += 1) {
        next.push(
          map.get(position) ?? { position, destinationType: 'ELIMINATED' }
        );
      }
      return next;
    },
    []
  );

  const updatePoolStageField = useCallback(
    (stageId: string, updater: (stage: PoolStageConfig) => PoolStageConfig) => {
      setPoolStages((current) =>
        current.map((item) => (item.id === stageId ? updater(item) : item))
      );
    },
    [setPoolStages]
  );

  const handlePoolStageNumberChange = useCallback((stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, stageNumber: value }));
  }, [updatePoolStageField]);

  const handlePoolStageNameChange = useCallback((stageId: string, value: string) => {
    updatePoolStageField(stageId, (item) => ({ ...item, name: value }));
  }, [updatePoolStageField]);

  const handlePoolStagePoolCountChange = useCallback((stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, poolCount: value }));
  }, [updatePoolStageField]);

  const handlePoolStagePlayersPerPoolChange = useCallback((stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({
      ...item,
      playersPerPool: value,
      rankingDestinations: normalizeDestinations(item.rankingDestinations, value),
    }));
  }, [normalizeDestinations, updatePoolStageField]);

  const handlePoolStageAdvanceCountChange = useCallback((stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, advanceCount: value }));
  }, [updatePoolStageField]);

  const handlePoolStageMatchFormatChange = useCallback((stageId: string, value: string | undefined) => {
    updatePoolStageField(stageId, (item) => {
      if (!value) {
        const rest = { ...item };
        delete rest.matchFormatKey;
        return rest;
      }
      return {
        ...item,
        matchFormatKey: value,
      };
    });
  }, [updatePoolStageField]);

  const handlePoolStageLosersAdvanceChange = useCallback((stageId: string, value: boolean) => {
    updatePoolStageField(stageId, (item) => ({ ...item, losersAdvanceToBracket: value }));
  }, [updatePoolStageField]);

  const handlePoolStageRankingDestinationChange = useCallback(
    (
      stageId: string,
      position: number,
      destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
    ) => {
      updatePoolStageField(stageId, (item) => {
        const current = normalizeDestinations(item.rankingDestinations, item.playersPerPool);
        const nextDestination = buildRankingDestination(position, destination);
        const next = current.map((entry) =>
          entry.position === position ? nextDestination : entry
        );
        return { ...item, rankingDestinations: next };
      });
    },
    [normalizeDestinations, updatePoolStageField]
  );

  const handlePoolStageStatusChange = useCallback((stage: PoolStageConfig, nextStatus: string) => {
    updatePoolStageField(stage.id, (item) => ({ ...item, status: nextStatus }));
    void savePoolStage({ ...stage, status: nextStatus });
  }, [savePoolStage, updatePoolStageField]);

  return {
    handlePoolStageNumberChange,
    handlePoolStageNameChange,
    handlePoolStagePoolCountChange,
    handlePoolStagePlayersPerPoolChange,
    handlePoolStageAdvanceCountChange,
    handlePoolStageMatchFormatChange,
    handlePoolStageLosersAdvanceChange,
    handlePoolStageRankingDestinationChange,
    handlePoolStageStatusChange,
  };
};

const usePoolStageDraftHandlers = ({
  setNewPoolStage,
  setIsAddingPoolStage,
}: {
  setNewPoolStage: PoolStageStateSetters['setNewPoolStage'];
  setIsAddingPoolStage: PoolStageStateSetters['setIsAddingPoolStage'];
}) => {
  const normalizeDestinations = useCallback(
    (destinations: PoolStageDraft['rankingDestinations'] | undefined, playersPerPool: number) => {
      const map = new Map((destinations ?? []).map((destination) => [destination.position, destination]));
      const next: NonNullable<PoolStageDraft['rankingDestinations']> = [];
      for (let position = 1; position <= playersPerPool; position += 1) {
        next.push(
          map.get(position) ?? { position, destinationType: 'ELIMINATED' }
        );
      }
      return next;
    },
    []
  );

  const startAddPoolStage = useCallback(() => {
    setIsAddingPoolStage(true);
  }, [setIsAddingPoolStage]);

  const cancelAddPoolStage = useCallback(() => {
    setIsAddingPoolStage(false);
  }, [setIsAddingPoolStage]);

  const handleNewPoolStageStageNumberChange = useCallback((value: number) => {
    setNewPoolStage((current) => ({ ...current, stageNumber: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStageNameChange = useCallback((value: string) => {
    setNewPoolStage((current) => ({ ...current, name: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStagePoolCountChange = useCallback((value: number) => {
    setNewPoolStage((current) => ({ ...current, poolCount: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStagePlayersPerPoolChange = useCallback((value: number) => {
    setNewPoolStage((current) => ({
      ...current,
      playersPerPool: value,
      rankingDestinations: normalizeDestinations(current.rankingDestinations, value),
    }));
  }, [normalizeDestinations, setNewPoolStage]);

  const handleNewPoolStageAdvanceCountChange = useCallback((value: number) => {
    setNewPoolStage((current) => ({ ...current, advanceCount: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStageMatchFormatChange = useCallback((value: string | undefined) => {
    setNewPoolStage((current) => {
      if (!value) {
        const rest = { ...current };
        delete rest.matchFormatKey;
        return rest;
      }
      return {
        ...current,
        matchFormatKey: value,
      };
    });
  }, [setNewPoolStage]);

  const handleNewPoolStageLosersAdvanceChange = useCallback((value: boolean) => {
    setNewPoolStage((current) => ({ ...current, losersAdvanceToBracket: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStageRankingDestinationChange = useCallback(
    (
      position: number,
      destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
    ) => {
      setNewPoolStage((current) => {
        const normalized = normalizeDestinations(current.rankingDestinations, current.playersPerPool);
        const nextDestination = buildRankingDestination(position, destination);
        const next = normalized.map((entry) =>
          entry.position === position ? nextDestination : entry
        );
        return { ...current, rankingDestinations: next };
      });
    },
    [normalizeDestinations, setNewPoolStage]
  );

  return {
    startAddPoolStage,
    cancelAddPoolStage,
    handleNewPoolStageStageNumberChange,
    handleNewPoolStageNameChange,
    handleNewPoolStagePoolCountChange,
    handleNewPoolStagePlayersPerPoolChange,
    handleNewPoolStageAdvanceCountChange,
    handleNewPoolStageMatchFormatChange,
    handleNewPoolStageLosersAdvanceChange,
    handleNewPoolStageRankingDestinationChange,
  };
};

const usePoolStageStructure = ({
  t,
  editingTournament,
  getSafeAccessToken,
}: TournamentStructureBaseProperties): PoolStageStructureResult => {
  const {
    poolStages,
    poolStagesError,
    newPoolStage,
    isAddingPoolStage,
    setPoolStages,
    setPoolStagesError,
    setNewPoolStage,
    setIsAddingPoolStage,
    resetPoolStageState,
  } = usePoolStageState();

  const loadPoolStages = usePoolStageLoaders({
    t,
    getSafeAccessToken,
    setPoolStages,
    setPoolStagesError,
    setNewPoolStage,
  });

  const { addPoolStage, savePoolStage, removePoolStage } = usePoolStageMutations({
    t,
    editingTournament,
    getSafeAccessToken,
    newPoolStage,
    loadPoolStages,
    setPoolStagesError,
    setNewPoolStage,
    setIsAddingPoolStage,
  });

  const {
    handlePoolStageNumberChange,
    handlePoolStageNameChange,
    handlePoolStagePoolCountChange,
    handlePoolStagePlayersPerPoolChange,
    handlePoolStageAdvanceCountChange,
    handlePoolStageMatchFormatChange,
    handlePoolStageLosersAdvanceChange,
    handlePoolStageRankingDestinationChange,
    handlePoolStageStatusChange,
  } = usePoolStageFieldHandlers({ setPoolStages, savePoolStage });

  const {
    startAddPoolStage,
    cancelAddPoolStage,
    handleNewPoolStageStageNumberChange,
    handleNewPoolStageNameChange,
    handleNewPoolStagePoolCountChange,
    handleNewPoolStagePlayersPerPoolChange,
    handleNewPoolStageAdvanceCountChange,
    handleNewPoolStageMatchFormatChange,
    handleNewPoolStageLosersAdvanceChange,
    handleNewPoolStageRankingDestinationChange,
  } = usePoolStageDraftHandlers({ setIsAddingPoolStage, setNewPoolStage });

  return {
    poolStages,
    poolStagesError,
    isAddingPoolStage,
    newPoolStage,
    loadPoolStages,
    handlePoolStageNumberChange,
    handlePoolStageNameChange,
    handlePoolStagePoolCountChange,
    handlePoolStagePlayersPerPoolChange,
    handlePoolStageAdvanceCountChange,
    handlePoolStageMatchFormatChange,
    handlePoolStageLosersAdvanceChange,
    handlePoolStageRankingDestinationChange,
    handlePoolStageStatusChange,
    addPoolStage,
    savePoolStage,
    removePoolStage,
    startAddPoolStage,
    cancelAddPoolStage,
    handleNewPoolStageStageNumberChange,
    handleNewPoolStageNameChange,
    handleNewPoolStagePoolCountChange,
    handleNewPoolStagePlayersPerPoolChange,
    handleNewPoolStageAdvanceCountChange,
    handleNewPoolStageMatchFormatChange,
    handleNewPoolStageLosersAdvanceChange,
    handleNewPoolStageRankingDestinationChange,
    resetPoolStageState,
  };
};

export type { PoolStageStructureResult };
export default usePoolStageStructure;
