const isJsdomEnvironment = () => {
  const userAgent = globalThis.navigator?.userAgent;
  return typeof userAgent === 'string' && userAgent.toLowerCase().includes('jsdom');
};

export const navigateWithinApp = (targetUrl: string) => {
  const windowObject = globalThis.window;
  if (!windowObject) {
    return;
  }

  if (isJsdomEnvironment()) {
    const currentUrl = new URL(windowObject.location.href);
    const nextUrl = new URL(targetUrl, currentUrl.origin);
    windowObject.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    return;
  }

  windowObject.location.assign(targetUrl);
};
