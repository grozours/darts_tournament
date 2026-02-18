import type { useI18n } from '../../i18n';

export type Translator = ReturnType<typeof useI18n>['t'];

export type LiveViewTarget = {
  id: string;
  targetNumber: number;
  targetCode?: string;
  name?: string;
  status?: string;
  currentMatchId?: string;
};

export type LiveViewMatch = {
  id: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  playerMatches?: Array<{
    player?: {
      id?: string;
      firstName: string;
      lastName: string;
      surname?: string;
      teamName?: string;
    };
    playerPosition?: number;
    scoreTotal?: number;
    legsWon?: number;
  }>;
  targetId?: string;
  target?: {
    id: string;
    targetNumber: number;
    targetCode?: string;
    name?: string;
  };
};

export type LiveViewPool = {
  id: string;
  poolNumber: number;
  name: string;
  matches?: LiveViewMatch[];
};

export type LiveViewPoolStage = {
  id: string;
  stageNumber: number;
  name: string;
  pools?: LiveViewPool[];
};

export type LiveViewBracket = {
  id: string;
  name: string;
  matches?: LiveViewMatch[];
};

export type LiveViewData = {
  id: string;
  name: string;
  status: string;
  targets?: LiveViewTarget[];
  poolStages?: LiveViewPoolStage[];
  brackets?: LiveViewBracket[];
};

export type TargetMatchInfo = {
  matchId: string;
  status: string;
  label: string;
  players: string[];
  tournamentId: string;
  tournamentName: string;
};

export type MatchQueueItem = {
  tournamentId: string;
  tournamentName: string;
  source: 'pool' | 'bracket';
  matchId: string;
  poolId: string;
  stageNumber: number;
  stageName: string;
  poolNumber: number;
  poolName: string;
  bracketName?: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  targetCode?: string;
  targetNumber?: number;
  players: string[];
  blocked: boolean;
};

export type PoolQueue = {
  poolId: string;
  stageNumber: number;
  poolNumber: number;
  progress: number;
  matches: MatchQueueItem[];
};

export type SharedTarget = {
  targetNumber: number;
  label: string;
  isInUse: boolean;
  activeMatchInfo?: TargetMatchInfo;
  targetIdsByTournament: Map<string, string>;
};
