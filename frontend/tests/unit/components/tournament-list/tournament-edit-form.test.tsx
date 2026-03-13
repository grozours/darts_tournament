import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
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

const renderEditForm = (override: Partial<ComponentProps<typeof TournamentEditForm>> = {}) => (
  render(
    <TournamentEditForm
      t={(key) => key}
      editForm={baseEditForm}
      editingTournament={{ status: 'OPEN' }}
      formatOptions={[{ value: 'SINGLE', label: 'Single' }]}
      durationOptions={[{ value: 'FULL_DAY', label: 'Full day' }]}
      logoFiles={[]}
      isUploadingLogo={false}
      onEditFormChange={vi.fn()}
      onLogoFilesChange={vi.fn()}
      onUploadLogo={vi.fn()}
      onDeleteLogo={vi.fn()}
      {...override}
    />
  )
);

describe('TournamentEditForm field changes', () => {
  it('forwards text/select/date field changes', () => {
    const onEditFormChange = vi.fn();
    renderEditForm({
      onEditFormChange,
      editingTournament: {
        status: 'OPEN',
        historicalFlag: true,
        createdAt: '2026-04-01T10:00:00.000Z',
        completedAt: undefined,
        logoUrl: undefined,
      },
    });

    fireEvent.change(screen.getByLabelText('edit.name'), { target: { value: 'New Cup' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Cup' }));

    fireEvent.change(screen.getByLabelText('edit.location'), { target: { value: 'Lyon' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ location: 'Lyon' }));

    fireEvent.change(screen.getByLabelText('edit.format'), { target: { value: 'SINGLE' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ format: 'SINGLE' }));

    fireEvent.change(screen.getByLabelText('edit.durationType'), { target: { value: 'FULL_DAY' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ durationType: 'FULL_DAY' }));

    fireEvent.change(screen.getByLabelText('edit.participants'), { target: { value: '24' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ totalParticipants: '24' }));

    fireEvent.change(screen.getByLabelText('edit.startTime'), { target: { value: '2026-05-01T10:00' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ startTime: '2026-05-01T10:00' }));

    fireEvent.change(screen.getByLabelText('edit.endTime'), { target: { value: '2026-05-01T18:00' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ endTime: '2026-05-01T18:00' }));

    fireEvent.change(screen.getByLabelText('edit.targetCount'), { target: { value: '12' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ targetCount: '12' }));

    fireEvent.change(screen.getByLabelText('edit.targetStartNumber'), { target: { value: '3' } });
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ targetStartNumber: '3' }));
  });

  it('forwards shareTargets checkbox change', () => {
    const onEditFormChange = vi.fn();
    renderEditForm({ onEditFormChange });

    fireEvent.click(screen.getByLabelText('edit.shareTargets'));
    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({ shareTargets: true }));
  });

});

describe('TournamentEditForm logos', () => {
  it('forwards selected logo files', () => {
    const onLogoFilesChange = vi.fn();
    const { container } = renderEditForm({ onLogoFilesChange });

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onLogoFilesChange).toHaveBeenCalledWith([file]);
  });

  it('renders details and allows deleting an existing logo', () => {
    const onDeleteLogo = vi.fn();

    renderEditForm({
      editingTournament: {
        status: 'OPEN',
        historicalFlag: true,
        createdAt: '2026-04-01T10:00:00.000Z',
        completedAt: undefined,
        logoUrl: undefined,
      },
    });

    expect(screen.getByText('common.yes')).toBeInTheDocument();
    expect(screen.getByText('edit.noLogo')).toBeInTheDocument();

    renderEditForm({
      editingTournament: { status: 'OPEN', logoUrls: ['https://img/logo.png'] },
      onDeleteLogo,
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(onDeleteLogo).toHaveBeenCalledWith('https://img/logo.png');
  });

  it('disables upload button when no file and enables it with file', () => {
    const onUploadLogo = vi.fn();
    const { rerender } = renderEditForm({ onUploadLogo });

    const upload = screen.getByRole('button', { name: 'edit.uploadLogo' });
    expect(upload).toBeDisabled();

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    rerender(
      <TournamentEditForm
        t={(key) => key}
        editForm={baseEditForm}
        editingTournament={{ status: 'OPEN', logoUrl: 'https://img' }}
        formatOptions={[{ value: 'SINGLE', label: 'Single' }]}
        durationOptions={[{ value: 'FULL_DAY', label: 'Full day' }]}
        logoFiles={[file]}
        isUploadingLogo={false}
        onEditFormChange={vi.fn()}
        onLogoFilesChange={vi.fn()}
        onUploadLogo={onUploadLogo}
        onDeleteLogo={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit.uploadLogo' }));
    expect(onUploadLogo).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('edit.logoAlt')).toBeInTheDocument();
    expect(screen.getByText('1 file(s)')).toBeInTheDocument();
  });

});

describe('TournamentEditForm details', () => {
  it('shows uploading state and fallback details values', () => {
    render(
      <TournamentEditForm
        t={(key) => key}
        editForm={baseEditForm}
        editingTournament={{ status: 'CLOSED', historicalFlag: false }}
        formatOptions={[{ value: 'SINGLE', label: 'Single' }]}
        durationOptions={[{ value: 'FULL_DAY', label: 'Full day' }]}
        logoFiles={[]}
        isUploadingLogo
        onEditFormChange={vi.fn()}
        onLogoFilesChange={vi.fn()}
        onUploadLogo={vi.fn()}
        onDeleteLogo={vi.fn()}
      />
    );

    expect(screen.getByText('common.no')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'edit.uploading' })).toBeDisabled();
  });
});
