import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { BracketType } from '@shared/types';
import type { BracketConfig, PoolStageConfig } from '../../services/tournament-service';
import {
  createBracket,
  deleteBracket,
  fetchBrackets,
  updateBracket,
} from '../../services/tournament-service';
import type { BracketDraft, TournamentStructureBaseProperties } from './tournament-structure-types';

type BracketStructureResult = {
  brackets: BracketConfig[];
  bracketsError: string | undefined;
  isAddingBracket: boolean;
  newBracket: BracketDraft;
  loadBrackets: (tournamentId: string) => Promise<void>;
  handleBracketNameChange: (bracketId: string, value: string) => void;
  handleBracketTypeChange: (bracketId: string, value: string) => void;
  handleBracketRoundsChange: (bracketId: string, value: number) => void;
  handleBracketStatusChange: (bracketId: string, value: string) => void;
  addBracket: () => Promise<void>;
  saveBracket: (bracket: BracketConfig) => Promise<void>;
  removeBracket: (bracketId: string) => Promise<void>;
  startAddBracket: () => void;
  cancelAddBracket: () => void;
  handleNewBracketNameChange: (value: string) => void;
  handleNewBracketTypeChange: (value: string) => void;
  handleNewBracketRoundsChange: (value: number) => void;
  getDefaultBracketRounds: (bracketName: string, bracketType: string) => number;
  resetBracketState: () => void;
};

type BracketStructureProperties = TournamentStructureBaseProperties & {
  poolStages: PoolStageConfig[];
};
type BracketState = {
  brackets: BracketConfig[];
  bracketsError: string | undefined;
  newBracket: BracketDraft;
  isAddingBracket: boolean;
  isBracketRoundsAuto: boolean;
};
type BracketStateSetters = {
  setBrackets: Dispatch<SetStateAction<BracketConfig[]>>;
  setBracketsError: Dispatch<SetStateAction<string | undefined>>;
  setNewBracket: Dispatch<SetStateAction<BracketDraft>>;
  setIsAddingBracket: Dispatch<SetStateAction<boolean>>;
  setIsBracketRoundsAuto: Dispatch<SetStateAction<boolean>>;
};

const initialBracketDraft: BracketDraft = {
  name: '',
  bracketType: BracketType.SINGLE_ELIMINATION as string,
  totalRounds: 3,
};
const useBracketState = (): BracketState & BracketStateSetters & {
  resetBracketState: () => void;
} => {
  const [brackets, setBrackets] = useState<BracketConfig[]>([]);
  const [bracketsError, setBracketsError] = useState<string | undefined>();
  const [newBracket, setNewBracket] = useState<BracketDraft>(initialBracketDraft);
  const [isAddingBracket, setIsAddingBracket] = useState(false);
  const [isBracketRoundsAuto, setIsBracketRoundsAuto] = useState(true);

  const resetBracketState = useCallback(() => {
    setBrackets([]);
    setBracketsError(undefined);
    setNewBracket(initialBracketDraft);
    setIsAddingBracket(false);
    setIsBracketRoundsAuto(true);
  }, []);

  return {
    brackets,
    bracketsError,
    newBracket,
    isAddingBracket,
    isBracketRoundsAuto,
    setBrackets,
    setBracketsError,
    setNewBracket,
    setIsAddingBracket,
    setIsBracketRoundsAuto,
    resetBracketState,
  };
};

const useBracketRounds = (poolStages: PoolStageConfig[]) =>
  useCallback((bracketName: string, bracketType: string) => {
    if (poolStages.length === 0) return 3;
    const firstStage = poolStages[0];
    if (!firstStage) return 3;
    let latestStage = firstStage;
    for (const stage of poolStages) {
      if (stage.stageNumber > latestStage.stageNumber) {
        latestStage = stage;
      }
    }
    const winnersPerPool = Math.max(0, latestStage.advanceCount);
    const losersPerPool = Math.max(0, latestStage.playersPerPool - latestStage.advanceCount);
    const winnerEntrants = latestStage.poolCount * winnersPerPool;
    const loserEntrants = latestStage.losersAdvanceToBracket
      ? latestStage.poolCount * losersPerPool
      : 0;
    const normalizedName = bracketName.trim().toLowerCase();
    const useLosers = normalizedName.includes('loser')
      || normalizedName.includes('perdant')
      || normalizedName.includes('perdants')
      || bracketType === BracketType.DOUBLE_ELIMINATION;
    const entrants = useLosers ? loserEntrants : winnerEntrants;
    const rounds = entrants > 0 ? Math.ceil(Math.log2(entrants)) : 1;
    return Math.max(1, rounds);
  }, [poolStages]);

const useBracketLoaders = ({
  t,
  getSafeAccessToken,
  setBrackets,
  setBracketsError,
  setIsAddingBracket,
  setIsBracketRoundsAuto,
}: Pick<TournamentStructureBaseProperties, 't' | 'getSafeAccessToken'>
  & Pick<BracketStateSetters, 'setBrackets' | 'setBracketsError' | 'setIsAddingBracket' | 'setIsBracketRoundsAuto'>) =>
  useCallback(async (tournamentId: string) => {
    setBracketsError(undefined);
    try {
      const token = await getSafeAccessToken();
      const data = await fetchBrackets(tournamentId, token);
      setBrackets(data);
      setIsAddingBracket(false);
      setIsBracketRoundsAuto(true);
    } catch (error_) {
      console.error('Error fetching brackets:', error_);
      setBracketsError(error_ instanceof Error ? error_.message : t('edit.error.failedLoadBrackets'));
    }
  }, [getSafeAccessToken, setBrackets, setBracketsError, setIsAddingBracket, setIsBracketRoundsAuto, t]);

const useBracketMutations = ({
  t,
  editingTournament,
  getSafeAccessToken,
  newBracket,
  loadBrackets,
  setBracketsError,
  setNewBracket,
  setIsAddingBracket,
  setIsBracketRoundsAuto,
}: {
  t: TournamentStructureBaseProperties['t'];
  editingTournament?: TournamentStructureBaseProperties['editingTournament'];
  getSafeAccessToken: TournamentStructureBaseProperties['getSafeAccessToken'];
  newBracket: BracketDraft;
  loadBrackets: (tournamentId: string) => Promise<void>;
  setBracketsError: BracketStateSetters['setBracketsError'];
  setNewBracket: BracketStateSetters['setNewBracket'];
  setIsAddingBracket: BracketStateSetters['setIsAddingBracket'];
  setIsBracketRoundsAuto: BracketStateSetters['setIsBracketRoundsAuto'];
}) => {
  const addBracket = useCallback(async () => {
    if (!editingTournament) return;
    if (!newBracket.name.trim()) {
      setBracketsError(t('edit.error.bracketNameRequired'));
      return;
    }
    setBracketsError(undefined);
    try {
      const token = await getSafeAccessToken();
      await createBracket(editingTournament.id, newBracket, token);
      await loadBrackets(editingTournament.id);
      setNewBracket((current) => ({ ...current, name: '' }));
      setIsAddingBracket(false);
      setIsBracketRoundsAuto(true);
    } catch (error_) {
      setBracketsError(error_ instanceof Error ? error_.message : t('edit.error.failedAddBracket'));
    }
  }, [editingTournament, getSafeAccessToken, loadBrackets, newBracket, setBracketsError, setIsAddingBracket, setIsBracketRoundsAuto, setNewBracket, t]);

  const saveBracket = useCallback(async (bracket: BracketConfig) => {
    if (!editingTournament) return;
    setBracketsError(undefined);
    try {
      const token = await getSafeAccessToken();
      await updateBracket(editingTournament.id, bracket.id, {
        name: bracket.name,
        bracketType: bracket.bracketType,
        totalRounds: bracket.totalRounds,
        status: bracket.status,
      }, token);
      await loadBrackets(editingTournament.id);
    } catch (error_) {
      setBracketsError(error_ instanceof Error ? error_.message : t('edit.error.failedUpdateBracket'));
    }
  }, [editingTournament, getSafeAccessToken, loadBrackets, setBracketsError, t]);

  const removeBracket = useCallback(async (bracketId: string) => {
    if (!editingTournament) return;
    if (!confirm('Delete this bracket?')) return;
    setBracketsError(undefined);
    try {
      const token = await getSafeAccessToken();
      await deleteBracket(editingTournament.id, bracketId, token);
      await loadBrackets(editingTournament.id);
    } catch (error_) {
      setBracketsError(error_ instanceof Error ? error_.message : t('edit.error.failedDeleteBracket'));
    }
  }, [editingTournament, getSafeAccessToken, loadBrackets, setBracketsError, t]);

  return { addBracket, saveBracket, removeBracket };
};

const useBracketFieldHandlers = ({
  setBrackets,
}: {
  setBrackets: BracketStateSetters['setBrackets'];
}) => {
  const updateBracketField = useCallback(
    (bracketId: string, updater: (bracket: BracketConfig) => BracketConfig) => {
      setBrackets((current) =>
        current.map((item) => (item.id === bracketId ? updater(item) : item))
      );
    },
    [setBrackets]
  );

  const handleBracketNameChange = useCallback((bracketId: string, value: string) => {
    updateBracketField(bracketId, (item) => ({ ...item, name: value }));
  }, [updateBracketField]);

  const handleBracketTypeChange = useCallback((bracketId: string, value: string) => {
    updateBracketField(bracketId, (item) => ({ ...item, bracketType: value }));
  }, [updateBracketField]);

  const handleBracketRoundsChange = useCallback((bracketId: string, value: number) => {
    updateBracketField(bracketId, (item) => ({ ...item, totalRounds: value }));
  }, [updateBracketField]);

  const handleBracketStatusChange = useCallback((bracketId: string, value: string) => {
    updateBracketField(bracketId, (item) => ({ ...item, status: value }));
  }, [updateBracketField]);

  return {
    handleBracketNameChange,
    handleBracketTypeChange,
    handleBracketRoundsChange,
    handleBracketStatusChange,
  };
};

const useBracketDraftHandlers = ({
  setNewBracket,
  setIsAddingBracket,
  setIsBracketRoundsAuto,
  isBracketRoundsAuto,
  getDefaultBracketRounds,
}: {
  setNewBracket: BracketStateSetters['setNewBracket'];
  setIsAddingBracket: BracketStateSetters['setIsAddingBracket'];
  setIsBracketRoundsAuto: BracketStateSetters['setIsBracketRoundsAuto'];
  isBracketRoundsAuto: boolean;
  getDefaultBracketRounds: (bracketName: string, bracketType: string) => number;
}) => {
  const startAddBracket = useCallback(() => {
    setIsAddingBracket(true);
    setIsBracketRoundsAuto(true);
    setNewBracket((current) => ({
      ...current,
      totalRounds: getDefaultBracketRounds(current.name, current.bracketType),
    }));
  }, [getDefaultBracketRounds, setIsAddingBracket, setIsBracketRoundsAuto, setNewBracket]);

  const cancelAddBracket = useCallback(() => {
    setIsAddingBracket(false);
    setIsBracketRoundsAuto(true);
  }, [setIsAddingBracket, setIsBracketRoundsAuto]);

  const handleNewBracketNameChange = useCallback((value: string) => {
    setNewBracket((current) => ({
      ...current,
      name: value,
      ...(isBracketRoundsAuto
        ? { totalRounds: getDefaultBracketRounds(value, current.bracketType) }
        : {}),
    }));
  }, [getDefaultBracketRounds, isBracketRoundsAuto, setNewBracket]);

  const handleNewBracketTypeChange = useCallback((value: string) => {
    setNewBracket((current) => ({
      ...current,
      bracketType: value,
      ...(isBracketRoundsAuto
        ? { totalRounds: getDefaultBracketRounds(current.name, value) }
        : {}),
    }));
  }, [getDefaultBracketRounds, isBracketRoundsAuto, setNewBracket]);

  const handleNewBracketRoundsChange = useCallback((value: number) => {
    setIsBracketRoundsAuto(false);
    setNewBracket((current) => ({
      ...current,
      totalRounds: value,
    }));
  }, [setIsBracketRoundsAuto, setNewBracket]);

  return {
    startAddBracket,
    cancelAddBracket,
    handleNewBracketNameChange,
    handleNewBracketTypeChange,
    handleNewBracketRoundsChange,
  };
};

const useBracketStructure = ({
  t,
  editingTournament,
  getSafeAccessToken,
  poolStages,
}: BracketStructureProperties): BracketStructureResult => {
  const {
    brackets,
    bracketsError,
    newBracket,
    isAddingBracket,
    isBracketRoundsAuto,
    setBrackets,
    setBracketsError,
    setNewBracket,
    setIsAddingBracket,
    setIsBracketRoundsAuto,
    resetBracketState,
  } = useBracketState();

  const getDefaultBracketRounds = useBracketRounds(poolStages);

  const loadBrackets = useBracketLoaders({
    t,
    getSafeAccessToken,
    setBrackets,
    setBracketsError,
    setIsAddingBracket,
    setIsBracketRoundsAuto,
  });

  const { addBracket, saveBracket, removeBracket } = useBracketMutations({
    t,
    editingTournament,
    getSafeAccessToken,
    newBracket,
    loadBrackets,
    setBracketsError,
    setNewBracket,
    setIsAddingBracket,
    setIsBracketRoundsAuto,
  });

  const {
    handleBracketNameChange,
    handleBracketTypeChange,
    handleBracketRoundsChange,
    handleBracketStatusChange,
  } = useBracketFieldHandlers({ setBrackets });

  const {
    startAddBracket,
    cancelAddBracket,
    handleNewBracketNameChange,
    handleNewBracketTypeChange,
    handleNewBracketRoundsChange,
  } = useBracketDraftHandlers({
    setNewBracket,
    setIsAddingBracket,
    setIsBracketRoundsAuto,
    isBracketRoundsAuto,
    getDefaultBracketRounds,
  });

  return {
    brackets,
    bracketsError,
    isAddingBracket,
    newBracket,
    loadBrackets,
    handleBracketNameChange,
    handleBracketTypeChange,
    handleBracketRoundsChange,
    handleBracketStatusChange,
    addBracket,
    saveBracket,
    removeBracket,
    startAddBracket,
    cancelAddBracket,
    handleNewBracketNameChange,
    handleNewBracketTypeChange,
    handleNewBracketRoundsChange,
    getDefaultBracketRounds,
    resetBracketState,
  };
};

export type { BracketStructureResult };
export default useBracketStructure;
