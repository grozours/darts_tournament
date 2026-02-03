// Tournament Types - matching backend types
export enum TournamentFormat {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TEAM_4_PLAYER = 'TEAM_4_PLAYER',
}

export enum DurationType {
  HALF_DAY_MORNING = 'HALF_DAY_MORNING',
  HALF_DAY_AFTERNOON = 'HALF_DAY_AFTERNOON',
  HALF_DAY_NIGHT = 'HALF_DAY_NIGHT',
  FULL_DAY = 'FULL_DAY',
  TWO_DAY = 'TWO_DAY',
}

export enum TournamentStatus {
  DRAFT = 'DRAFT',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface Tournament {
  id: string;
  name: string;
  logoUrl?: string;
  format: TournamentFormat;
  durationType: DurationType;
  startTime: Date;
  endTime: Date;
  totalParticipants: number;
  targetCount: number;
  status: TournamentStatus;
  createdAt: Date;
  completedAt?: Date;
  historicalFlag: boolean;
}

export interface CreateTournamentData {
  name: string;
  format: TournamentFormat;
  durationType: DurationType;
  startTime: string;
  endTime: string;
  totalParticipants: number;
  targetCount: number;
}

export interface TournamentFilters {
  status?: TournamentStatus;
  format?: TournamentFormat;
  durationType?: DurationType;
  search?: string;
}

export interface TournamentListResponse {
  data: Tournament[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TournamentStats {
  total: number;
  active: number;
  completed: number;
  participants: {
    total: number;
    average: number;
  };
  formats: Record<TournamentFormat, number>;
  status: Record<TournamentStatus, number>;
}