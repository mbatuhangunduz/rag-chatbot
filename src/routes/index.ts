import express from 'express';
import { z } from 'zod';
import { RAGService } from '../services/ragService';

export class Routes {
  private ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
  }

  public setupRoutes(app: express.Application): void {
    // Health check
    app.get('/health', this.handleHealthCheck.bind(this));

    // Initialize system with PDFs
    app.post('/initialize', this.handleInitialize.bind(this));

    // Main query endpoint
    app.post('/ask', this.handleQuery.bind(this));

    // Get available documents
    app.get('/documents', this.handleGetDocuments.bind(this));
  }

  private handleHealthCheck(req: express.Request, res: express.Response): void {
    res.json({ 
      status: 'healthy', 
      initialized: this.ragService.isSystemInitialized(),
      timestamp: new Date().toISOString()
    });
  }

  private async handleInitialize(req: express.Request, res: express.Response): Promise<void> {
    try {
      const result = await this.ragService.initialize();
      res.json({
        message: 'System initialized successfully',
        ...result
      });
    } catch (error) {
      console.error('Initialization error:', error);
      
      if (error instanceof Error && error.message === 'System already initialized') {
        res.json({ message: 'System already initialized' });
        return;
      }
      
      res.status(500).json({ 
        error: 'Failed to initialize system',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleQuery(req: express.Request, res: express.Response): Promise<void> {
    try {
      if (this.ragService.isSystemInitialized()) {
        res.status(503).json({ 
          error: 'System not initialized. Please call /initialize first.' 
        });
        return;
      }

      // Validate input
      const querySchema = z.object({
        question: z.string().min(5).max(500),
        maxResults: z.number().optional().default(5),
        includeSource: z.boolean().optional().default(true),
      });

      const queryRequest = querySchema.parse(req.body);
      const response = await this.ragService.query(queryRequest);

      res.json(response);

    } catch (error) {
      console.error('Query error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Invalid input',
          details: error.errors 
        });
        return;
      }
      
      res.status(500).json({ 
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private handleGetDocuments(req: express.Request, res: express.Response): void {
    try {
      const stats = this.ragService.getDocumentStats();
      res.json({
        ...stats,
        initialized: this.ragService.isSystemInitialized(),
      });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ 
        error: 'Failed to get documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}