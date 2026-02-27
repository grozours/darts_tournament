import { auth } from 'express-oauth2-jwt-bearer';
import { config } from '../../src/config/environment';
import { isAdmin, optionalAuth, requireAdmin } from '../../src/middleware/auth';

jest.mock('express-oauth2-jwt-bearer', () => ({
  auth: jest.fn(() => (_request: unknown, _response: unknown, next: () => void) => next()),
}));

describe('auth middleware', () => {
  const originalAuthEnabled = config.auth.enabled;
  const originalAdminEmails = [...config.auth.adminEmails];
  const originalDevAutoLoginMode = config.auth.devAutoLoginMode;
  const originalDevAutoLoginAdminEmail = config.auth.devAutoLoginAdminEmail;

  beforeEach(() => {
    config.auth.enabled = false;
    config.auth.adminEmails = [];
    delete config.auth.devAutoLoginMode;
    delete config.auth.devAutoLoginAdminEmail;
  });

  afterAll(() => {
    config.auth.enabled = originalAuthEnabled;
    config.auth.adminEmails = originalAdminEmails;
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
    const originalIsDevelopment = config.isDevelopment;
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
});
