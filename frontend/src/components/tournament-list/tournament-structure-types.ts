import type { Tournament, Translator } from './types';

type PoolStageDraft = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
};

type BracketDraft = {
  name: string;
  bracketType: string;
  totalRounds: number;
};

type TournamentStructureBaseProperties = {
  t: Translator;
  editingTournament: Tournament | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
};

export type { PoolStageDraft, BracketDraft, TournamentStructureBaseProperties };
