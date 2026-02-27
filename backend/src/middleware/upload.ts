import multer, { StorageEngine } from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { AppError } from './error-handler';
import logger from '../utils/logger';

// Ensure upload directory exists
const ensureUploadDirectory = (): void => {
  if (!fs.existsSync(config.upload.directory)) {
    fs.mkdirSync(config.upload.directory, { recursive: true });
    logger.info('Created upload directory', {
      metadata: {
        directory: config.upload.directory,
      },
    });
  }
};

// Initialize upload directory
ensureUploadDirectory();

// Storage configuration per constitution file handling requirements
const storage: StorageEngine = multer.diskStorage({
  destination: (_request: Request, _file: Express.Multer.File, callback) => {
    // Upload directory is created at startup; keep destination fixed to avoid path traversal.
    // Content length is enforced via Multer limits to cap payload size before writing.
    // eslint-disable-next-line unicorn/no-null
    callback(null, config.upload.directory);
  },
  filename: (_request: Request, file: Express.Multer.File, callback) => {
    // Generate unique filename with timestamp and cryptographic randomness
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    // eslint-disable-next-line unicorn/no-null
    callback(null, filename);
  },
});

// File filter per constitution requirements
const fileFilter = (_request: Request, file: Express.Multer.File, callback: multer.FileFilterCallback): void => {
  // Check MIME type
  if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
    const error = new AppError(
      `Invalid file type. Only ${config.upload.allowedMimeTypes.join(', ')} files are allowed`,
      400,
      'INVALID_FILE_TYPE'
    );
    return callback(error);
  }

  // Check file extension
  const extension = path.extname(file.originalname).toLowerCase();
  if (!config.upload.allowedExtensions.includes(extension)) {
    const error = new AppError(
      `Invalid file extension. Only ${config.upload.allowedExtensions.join(', ')} files are allowed`,
      400,
      'INVALID_FILE_EXTENSION'
    );
    return callback(error);
  }

  // eslint-disable-next-line unicorn/no-null
  callback(null, true);
};

// Multer configuration
// Enforce a conservative upload limit to guard memory/disk usage even if upstream limits are higher.
// Keep this limit aligned with any reverse proxy/body parser caps to prevent oversized payloads.
const maxUploadSize = Math.min(config.upload.maxSize, 5 * 1024 * 1024);
const upload = multer({
  storage,
  fileFilter,
  limits: {
    // Cap content length to a conservative 5MB max (or lower config) to prevent abuse.
    fileSize: maxUploadSize, // 5MB per constitution
    files: 1, // Single file upload for tournament logos
  },
});

// Tournament logo upload middleware
export const uploadTournamentLogo = upload.single('logo');

// Generic file upload middleware
export const uploadSingleFile = (fieldName: string) => upload.single(fieldName);

// Multiple file upload middleware (for future use)
export const uploadMultipleFiles = (fieldName: string, maxCount: number = 5) => 
  upload.array(fieldName, maxCount);

// File validation middleware (additional checks after multer)
export const validateUploadedFile = (request: Request, _response: Response, next: NextFunction): void => {
  const file = request.file;
  
  if (!file) {
    return next(new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED'));
  }

  // Additional file size check (belt and suspenders approach)
  if (file.size > maxUploadSize) {
    // Clean up the uploaded file
    fs.unlink(file.path, (error) => {
      if (error) {
        logger.error('Failed to clean up oversized uploaded file', {
          metadata: {
            filePath: file.path,
            errorMessage: error.message,
          },
        });
      }
    });
    
    return next(new AppError(
      `File too large. Maximum size is ${Math.round(maxUploadSize / 1024 / 1024)}MB`,
      400,
      'FILE_TOO_LARGE'
    ));
  }

  // Validate file exists and is readable
  if (!fs.existsSync(file.path)) {
    return next(new AppError('File upload failed', 500, 'FILE_UPLOAD_FAILED'));
  }

  next();
};

// File cleanup utility
export const cleanupFile = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (error) => {
      if (error) {
        logger.error('Failed to clean up file', {
          metadata: {
            filePath,
            errorMessage: error.message,
          },
        });
      } else {
        logger.debug('Cleaned up file', {
          metadata: {
            filePath,
          },
        });
      }
    });
  }
};

// Get file URL helper
export const getFileUrl = (filename: string): string => {
  return `/uploads/${filename}`;
};

// File type validation for logos specifically
export const validateLogoFile = (request: Request, _response: Response, next: NextFunction): void => {
  const file = request.file;
  
  if (!file) {
    return next();
  }

  // Logo-specific validations
  const allowedLogoTypes = ['image/jpeg', 'image/png'];
  if (!allowedLogoTypes.includes(file.mimetype)) {
    cleanupFile(file.path);
    return next(new AppError(
      'Logo must be a JPEG or PNG image',
      400,
      'INVALID_LOGO_FORMAT'
    ));
  }

  // Check file dimensions (optional - could add image processing here)
  // For now, we'll just ensure it's not empty
  if (file.size === 0) {
    cleanupFile(file.path);
    return next(new AppError(
      'Logo file is empty',
      400,
      'EMPTY_LOGO_FILE'
    ));
  }

  logger.info('Logo uploaded', {
    metadata: {
      fileName: file.originalname,
      sizeKb: Math.round(file.size / 1024),
    },
  });
  next();
};