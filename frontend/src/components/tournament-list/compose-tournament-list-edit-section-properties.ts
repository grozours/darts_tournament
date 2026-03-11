import { normalizeTournamentStatus } from './tournament-status-helpers';
import type { TournamentListEditSectionProperties } from './tournament-list-edit-section';

type ComposeTournamentListEditSectionPropertiesInput = Omit<
  TournamentListEditSectionProperties,
  'normalizedStatus' | 'onLoadPoolStages' | 'onLoadBrackets' | 'onSubmitPlayer' | 'onFetchPlayers'
> & {
  loadPoolStages: (tournamentId: string) => Promise<void>;
  loadBrackets: (tournamentId: string) => Promise<void>;
  loadTargets: (tournamentId: string) => Promise<void>;
  fetchPlayers: (tournamentId: string) => Promise<void>;
  savePlayerEdit: () => Promise<void>;
  registerPlayer: () => Promise<void>;
};

const composeTournamentListEditSectionProperties = ({
  editingTournament,
  editingPlayerId,
  loadPoolStages,
  loadBrackets,
  loadTargets,
  fetchPlayers,
  savePlayerEdit,
  registerPlayer,
  ...properties
}: ComposeTournamentListEditSectionPropertiesInput): TournamentListEditSectionProperties => ({
  ...properties,
  editingTournament,
  editingPlayerId,
  normalizedStatus: editingTournament ? normalizeTournamentStatus(editingTournament.status) : '',
  onLoadPoolStages: () => {
    if (editingTournament) {
      void loadPoolStages(editingTournament.id);
    }
  },
  onLoadBrackets: () => {
    if (editingTournament) {
      void loadBrackets(editingTournament.id);
      void loadTargets(editingTournament.id);
    }
  },
  onSubmitPlayer: () => {
    void (editingPlayerId ? savePlayerEdit() : registerPlayer());
  },
  onFetchPlayers: () => {
    if (editingTournament) {
      void fetchPlayers(editingTournament.id);
    }
  },
});

export default composeTournamentListEditSectionProperties;
