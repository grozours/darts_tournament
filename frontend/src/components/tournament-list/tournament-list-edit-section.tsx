import TournamentEditPanel, { type TournamentEditPanelProperties } from './tournament-edit-panel';

export type TournamentListEditSectionProperties = Omit<TournamentEditPanelProperties, 'editingTournament' | 'editForm'> & {
  editingTournament: TournamentEditPanelProperties['editingTournament'] | undefined;
  editForm: TournamentEditPanelProperties['editForm'] | undefined;
};

const TournamentListEditSection = ({ editingTournament, editForm, ...panelProperties }: TournamentListEditSectionProperties) => {
  if (!editingTournament || !editForm) {
    return null;
  }

  return (
    <TournamentEditPanel
      {...panelProperties}
      editingTournament={editingTournament}
      editForm={editForm}
    />
  );
};

export default TournamentListEditSection;
