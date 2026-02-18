import { auth } from 'express-oauth2-jwt-bearer';
import { config } from '../../src/config/environment';
import { isAdmin, optionalAuth, requireAdmin } from '../../src/middleware/auth';

jest.mock('express-oauth2-jwt-bearer', () => ({
  auth: jest.fn(() => (_request: unknown, _response: unknown, next: () => void) => next()),
}));

describe('auth middleware', () => {
  const originalAuthEnabled = config.auth.enabled;
  const originalAdminEmails = [...config.auth.adminEmails];

  beforeEach(() => {
    config.auth.enabled = false;
    config.auth.adminEmails = [];
  });

  afterAll(() => {
    config.auth.enabled = originalAuthEnabled;
    config.auth.adminEmails = originalAdminEmails;
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
});
