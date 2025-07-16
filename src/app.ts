import express from 'express';
import { setupMiddleware, errorHandler } from './middleware';
import { Routes } from './routes';
import { config } from './config/config';
import logger from './utils/logger';

export class MedicalDeviceRAGChatbot {
  private static instance: MedicalDeviceRAGChatbot;
  private app: express.Application;
  private routes: Routes;

  private constructor() {
    this.app = express();
    this.routes = new Routes();
    logger.info('MedicalDeviceRAGChatbot instance created');
    this.setupApp();
  }

  public static getInstance(): MedicalDeviceRAGChatbot {
    if (!MedicalDeviceRAGChatbot.instance) {
      MedicalDeviceRAGChatbot.instance = new MedicalDeviceRAGChatbot();
    }
    return MedicalDeviceRAGChatbot.instance;
  }

  private setupApp(): void {
    logger.info('Setting up application...');
    
    // Setup middleware
    setupMiddleware(this.app);
    logger.info('Middleware setup completed');

    // Setup routes
    this.routes.setupRoutes(this.app);
    logger.info('Routes setup completed');

    // Error handling middleware (must be last)
    this.app.use(errorHandler);
    logger.info('Error handling middleware setup completed');
  }

  public async start(port: number = config.server.port): Promise<void> {
    try {
      this.app.listen(port, () => {
        logger.info(`Medical Device RAG Chatbot API running on port ${port}`);
        logger.info(`Call POST /initialize to process PDFs`);
        logger.info(`Call POST /ask to query the system`);
        logger.info(`Call GET /documents to see processed documents`);
        logger.info(`Call GET /health to check system status`);
      });
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      process.exit(1);
    }
  }
}

export default MedicalDeviceRAGChatbot;