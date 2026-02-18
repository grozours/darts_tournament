jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlink: jest.fn((_: unknown, callback?: (error: Error | null) => void) => {
    if (callback) {
      callback(null);
    }
  }),
}));

const loadUploadModule = () => {
  let moduleExports: typeof import('../../src/middleware/upload');
  jest.isolateModules(() => {
    moduleExports = require('../../src/middleware/upload');
  });
  return moduleExports!;
};

describe('upload middleware helpers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('builds upload urls', () => {
    const { getFileUrl } = loadUploadModule();

    expect(getFileUrl('logo.png')).toBe('/uploads/logo.png');
  });

  it('cleans up files when present', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; unlink: jest.Mock };
    fs.existsSync.mockReturnValue(true);

    const { cleanupFile } = loadUploadModule();

    cleanupFile('/tmp/logo.png');

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/logo.png', expect.any(Function));
  });

  it('reports missing files during validation', () => {
    const { validateUploadedFile } = loadUploadModule();
    const next = jest.fn();

    validateUploadedFile({} as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('NO_FILE_UPLOADED');
  });

  it('rejects oversized uploads', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; unlink: jest.Mock };
    fs.existsSync.mockReturnValue(true);

    const { validateUploadedFile } = loadUploadModule();
    const next = jest.fn();

    validateUploadedFile(
      {
        file: {
          size: Number.MAX_SAFE_INTEGER,
          path: '/tmp/big.png',
        },
      } as never,
      {} as never,
      next
    );

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/big.png', expect.any(Function));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects missing uploaded file paths', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock };
    fs.existsSync.mockReturnValue(false);

    const { validateUploadedFile } = loadUploadModule();
    const next = jest.fn();

    validateUploadedFile(
      {
        file: {
          size: 10,
          path: '/tmp/missing.png',
        },
      } as never,
      {} as never,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('FILE_UPLOAD_FAILED');
  });

  it('accepts valid uploaded files', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock };
    fs.existsSync.mockReturnValue(true);

    const { validateUploadedFile } = loadUploadModule();
    const next = jest.fn();

    validateUploadedFile(
      {
        file: {
          size: 10,
          path: '/tmp/ok.png',
        },
      } as never,
      {} as never,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('skips logo validation when no file exists', () => {
    const { validateLogoFile } = loadUploadModule();
    const next = jest.fn();

    validateLogoFile({} as never, {} as never, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects invalid logo mime types', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; unlink: jest.Mock };
    fs.existsSync.mockReturnValue(true);

    const { validateLogoFile } = loadUploadModule();
    const next = jest.fn();

    validateLogoFile(
      {
        file: {
          mimetype: 'image/gif',
          path: '/tmp/logo.gif',
          size: 100,
          originalname: 'logo.gif',
        },
      } as never,
      {} as never,
      next
    );

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/logo.gif', expect.any(Function));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('INVALID_LOGO_FORMAT');
  });

  it('rejects empty logo uploads', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; unlink: jest.Mock };
    fs.existsSync.mockReturnValue(true);

    const { validateLogoFile } = loadUploadModule();
    const next = jest.fn();

    validateLogoFile(
      {
        file: {
          mimetype: 'image/png',
          path: '/tmp/logo.png',
          size: 0,
          originalname: 'logo.png',
        },
      } as never,
      {} as never,
      next
    );

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/logo.png', expect.any(Function));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('EMPTY_LOGO_FILE');
  });

  it('accepts valid logo uploads', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock };
    fs.existsSync.mockReturnValue(true);

    const { validateLogoFile } = loadUploadModule();
    const next = jest.fn();

    validateLogoFile(
      {
        file: {
          mimetype: 'image/png',
          path: '/tmp/logo.png',
          size: 100,
          originalname: 'logo.png',
        },
      } as never,
      {} as never,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });
});
