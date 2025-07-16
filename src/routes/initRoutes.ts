import { Router } from 'express';
import { InitController } from '../controllers/initController';
import { RAGService } from '../services/ragService';

const router = Router();
const ragService = RAGService.getInstance();
const initController = new InitController(ragService);

router.post('/', initController.initialize.bind(initController));

export { router as initRoutes };