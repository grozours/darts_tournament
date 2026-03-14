import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OpenSourceView from '../../../src/components/open-source-view';

describe('OpenSourceView', () => {
  it('updates document metadata and restores it on unmount', () => {
    document.title = 'Previous title';
    const description = document.createElement('meta');
    description.setAttribute('name', 'description');
    description.setAttribute('content', 'Previous description');
    document.head.append(description);

    const { unmount } = render(<OpenSourceView />);

    expect(document.title).toBe('Darts Tournament GitHub Project');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      'Open source darts tournament manager project'
    );
    expect(screen.getByRole('link', { name: 'https://github.com/grozours/darts_tournament' })).toHaveAttribute(
      'href',
      'https://github.com/grozours/darts_tournament'
    );

    unmount();

    expect(document.title).toBe('Previous title');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Previous description');
    description.remove();
  });

  it('creates meta description when missing', () => {
    document.querySelector('meta[name="description"]')?.remove();

    render(<OpenSourceView />);

    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toContain('Open source darts tournament manager project');
  });
});
