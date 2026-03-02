const DEFAULT_ADMIN_REFRESH_INTERVAL_MS = 10_000;
const DEFAULT_VIEWER_REFRESH_INTERVAL_MS = 60_000;
const MIN_REFRESH_INTERVAL_MS = 5_000;

const getEnvironmentValue = (key: keyof ImportMetaEnv): string | undefined => {
  const runtimeEnvironment = (globalThis as typeof globalThis & {
    __APP_ENV__?: Record<string, string>;
  }).__APP_ENV__;

  return runtimeEnvironment?.[key] ?? import.meta.env[key];
};

const parseRefreshInterval = (rawValue: string | undefined, fallbackValue: number): number => {
  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < MIN_REFRESH_INTERVAL_MS) {
    return fallbackValue;
  }

  return parsedValue;
};

export const getLiveRefreshIntervalMs = (isAdmin: boolean): number => {
  const adminInterval = parseRefreshInterval(getEnvironmentValue('VITE_LIVE_REFRESH_INTERVAL_ADMIN_MS'), DEFAULT_ADMIN_REFRESH_INTERVAL_MS);
  const viewerInterval = parseRefreshInterval(getEnvironmentValue('VITE_LIVE_REFRESH_INTERVAL_VIEWER_MS'), DEFAULT_VIEWER_REFRESH_INTERVAL_MS);
  return isAdmin ? adminInterval : viewerInterval;
};

export const getTargetsRefreshIntervalMs = (isAdmin: boolean): number => {
  const adminInterval = parseRefreshInterval(getEnvironmentValue('VITE_TARGETS_REFRESH_INTERVAL_ADMIN_MS'), DEFAULT_ADMIN_REFRESH_INTERVAL_MS);
  const viewerInterval = parseRefreshInterval(getEnvironmentValue('VITE_TARGETS_REFRESH_INTERVAL_VIEWER_MS'), DEFAULT_VIEWER_REFRESH_INTERVAL_MS);
  return isAdmin ? adminInterval : viewerInterval;
};
