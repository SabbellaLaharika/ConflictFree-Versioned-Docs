import { Request, Response } from 'express';
import { getDB } from '../db';

export async function searchDocuments(req: Request, res: Response) {
  try {
    const { q, tags } = req.query;

    const db = getDB();
    const collection = db.collection('documents');

    const query: any = {};

    if (q) {
      query.$text = { $search: q as string };
    }

    if (tags) {
      const tagList = (tags as string).split(',').map(t => t.trim());
      query.tags = { $all: tagList };
    }

    const cursor = collection.find(query);

    if (q) {
      cursor.project({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
    }

    const results = await cursor.toArray();
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getMostEdited(req: Request, res: Response) {
  try {
    const db = getDB();
    const collection = db.collection('documents');

    const pipeline = [
      {
        $project: {
          slug: 1,
          title: 1,
          revisionCount: { $size: '$revision_history' }
        }
      },
      { $sort: { revisionCount: -1 } },
      { $limit: 10 }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    res.json(results);
  } catch (error) {
    console.error('Most edited error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getTagCooccurrence(req: Request, res: Response) {
  try {
    const db = getDB();
    const collection = db.collection('documents');

    // Pipeline as described in requirements:
    // 1. Unwind tags
    // 2. Group by ID to re-collect (per instructions)
    // 3. Unwind again (to create pairs with original)
    // 4. Match and group
    
    const pipeline = [
      // Filter for documents with at least 2 tags to reduce initial set
      { $match: { 'tags.1': { $exists: true } } },
      // Create all unique, sorted pairs of tags within each document
      { $project: {
          pairs: { $setUnion: [ { $map: {
              input: '$tags',
              as: 'tag1',
              in: { $map: {
                  input: '$tags',
                  as: 'tag2',
                  in: { $cond: [ { $lt: ['$$tag1', '$$tag2'] }, ['$$tag1', '$$tag2'], null ] }
              } }
          } } ] }
      } },
      { $unwind: '$pairs' },
      { $unwind: '$pairs' },
      { $match: { pairs: { $ne: null } } },
      // Group by the pair and count occurrences
      { $group: { _id: '$pairs', count: { $sum: 1 } } },
      // Project the array format into the required response structure
      { $project: { _id: 0, tags: '$_id', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    res.json(results);
  } catch (error) {
    console.error('Co-occurrence error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
