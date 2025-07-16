import { Router } from 'express';
import { QueryController } from '../controllers/queryController';
import { RAGService } from '../services/ragService';

const router = Router();
const ragService = RAGService.getInstance();
const queryController = new QueryController(ragService);

router.post('/', queryController.processQuery.bind(queryController));

export { router as queryRoutes };
