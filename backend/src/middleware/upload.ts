import multer, { StorageEngine } from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { AppError } from './errorHandler';

// Ensure upload directory exists
const ensureUploadDir = (): void => {
  if (!fs.existsSync(config.upload.directory)) {
    fs.mkdirSync(config.upload.directory, { recursive: true });
    console.log(`📁 Created upload directory: ${config.upload.directory}`);
  }
};

// Initialize upload directory
ensureUploadDir();

// Storage configuration per constitution file handling requirements
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, config.upload.directory);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// File filter per constitution requirements
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  // Check MIME type
  if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
    const error = new AppError(
      `Invalid file type. Only ${config.upload.allowedMimeTypes.join(', ')} files are allowed`,
      400,
      'INVALID_FILE_TYPE'
    );
    return cb(error);
  }

  // Check file extension
  const extension = path.extname(file.originalname).toLowerCase();
  if (!config.upload.allowedExtensions.includes(extension)) {
    const error = new AppError(
      `Invalid file extension. Only ${config.upload.allowedExtensions.join(', ')} files are allowed`,
      400,
      'INVALID_FILE_EXTENSION'
    );
    return cb(error);
  }

  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize, // 5MB per constitution
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
export const validateUploadedFile = (req: Request, res: Response, next: NextFunction): void => {
  const file = req.file;
  
  if (!file) {
    return next(new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED'));
  }

  // Additional file size check (belt and suspenders approach)
  if (file.size > config.upload.maxSize) {
    // Clean up the uploaded file
    fs.unlink(file.path, (err) => {
      if (err) console.error('Error cleaning up oversized file:', err);
    });
    
    return next(new AppError(
      `File too large. Maximum size is ${Math.round(config.upload.maxSize / 1024 / 1024)}MB`,
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
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error cleaning up file:', err);
      } else {
        console.log('🗑️  Cleaned up file:', filePath);
      }
    });
  }
};

// Get file URL helper
export const getFileUrl = (filename: string): string => {
  return `/uploads/${filename}`;
};

// File type validation for logos specifically
export const validateLogoFile = (req: Request, res: Response, next: NextFunction): void => {
  const file = req.file;
  
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

  console.log(`📷 Logo uploaded: ${file.originalname} (${Math.round(file.size / 1024)}KB)`);
  next();
};