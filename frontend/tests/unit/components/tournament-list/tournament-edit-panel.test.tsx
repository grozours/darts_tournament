import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TournamentEditPanel from '../../../../src/components/tournament-list/tournament-edit-panel';

vi.mock('../../../../src/components/tournament-list/tournament-edit-header', () => ({
  default: ({ tournamentId }: { tournamentId: string }) => <div data-testid="header">header:{tournamentId}</div>,
}));

vi.mock('../../../../src/components/tournament-list/tournament-edit-content', () => ({
  default: () => <div data-testid="content">content</div>,
}));

vi.mock('../../../../src/components/tournament-list/tournament-edit-footer', () => ({
  default: ({ canOpenRegistration }: { canOpenRegistration: boolean }) => (
    <div data-testid="footer">footer:{String(canOpenRegistration)}</div>
  ),
}));

const baseProperties = {
  t: (key: string) => key,
  isEditPage: false,
  isAdmin: true,
  editForm: {} as never,
  editingTournament: {
    id: 't1',
    name: 'Cup',
    format: 'SINGLE',
    totalParticipants: 8,
    status: 'DRAFT',
  },
  formatOptions: [],
  durationOptions: [],
  skillLevelOptions: [],
  isSaving: false,
  isUploadingLogo: false,
  logoFiles: [],
  normalizedStatus: 'DRAFT',
  onClose: vi.fn(),
  onEditFormChange: vi.fn(),
  onLogoFilesChange: vi.fn(),
  onUploadLogo: vi.fn(),
  onDeleteLogo: vi.fn(),
  poolStages: [],
  onLoadPoolStages: vi.fn(),
  onPoolStageNumberChange: vi.fn(),
  onPoolStageNameChange: vi.fn(),
  onPoolStagePoolCountChange: vi.fn(),
  onPoolStagePlayersPerPoolChange: vi.fn(),
  onPoolStageAdvanceCountChange: vi.fn(),
  onPoolStageMatchFormatChange: vi.fn(),
  onPoolStageLosersAdvanceChange: vi.fn(),
  onPoolStageRankingDestinationChange: vi.fn(),
  onPoolStageStatusChange: vi.fn(),
  onOpenPoolStageAssignments: vi.fn(),
  onSavePoolStage: vi.fn(),
  onRemovePoolStage: vi.fn(),
  isAddingPoolStage: false,
  newPoolStage: {
    stageNumber: 1,
    name: '',
    poolCount: 1,
    playersPerPool: 4,
    advanceCount: 1,
    losersAdvanceToBracket: false,
  },
  onStartAddPoolStage: vi.fn(),
  onCancelAddPoolStage: vi.fn(),
  onNewPoolStageStageNumberChange: vi.fn(),
  onNewPoolStageNameChange: vi.fn(),
  onNewPoolStagePoolCountChange: vi.fn(),
  onNewPoolStagePlayersPerPoolChange: vi.fn(),
  onNewPoolStageAdvanceCountChange: vi.fn(),
  onNewPoolStageMatchFormatChange: vi.fn(),
  onNewPoolStageLosersAdvanceChange: vi.fn(),
  onNewPoolStageRankingDestinationChange: vi.fn(),
  onAddPoolStage: vi.fn(async () => true),
  brackets: [],
  targets: [],
  onLoadBrackets: vi.fn(),
  onBracketNameChange: vi.fn(),
  onBracketTypeChange: vi.fn(),
  onBracketRoundsChange: vi.fn(),
  onBracketRoundMatchFormatChange: vi.fn(),
  onBracketStatusChange: vi.fn(),
  onBracketTargetToggle: vi.fn(),
  onSaveBracket: vi.fn(),
  onSaveBracketTargets: vi.fn(),
  onRemoveBracket: vi.fn(),
  isAddingBracket: false,
  newBracket: { name: '', bracketType: 'SINGLE_ELIMINATION', totalRounds: 1 },
  onStartAddBracket: vi.fn(),
  onCancelAddBracket: vi.fn(),
  onNewBracketNameChange: vi.fn(),
  onNewBracketTypeChange: vi.fn(),
  onNewBracketRoundsChange: vi.fn(),
  onNewBracketRoundMatchFormatChange: vi.fn(),
  onAddBracket: vi.fn(),
  getStatusLabel: vi.fn(),
  normalizeStageStatus: vi.fn(),
  players: [{ id: 'p1' }],
  playersLoading: false,
  playerForm: {} as never,
  playerActionLabel: 'save',
  isRegisteringPlayer: false,
  isAutoFillingPlayers: false,
  isConfirmingAll: false,
  isApplyingPreset: false,
  onPlayerFormChange: vi.fn(),
  onStartEditPlayer: vi.fn(),
  onCancelEditPlayer: vi.fn(),
  onSubmitPlayer: vi.fn(),
  onAutoFillPlayers: vi.fn(),
  onRemovePlayer: vi.fn(),
  onFetchPlayers: vi.fn(),
  onConfirmAllPlayers: vi.fn(),
  onTogglePlayerCheckIn: vi.fn(),
  quickStructurePresets: [],
  quickStructurePresetsLoading: false,
  onApplyStructurePreset: vi.fn(),
  onMoveToSignature: vi.fn(),
  onMoveToLive: vi.fn(),
  onOpenRegistration: vi.fn(),
  onSaveEdit: vi.fn(),
};

describe('TournamentEditPanel', () => {
  it('renders fixed modal layout and edit error in non-edit page mode', () => {
    const { container } = render(
      <TournamentEditPanel
        {...baseProperties}
        isEditPage={false}
        editError="save error"
      />
    );

    expect(screen.getByTestId('header')).toHaveTextContent('header:t1');
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toHaveTextContent('footer:true');
    expect(screen.getByText('save error')).toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-0')).toBeTruthy();
  });

  it('renders inline layout in edit page mode and computes canOpenRegistration false', () => {
    const { container } = render(
      <TournamentEditPanel
        {...baseProperties}
        isEditPage
        players={[{ id: 'p1' }, { id: 'p2' }] as never}
        editingTournament={{ ...baseProperties.editingTournament, totalParticipants: 2 }}
      />
    );

    expect(screen.getByTestId('footer')).toHaveTextContent('footer:false');
    expect(container.querySelector('.fixed.inset-0')).toBeFalsy();
    expect(container.querySelector('.rounded-3xl.border')).toBeTruthy();
  });
});
