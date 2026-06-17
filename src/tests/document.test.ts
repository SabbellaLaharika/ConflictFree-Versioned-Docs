import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../index';
import { connectDB, disconnectDB, getDB } from '../db';

describe('Collaborative Documents API Integration Tests', () => {
  let db: any;
  let testCollection: any;

  beforeAll(async () => {
    db = await connectDB();
    testCollection = db.collection('documents');
  });

  afterAll(async () => {
    // Clean up test documents
    await testCollection.deleteMany({ isTest: true });
    await disconnectDB();
  });

  beforeEach(async () => {
    await testCollection.deleteMany({ isTest: true });
  });

  describe('POST /api/documents', () => {
    it('should create a new document with version 1 and a generated slug', async () => {
      const payload = {
        title: 'Test Document Title',
        content: 'This is the content of the test document.',
        tags: ['test', 'jest'],
        authorName: 'Test Author',
        authorEmail: 'author@test.com'
      };

      const res = await request(app)
        .post('/api/documents')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('slug');
      expect(res.body.title).toBe(payload.title);
      expect(res.body.content).toBe(payload.content);
      expect(res.body.version).toBe(1);
      expect(res.body.tags).toEqual(payload.tags);
      expect(res.body.metadata.author.name).toBe(payload.authorName);
      expect(res.body.metadata.author.email).toBe(payload.authorEmail);
      expect(res.body.revision_history).toEqual([]);

      // Mark document as test for cleanup
      await testCollection.updateOne(
        { slug: res.body.slug },
        { $set: { isTest: true } }
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({
          title: 'Missing content'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/documents/:slug', () => {
    it('should retrieve a single document by its slug', async () => {
      const doc = {
        slug: 'get-test-slug',
        title: 'Get Test Doc',
        content: 'Content here',
        version: 1,
        tags: ['get-test'],
        metadata: {
          author: { id: 'user-1', name: 'Tester', email: 'tester@test.com' },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        revision_history: [],
        isTest: true
      };

      await testCollection.insertOne(doc);

      const res = await request(app)
        .get(`/api/documents/${doc.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(doc.slug);
      expect(res.body.title).toBe(doc.title);
    });

    it('should return 404 for non-existent document slug', async () => {
      const res = await request(app)
        .get('/api/documents/non-existent-slug-12345');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should transparently migrate old schema upon read', async () => {
      const oldDoc = {
        slug: 'old-schema-slug',
        title: 'Old Schema Doc',
        content: 'Old Content',
        version: 1,
        tags: ['legacy'],
        metadata: {
          author: 'Legacy Author Name', // Old schema uses string instead of object
          createdAt: new Date(),
          updatedAt: new Date()
        },
        revision_history: [],
        isTest: true
      };

      await testCollection.insertOne(oldDoc);

      const res = await request(app)
        .get(`/api/documents/${oldDoc.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.metadata.author).toEqual({
        id: null,
        name: 'Legacy Author Name',
        email: null
      });

      // Wait a moment for background update to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Query database directly to confirm migration persisted
      const dbDoc = await testCollection.findOne({ slug: oldDoc.slug });
      expect(dbDoc.metadata.author).toEqual({
        id: null,
        name: 'Legacy Author Name',
        email: null
      });
    });
  });

  describe('PUT /api/documents/:slug (OCC)', () => {
    it('should update successfully when correct version is provided', async () => {
      const doc = {
        slug: 'occ-ok-slug',
        title: 'OCC OK Doc',
        content: 'Initial content',
        version: 5,
        tags: ['occ'],
        metadata: {
          author: { id: 'user-1', name: 'Tester', email: 'tester@test.com' },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        revision_history: [],
        isTest: true
      };

      await testCollection.insertOne(doc);

      const payload = {
        title: 'Updated OCC OK Doc',
        content: 'Updated content',
        version: 5,
        tags: ['occ', 'updated']
      };

      const res = await request(app)
        .put(`/api/documents/${doc.slug}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(6);
      expect(res.body.content).toBe(payload.content);
      expect(res.body.revision_history.length).toBe(1);
      expect(res.body.revision_history[0].version).toBe(5);
      expect(res.body.revision_history[0].contentDiff).toContain('@@');
    });

    it('should return 409 conflict when an outdated version is provided', async () => {
      const doc = {
        slug: 'occ-conflict-slug',
        title: 'OCC Conflict Doc',
        content: 'Initial content',
        version: 5,
        tags: ['occ'],
        metadata: {
          author: { id: 'user-1', name: 'Tester', email: 'tester@test.com' },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        revision_history: [],
        isTest: true
      };

      await testCollection.insertOne(doc);

      const payload = {
        title: 'Updated OCC Conflict Doc',
        content: 'Outdated update',
        version: 4, // Expected is 5, client provides 4
        tags: ['occ']
      };

      const res = await request(app)
        .put(`/api/documents/${doc.slug}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body.currentDocument.version).toBe(5);
      expect(res.body.currentDocument.content).toBe('Initial content');

      // Verify DB document was NOT modified
      const dbDoc = await testCollection.findOne({ slug: doc.slug });
      expect(dbDoc.version).toBe(5);
      expect(dbDoc.content).toBe('Initial content');
    });
  });

  describe('Search and Analytics', () => {
    beforeEach(async () => {
      // Create test data
      const docs = [
        {
          slug: 'search-doc-1',
          title: 'MongoDB Aggregation Guide',
          content: 'This guide describes how to use MongoDB aggregate framework pipelines.',
          version: 1,
          tags: ['mongodb', 'database'],
          metadata: { author: { id: 'u1', name: 'A1', email: 'a1@t.com' }, createdAt: new Date(), updatedAt: new Date() },
          revision_history: [{}, {}, {}], // 3 edits
          isTest: true
        },
        {
          slug: 'search-doc-2',
          title: 'Express Routing tutorial',
          content: 'This tutorial explains Express routing and middlewares.',
          version: 1,
          tags: ['express', 'node'],
          metadata: { author: { id: 'u2', name: 'A2', email: 'a2@t.com' }, createdAt: new Date(), updatedAt: new Date() },
          revision_history: [{}], // 1 edit
          isTest: true
        },
        {
          slug: 'search-doc-3',
          title: 'Advanced MongoDB performance',
          content: 'Learn to index database tables for advanced full-text search.',
          version: 1,
          tags: ['mongodb', 'performance'],
          metadata: { author: { id: 'u3', name: 'A3', email: 'a3@t.com' }, createdAt: new Date(), updatedAt: new Date() },
          revision_history: [{}, {}], // 2 edits
          isTest: true
        }
      ];

      await testCollection.insertMany(docs);
    });

    describe('GET /api/search', () => {
      it('should search documents by text query q', async () => {
        // Wait for text indexes to be updated (since testCollection is filled dynamically)
        // Note: The database already has a text index set up in the seeding logic.
        const res = await request(app)
          .get('/api/search')
          .query({ q: 'MongoDB' });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        // Verify results contain "MongoDB" in title or content
        res.body.forEach((doc: any) => {
          const matched = doc.title.toLowerCase().includes('mongodb') || doc.content.toLowerCase().includes('mongodb');
          expect(matched).toBe(true);
        });
      });

      it('should filter by tags in addition to search query', async () => {
        const res = await request(app)
          .get('/api/search')
          .query({ q: 'MongoDB', tags: 'performance' });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].slug).toBe('search-doc-3');
      });
    });

    describe('GET /api/analytics/most-edited', () => {
      it('should return the top 10 most-edited documents', async () => {
        const res = await request(app)
          .get('/api/analytics/most-edited');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].slug).toBe('search-doc-1'); // 3 edits
        expect(res.body[0].revisionCount).toBe(3);
      });
    });

    describe('GET /api/analytics/tag-cooccurrence', () => {
      it('should calculate tag co-occurrences correctly', async () => {
        const res = await request(app)
          .get('/api/analytics/tag-cooccurrence');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
          // Check format
          expect(res.body[0]).toHaveProperty('tags');
          expect(res.body[0]).toHaveProperty('count');
          expect(Array.isArray(res.body[0].tags)).toBe(true);
          expect(res.body[0].tags.length).toBe(2);
          // Check that tags are sorted alphabetically
          res.body.forEach((item: any) => {
            expect(item.tags[0] < item.tags[1]).toBe(true);
          });
        }
      });
    });
  });
});
