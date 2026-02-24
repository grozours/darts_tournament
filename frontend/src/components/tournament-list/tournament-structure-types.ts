import type { Tournament, Translator } from './types';
import type { PoolStageRankingDestination } from '../../services/tournament-service';

type PoolStageDraft = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
  rankingDestinations?: PoolStageRankingDestination[];
};

type BracketDraft = {
  name: string;
  bracketType: string;
  totalRounds: number;
};

type TournamentStructureBaseProperties = {
  t: Translator;
  editingTournament: Tournament | undefined;
  authEnabled: boolean;
  getSafeAccessToken: () => Promise<string | undefined>;
};

export type { PoolStageDraft, BracketDraft, TournamentStructureBaseProperties };
