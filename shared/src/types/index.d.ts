export declare enum TournamentFormat {
    SINGLE = "SINGLE",
    DOUBLE = "DOUBLE",
    TEAM_4_PLAYER = "TEAM_4_PLAYER"
}
export declare enum DurationType {
    HALF_DAY_MORNING = "HALF_DAY_MORNING",
    HALF_DAY_AFTERNOON = "HALF_DAY_AFTERNOON",
    HALF_DAY_NIGHT = "HALF_DAY_NIGHT",
    FULL_DAY = "FULL_DAY",
    TWO_DAY = "TWO_DAY"
}
export declare enum TournamentStatus {
    DRAFT = "DRAFT",
    OPEN = "OPEN",
    SIGNATURE = "SIGNATURE",
    LIVE = "LIVE",
    FINISHED = "FINISHED"
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
export declare enum SkillLevel {
    BEGINNER = "BEGINNER",
    INTERMEDIATE = "INTERMEDIATE",
    ADVANCED = "ADVANCED",
    EXPERT = "EXPERT"
}
export interface Player {
    id: string;
    tournamentId: string;
    personId?: string;
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    email?: string;
    phone?: string;
    skillLevel?: SkillLevel;
    registeredAt: Date;
    isActive: boolean;
    checkedIn: boolean;
}
export declare enum StageStatus {
    NOT_STARTED = "NOT_STARTED",
    EDITION = "EDITION",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export declare enum PoolStatus {
    NOT_STARTED = "NOT_STARTED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export declare enum AssignmentType {
    SEEDED = "SEEDED",
    RANDOM = "RANDOM",
    BYE = "BYE"
}
export interface PoolStage {
    id: string;
    tournamentId: string;
    stageNumber: number;
    name: string;
    poolCount: number;
    playersPerPool: number;
    advanceCount: number;
    status: StageStatus;
    createdAt: Date;
    completedAt?: Date;
}
export interface Pool {
    id: string;
    poolStageId: string;
    poolNumber: number;
    name: string;
    status: PoolStatus;
    createdAt: Date;
    completedAt?: Date;
}
export interface PoolAssignment {
    id: string;
    poolId: string;
    playerId: string;
    assignmentType: AssignmentType;
    seedNumber?: number;
    assignedAt: Date;
}
export declare enum BracketType {
    SINGLE_ELIMINATION = "SINGLE_ELIMINATION",
    DOUBLE_ELIMINATION = "DOUBLE_ELIMINATION"
}
export declare enum BracketStatus {
    NOT_STARTED = "NOT_STARTED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export interface Bracket {
    id: string;
    tournamentId: string;
    bracketType: BracketType;
    name: string;
    totalRounds: number;
    status: BracketStatus;
    createdAt: Date;
    completedAt?: Date;
}
export interface BracketEntry {
    id: string;
    bracketId: string;
    playerId: string;
    seedNumber: number;
    currentRound: number;
    isEliminated: boolean;
    finalPosition?: number;
    enteredAt: Date;
}
export declare enum TargetStatus {
    AVAILABLE = "AVAILABLE",
    IN_USE = "IN_USE",
    MAINTENANCE = "MAINTENANCE"
}
export interface Target {
    id: string;
    tournamentId: string;
    targetNumber: number;
    targetCode: string;
    name?: string;
    status: TargetStatus;
    currentMatchId?: string;
    lastUsedAt?: Date;
}
export declare enum MatchStatus {
    SCHEDULED = "SCHEDULED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}
export interface Match {
    id: string;
    tournamentId: string;
    poolId?: string;
    bracketId?: string;
    targetId?: string;
    roundNumber: number;
    matchNumber: number;
    legs: number;
    sets: number;
    status: MatchStatus;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    winnerId?: string;
}
export interface PlayerMatch {
    id: string;
    matchId: string;
    playerId: string;
    playerPosition: number;
    scoreTotal: number;
    legsWon: number;
    setsWon: number;
    isWinner: boolean;
}
export interface Score {
    id: string;
    matchId: string;
    playerId: string;
    setNumber: number;
    legNumber: number;
    dartThrow: number;
    score: number;
    remaining: number;
    isFinish: boolean;
    thrownAt: Date;
}
export interface Schedule {
    id: string;
    tournamentId: string;
    generatedAt: Date;
    isPublished: boolean;
    publishedAt?: Date;
}
export interface ScheduledMatch {
    id: string;
    scheduleId: string;
    matchId: string;
    targetId: string;
    scheduledTime: Date;
    estimatedDuration: number;
    sequenceOrder: number;
}
export interface CreateTournamentRequest {
    name: string;
    format: TournamentFormat;
    durationType: DurationType;
    startTime: string;
    endTime: string;
    totalParticipants: number;
    targetCount: number;
}
export interface CreatePlayerRequest {
    firstName: string;
    lastName: string;
    surname?: string;
    teamName?: string;
    email?: string;
    phone?: string;
    skillLevel?: SkillLevel;
}
export interface UpdateMatchScoreRequest {
    playerId: string;
    setNumber: number;
    legNumber: number;
    dartThrow: number;
    score: number;
    remaining: number;
    isFinish: boolean;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    timestamp: string;
}
export interface ErrorResponse {
    error: {
        message: string;
        statusCode: number;
        code?: string;
        details?: any;
        stack?: string;
    };
    timestamp: string;
    path: string;
}
export interface WebSocketEvent {
    type: string;
    data: any;
    timestamp: number;
}
export interface TournamentUpdateEvent {
    tournamentId: string;
    status: TournamentStatus;
}
export interface PlayerRegisteredEvent {
    tournamentId: string;
    player: Player;
}
export interface MatchScoreUpdateEvent {
    matchId: string;
    tournamentId: string;
    score: Score;
}
export interface TargetAvailableEvent {
    targetId: string;
    tournamentId: string;
}
export interface PoolAssignedEvent {
    tournamentId: string;
    poolAssignments: PoolAssignment[];
}
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export interface TournamentWithDetails extends Tournament {
    players: Player[];
    targets: Target[];
    poolStages: PoolStage[];
    brackets: Bracket[];
    matches: Match[];
    schedule?: Schedule;
}
export interface PlayerWithMatches extends Player {
    playerMatches: PlayerMatch[];
    scores: Score[];
    poolAssignments: PoolAssignment[];
    bracketEntries: BracketEntry[];
}
export interface MatchWithDetails extends Match {
    playerMatches: PlayerMatch[];
    scores: Score[];
    target?: Target;
    winner?: Player;
}
export interface PerformanceMetrics {
    responseTime: number;
    timestamp: Date;
    endpoint: string;
    method: string;
    statusCode: number;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface FeatureFlags {
    enableRealTimeUpdates: boolean;
    enableAdvancedPooling: boolean;
    enableTournamentAnalytics: boolean;
}
export interface AppConfig {
    env: string;
    port: number;
    database: {
        url: string;
        maxConnections: number;
    };
    redis: {
        host: string;
        port: number;
    };
    performance: {
        maxResponseTime: number;
        enableMetrics: boolean;
    };
}
//# sourceMappingURL=index.d.ts.map