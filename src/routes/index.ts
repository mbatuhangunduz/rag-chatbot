import { Application } from 'express';
import { healthRoutes } from './healthRoutes';
import { initRoutes } from './initRoutes';
import { queryRoutes } from './queryRoutes';
import { documentRoutes } from './documentRoutes';
import logger from '../utils/logger';

export class Routes {
  public setupRoutes(app: Application): void {
    logger.info('Setting up API routes...');

    // Health check endpoint
    app.use('/health', healthRoutes);

    // Initialize system with PDFs
    app.use('/initialize', initRoutes);

    // Main query endpoint
    app.use('/ask', queryRoutes);

    // Document management endpoints
    app.use('/documents', documentRoutes);

    // API info endpoint
    app.get('/', (req, res) => {
      logger.info('API info endpoint accessed');
      res.json({
        message: 'Medical Device RAG Chatbot API',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          initialize: 'POST /initialize',
          query: 'POST /ask',
          documents: 'GET /documents',
          documentById: 'GET /documents/:id'
        },
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      logger.warn(`404 - Endpoint not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.originalUrl} was not found.`,
        availableEndpoints: [
          'GET /health',
          'POST /initialize', 
          'POST /ask',
          'GET /documents',
          'GET /documents/:id'
        ]
      });
    });
    logger.info('API routes setup completed');
  }
}