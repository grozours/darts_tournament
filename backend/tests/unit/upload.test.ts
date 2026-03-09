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
  let moduleExports: typeof import('../../src/middleware/upload') | undefined;
  jest.isolateModules(() => {
    moduleExports = require('../../src/middleware/upload');
  });

  if (!moduleExports) {
    throw new Error('Unable to load upload middleware module');
  }

  return moduleExports;
};

const loadUploadModuleWithMockedMulter = () => {
  const singleMiddleware = jest.fn((_request: unknown, _response: unknown, next: (error?: unknown) => void) => next());
  const arrayMiddleware = jest.fn((_request: unknown, _response: unknown, next: (error?: unknown) => void) => next());
  const single = jest.fn((_fieldName: string) => singleMiddleware);
  const array = jest.fn((_fieldName: string, _maxCount: number) => arrayMiddleware);

  const multerFactory = jest.fn((_options: unknown) => ({
    single,
    array,
  }));

  const diskStorage = jest.fn((options: unknown) => options);
  (multerFactory as unknown as { diskStorage: jest.Mock }).diskStorage = diskStorage;

  let moduleExports: typeof import('../../src/middleware/upload') | undefined;
  jest.isolateModules(() => {
    jest.doMock('multer', () => multerFactory);
    moduleExports = require('../../src/middleware/upload');
  });

  if (!moduleExports) {
    throw new Error('Unable to load upload middleware module with mocked multer');
  }

  return {
    moduleExports,
    multerFactory,
    single,
    array,
    diskStorage,
  };
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

  it('creates upload directory on startup when missing', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; mkdirSync: jest.Mock };
    fs.existsSync.mockReturnValue(false);

    loadUploadModule();

    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('rejects chunked uploads before multer middleware', () => {
    const { moduleExports, single } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    moduleExports.uploadTournamentLogo(
      {
        headers: {
          'transfer-encoding': 'chunked',
          'content-length': '100',
        },
      } as never,
      {} as never,
      next
    );

    expect(single).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('CONTENT_LENGTH_REQUIRED');
  });

  it('rejects missing content-length header before multer middleware', () => {
    const { moduleExports, single } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    moduleExports.uploadTournamentLogo(
      {
        headers: {},
      } as never,
      {} as never,
      next
    );

    expect(single).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('CONTENT_LENGTH_REQUIRED');
  });

  it('rejects non numeric content-length values', () => {
    const { moduleExports, single } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    moduleExports.uploadTournamentLogo(
      {
        headers: {
          'content-length': '12x',
        },
      } as never,
      {} as never,
      next
    );

    expect(single).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('INVALID_CONTENT_LENGTH');
  });

  it('rejects too large content-length values', () => {
    const { moduleExports, single } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    moduleExports.uploadTournamentLogo(
      {
        headers: {
          'content-length': `${6 * 1024 * 1024}`,
        },
      } as never,
      {} as never,
      next
    );

    expect(single).not.toHaveBeenCalled();
    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('FILE_TOO_LARGE');
  });

  it('delegates logo upload middleware when content-length is valid', () => {
    const { moduleExports, single } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    moduleExports.uploadTournamentLogo(
      {
        headers: {
          'content-length': '1024',
        },
      } as never,
      {} as never,
      next
    );

    expect(single).toHaveBeenCalledWith('logo');
    expect(next).toHaveBeenCalledWith();
  });

  it('delegates single upload middleware when content-length is valid', () => {
    const { moduleExports, single } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    const middleware = moduleExports.uploadSingleFile('document');
    middleware(
      {
        headers: {
          'content-length': '1024',
        },
      } as never,
      {} as never,
      next
    );

    expect(single).toHaveBeenCalledWith('document');
    expect(next).toHaveBeenCalledWith();
  });

  it('delegates array upload middleware when content-length is valid', () => {
    const { moduleExports, array } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    const middleware = moduleExports.uploadMultipleFiles('attachments', 3);
    middleware(
      {
        headers: {
          'content-length': '2048',
        },
      } as never,
      {} as never,
      next
    );

    expect(array).toHaveBeenCalledWith('attachments', 3);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns guard errors for single upload middleware', () => {
    const { moduleExports } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    const middleware = moduleExports.uploadSingleFile('document');
    middleware(
      {
        headers: {
          'content-length': '1z',
        },
      } as never,
      {} as never,
      next
    );

    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('INVALID_CONTENT_LENGTH');
  });

  it('returns guard errors for multiple upload middleware', () => {
    const { moduleExports } = loadUploadModuleWithMockedMulter();
    const next = jest.fn();

    const middleware = moduleExports.uploadMultipleFiles('attachments', 2);
    middleware(
      {
        headers: {
          'transfer-encoding': 'chunked',
          'content-length': '1024',
        },
      } as never,
      {} as never,
      next
    );

    const error = next.mock.calls[0][0] as { code?: string };
    expect(error.code).toBe('CONTENT_LENGTH_REQUIRED');
  });

  it('validates storage destination and filename callbacks', () => {
    const { diskStorage } = loadUploadModuleWithMockedMulter();
    const storageCall = diskStorage.mock.calls[0];
    if (!storageCall) {
      throw new Error('Missing diskStorage call');
    }

    const storageOptions = storageCall[0] as {
      destination: (request: unknown, file: unknown, callback: (error: unknown, destination: string) => void) => void;
      filename: (request: unknown, file: { fieldname: string; originalname: string }, callback: (error: unknown, name: string) => void) => void;
    };

    const destinationCallback = jest.fn();
    storageOptions.destination(
      {
        headers: {
          'content-length': '300',
        },
      },
      {},
      destinationCallback
    );
    expect(destinationCallback).toHaveBeenCalledWith(null, expect.any(String));

    const invalidDestinationCallback = jest.fn();
    storageOptions.destination(
      {
        headers: {
          'content-length': 'abc',
        },
      },
      {},
      invalidDestinationCallback
    );
    const destinationError = invalidDestinationCallback.mock.calls[0][0] as { code?: string };
    expect(destinationError.code).toBe('INVALID_CONTENT_LENGTH');

    const filenameCallback = jest.fn();
    storageOptions.filename(
      {},
      {
        fieldname: 'logo',
        originalname: 'team.png',
      },
      filenameCallback
    );
    expect(filenameCallback).toHaveBeenCalledWith(null, expect.stringMatching(/^logo-/));
  });

  it('validates fileFilter mime type and extension branches', () => {
    const { multerFactory } = loadUploadModuleWithMockedMulter();
    const multerCall = multerFactory.mock.calls[0];
    if (!multerCall) {
      throw new Error('Missing multer initialization call');
    }

    const multerOptions = multerCall[0] as {
      fileFilter: (
        request: unknown,
        file: { mimetype: string; originalname: string },
        callback: (error: unknown, accepted?: boolean) => void
      ) => void;
    };

    const mimeCallback = jest.fn();
    multerOptions.fileFilter(
      {},
      {
        mimetype: 'image/gif',
        originalname: 'logo.gif',
      },
      mimeCallback
    );
    const mimeError = mimeCallback.mock.calls[0][0] as { code?: string };
    expect(mimeError.code).toBe('INVALID_FILE_TYPE');

    const extensionCallback = jest.fn();
    multerOptions.fileFilter(
      {},
      {
        mimetype: 'image/png',
        originalname: 'logo.exe',
      },
      extensionCallback
    );
    const extensionError = extensionCallback.mock.calls[0][0] as { code?: string };
    expect(extensionError.code).toBe('INVALID_FILE_EXTENSION');

    const okCallback = jest.fn();
    multerOptions.fileFilter(
      {},
      {
        mimetype: 'image/png',
        originalname: 'logo.png',
      },
      okCallback
    );
    expect(okCallback).toHaveBeenCalledWith(null, true);
  });

  it('handles fs unlink errors while cleaning oversized uploads', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; unlink: jest.Mock };
    fs.existsSync.mockReturnValue(true);
    fs.unlink.mockImplementationOnce((_: unknown, callback?: (error: Error | null) => void) => {
      if (callback) {
        callback(new Error('unlink failed'));
      }
    });

    const { validateUploadedFile } = loadUploadModule();
    const next = jest.fn();

    validateUploadedFile(
      {
        file: {
          size: Number.MAX_SAFE_INTEGER,
          path: '/tmp/unlink-error.png',
        },
      } as never,
      {} as never,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('handles fs unlink errors while cleaning up files', () => {
    const fs = require('node:fs') as { existsSync: jest.Mock; unlink: jest.Mock };
    fs.existsSync.mockReturnValue(true);
    fs.unlink.mockImplementationOnce((_: unknown, callback?: (error: Error | null) => void) => {
      if (callback) {
        callback(new Error('cleanup failed'));
      }
    });

    const { cleanupFile } = loadUploadModule();
    cleanupFile('/tmp/cleanup-error.png');

    expect(fs.unlink).toHaveBeenCalledWith('/tmp/cleanup-error.png', expect.any(Function));
  });
});
