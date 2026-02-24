import { StageStatus } from '@shared/types';
import type {
  BracketConfig,
  PoolStageConfig,
  PoolStageDestinationType,
  PoolStageRankingDestination,
} from '../../services/tournament-service';
import type { Translator } from './types';

type PoolStageDraft = {
  stageNumber: number;
  name: string;
  poolCount: number;
  playersPerPool: number;
  advanceCount: number;
  losersAdvanceToBracket: boolean;
  rankingDestinations?: PoolStageRankingDestination[];
};

type PoolStagesListProperties = {
  t: Translator;
  poolStages: PoolStageConfig[];
  brackets: BracketConfig[];
  isTournamentLive: boolean;
  showStageStatusControl?: boolean;
  showEditPlayersButton?: boolean;
  onPoolStageNumberChange: (id: string, value: number) => void;
  onPoolStageNameChange: (id: string, value: string) => void;
  onPoolStagePoolCountChange: (id: string, value: number) => void;
  onPoolStagePlayersPerPoolChange: (id: string, value: number) => void;
  onPoolStageAdvanceCountChange: (id: string, value: number) => void;
  onPoolStageLosersAdvanceChange: (id: string, value: boolean) => void;
  onPoolStageRankingDestinationChange: (
    stageId: string,
    position: number,
    destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
  ) => void;
  onPoolStageStatusChange: (stage: PoolStageConfig, status: string) => void;
  onOpenPoolStageAssignments: (stage: PoolStageConfig) => void;
  onSavePoolStage: (stage: PoolStageConfig) => void;
  onRemovePoolStage: (id: string) => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
};

type PoolStageItemProperties = {
  t: Translator;
  stage: PoolStageConfig;
  brackets: BracketConfig[];
  poolStages: PoolStageConfig[];
  isTournamentLive: boolean;
  showStageStatusControl?: boolean;
  showEditPlayersButton?: boolean;
  onPoolStageNumberChange: (id: string, value: number) => void;
  onPoolStageNameChange: (id: string, value: string) => void;
  onPoolStagePoolCountChange: (id: string, value: number) => void;
  onPoolStagePlayersPerPoolChange: (id: string, value: number) => void;
  onPoolStageAdvanceCountChange: (id: string, value: number) => void;
  onPoolStageLosersAdvanceChange: (id: string, value: boolean) => void;
  onPoolStageRankingDestinationChange: (
    stageId: string,
    position: number,
    destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
  ) => void;
  onPoolStageStatusChange: (stage: PoolStageConfig, status: string) => void;
  onOpenPoolStageAssignments: (stage: PoolStageConfig) => void;
  onSavePoolStage: (stage: PoolStageConfig) => void;
  onRemovePoolStage: (id: string) => void;
  getStatusLabel: (kind: 'stage' | 'bracket', status: string) => string;
  normalizeStageStatus: (status?: string) => string;
};

type NewPoolStageFormProperties = {
  t: Translator;
  brackets: BracketConfig[];
  poolStages: PoolStageConfig[];
  isAddingPoolStage: boolean;
  newPoolStage: PoolStageDraft;
  onStartAddPoolStage: () => void;
  onCancelAddPoolStage: () => void;
  onNewPoolStageStageNumberChange: (value: number) => void;
  onNewPoolStageNameChange: (value: string) => void;
  onNewPoolStagePoolCountChange: (value: number) => void;
  onNewPoolStagePlayersPerPoolChange: (value: number) => void;
  onNewPoolStageAdvanceCountChange: (value: number) => void;
  onNewPoolStageLosersAdvanceChange: (value: boolean) => void;
  onNewPoolStageRankingDestinationChange: (
    position: number,
    destination: { destinationType: PoolStageDestinationType; bracketId?: string; poolStageId?: string }
  ) => void;
  onAddPoolStage: () => Promise<boolean>;
};

const resolveBracketByName = (brackets: BracketConfig[], pattern: RegExp) =>
  brackets.find((bracket) => pattern.test(bracket.name));

const buildDefaultRankingDestinations = (
  stage: { playersPerPool: number; advanceCount: number; losersAdvanceToBracket: boolean },
  brackets: BracketConfig[]
): PoolStageRankingDestination[] => {
  const winnerBracket = resolveBracketByName(brackets, /winner|gagnant/i) ?? brackets[0];
  const loserBracket = resolveBracketByName(brackets, /loser|perdant/i);

  const destinations: PoolStageRankingDestination[] = [];
  for (let position = 1; position <= stage.playersPerPool; position += 1) {
    if (position <= stage.advanceCount && winnerBracket) {
      destinations.push({
        position,
        destinationType: 'BRACKET',
        bracketId: winnerBracket.id,
      });
    } else if (stage.losersAdvanceToBracket && loserBracket) {
      destinations.push({
        position,
        destinationType: 'BRACKET',
        bracketId: loserBracket.id,
      });
    } else {
      destinations.push({
        position,
        destinationType: 'ELIMINATED',
      });
    }
  }

  return destinations;
};

const resolveRankingDestinations = (
  stage: {
    rankingDestinations?: PoolStageRankingDestination[];
    playersPerPool: number;
    advanceCount: number;
    losersAdvanceToBracket: boolean;
  },
  brackets: BracketConfig[]
): PoolStageRankingDestination[] => (
  stage.rankingDestinations && stage.rankingDestinations.length > 0
    ? stage.rankingDestinations
    : buildDefaultRankingDestinations(stage, brackets)
);

const getDestinationSelectValue = (destination: PoolStageRankingDestination): string => {
  if (destination.destinationType === 'ELIMINATED') {
    return 'ELIMINATED';
  }
  if (destination.destinationType === 'BRACKET') {
    return `BRACKET:${destination.bracketId ?? ''}`;
  }
  return `POOL_STAGE:${destination.poolStageId ?? ''}`;
};

export const PoolStageItem = ({
  t,
  stage,
  brackets,
  poolStages,
  isTournamentLive,
  showStageStatusControl = true,
  showEditPlayersButton = true,
  onPoolStageNumberChange,
  onPoolStageNameChange,
  onPoolStagePoolCountChange,
  onPoolStagePlayersPerPoolChange,
  onPoolStageAdvanceCountChange,
  onPoolStageLosersAdvanceChange,
  onPoolStageRankingDestinationChange,
  onPoolStageStatusChange,
  onOpenPoolStageAssignments,
  onSavePoolStage,
  onRemovePoolStage,
  getStatusLabel,
  normalizeStageStatus,
}: PoolStageItemProperties) => {
  const destinations = resolveRankingDestinations(stage, brackets);
  const availablePoolStages = poolStages.filter((item) => item.id !== stage.id);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
      <div className="grid gap-3 md:grid-cols-6">
        <label className="text-xs text-slate-400">
          {t('edit.stageNumber')}
          <input
            type="number"
            value={stage.stageNumber}
            onChange={(event_) => onPoolStageNumberChange(stage.id, Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400 md:col-span-2">
          {t('edit.name')}
          <input
            type="text"
            value={stage.name}
            onChange={(event_) => onPoolStageNameChange(stage.id, event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.pools')}
          <input
            type="number"
            value={stage.poolCount}
            onChange={(event_) => onPoolStagePoolCountChange(stage.id, Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.perPool')}
          <input
            type="number"
            value={stage.playersPerPool}
            onChange={(event_) => onPoolStagePlayersPerPoolChange(stage.id, Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.advance')}
          <input
            type="number"
            value={stage.advanceCount}
            onChange={(event_) => onPoolStageAdvanceCountChange(stage.id, Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.losers')}
          <select
            value={stage.losersAdvanceToBracket ? 'bracket' : 'out'}
            onChange={(event_) => onPoolStageLosersAdvanceChange(stage.id, event_.target.value === 'bracket')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            <option value="out">{t('edit.losersOut')}</option>
            <option value="bracket">{t('edit.losersToBracket')}</option>
          </select>
        </label>
      </div>
      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
          {t('edit.poolRankingDestinations')}
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {destinations.map((destination) => {
            const selectedValue = getDestinationSelectValue(destination);
            return (
              <div key={destination.position} className="flex items-center gap-2">
                <span className="w-20 text-xs text-slate-400">#{destination.position}</span>
                <select
                  value={selectedValue}
                  onChange={(event_) => {
                    const value = event_.target.value;
                    if (value === 'ELIMINATED') {
                      onPoolStageRankingDestinationChange(stage.id, destination.position, {
                        destinationType: 'ELIMINATED',
                      });
                      return;
                    }
                    const [type, destinationId] = value.split(':');
                    if (!destinationId) {
                      return;
                    }
                    if (type === 'BRACKET') {
                      onPoolStageRankingDestinationChange(stage.id, destination.position, {
                        destinationType: 'BRACKET',
                        bracketId: destinationId,
                      });
                      return;
                    }
                    if (type === 'POOL_STAGE') {
                      onPoolStageRankingDestinationChange(stage.id, destination.position, {
                        destinationType: 'POOL_STAGE',
                        poolStageId: destinationId,
                      });
                    }
                  }}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                >
                  <option value="ELIMINATED">{t('edit.destinationEliminated')}</option>
                  {brackets.map((bracket) => (
                    <option key={bracket.id} value={`BRACKET:${bracket.id}`}>
                      {bracket.name}
                    </option>
                  ))}
                  {availablePoolStages.map((poolStage) => (
                    <option key={poolStage.id} value={`POOL_STAGE:${poolStage.id}`}>
                      {t('edit.destinationPoolStage')} {poolStage.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {showStageStatusControl && (
          <select
            value={stage.status}
            onChange={(event_) => onPoolStageStatusChange(stage, event_.target.value)}
            className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
          >
            {Object.values(StageStatus).map((status) => (
              <option
                key={status}
                value={status}
                disabled={!isTournamentLive && status === StageStatus.IN_PROGRESS}
              >
                {getStatusLabel('stage', status)}
              </option>
            ))}
          </select>
        )}
        {showEditPlayersButton && (
          <button
            type="button"
            onClick={() => onOpenPoolStageAssignments(stage)}
            disabled={normalizeStageStatus(stage.status) !== StageStatus.EDITION}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('edit.editPlayers')}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSavePoolStage({
            ...stage,
            rankingDestinations: stage.rankingDestinations ?? destinations,
          })}
          className="rounded-full border border-cyan-500/60 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-300"
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => onRemovePoolStage(stage.id)}
          className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
};

export const PoolStagesList = ({
  t,
  poolStages,
  brackets,
  isTournamentLive,
  showStageStatusControl = true,
  showEditPlayersButton = true,
  onPoolStageNumberChange,
  onPoolStageNameChange,
  onPoolStagePoolCountChange,
  onPoolStagePlayersPerPoolChange,
  onPoolStageAdvanceCountChange,
  onPoolStageLosersAdvanceChange,
  onPoolStageRankingDestinationChange,
  onPoolStageStatusChange,
  onOpenPoolStageAssignments,
  onSavePoolStage,
  onRemovePoolStage,
  getStatusLabel,
  normalizeStageStatus,
}: PoolStagesListProperties) => (
  <div className="mt-4 space-y-3">
    {poolStages.length === 0 ? (
      <p className="text-sm text-slate-400">{t('edit.noPoolStages')}</p>
    ) : (
      poolStages.map((stage) => (
        <PoolStageItem
          key={stage.id}
          t={t}
          stage={stage}
          brackets={brackets}
          poolStages={poolStages}
          isTournamentLive={isTournamentLive}
          showStageStatusControl={showStageStatusControl}
          showEditPlayersButton={showEditPlayersButton}
          onPoolStageNumberChange={onPoolStageNumberChange}
          onPoolStageNameChange={onPoolStageNameChange}
          onPoolStagePoolCountChange={onPoolStagePoolCountChange}
          onPoolStagePlayersPerPoolChange={onPoolStagePlayersPerPoolChange}
          onPoolStageAdvanceCountChange={onPoolStageAdvanceCountChange}
          onPoolStageLosersAdvanceChange={onPoolStageLosersAdvanceChange}
          onPoolStageRankingDestinationChange={onPoolStageRankingDestinationChange}
          onPoolStageStatusChange={onPoolStageStatusChange}
          onOpenPoolStageAssignments={onOpenPoolStageAssignments}
          onSavePoolStage={onSavePoolStage}
          onRemovePoolStage={onRemovePoolStage}
          getStatusLabel={getStatusLabel}
          normalizeStageStatus={normalizeStageStatus}
        />
      ))
    )}
  </div>
);

export const NewPoolStageForm = ({
  t,
  brackets,
  poolStages,
  isAddingPoolStage,
  newPoolStage,
  onStartAddPoolStage,
  onCancelAddPoolStage,
  onNewPoolStageStageNumberChange,
  onNewPoolStageNameChange,
  onNewPoolStagePoolCountChange,
  onNewPoolStagePlayersPerPoolChange,
  onNewPoolStageAdvanceCountChange,
  onNewPoolStageLosersAdvanceChange,
  onNewPoolStageRankingDestinationChange,
  onAddPoolStage,
}: NewPoolStageFormProperties) => {
  if (!isAddingPoolStage) {
    return (
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onStartAddPoolStage}
          className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
        >
          {t('edit.addStage')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <label className="text-xs text-slate-400">
          {t('edit.stageNumber')}
          <input
            type="number"
            value={newPoolStage.stageNumber}
            onChange={(event_) => onNewPoolStageStageNumberChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400 md:col-span-2">
          {t('edit.name')}
          <input
            type="text"
            value={newPoolStage.name}
            onChange={(event_) => onNewPoolStageNameChange(event_.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.pools')}
          <input
            type="number"
            value={newPoolStage.poolCount}
            onChange={(event_) => onNewPoolStagePoolCountChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.perPool')}
          <input
            type="number"
            value={newPoolStage.playersPerPool}
            onChange={(event_) => onNewPoolStagePlayersPerPoolChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.advance')}
          <input
            type="number"
            value={newPoolStage.advanceCount}
            onChange={(event_) => onNewPoolStageAdvanceCountChange(Number(event_.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          {t('edit.losers')}
          <select
            value={newPoolStage.losersAdvanceToBracket ? 'bracket' : 'out'}
            onChange={(event_) => onNewPoolStageLosersAdvanceChange(event_.target.value === 'bracket')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
          >
            <option value="out">{t('edit.losersOut')}</option>
            <option value="bracket">{t('edit.losersToBracket')}</option>
          </select>
        </label>
      </div>
      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
          {t('edit.poolRankingDestinations')}
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {resolveRankingDestinations(newPoolStage, brackets).map((destination) => {
            const selectedValue = getDestinationSelectValue(destination);
            return (
              <div key={destination.position} className="flex items-center gap-2">
                <span className="w-20 text-xs text-slate-400">#{destination.position}</span>
                <select
                  value={selectedValue}
                  onChange={(event_) => {
                    const value = event_.target.value;
                    if (value === 'ELIMINATED') {
                      onNewPoolStageRankingDestinationChange(destination.position, {
                        destinationType: 'ELIMINATED',
                      });
                      return;
                    }
                    const [type, destinationId] = value.split(':');
                    if (!destinationId) {
                      return;
                    }
                    if (type === 'BRACKET') {
                      onNewPoolStageRankingDestinationChange(destination.position, {
                        destinationType: 'BRACKET',
                        bracketId: destinationId,
                      });
                      return;
                    }
                    if (type === 'POOL_STAGE') {
                      onNewPoolStageRankingDestinationChange(destination.position, {
                        destinationType: 'POOL_STAGE',
                        poolStageId: destinationId,
                      });
                    }
                  }}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                >
                  <option value="ELIMINATED">{t('edit.destinationEliminated')}</option>
                  {brackets.map((bracket) => (
                    <option key={bracket.id} value={`BRACKET:${bracket.id}`}>
                      {bracket.name}
                    </option>
                  ))}
                  {poolStages.map((poolStage) => (
                    <option key={poolStage.id} value={`POOL_STAGE:${poolStage.id}`}>
                      {t('edit.destinationPoolStage')} {poolStage.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancelAddPoolStage}
          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onAddPoolStage}
          disabled={!newPoolStage.name.trim()}
          className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
        >
          {t('edit.addStage')}
        </button>
      </div>
    </>
  );
};
