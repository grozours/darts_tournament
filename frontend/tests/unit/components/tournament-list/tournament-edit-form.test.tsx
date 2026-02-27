import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TournamentEditForm from '../../../../src/components/tournament-list/tournament-edit-form';

const baseEditForm = {
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
};

describe('TournamentEditForm', () => {
  it('renders details and forwards edit field changes', () => {
    const onEditFormChange = vi.fn();
    const onLogoFileChange = vi.fn();

    const { container } = render(
      <TournamentEditForm
        t={(key) => key}
        editForm={baseEditForm}
        editingTournament={{
          status: 'OPEN',
          historicalFlag: true,
          createdAt: '2026-04-01T10:00:00.000Z',
          completedAt: undefined,
          logoUrl: undefined,
        }}
        formatOptions={[{ value: 'SINGLE', label: 'Single' }]}
        durationOptions={[{ value: 'FULL_DAY', label: 'Full day' }]}
        logoFile={undefined}
        isUploadingLogo={false}
        onEditFormChange={onEditFormChange}
        onLogoFileChange={onLogoFileChange}
        onUploadLogo={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('edit.name'), { target: { value: 'New Cup' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Cup' }));

    fireEvent.click(screen.getByLabelText('edit.shareTargets'));
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ shareTargets: true }));

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onLogoFileChange).toHaveBeenCalledWith(file);

    expect(screen.getByText('common.yes')).toBeInTheDocument();
    expect(screen.getByText('edit.noLogo')).toBeInTheDocument();
  });

  it('disables upload button when no file and enables it with file', () => {
    const onUploadLogo = vi.fn();
    const { rerender } = render(
      <TournamentEditForm
        t={(key) => key}
        editForm={baseEditForm}
        editingTournament={{ status: 'OPEN' }}
        formatOptions={[{ value: 'SINGLE', label: 'Single' }]}
        durationOptions={[{ value: 'FULL_DAY', label: 'Full day' }]}
        logoFile={undefined}
        isUploadingLogo={false}
        onEditFormChange={vi.fn()}
        onLogoFileChange={vi.fn()}
        onUploadLogo={onUploadLogo}
      />
    );

    const upload = screen.getByRole('button', { name: 'edit.uploadLogo' });
    expect(upload).toBeDisabled();

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    rerender(
      <TournamentEditForm
        t={(key) => key}
        editForm={baseEditForm}
        editingTournament={{ status: 'OPEN', logoUrl: 'http://img' }}
        formatOptions={[{ value: 'SINGLE', label: 'Single' }]}
        durationOptions={[{ value: 'FULL_DAY', label: 'Full day' }]}
        logoFile={file}
        isUploadingLogo={false}
        onEditFormChange={vi.fn()}
        onLogoFileChange={vi.fn()}
        onUploadLogo={onUploadLogo}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit.uploadLogo' }));
    expect(onUploadLogo).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('edit.logoAlt')).toBeInTheDocument();
  });
});
