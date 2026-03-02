import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLiveRefreshIntervalMs, getTargetsRefreshIntervalMs } from '../../../src/utils/polling-config';

describe('polling-config', () => {
  const globalEnvironment = (globalThis as typeof globalThis & {
    __APP_ENV__?: Record<string, string>;
  }).__APP_ENV__ ?? {};

  const originalEnvironment = {
    VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS: globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS,
    VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS: globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS,
    VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS: globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS,
    VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS: globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS,
  };

  const expectedFromImportMeta = (rawValue: string | undefined, fallbackValue: number): number => {
    if (!rawValue) {
      return fallbackValue;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsedValue) || parsedValue < 5_000) {
      return fallbackValue;
    }

    return parsedValue;
  };

  beforeEach(() => {
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS = '';
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS = '';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS = '';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS = '';
    (globalThis as typeof globalThis & { __APP_ENV__?: Record<string, string> }).__APP_ENV__ = globalEnvironment;
  });

  afterEach(() => {
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS = originalEnvironment.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS ?? '';
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS = originalEnvironment.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS ?? '';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS = originalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS ?? '';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS = originalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS ?? '';
  });

  it('uses default intervals when values are missing', () => {
    expect(getLiveRefreshIntervalMs(true)).toBe(10_000);
    expect(getLiveRefreshIntervalMs(false)).toBe(60_000);
    expect(getTargetsRefreshIntervalMs(true)).toBe(10_000);
    expect(getTargetsRefreshIntervalMs(false)).toBe(60_000);
  });

  it('uses configured intervals when values are valid', () => {
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS = '15000';
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS = '90000';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS = '12000';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS = '75000';

    expect(getLiveRefreshIntervalMs(true)).toBe(15_000);
    expect(getLiveRefreshIntervalMs(false)).toBe(90_000);
    expect(getTargetsRefreshIntervalMs(true)).toBe(12_000);
    expect(getTargetsRefreshIntervalMs(false)).toBe(75_000);
  });

  it('falls back to defaults for invalid values and values below minimum', () => {
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS = 'not-a-number';
    globalEnvironment.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS = '4999';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS = '-1';
    globalEnvironment.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS = '3000';

    expect(getLiveRefreshIntervalMs(true)).toBe(10_000);
    expect(getLiveRefreshIntervalMs(false)).toBe(60_000);
    expect(getTargetsRefreshIntervalMs(true)).toBe(10_000);
    expect(getTargetsRefreshIntervalMs(false)).toBe(60_000);
  });

  it('falls back to import.meta.env when __APP_ENV__ is undefined', () => {
    (globalThis as typeof globalThis & { __APP_ENV__?: Record<string, string> }).__APP_ENV__ = undefined;

    expect(getLiveRefreshIntervalMs(true)).toBe(
      expectedFromImportMeta(import.meta.env.VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS, 10_000)
    );
    expect(getLiveRefreshIntervalMs(false)).toBe(
      expectedFromImportMeta(import.meta.env.VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS, 60_000)
    );
    expect(getTargetsRefreshIntervalMs(true)).toBe(
      expectedFromImportMeta(import.meta.env.VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS, 10_000)
    );
    expect(getTargetsRefreshIntervalMs(false)).toBe(
      expectedFromImportMeta(import.meta.env.VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS, 60_000)
    );
  });
});
