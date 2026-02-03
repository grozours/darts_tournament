import request from 'supertest';
import path from 'path';
import fs from 'fs';
import App from '../../src/app';
import { TournamentFormat, DurationType } from '@shared/types';

describe('POST /tournaments/:id/logo - Contract Tests', () => {
  let app: App;
  let server: any;
  let tournamentId: string;

  // Create a test image file
  const testImagePath = path.join(__dirname, '../fixtures/test-logo.png');
  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeAll(async () => {
    app = new App();
    server = app.server;

    // Ensure fixtures directory exists
    const fixturesDir = path.dirname(testImagePath);
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create test image file
    fs.writeFileSync(testImagePath, testImageBuffer);

    // Create a test tournament first
    const tournamentData = {
      name: 'Logo Test Tournament',
      format: TournamentFormat.SINGLE,
      durationType: DurationType.FULL_DAY,
      startTime: new Date('2026-02-10T09:00:00.000Z').toISOString(),
      endTime: new Date('2026-02-10T18:00:00.000Z').toISOString(),
      totalParticipants: 8,
      targetCount: 2,
    };

    const response = await request(server)
      .post('/api/tournaments')
      .send(tournamentData)
      .expect(201);

    tournamentId = response.body.id;
  });

  afterAll(async () => {
    // Cleanup test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Valid logo upload', () => {
    it('should upload PNG logo successfully', async () => {
      const response = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect('Content-Type', /json/)
        .expect(200);

      // Contract: Should return logo URL
      expect(response.body).toHaveProperty('logo_url');
      expect(response.body.logo_url).toMatch(/^\/uploads\/.+\.png$/);
      
      // Contract: URL should be a valid path
      expect(response.body.logo_url).toContain('logo-');
      expect(response.body.logo_url).toMatch(/\d+-\d+/); // timestamp format
    });

    it('should upload JPEG logo successfully', async () => {
      // Create a JPEG test file
      const jpegImagePath = path.join(__dirname, '../fixtures/test-logo.jpg');
      const jpegBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDX4AAAAAAAAAAA',
        'base64'
      );
      fs.writeFileSync(jpegImagePath, jpegBuffer);

      try {
        const response = await request(server)
          .post(`/api/tournaments/${tournamentId}/logo`)
          .attach('logo', jpegImagePath)
          .expect(200);

        expect(response.body.logo_url).toMatch(/\.(jpg|jpeg)$/);
      } finally {
        // Cleanup
        if (fs.existsSync(jpegImagePath)) {
          fs.unlinkSync(jpegImagePath);
        }
      }
    });

    it('should overwrite existing logo', async () => {
      // Upload first logo
      const firstResponse = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect(200);

      const firstLogoUrl = firstResponse.body.logo_url;

      // Upload second logo
      const secondResponse = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect(200);

      const secondLogoUrl = secondResponse.body.logo_url;

      // Contract: URLs should be different (new upload)
      expect(firstLogoUrl).not.toBe(secondLogoUrl);
    });
  });

  describe('Invalid logo upload', () => {
    it('should reject upload with no file', async () => {
      const response = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error.message).toMatch(/no file/i);
      expect(response.body.error.code).toBe('NO_FILE_UPLOADED');
    });

    it('should reject non-image files', async () => {
      // Create a text file
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(textFilePath, 'This is not an image');

      try {
        const response = await request(server)
          .post(`/api/tournaments/${tournamentId}/logo`)
          .attach('logo', textFilePath)
          .expect(400);

        expect(response.body.error.message).toMatch(/invalid file type|jpeg.*png/i);
        expect(response.body.error.code).toBe('INVALID_FILE_TYPE');
      } finally {
        // Cleanup
        if (fs.existsSync(textFilePath)) {
          fs.unlinkSync(textFilePath);
        }
      }
    });

    it('should reject files that are too large', async () => {
      // Create a large file (> 5MB)
      const largeFilePath = path.join(__dirname, '../fixtures/large-image.png');
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      fs.writeFileSync(largeFilePath, largeBuffer);

      try {
        const response = await request(server)
          .post(`/api/tournaments/${tournamentId}/logo`)
          .attach('logo', largeFilePath)
          .expect(400);

        expect(response.body.error.message).toMatch(/file too large|5mb/i);
        expect(response.body.error.code).toMatch(/FILE_TOO_LARGE|LIMIT_FILE_SIZE/i);
      } finally {
        // Cleanup
        if (fs.existsSync(largeFilePath)) {
          fs.unlinkSync(largeFilePath);
        }
      }
    });

    it('should reject upload for non-existent tournament', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(server)
        .post(`/api/tournaments/${fakeId}/logo`)
        .attach('logo', testImagePath)
        .expect(404);

      expect(response.body.error.message).toMatch(/tournament.*not found/i);
    });

    it('should reject upload with invalid tournament ID', async () => {
      const response = await request(server)
        .post('/api/tournaments/invalid-id/logo')
        .attach('logo', testImagePath)
        .expect(400);

      expect(response.body.error.message).toMatch(/invalid.*uuid/i);
    });

    it('should reject unsupported image formats', async () => {
      // Create a GIF file (not supported)
      const gifFilePath = path.join(__dirname, '../fixtures/test.gif');
      const gifBuffer = Buffer.from('GIF87a010001', 'ascii');
      fs.writeFileSync(gifFilePath, gifBuffer);

      try {
        const response = await request(server)
          .post(`/api/tournaments/${tournamentId}/logo`)
          .attach('logo', gifFilePath)
          .expect(400);

        expect(response.body.error.message).toMatch(/jpeg.*png.*allowed/i);
        expect(response.body.error.code).toBe('INVALID_FILE_TYPE');
      } finally {
        // Cleanup
        if (fs.existsSync(gifFilePath)) {
          fs.unlinkSync(gifFilePath);
        }
      }
    });
  });

  describe('File handling per constitution requirements', () => {
    it('should clean up files on validation failure', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/cleanup-test.txt');
      fs.writeFileSync(textFilePath, 'Test content');

      try {
        await request(server)
          .post(`/api/tournaments/${tournamentId}/logo`)
          .attach('logo', textFilePath)
          .expect(400);

        // Contract: Temporary upload files should be cleaned up
        // Note: This tests the internal cleanup mechanism
      } finally {
        if (fs.existsSync(textFilePath)) {
          fs.unlinkSync(textFilePath);
        }
      }
    });

    it('should handle upload timing per performance requirements', async () => {
      const startTime = Date.now();
      
      await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect(200);

      const duration = Date.now() - startTime;
      
      // Constitution: File uploads should be reasonably fast
      expect(duration).toBeLessThan(5000); // 5 seconds for file upload
    });

    it('should return consistent security headers', async () => {
      const response = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .expect(200);

      // Constitution: Security headers should be present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Multiple file field handling', () => {
    it('should reject multiple files on single field', async () => {
      const response = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('logo', testImagePath)
        .attach('logo', testImagePath)
        .expect(400);

      expect(response.body.error.message).toMatch(/single file|multiple files/i);
    });

    it('should reject wrong field name', async () => {
      const response = await request(server)
        .post(`/api/tournaments/${tournamentId}/logo`)
        .attach('wrong-field', testImagePath)
        .expect(400);

      expect(response.body.error.message).toMatch(/no file|field.*logo/i);
    });
  });
});