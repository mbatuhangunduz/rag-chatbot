import { Router } from 'express';
import { HealthController } from '../controllers/healthController';
import { RAGService } from '../services/ragService';

const router = Router();
const ragService = RAGService.getInstance();
const healthController = new HealthController(ragService);

router.get('/', healthController.getHealth.bind(healthController));

export { router as healthRoutes };