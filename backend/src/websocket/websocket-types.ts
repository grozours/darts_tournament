type PlayerSummary = {
  id?: string;
  firstName?: string;
  lastName?: string;
  surname?: string;
  teamName?: string;
  [key: string]: unknown;
};

type MatchStartedPayload = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  startedAt?: string;
  matchFormatKey?: string;
  matchFormatTooltip?: string;
  target?: {
    id: string;
    targetNumber: number;
    targetCode?: string;
    name?: string | null;
  };
  match: {
    source: 'pool' | 'bracket';
    matchNumber: number;
    roundNumber?: number | null;
    stageNumber?: number;
    poolNumber?: number;
    poolId?: string;
    bracketName?: string | null;
  };
  players: PlayerSummary[];
};

type MatchFinishedPayload = MatchStartedPayload & {
  event: 'completed' | 'cancelled';
  finishedAt?: string;
  winner?: PlayerSummary | null;
  players: Array<PlayerSummary & {
    scoreTotal?: number | null;
    legsWon?: number | null;
    setsWon?: number | null;
    isWinner?: boolean | null;
  }>;
};

type MatchFormatChangedPayload = MatchStartedPayload & {
  event: 'format_changed';
  matchFormatKey: string;
  matchFormatTooltip: string;
};

type ScorePayload = Record<string, unknown>;
type PoolAssignmentPayload = Record<string, unknown>;
type SchedulePayload = Record<string, unknown>;

export type {
  MatchFinishedPayload,
  MatchFormatChangedPayload,
  MatchStartedPayload,
  PlayerSummary,
  PoolAssignmentPayload,
  SchedulePayload,
  ScorePayload,
};

export interface WebSocketEvents {
  'tournament:updated': (data: { tournamentId: string; status: string }) => void;
  'tournament:player-registered': (data: { tournamentId: string; player: PlayerSummary }) => void;
  'match:started': (data: MatchStartedPayload) => void;
  'match:score-updated': (data: { matchId: string; tournamentId: string; score: ScorePayload }) => void;
  'match:completed': (data: { matchId: string; tournamentId: string; winner: PlayerSummary }) => void;
  'match:finished': (data: MatchFinishedPayload) => void;
  'match:format-changed': (data: MatchFormatChangedPayload) => void;
  'target:available': (data: { targetId: string; tournamentId: string }) => void;
  'target:in-use': (data: { targetId: string; matchId: string; tournamentId: string }) => void;
  'pool:assigned': (data: { tournamentId: string; poolAssignments: PoolAssignmentPayload[] }) => void;
  'schedule:generated': (data: { tournamentId: string; schedule: SchedulePayload }) => void;
  'schedule:updated': (data: { tournamentId: string; changes: SchedulePayload }) => void;
  'error': (data: { message: string; code?: string }) => void;
  'connect': () => void;
  'disconnect': (reason: string) => void;
}