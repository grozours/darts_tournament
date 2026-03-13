import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TournamentFormat } from '@shared/types';
import TournamentEditContent, {
  type TournamentEditContentProperties,
} from '../../../../src/components/tournament-list/tournament-edit-content';

const tournamentEditFormSpy = vi.hoisted(() => vi.fn());
const poolStagesEditorSpy = vi.hoisted(() => vi.fn());
const bracketsEditorSpy = vi.hoisted(() => vi.fn());
const tournamentStatusSectionsSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/components/tournament-list/tournament-edit-form', () => ({
  default: (props: unknown) => {
    tournamentEditFormSpy(props);
    return <div data-testid="tournament-edit-form" />;
  },
}));

vi.mock('../../../../src/components/tournament-list/pool-stages-editor', () => ({
  default: (props: unknown) => {
    poolStagesEditorSpy(props);
    return <div data-testid="pool-stages-editor" />;
  },
}));

vi.mock('../../../../src/components/tournament-list/brackets-editor', () => ({
  default: (props: { canEditBrackets: boolean; canAddBrackets: boolean }) => {
    bracketsEditorSpy(props);
    return (
      <div data-testid="brackets-editor">
        {`edit:${String(props.canEditBrackets)} add:${String(props.canAddBrackets)}`}
      </div>
    );
  },
}));

vi.mock('../../../../src/components/tournament-list/tournament-status-sections', () => ({
  default: (props: unknown) => {
    tournamentStatusSectionsSpy(props);
    return <div data-testid="status-sections" />;
  },
}));

const noOp = () => undefined;

const buildProperties = (
  override: Partial<TournamentEditContentProperties> = {}
): TournamentEditContentProperties => ({
  t: (key: string) => key,
  isAdmin: true,
  editForm: {
    name: 'Cup',
    location: 'Paris',
    format: 'SINGLE',
    doubleStageEnabled: false,
    durationType: 'FULL_DAY',
    totalParticipants: '16',
    startTime: '2026-04-10T10:00',
    endTime: '2026-04-10T18:00',
    targetCount: '8',
    targetStartNumber: '1',
    shareTargets: false,
  },
  editingTournament: {
    status: 'OPEN',
    format: 'SINGLE',
    totalParticipants: 16,
  },
  formatOptions: [{ value: 'SINGLE', label: 'Single' }],
  durationOptions: [{ value: 'FULL_DAY', label: 'Full day' }],
  skillLevelOptions: [{ value: 'ALL', label: 'All' }],
  logoFiles: [],
  isUploadingLogo: false,
  poolStages: [],
  poolStagesError: undefined,
  isAddingPoolStage: false,
  newPoolStage: {
    stageNumber: 1,
    name: '',
    poolCount: 2,
    playersPerPool: 4,
    advanceCount: 2,
    losersAdvanceToBracket: false,
  },
  brackets: [],
  bracketsError: undefined,
  targets: [],
  targetsError: undefined,
  isAddingBracket: false,
  newBracket: { name: '', bracketType: 'SINGLE_ELIMINATION', totalRounds: 3 },
  players: [],
  playersLoading: false,
  playersError: undefined,
  playerForm: { firstName: '', lastName: '' },
  editingPlayerId: undefined,
  checkingInPlayerId: undefined,
  playerActionLabel: 'add',
  isRegisteringPlayer: false,
  isAutoFillingPlayers: false,
  isConfirmingAll: false,
  isApplyingPreset: false,
  quickStructurePresets: [],
  quickStructurePresetsLoading: false,
  normalizedStatus: 'OPEN',
  onEditFormChange: noOp,
  onLogoFilesChange: noOp,
  onUploadLogo: noOp,
  onDeleteLogo: noOp,
  onApplyStructurePreset: noOp,
  onLoadPoolStages: noOp,
  onPoolStageNumberChange: noOp,
  onPoolStageNameChange: noOp,
  onPoolStagePoolCountChange: noOp,
  onPoolStagePlayersPerPoolChange: noOp,
  onPoolStageAdvanceCountChange: noOp,
  onPoolStageMatchFormatChange: noOp,
  onPoolStageLosersAdvanceChange: noOp,
  onPoolStageRankingDestinationChange: noOp,
  onPoolStageStatusChange: noOp,
  onOpenPoolStageAssignments: noOp,
  onSavePoolStage: noOp,
  onRemovePoolStage: noOp,
  onStartAddPoolStage: noOp,
  onCancelAddPoolStage: noOp,
  onNewPoolStageStageNumberChange: noOp,
  onNewPoolStageNameChange: noOp,
  onNewPoolStagePoolCountChange: noOp,
  onNewPoolStagePlayersPerPoolChange: noOp,
  onNewPoolStageAdvanceCountChange: noOp,
  onNewPoolStageMatchFormatChange: noOp,
  onNewPoolStageLosersAdvanceChange: noOp,
  onNewPoolStageRankingDestinationChange: noOp,
  onAddPoolStage: async () => true,
  onLoadBrackets: noOp,
  onBracketNameChange: noOp,
  onBracketTypeChange: noOp,
  onBracketRoundsChange: noOp,
  onBracketRoundMatchFormatChange: noOp,
  onBracketStatusChange: noOp,
  onBracketTargetToggle: noOp,
  onSaveBracket: noOp,
  onSaveBracketTargets: noOp,
  onRemoveBracket: noOp,
  onStartAddBracket: noOp,
  onCancelAddBracket: noOp,
  onNewBracketNameChange: noOp,
  onNewBracketTypeChange: noOp,
  onNewBracketRoundsChange: noOp,
  onNewBracketRoundMatchFormatChange: noOp,
  onAddBracket: noOp,
  getStatusLabel: (_kind, status) => status,
  normalizeStageStatus: (status) => status ?? 'NOT_STARTED',
  onPlayerFormChange: noOp,
  onStartEditPlayer: noOp,
  onCancelEditPlayer: noOp,
  onSubmitPlayer: noOp,
  onAutoFillPlayers: noOp,
  onRemovePlayer: noOp,
  onFetchPlayers: noOp,
  onConfirmAllPlayers: noOp,
  onTogglePlayerCheckIn: noOp,
  ...override,
});

describe('TournamentEditContent', () => {
  beforeEach(() => {
    tournamentEditFormSpy.mockClear();
    poolStagesEditorSpy.mockClear();
    bracketsEditorSpy.mockClear();
    tournamentStatusSectionsSpy.mockClear();
  });

  it('renders quick preset states and applies a preset payload', () => {
    const onApplyStructurePreset = vi.fn();

    render(
      <TournamentEditContent
        {...buildProperties({
          quickStructurePresets: [{
            id: 'p1',
            name: 'Fast Start',
            presetType: 'custom',
            templateConfig: { format: TournamentFormat.SINGLE, stages: [], brackets: [], routingRules: [] },
            createdAt: '',
            updatedAt: '',
            totalParticipants: 16,
            targetCount: 4,
            isSystem: false,
          }],
          onApplyStructurePreset,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fast Start' }));
    expect(onApplyStructurePreset).toHaveBeenCalledWith({
      name: 'Fast Start',
      presetType: 'custom',
      templateConfig: { format: 'SINGLE', stages: [], brackets: [], routingRules: [] },
    });

    expect(screen.getByTestId('tournament-edit-form')).toBeInTheDocument();
    expect(screen.getByTestId('pool-stages-editor')).toBeInTheDocument();
    expect(screen.getByTestId('brackets-editor')).toBeInTheDocument();
    expect(screen.getByTestId('status-sections')).toBeInTheDocument();
  });

  it('disables quick presets in LIVE and computes bracket edit flags', () => {
    render(
      <TournamentEditContent
        {...buildProperties({
          normalizedStatus: 'LIVE',
          isAdmin: false,
          quickStructurePresets: [{
            id: 'p2',
            name: 'Locked Preset',
            presetType: 'custom',
            createdAt: '',
            updatedAt: '',
            totalParticipants: 16,
            targetCount: 4,
            isSystem: false,
            templateConfig: { format: TournamentFormat.SINGLE, stages: [], brackets: [], routingRules: [] },
          }],
          brackets: [{
            id: 'b1',
            tournamentId: 't1',
            name: 'Main',
            bracketType: 'SINGLE_ELIMINATION',
            totalRounds: 3,
            status: 'NOT_STARTED',
            targetIds: [],
          }],
        })}
      />
    );

    expect(screen.getByText('edit.quickStructureDisabledLive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Locked Preset' })).toBeDisabled();
    expect(screen.getByText('edit:false add:false')).toBeInTheDocument();
  });
});
