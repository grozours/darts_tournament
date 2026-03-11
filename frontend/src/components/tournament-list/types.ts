import type { useI18n } from '../../i18n';
import type {
  TournamentPlayer,
  PoolStageConfig,
  BracketConfig,
  PoolStagePool,
  CreatePlayerPayload,
} from '../../services/tournament-service';

export type Translator = ReturnType<typeof useI18n>['t'];

export type Tournament = {
  id: string;
  name: string;
  location?: string;
  logoUrl?: string;
  format: string;
  totalParticipants: number;
  currentParticipants?: number;
  status: string;
  durationType?: string;
  startTime?: string;
  endTime?: string;
  targetCount?: number;
  targetStartNumber?: number;
  shareTargets?: boolean;
  createdAt?: string;
  completedAt?: string;
  historicalFlag?: boolean;
  doubleStageEnabled?: boolean;
  hasLiveBrackets?: boolean;
};

export type EditFormState = {
  name: string;
  location: string;
  format: string;
  durationType: string;
  startTime: string;
  endTime: string;
  totalParticipants: string;
  targetCount: string;
  targetStartNumber: string;
  shareTargets: boolean;
  doubleStageEnabled: boolean;
};

export type TournamentListGroup = {
  title: string;
  status: string;
  items: Tournament[];
};

export type UserTournamentGroupStatus = {
  groupId?: string;
  hasGroup: boolean;
  isGroupCaptain: boolean;
  isGroupComplete: boolean;
  isGroupRegistered: boolean;
};

export type PoolStageAssignmentsState = Record<string, string[]>;

export type PlayerFormState = CreatePlayerPayload;

export type TournamentListSharedProperties = {
  t: Translator;
  isAdmin: boolean;
};

export type TournamentEditState = {
  editingTournament: Tournament | undefined;
  editForm: EditFormState | undefined;
  editError: string | undefined;
  isSaving: boolean;
  isEditPage: boolean;
  logoFile: File | undefined;
  isUploadingLogo: boolean;
  poolStages: PoolStageConfig[];
  poolStagesError: string | undefined;
  newPoolStage: {
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    matchFormatKey?: string;
    losersAdvanceToBracket: boolean;
  };
  isAddingPoolStage: boolean;
  brackets: BracketConfig[];
  bracketsError: string | undefined;
  newBracket: {
    name: string;
    bracketType: string;
    totalRounds: number;
    roundMatchFormats?: Record<string, string>;
  };
  isAddingBracket: boolean;
  isBracketRoundsAuto: boolean;
  players: TournamentPlayer[];
  playersLoading: boolean;
  playersError: string | undefined;
  playerForm: PlayerFormState;
  editingPlayerId: string | undefined;
  isRegisteringPlayer: boolean;
  isAutoFillingPlayers: boolean;
  isConfirmingAll: boolean;
  checkingInPlayerId: string | undefined;
  skillLevelOptions: Array<{ value: string; label: string }>;
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
};

export type PoolStageAssignmentsModalState = {
  editingPoolStage: PoolStageConfig | undefined;
  poolStagePools: PoolStagePool[];
  poolStagePlayers: TournamentPlayer[];
  poolStageAssignments: PoolStageAssignmentsState;
  poolStageEditError: string | undefined;
  isSavingAssignments: boolean;
};
