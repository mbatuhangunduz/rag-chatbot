import express from 'express';
import { setupMiddleware, errorHandler } from './middleware';
import { Routes } from './routes';
import { config } from './config/config';

export class MedicalDeviceRAGChatbot {
  private app: express.Application;
  private routes: Routes;

  constructor() {
    this.app = express();
    this.routes = new Routes();
    this.setupApp();
  }

  private setupApp(): void {
    // Setup middleware
    setupMiddleware(this.app);

    // Setup routes
    this.routes.setupRoutes(this.app);

    // Error handling middleware (must be last)
    this.app.use(errorHandler);
  }

  public async start(port: number = config.server.port): Promise<void> {
    try {
      this.app.listen(port, () => {
        console.log(`🚀 Medical Device RAG Chatbot API running on port ${port}`);
        console.log(`📚 Place your PDF files in the 'documents' directory`);
        console.log(`🔧 Call POST /initialize to process PDFs`);
        console.log(`💬 Call POST /ask to query the system`);
        console.log(`📄 Call GET /documents to see processed documents`);
        console.log(`❤️  Call GET /health to check system status`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

export default MedicalDeviceRAGChatbot;