import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TargetsViewHeader from '../../../../src/components/targets-view/targets-view-header';

describe('TargetsViewHeader', () => {
  const t = (key: string) => key;

  it('always renders title', () => {
    render(<TargetsViewHeader t={t} tournamentId={undefined} scopedViews={[]} />);
    expect(screen.getByText('targets.title')).toBeInTheDocument();
  });

  it('renders tournament name and id when scoped view is present', () => {
    render(
      <TargetsViewHeader
        t={t}
        tournamentId="t1"
        scopedViews={[{ id: 't1', name: 'Cup', status: 'LIVE' }] as never}
      />
    );

    expect(screen.getByText('Cup')).toBeInTheDocument();
    expect(screen.getByText('ID: t1')).toBeInTheDocument();
  });
});
