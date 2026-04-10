import { Request, Response } from 'express';
import { getDB } from '../db';
import slugify from 'slugify';
import * as Diff from 'diff';

export async function createDocument(req: Request, res: Response) {
  try {
    const { title, content, tags, authorName, authorEmail } = req.body;

    if (!title || !content || !authorName || !authorEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDB();
    const collection = db.collection('documents');

    // Generate slug
    let slugCandidate = slugify(title.toLowerCase()).replace(/[^a-z0-9-]/g, '');
    let finalSlug = slugCandidate || `doc-${Math.random().toString(36).substr(2, 9)}`;

    // Ensure uniqueness
    let existing = await collection.findOne({ slug: finalSlug });
    if (existing) {
      finalSlug = `${finalSlug}-${Math.random().toString(36).substr(2, 5)}`;
    }

    const newDoc = {
      slug: finalSlug,
      title,
      content,
      version: 1,
      tags: tags || [],
      metadata: {
        author: {
          id: `user-${Math.random().toString(36).substr(2, 6)}`,
          name: authorName,
          email: authorEmail
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        wordCount: content.split(/\s+/).length
      },
      revision_history: []
    };

    await collection.insertOne(newDoc);
    res.status(201).json(newDoc);
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const db = getDB();
    const collection = db.collection('documents');

    let doc = await collection.findOne({ slug });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Lazy Migration: Check if metadata.author is a string
    if (typeof doc.metadata.author === 'string') {
      const authorName = doc.metadata.author;
      doc.metadata.author = {
        id: null,
        name: authorName,
        email: null
      };
      
      // Update in background (don't await to keep response fast)
      collection.updateOne(
        { _id: doc._id },
        { $set: { 'metadata.author': doc.metadata.author } }
      ).catch(err => console.error('Lazy migration failed for doc:', doc?._id, err));
    }

    res.json(doc);
  } catch (error) {
    console.error('Get error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const db = getDB();
    const collection = db.collection('documents');

    const result = await collection.deleteOne({ slug });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateDocument(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { title, content, version: expectedVersion, tags } = req.body;

    if (expectedVersion === undefined) {
      return res.status(400).json({ error: 'Version is required for OCC' });
    }

    const db = getDB();
    const collection = db.collection('documents');

    const currentDoc = await collection.findOne({ slug });
    if (!currentDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 1. Initial OCC check
    if (currentDoc.version !== expectedVersion) {
      return res.status(409).json({
        error: 'Conflict: Document has been modified by another user',
        currentDocument: currentDoc
      });
    }

    // 2. Generate diff for revision history
    const patch = Diff.createPatch(slug as string, currentDoc.content as string, content as string);

    const revision = {
      version: currentDoc.version,
      updatedAt: new Date(),
      authorId: currentDoc.metadata.author.id || 'unknown',
      contentDiff: patch
    };

    // 3. Atomic update with version check
    const result = await collection.findOneAndUpdate(
      { slug, version: expectedVersion },
      {
        $set: {
          title,
          content,
          tags: tags || currentDoc.tags,
          'metadata.updatedAt': new Date(),
          'metadata.wordCount': content.split(/\s+/).length
        },
        $inc: { version: 1 },
        $push: {
          revision_history: {
            $each: [revision],
            $slice: -20
          }
        }
      } as any,
      { returnDocument: 'after' }
    );

    if (!result) {
      // Double check if it failed due to version change in the microsecond interval
      const latest = await collection.findOne({ slug });
      return res.status(409).json({ 
        error: 'Conflict: The document was updated concurrently.', 
        currentDocument: latest 
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
