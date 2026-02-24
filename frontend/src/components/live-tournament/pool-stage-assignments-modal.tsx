import type { PoolStagePool, TournamentPlayer } from '../../services/tournament-service';
import type { Translator } from './types';

type EditablePoolStage = {
  id: string;
  name: string;
  playersPerPool: number;
};

type PoolStageAssignmentsModalProperties = {
  t: Translator;
  editingPoolStage: EditablePoolStage | undefined;
  poolStagePools: PoolStagePool[];
  poolStagePlayers: TournamentPlayer[];
  poolStageAssignments: Record<string, string[]>;
  poolStageEditError?: string | undefined;
  isSavingAssignments: boolean;
  onClose: () => void;
  onSave: () => void;
  onUpdateAssignment: (poolId: string, slotIndex: number, playerId: string) => void;
};

const getAvailablePlayers = (
  players: TournamentPlayer[],
  assignments: Record<string, string[]>,
  currentValue: string
) => {
  const assignedPlayerIds = new Set(
    Object.values(assignments)
      .flat()
      .filter(Boolean)
  );

  if (currentValue) {
    assignedPlayerIds.delete(currentValue);
  }

  return players.filter((player) => !assignedPlayerIds.has(player.playerId));
};

const PoolStageAssignmentsModal = ({
  editingPoolStage,
  poolStagePools,
  poolStagePlayers,
  poolStageAssignments,
  poolStageEditError,
  isSavingAssignments,
  t,
  onClose,
  onSave,
  onUpdateAssignment,
}: PoolStageAssignmentsModalProperties) => {
  if (!editingPoolStage) {
    return;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6">
      <div className="flex w-full max-w-3xl max-h-[85vh] flex-col rounded-3xl border border-slate-800/70 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('edit.poolPlayersTitle')}</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-1">
              {editingPoolStage.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white"
          >
            {t('edit.close')}
          </button>
        </div>

        {poolStageEditError && (
          <p className="mt-4 text-sm text-rose-300">{poolStageEditError}</p>
        )}

        <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
          {poolStagePools.length === 0 ? (
            <p className="text-sm text-slate-400">{t('edit.noPoolsAvailable')}</p>
          ) : (
            poolStagePools.map((pool) => (
              <div key={pool.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{pool.name}</p>
                    <p className="text-xs text-slate-500">{t('edit.poolNumber')} {pool.poolNumber}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: editingPoolStage.playersPerPool }, (_, slot) => slot + 1).map((slotNumber) => {
                    const index = slotNumber - 1;
                    const value = poolStageAssignments[pool.id]?.[index] || '';
                    const availablePlayers = getAvailablePlayers(
                      poolStagePlayers,
                      poolStageAssignments,
                      value
                    );

                    return (
                      <label key={`${pool.id}-slot-${slotNumber}`} className="text-xs text-slate-400">
                        {t('edit.slot')} {slotNumber}
                        <select
                          value={value}
                          onChange={(event_) => onUpdateAssignment(pool.id, index, event_.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                        >
                          <option value="">{t('edit.unassigned')}</option>
                          {availablePlayers.map((player) => {
                            const label = player.name
                              || `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim()
                              || player.playerId;
                            return (
                              <option key={player.playerId} value={player.playerId}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={isSavingAssignments}
            className="rounded-full border border-emerald-500/60 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300 disabled:opacity-60"
          >
            {isSavingAssignments ? t('edit.saving') : t('edit.saveAssignments')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PoolStageAssignmentsModal;