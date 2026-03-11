import TournamentListLayout from './tournament-list/tournament-list-layout';
import useTournamentListLayoutProperties from './tournament-list/use-tournament-list-layout-properties';

function TournamentList() { // NOSONAR
  const layoutProperties = useTournamentListLayoutProperties();

  return (
    <TournamentListLayout {...layoutProperties} />
  );
}

export default TournamentList;