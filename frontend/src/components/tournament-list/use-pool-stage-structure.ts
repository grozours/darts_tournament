import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { PoolStageConfig } from '../../services/tournament-service';
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
  handlePoolStageLosersAdvanceChange: (stageId: string, value: boolean) => void;
  handlePoolStageStatusChange: (stage: PoolStageConfig, nextStatus: string) => void;
  addPoolStage: () => Promise<void>;
  savePoolStage: (stage: PoolStageConfig) => Promise<void>;
  removePoolStage: (stageId: string) => Promise<void>;
  startAddPoolStage: () => void;
  cancelAddPoolStage: () => void;
  handleNewPoolStageStageNumberChange: (value: number) => void;
  handleNewPoolStageNameChange: (value: string) => void;
  handleNewPoolStagePoolCountChange: (value: number) => void;
  handleNewPoolStagePlayersPerPoolChange: (value: number) => void;
  handleNewPoolStageAdvanceCountChange: (value: number) => void;
  handleNewPoolStageLosersAdvanceChange: (value: boolean) => void;
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
  losersAdvanceToBracket: false,
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
      console.error('Error fetching pool stages:', error_);
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
    if (!editingTournament) return;
    if (!newPoolStage.name.trim()) {
      setPoolStagesError(t('edit.error.stageNameRequired'));
      return;
    }
    setPoolStagesError(undefined);
    try {
      const token = await getSafeAccessToken();
      await createPoolStage(editingTournament.id, newPoolStage, token);
      await loadPoolStages(editingTournament.id);
      setNewPoolStage((current) => ({ ...current, name: '' }));
      setIsAddingPoolStage(false);
    } catch (error_) {
      setPoolStagesError(error_ instanceof Error ? error_.message : t('edit.error.failedAddPoolStage'));
    }
  }, [editingTournament, getSafeAccessToken, loadPoolStages, newPoolStage, setIsAddingPoolStage, setNewPoolStage, setPoolStagesError, t]);

  const savePoolStage = useCallback(async (stage: PoolStageConfig) => {
    if (!editingTournament) return;
    setPoolStagesError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updatePoolStage(editingTournament.id, stage.id, {
        stageNumber: stage.stageNumber,
        name: stage.name,
        poolCount: stage.poolCount,
        playersPerPool: stage.playersPerPool,
        advanceCount: stage.advanceCount,
        losersAdvanceToBracket: stage.losersAdvanceToBracket,
        status: stage.status,
      }, token);
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

const usePoolStageFieldHandlers = ({
  setPoolStages,
  savePoolStage,
}: {
  setPoolStages: PoolStageStateSetters['setPoolStages'];
  savePoolStage: (stage: PoolStageConfig) => Promise<void>;
}) => {
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
    updatePoolStageField(stageId, (item) => ({ ...item, playersPerPool: value }));
  }, [updatePoolStageField]);

  const handlePoolStageAdvanceCountChange = useCallback((stageId: string, value: number) => {
    updatePoolStageField(stageId, (item) => ({ ...item, advanceCount: value }));
  }, [updatePoolStageField]);

  const handlePoolStageLosersAdvanceChange = useCallback((stageId: string, value: boolean) => {
    updatePoolStageField(stageId, (item) => ({ ...item, losersAdvanceToBracket: value }));
  }, [updatePoolStageField]);

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
    handlePoolStageLosersAdvanceChange,
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
    setNewPoolStage((current) => ({ ...current, playersPerPool: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStageAdvanceCountChange = useCallback((value: number) => {
    setNewPoolStage((current) => ({ ...current, advanceCount: value }));
  }, [setNewPoolStage]);

  const handleNewPoolStageLosersAdvanceChange = useCallback((value: boolean) => {
    setNewPoolStage((current) => ({ ...current, losersAdvanceToBracket: value }));
  }, [setNewPoolStage]);

  return {
    startAddPoolStage,
    cancelAddPoolStage,
    handleNewPoolStageStageNumberChange,
    handleNewPoolStageNameChange,
    handleNewPoolStagePoolCountChange,
    handleNewPoolStagePlayersPerPoolChange,
    handleNewPoolStageAdvanceCountChange,
    handleNewPoolStageLosersAdvanceChange,
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
    handlePoolStageLosersAdvanceChange,
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
    handleNewPoolStageLosersAdvanceChange,
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
    handlePoolStageLosersAdvanceChange,
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
    handleNewPoolStageLosersAdvanceChange,
    resetPoolStageState,
  };
};

export type { PoolStageStructureResult };
export default usePoolStageStructure;
