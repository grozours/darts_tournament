import type {
  LiveViewMatch,
  LiveViewPoolStage,
  LiveViewTarget,
  Translator,
} from './types';
import PoolStageCard from './pool-stage-card';
import SectionEmptyState from './section-empty-state';

type PoolStagesSectionProperties = {
  t: Translator;
  tournamentId: string;
  tournamentStatus: string;
  doubleStageEnabled: boolean;
  stages: LiveViewPoolStage[];
  isAdmin: boolean;
  isPoolStagesReadonly: boolean;
  getStatusLabel: (scope: 'pool' | 'match' | 'bracket' | 'stage', status?: string) => string;
  getMatchTargetLabel: (target: LiveViewMatch['target'] | undefined) => string | undefined;
  getTargetLabel: (target: LiveViewTarget) => string;
  matchScores: Record<string, Record<string, string>>;
  matchTargetSelections: Record<string, string>;
  updatingMatchId: string | undefined;
  resettingPoolId: string | undefined;
  editingMatchId?: string | undefined;
  availableTargetsByTournament: Map<string, LiveViewTarget[]>;
  getMatchKey: (matchTournamentId: string, matchId: string) => string;
  getTargetIdForSelection: (tournamentId: string, targetNumberValue: string) => string | undefined;
  onTargetSelectionChange: (matchKey: string, targetId: string) => void;
  onScoreChange: (matchKey: string, playerId: string, value: string) => void;
  onStartMatch: (matchTournamentId: string, matchId: string, targetId: string) => void;
  onCompleteMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onEditMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onUpdateCompletedMatch: (matchTournamentId: string, match: LiveViewMatch) => void;
  onCancelMatchEdit: () => void;
  onResetPoolMatches: (tournamentId: string, stageId: string, poolId: string) => void;
  onEditStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCancelEditStage: () => void;
  onUpdateStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onCompleteStageWithScores: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onDeleteStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onRecomputeDoubleStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onStagePoolCountChange: (stageId: string, value: string) => void;
  onStagePlayersPerPoolChange: (stageId: string, value: string) => void;
  onStageStatusChange: (stageId: string, value: string) => void;
  onLaunchStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  onResetStage: (stageTournamentId: string, stage: LiveViewPoolStage) => void;
  canDeleteStage: boolean;
  editingStageId?: string | undefined;
  updatingStageId?: string | undefined;
  stageStatusDrafts: Record<string, string>;
  stagePoolCountDrafts: Record<string, string>;
  stagePlayersPerPoolDrafts: Record<string, string>;
  playerIdByTournament: Record<string, string>;
};

const PoolStagesSection = ({
  t,
  tournamentId,
  tournamentStatus,
  doubleStageEnabled,
  stages,
  isAdmin,
  playerIdByTournament = {},
  ...stageProperties
}: PoolStagesSectionProperties) => {
  if (stages.length === 0) {
    return <SectionEmptyState title={t('live.poolStages')} message={t('live.noPoolStages')} />;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">{t('live.poolStages')}</h3>
      <div className="space-y-6">
        {stages.map((stage) => (
          <div key={stage.id} id={`pool-stage-${tournamentId}-${stage.id}`}>
            <PoolStageCard
              t={t}
              tournamentId={tournamentId}
              tournamentStatus={tournamentStatus}
              doubleStageEnabled={doubleStageEnabled}
              stage={stage}
              isAdmin={isAdmin}
              {...(playerIdByTournament[tournamentId]
                ? { preferredPlayerId: playerIdByTournament[tournamentId] }
                : {})}
              {...stageProperties}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PoolStagesSection;
