import SharedPoolStageAssignmentsModal, {
  type PoolStageAssignmentsModalSharedProperties,
} from '../shared/pool-stage-assignments-modal';

type PoolStageAssignmentsModalProperties = PoolStageAssignmentsModalSharedProperties;

const PoolStageAssignmentsModal = (properties: PoolStageAssignmentsModalProperties) => (
  <SharedPoolStageAssignmentsModal {...properties} />
);

export default PoolStageAssignmentsModal;