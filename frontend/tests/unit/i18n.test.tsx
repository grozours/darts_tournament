import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, useI18n } from '../../src/i18n';

const Probe = () => {
  const { lang, t, toggleLang, setLanguage } = useI18n();

  return (
    <div>
      <div data-testid="lang">{lang}</div>
      <div data-testid="title">{t('app.title')}</div>
      <div data-testid="fallback">{t('missing.translation.key')}</div>
      <button onClick={toggleLang}>toggle</button>
      <button onClick={() => setLanguage('de')}>set-de</button>
    </div>
  );
};

describe('i18n provider', () => {
  it('defaults to fr and falls back to key when translation is missing', () => {
    globalThis.localStorage.removeItem('lang');

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId('lang').textContent).toContain('fr');
    expect(screen.getByTestId('fallback').textContent).toContain('missing.translation.key');
  });

  it('normalizes stored language values and toggles through the language order', () => {
    globalThis.localStorage.setItem('lang', 'es-MX');

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId('lang').textContent).toContain('es');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('lang').textContent).toContain('de');
    expect(globalThis.localStorage.getItem('lang')).toBe('de');
  });

  it('stores selected language via setLanguage', () => {
    globalThis.localStorage.setItem('lang', 'unknown-language');

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId('lang').textContent).toContain('en');

    fireEvent.click(screen.getByRole('button', { name: 'set-de' }));
    expect(screen.getByTestId('lang').textContent).toContain('de');
    expect(globalThis.localStorage.getItem('lang')).toBe('de');
  });
});
