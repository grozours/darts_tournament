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
  matchFormatKey?: string;
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
  assignments?: Array<{
    player?: {
      id?: string;
    };
  }>;
  matches?: LiveViewMatch[];
};

export type LiveViewPoolStage = {
  id: string;
  stageNumber: number;
  name: string;
  inParallelWith?: string[];
  matchFormatKey?: string;
  status?: string;
  rankingDestinations?: Array<{
    destinationType?: string;
    bracketId?: string;
  }>;
  pools?: LiveViewPool[];
};

export type LiveViewBracket = {
  id: string;
  name: string;
  roundMatchFormats?: Record<string, string>;
  matches?: LiveViewMatch[];
  targetIds?: string[];
  bracketTargets?: Array<{ targetId: string }>;
};

export type LiveViewData = {
  id: string;
  name: string;
  format?: string;
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
  bracketId?: string;
  bracketName?: string;
  bracketTargetIds?: string[];
  matchNumber: number;
  roundNumber: number;
  status: string;
  targetCode?: string;
  targetNumber?: number;
  players: string[];
  blocked: boolean;
  isBracketFinal?: boolean;
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
