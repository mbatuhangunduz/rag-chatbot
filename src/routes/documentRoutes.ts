import { Router } from 'express';
import { DocumentController } from '../controllers/documentController';
import { RAGService } from '../services/ragService';

const router = Router();
const ragService = RAGService.getInstance();
const documentController = new DocumentController(ragService);

router.get('/', documentController.getDocuments.bind(documentController));

export { router as documentRoutes };