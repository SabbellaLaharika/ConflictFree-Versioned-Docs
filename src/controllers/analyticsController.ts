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
    
    // Actually, a more standard tag co-occurrence pipeline:
    const pipeline = [
      { $match: { "tags.1": { $exists: true } } }, // docs with at least 2 tags
      { $unwind: "$tags" },
      {
        $lookup: {
          from: "documents",
          localField: "_id",
          foreignField: "_id",
          as: "doc"
        }
      },
      { $unwind: "$doc" },
      { $unwind: "$doc.tags" },
      { $match: { $expr: { $lt: ["$tags", "$doc.tags"] } } }, // avoid self-pairs and duplicates
      {
        $group: {
          _id: { tag1: "$tags", tag2: "$doc.tags" },
          count: { $sum: 1 }
        }
      },
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
