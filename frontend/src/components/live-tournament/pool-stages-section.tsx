import type {
  LiveViewMatch,
  LiveViewPoolStage,
  LiveViewTarget,
  Translator,
} from './types';
import PoolStageCard from './pool-stage-card';

type PoolStagesSectionProperties = {
  t: Translator;
  tournamentId: string;
  stages: LiveViewPoolStage[];
  isPoolStagesReadonly: boolean;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  updatingMatchId: string | undefined;
  editingMatchId?: string | undefined;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onEditStage: (stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, value: string) => void;
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
};

const PoolStagesSection = ({
  t,
  tournamentId,
  stages,
  ...stageProperties
}: PoolStagesSectionProperties) => {
  if (stages.length === 0) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">{t('live.poolStages')}</h3>
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
          {t('live.noPoolStages')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">{t('live.poolStages')}</h3>
      <div className="space-y-6">
        {stages.map((stage) => (
          <PoolStageCard
            key={stage.id}
            t={t}
            tournamentId={tournamentId}
            stage={stage}
            {...stageProperties}
          />
        ))}
      </div>
    </div>
  );
};

export default PoolStagesSection;
