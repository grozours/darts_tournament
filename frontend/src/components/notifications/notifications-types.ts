export type MatchBasePayload = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  startedAt?: string;
  target?: {
    id: string;
    targetNumber: number;
    targetCode?: string;
    name?: string;
  };
  match: {
    source: 'pool' | 'bracket';
    matchNumber: number;
    roundNumber?: number;
    stageNumber?: number;
    poolNumber?: number;
    poolId?: string;
    bracketName?: string;
  };
  players: Array<{
    id?: string;
    firstName?: string;
    lastName?: string;
    surname?: string;
    teamName?: string;
    scoreTotal?: number | null;
    legsWon?: number | null;
    setsWon?: number | null;
    isWinner?: boolean | null;
  }>;
};

export type MatchStartedPayload = MatchBasePayload & {
  event: 'started';
};

export type MatchFinishedPayload = MatchBasePayload & {
  event: 'completed' | 'cancelled';
  finishedAt?: string;
  winner?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    surname?: string;
    teamName?: string;
  };
};

export type MatchFormatChangedPayload = MatchBasePayload & {
  event: 'format_changed';
  matchFormatKey: string;
  matchFormatTooltip: string;
};

export type MatchNotificationPayload = MatchStartedPayload | MatchFinishedPayload | MatchFormatChangedPayload;

export type NotificationItem = {
  id: string;
  receivedAt: string;
  payload: MatchNotificationPayload;
  acknowledgedAt?: string;
};

export const NOTIFICATIONS_STORAGE_KEY = 'notifications:match-started';
export const STORAGE_LIMIT = 50;
