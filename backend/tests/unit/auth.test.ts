import { auth } from 'express-oauth2-jwt-bearer';
import { config } from '../../src/config/environment';
import {
  getActiveDevelopmentAutologinMode,
  isAdmin,
  optionalAuth,
  parseDevelopmentAutologinMode,
  requireAdmin,
  requireAuth,
  resolveUserEmailFromPayload,
} from '../../src/middleware/auth';

jest.mock('express-oauth2-jwt-bearer', () => ({
  auth: jest.fn(() => (_request: unknown, _response: unknown, next: () => void) => next()),
}));

describe('auth middleware', () => {
  const originalAuthEnabled = config.auth.enabled;
  const originalAdminEmails = [...config.auth.adminEmails];
  const originalIsDevelopment = config.isDevelopment;
  const originalDevAutoLoginEnabled = config.auth.devAutoLoginEnabled;
  const originalDevAutoLoginMode = config.auth.devAutoLoginMode;
  const originalDevAutoLoginAdminEmail = config.auth.devAutoLoginAdminEmail;
  const originalDevAutoLoginPlayerEmail = config.auth.devAutoLoginPlayerEmail;

  beforeEach(() => {
    config.isDevelopment = true;
    config.auth.enabled = false;
    config.auth.adminEmails = [];
    config.auth.devAutoLoginEnabled = false;
    delete config.auth.devAutoLoginMode;
    delete config.auth.devAutoLoginAdminEmail;
    delete config.auth.devAutoLoginPlayerEmail;
    (auth as jest.Mock).mockClear();
  });

  afterAll(() => {
    config.auth.enabled = originalAuthEnabled;
    config.auth.adminEmails = originalAdminEmails;
    config.isDevelopment = originalIsDevelopment;
    config.auth.devAutoLoginEnabled = originalDevAutoLoginEnabled;
    if (originalDevAutoLoginMode) {
      config.auth.devAutoLoginMode = originalDevAutoLoginMode;
    } else {
      delete config.auth.devAutoLoginMode;
    }
    if (originalDevAutoLoginAdminEmail) {
      config.auth.devAutoLoginAdminEmail = originalDevAutoLoginAdminEmail;
    } else {
      delete config.auth.devAutoLoginAdminEmail;
    }
    if (originalDevAutoLoginPlayerEmail) {
      config.auth.devAutoLoginPlayerEmail = originalDevAutoLoginPlayerEmail;
    } else {
      delete config.auth.devAutoLoginPlayerEmail;
    }
  });

  it('parses development autologin mode with normalization', () => {
    expect(parseDevelopmentAutologinMode(' ADMIN ')).toBe('admin');
    expect(parseDevelopmentAutologinMode('player')).toBe('player');
    expect(parseDevelopmentAutologinMode('anonymous')).toBe('anonymous');
    expect(parseDevelopmentAutologinMode('guest')).toBeUndefined();
    expect(parseDevelopmentAutologinMode(undefined)).toBeUndefined();
  });

  it('returns undefined for active development mode outside dev or when auth is disabled', () => {
    config.isDevelopment = false;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;
    expect(getActiveDevelopmentAutologinMode({ headers: {}, query: {} } as never)).toBeUndefined();

    config.isDevelopment = true;
    config.auth.enabled = false;
    expect(getActiveDevelopmentAutologinMode({ headers: {}, query: {} } as never)).toBeUndefined();
  });

  it('returns admin fallback mode when dev autologin is disabled but admin email exists', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = false;
    config.auth.devAutoLoginAdminEmail = 'admin@example.com';

    expect(getActiveDevelopmentAutologinMode({ headers: {}, query: {} } as never)).toBe('admin');
  });

  it('resolves active development mode from query, header, cookie and config fallback', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;

    expect(
      getActiveDevelopmentAutologinMode({
        headers: {},
        query: { devAuthMode: ['player', 'admin'] },
      } as never)
    ).toBe('player');

    expect(
      getActiveDevelopmentAutologinMode({
        headers: { 'x-dev-autologin-mode': ' ADMIN ' },
        query: {},
      } as never)
    ).toBe('admin');

    expect(
      getActiveDevelopmentAutologinMode({
        headers: { cookie: ' foo=bar; dev-autologin-mode=player; malformed ; invalid=' },
        query: {},
      } as never)
    ).toBe('player');

    config.auth.devAutoLoginMode = 'anonymous';
    expect(getActiveDevelopmentAutologinMode({ headers: {}, query: {} } as never)).toBe('anonymous');
  });

  it('falls back to admin mode when no request mode is found but admin email is configured', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;
    config.auth.devAutoLoginAdminEmail = 'admin@example.com';

    expect(
      getActiveDevelopmentAutologinMode({
        headers: { cookie: 'x=y;broken' },
        query: { devAuthMode: 'invalid-mode' },
      } as never)
    ).toBe('admin');
  });

  it('returns false when no auth payload exists', () => {
    expect(isAdmin({} as never)).toBe(false);
  });

  it('returns true when user email is an admin', () => {
    config.auth.adminEmails = ['admin@example.com'];

    const request = {
      auth: {
        payload: {
          email: 'Admin@Example.com',
        },
      },
    };

    expect(isAdmin(request as never)).toBe(true);
  });

  it('returns false when no resolvable email claim exists', () => {
    config.auth.adminEmails = ['admin@example.com'];

    const request = {
      auth: {
        payload: {
          name: 'NotAnEmail',
        },
      },
    };

    expect(isAdmin(request as never)).toBe(false);
  });

  it('resolves user email from namespaced claims and fallback keys', () => {
    expect(resolveUserEmailFromPayload({ preferred_username: ' USER@example.com ' })).toBe('user@example.com');
    expect(resolveUserEmailFromPayload({ 'https://tenant.example.com/email': 'Admin@Example.com' })).toBe(
      'admin@example.com'
    );
    expect(resolveUserEmailFromPayload({ name: 'NoEmailValue' })).toBeUndefined();
  });

  it('allows requests when auth is disabled', () => {
    const next = jest.fn();

    requireAdmin({} as never, {} as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects requests without auth when enabled', () => {
    config.auth.enabled = true;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    requireAdmin({} as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthorized',
      })
    );
  });

  it('rejects non-admin users when enabled', () => {
    config.auth.enabled = true;
    config.auth.adminEmails = ['admin@example.com'];
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      auth: {
        payload: {
          email: 'user@example.com',
        },
      },
    };

    requireAdmin(request as never, response as never, jest.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
      })
    );
  });

  it('accepts admin users when enabled', () => {
    config.auth.enabled = true;
    config.auth.adminEmails = ['admin@example.com'];
    const next = jest.fn();
    const request = {
      auth: {
        payload: {
          email: 'admin@example.com',
        },
      },
    };

    requireAdmin(request as never, {} as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('skips optional auth when auth is disabled', () => {
    const next = jest.fn();

    optionalAuth({ headers: {} } as never, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
  });

  it('skips optional auth when no bearer token exists', () => {
    config.auth.enabled = true;
    const next = jest.fn();

    optionalAuth({ headers: {} } as never, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
  });

  it('runs auth middleware when bearer token exists', () => {
    config.auth.enabled = true;
    const next = jest.fn();
    const authNext = jest.fn();

    (auth as jest.Mock).mockImplementationOnce(
      () => (_request: unknown, _response: unknown, innerNext: () => void) => {
        authNext();
        innerNext();
      }
    );

    optionalAuth(
      { headers: { authorization: 'Bearer token' } } as never,
      {} as never,
      next
    );

    expect(auth).toHaveBeenCalled();
    expect(authNext).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('applies legacy development admin autologin when mode is unset', () => {
    try {
      config.isDevelopment = true;
      config.auth.enabled = true;
      config.auth.devAutoLoginAdminEmail = 'admin@example.com';

      const next = jest.fn();
      const request = { headers: {} } as never;

      optionalAuth(request, {} as never, next);

      expect(next).toHaveBeenCalled();
      expect((request as { auth?: { payload?: { sub?: string } } }).auth?.payload?.sub).toBe('dev-admin:admin@example.com');
    } finally {
      config.isDevelopment = originalIsDevelopment;
    }
  });

  it('runs requireAuth through configured auth middleware when dev autologin is not applied', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;

    const next = jest.fn();
    const authNext = jest.fn();

    (auth as jest.Mock).mockImplementationOnce(
      () => (_request: unknown, _response: unknown, innerNext: () => void) => {
        authNext();
        innerNext();
      }
    );

    requireAuth({ headers: {}, query: {} } as never, {} as never, next);

    expect(auth).toHaveBeenCalled();
    expect(authNext).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('uses development player autologin when mode is requested and no bearer token is present', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;
    config.auth.devAutoLoginPlayerEmail = 'player@example.com';

    const next = jest.fn();
    const request = {
      headers: { 'x-dev-autologin-mode': 'player' },
      query: {},
    } as never;

    requireAuth(request, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
    expect((request as { auth?: { payload?: { sub?: string } } }).auth?.payload?.sub).toBe(
      'dev-player:player@example.com'
    );
  });

  it('uses first admin email when admin mode is active and explicit admin autologin email is missing', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;
    config.auth.adminEmails = ['main-admin@example.com'];

    const next = jest.fn();
    const request = {
      headers: { 'x-dev-autologin-mode': 'admin' },
      query: {},
    } as never;

    requireAuth(request, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect((request as { auth?: { payload?: { sub?: string } } }).auth?.payload?.sub).toBe(
      'dev-admin:main-admin@example.com'
    );
  });

  it('does not apply development autologin for anonymous mode or when bearer token exists', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;

    const nextAnonymous = jest.fn();
    requireAuth(
      {
        headers: { 'x-dev-autologin-mode': 'anonymous' },
        query: {},
      } as never,
      {} as never,
      nextAnonymous
    );
    expect(auth).toHaveBeenCalledTimes(1);
    expect(nextAnonymous).toHaveBeenCalled();

    const nextBearer = jest.fn();
    requireAuth(
      {
        headers: {
          'x-dev-autologin-mode': 'player',
          authorization: 'Bearer abc',
        },
        query: {},
      } as never,
      {} as never,
      nextBearer
    );
    expect(auth).toHaveBeenCalledTimes(2);
    expect(nextBearer).toHaveBeenCalled();
  });

  it('falls back to configured auth when admin autologin mode has no resolvable email', () => {
    config.isDevelopment = true;
    config.auth.enabled = true;
    config.auth.devAutoLoginEnabled = true;
    config.auth.adminEmails = [];
    delete config.auth.devAutoLoginAdminEmail;

    const authNext = jest.fn();
    const next = jest.fn();
    (auth as jest.Mock).mockImplementationOnce(
      () => (_request: unknown, _response: unknown, innerNext: () => void) => {
        authNext();
        innerNext();
      }
    );

    const request = {
      headers: { 'x-dev-autologin-mode': 'admin' },
      query: {},
    } as never;

    requireAuth(request, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect(authNext).toHaveBeenCalled();
    expect((request as { auth?: unknown }).auth).toBeUndefined();
  });
});
