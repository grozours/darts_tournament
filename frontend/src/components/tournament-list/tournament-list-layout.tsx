import PoolStageAssignmentsModal, {
  type PoolStageAssignmentsModalProperties,
} from './pool-stage-assignments-modal';
import TournamentListEditSection, {
  type TournamentListEditSectionProperties,
} from './tournament-list-edit-section';
import TournamentListHeader, {
  type TournamentListHeaderProperties,
} from './tournament-list-header';
import TournamentListNotices, {
  type TournamentListNoticesProperties,
} from './tournament-list-notices';
import TournamentListOverviewSection, {
  type TournamentListOverviewSectionProperties,
} from './tournament-list-overview-section';
import TournamentListStateGate, {
  type TournamentListStateGateProperties,
} from './tournament-list-state-gate';

export type TournamentListLayoutProperties = {
  stateGateProperties: Omit<TournamentListStateGateProperties, 'children'>;
  headerProperties: TournamentListHeaderProperties;
  noticesProperties: TournamentListNoticesProperties;
  overviewSectionProperties: TournamentListOverviewSectionProperties;
  editSectionProperties: TournamentListEditSectionProperties;
  poolStageAssignmentsModalProperties: PoolStageAssignmentsModalProperties;
};

const TournamentListLayout = ({
  stateGateProperties,
  headerProperties,
  noticesProperties,
  overviewSectionProperties,
  editSectionProperties,
  poolStageAssignmentsModalProperties,
}: TournamentListLayoutProperties) => (
  <TournamentListStateGate {...stateGateProperties}>
    <div className="space-y-8">
      <TournamentListHeader {...headerProperties} />

      <TournamentListNotices {...noticesProperties} />

      <TournamentListOverviewSection {...overviewSectionProperties} />

      <TournamentListEditSection {...editSectionProperties} />

      <PoolStageAssignmentsModal {...poolStageAssignmentsModalProperties} />
    </div>
  </TournamentListStateGate>
);

export default TournamentListLayout;
