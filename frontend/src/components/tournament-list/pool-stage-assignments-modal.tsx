import SharedPoolStageAssignmentsModal from '../shared/pool-stage-assignments-modal';
import type { PoolStageAssignmentsModalState, Translator } from './types';

export type PoolStageAssignmentsModalProperties = PoolStageAssignmentsModalState & {
  t: Translator;
  onClose: () => void;
  onSave: () => void;
  onUpdateAssignment: (poolId: string, slotIndex: number, playerId: string) => void;
};

const PoolStageAssignmentsModal = (properties: PoolStageAssignmentsModalProperties) => (
  <SharedPoolStageAssignmentsModal {...properties} />
);

export default PoolStageAssignmentsModal;
