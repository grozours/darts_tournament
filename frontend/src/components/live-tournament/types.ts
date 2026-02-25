import type { useI18n } from '../../i18n';

export type Translator = ReturnType<typeof useI18n>['t'];

export interface LiveViewMatchPlayer {
  player?: {
    id: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
  };
  playerPosition: number;
  scoreTotal?: number;
  legsWon?: number;
  setsWon?: number;
}

export interface LiveViewMatch {
  id: string;
  matchNumber: number;
  roundNumber: number;
  matchFormatKey?: string;
  status: string;
  scheduledAt?: string;
  playerMatches?: LiveViewMatchPlayer[];
  winner?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  target?: {
    targetNumber: number;
    targetCode?: string;
    name?: string;
  };
}

export interface LiveViewTarget {
  id: string;
  targetNumber: number;
  targetCode?: string;
  name?: string;
  status?: string;
  currentMatchId?: string;
}

export interface LiveViewPool {
  id: string;
  poolNumber: number;
  name: string;
  status: string;
  assignments?: Array<{
    id: string;
    player: {
      id: string;
      firstName: string;
      lastName: string;
      surname?: string;
      teamName?: string;
    };
  }>;
  matches?: LiveViewMatch[];
}

export interface PoolLeaderboardRow {
  playerId: string;
  name: string;
  legsWon: number;
  legsLost: number;
  headToHeadBonus?: number;
  position: number;
}

export interface LiveViewPoolStage {
  id: string;
  stageNumber: number;
  name: string;
  matchFormatKey?: string;
  inParallelWith?: string[];
  status: string;
  poolCount?: number;
  playersPerPool?: number;
  advanceCount?: number;
  rankingDestinations?: Array<{
    position: number;
    destinationType: 'POOL_STAGE' | 'BRACKET' | 'ELIMINATED';
    poolStageId?: string;
    bracketId?: string;
  }>;
  pools?: LiveViewPool[];
}

export interface LiveViewBracket {
  id: string;
  name: string;
  bracketType: string;
  status: string;
  totalRounds?: number;
  roundMatchFormats?: Record<string, string>;
  inParallelWith?: string[];
  targetIds?: string[];
  bracketTargets?: Array<{ targetId: string }>;
  entries?: Array<{
    id: string;
    seedNumber: number;
    player: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  matches?: LiveViewMatch[];
}

export interface LiveViewData {
  id: string;
  name: string;
  status: string;
  startTime?: string;
  endTime?: string;
  doubleStageEnabled?: boolean;
  poolStages?: LiveViewPoolStage[];
  brackets?: LiveViewBracket[];
  targets?: LiveViewTarget[];
}

export type MatchQueueItem = {
  tournamentId: string;
  tournamentName: string;
  stageId: string;
  stageName: string;
  stageNumber: number;
  poolId: string;
  poolName: string;
  poolNumber: number;
  matchId: string;
  matchNumber: number;
  roundNumber: number;
  status: string;
  targetCode?: string;
  targetNumber?: number;
  players: string[];
  match: LiveViewMatch;
};

export type PoolQueue = {
  poolId: string;
  stageNumber: number;
  poolNumber: number;
  progress: number;
  matches: MatchQueueItem[];
};

export type AuthErrorDetails = {
  code?: string;
  description?: string;
  state?: string;
};

export type LiveViewMode = string | undefined;
