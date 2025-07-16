import { DocumentProcessor } from './documentProcessor';
import { VectorService } from './vectorService';
import { QueryRequest, QueryResponse, DocumentChunk } from '../types';
import { config } from '../config/config';
import logger from '../utils/logger';

export class RAGService {
  private static instance: RAGService;
  private documentProcessor: DocumentProcessor;
  private vectorService: VectorService;
  private isInitialized = false;

  private constructor() {
    this.documentProcessor = DocumentProcessor.getInstance();
    this.vectorService = VectorService.getInstance();
    logger.info('RAGService instance created');
  }

  public static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  public async initialize(): Promise<{ processedDocuments?: number; totalChunks: number; documents?: string[] }> {
    try {
      logger.info('Starting RAG Service initialization...');
      
      // Ensure index exists and is ready
      await this.vectorService.ensureIndexExists();
      
      // Initialize vector service (prepare vectorIndex for use)
      await this.vectorService.initialize();
  
      // Check if index already has data
      const indexStats = await this.vectorService.getIndexStats();
      const existingVectorCount = indexStats.totalRecordCount || 0;
      
      if (existingVectorCount > 0) {
        logger.info(`Index already contains ${existingVectorCount} vectors. Skipping upload.`);
        this.isInitialized = true;
        
        // Return existing stats
        return {
          totalChunks: indexStats.totalRecordCount,
        };
      }

      logger.info('Processing documents from directory...');
      // Process only if index is empty
      const processedFiles = await this.documentProcessor.processPDFsFromDirectory(config.documents.path);
      logger.info(`Processed ${processedFiles.length} PDF files`);
      
      // Get document chunks
      const documentChunks = this.documentProcessor.getDocumentChunks();
      logger.info(`Generated ${documentChunks.size} document chunks`);
      
      if (documentChunks.size === 0) {
        logger.warn('No chunks to process');
        this.isInitialized = true;
        return {
          processedDocuments: processedFiles.length,
          totalChunks: 0,
          documents: processedFiles
        };
      }
      
      // Process chunks in batches
      const chunks = Array.from(documentChunks.values());
      const batchSize = config.documents.batchSize;
      
      logger.info(`Processing ${chunks.length} chunks in batches of ${batchSize}`);
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(chunks.length / batchSize);
        
        logger.info(`Processing batch ${batchNumber}/${totalBatches}`);
        await this.vectorService.processBatch(batch);
      }
  
      this.isInitialized = true;
      logger.info('RAG Service initialization completed successfully');
  
      return {
        processedDocuments: processedFiles.length,
        totalChunks: documentChunks.size,
        documents: processedFiles
      };
      
    } catch (error) {
      logger.error(`Error during RAG initialization: ${error}`);
      this.isInitialized = false;
      throw error;
    }
  }

  public async query(request: QueryRequest): Promise<QueryResponse> {
    try {
      if (!this.isInitialized) {
        const error = 'System not initialized. Please call initialize first.';
        logger.error(error);
        throw new Error(error);
      }

      logger.info(`Processing query: ${request.question.substring(0, 50)}...`);
      
      await this.vectorService.initialize();

      const { question, maxResults = 5, includeSource = true } = request;

      const sourceFilter = (await this.vectorService.detectSourceFromQuestion(question)) ?? undefined;
      
      // Search similar chunks
      const matches = await this.vectorService.searchSimilar(question, maxResults * 2, sourceFilter);
      logger.info(`Found ${matches.length} initial matches`);

      if (matches.length === 0) {
        logger.warn('No matches found for query');
        return {
          answer: 'I could not find relevant information about your question in the medical device manuals.',
          sources: [],
          confidence: 0,
          timestamp: new Date(),
        };
      }

      // Filter by relevance score
      const relevantChunks = matches
        .filter(match => match.score && match.score > config.search.minRelevanceScore)
        .slice(0, maxResults);

      logger.info(`Filtered to ${relevantChunks.length} relevant chunks (min score: ${config.search.minRelevanceScore})`);

      if (relevantChunks.length === 0) {
        logger.warn('No sufficiently relevant chunks found');
        return {
          answer: 'I could not find sufficiently relevant information about your question in the medical device manuals.',
          sources: [],
          confidence: 0,
          timestamp: new Date(),
        };
      }

      // Build context from relevant chunks
      const context = relevantChunks
        .map(match => {
          const documentChunks = this.documentProcessor.getDocumentChunks();
          const chunk = documentChunks.get(match.id!);
          return chunk ? chunk.content : match.metadata?.content || '';
        })
        .join('\n\n');
      
      logger.debug(`Built context with ${context.length} characters`);

      // Generate answer using GPT
      const answer = await this.vectorService.generateAnswer(question, context);

      // Calculate confidence based on relevance scores
      const avgScore = relevantChunks.reduce((sum, match) => 
        sum + (match.score || 0), 0) / relevantChunks.length;

      const confidence = Math.round(avgScore * 100) / 100;
      
      logger.info(`Query completed successfully with confidence: ${confidence}`);

      return {
        answer,
        sources: includeSource ? relevantChunks.map(match => ({
          document: match.metadata?.source || 'Unknown',
          page: match.metadata?.page || 1,
          relevanceScore: Math.round((match.score || 0) * 100) / 100,
          excerpt: (match.metadata?.content || '').substring(0, 150) + '...',
        })) : [],
        confidence,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`Error processing query: ${error}`);
      throw error;
    }
  }

  public getDocumentStats() {
    try {
      const stats = this.documentProcessor.getDocumentStats();
      logger.debug(`Document stats retrieved: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      logger.error(`Error getting document stats: ${error}`);
      throw error;
    }
  }

  public async isSystemInitialized(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        logger.debug('System is already initialized');
        return true;
      }
      
      const stats = await this.vectorService.getIndexStats();
      this.isInitialized = stats.totalRecordCount > 0;
      
      logger.info(`System initialization check: ${this.isInitialized ? 'initialized' : 'not initialized'}`);
      return this.isInitialized;
    } catch (error) {
      logger.error(`Error checking system initialization: ${error}`);
      return false;
    }
  }
}