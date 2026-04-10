import { Router } from 'express';
import { createDocument, getDocument, deleteDocument, updateDocument } from './controllers/documentController';
import { searchDocuments, getMostEdited, getTagCooccurrence } from './controllers/analyticsController';

const router = Router();

router.post('/documents', createDocument);
router.get('/documents/:slug', getDocument);
router.put('/documents/:slug', updateDocument);
router.delete('/documents/:slug', deleteDocument);

// Search and Analytics
router.get('/search', searchDocuments);
router.get('/analytics/most-edited', getMostEdited);
router.get('/analytics/tag-cooccurrence', getTagCooccurrence);

export default router;
