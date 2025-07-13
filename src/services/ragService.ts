import { DocumentProcessor } from './documentProcessor';
import { VectorService } from './vectorService';
import { QueryRequest, QueryResponse, DocumentChunk } from '../types';
import { config } from '../config/config';

export class RAGService {
  private documentProcessor: DocumentProcessor;
  private vectorService: VectorService;
  private isInitialized = false;

  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.vectorService = new VectorService();
  }

  public async initialize(): Promise<{ processedDocuments: number; totalChunks: number; documents: string[] }> {
    if (this.isInitialized) {
      throw new Error('System already initialized');
    }

    // Initialize vector service
    console.log("buradadadadasdasdsadasdas");
    await this.vectorService.initialize();

    // Process PDFs from the documents directory
    const processedFiles = await this.documentProcessor.processPDFsFromDirectory(config.documents.path);
    
    // Process chunks in batches and upload to vector database
    const documentChunks = this.documentProcessor.getDocumentChunks();
    const chunks = Array.from(documentChunks.values());
    console.log("buradayım aşkım");
    
    const batchSize = config.documents.batchSize;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await this.vectorService.processBatch(batch);
    }

    this.isInitialized = true;
    console.log('isInitialized', this.isInitialized)

    return {
      processedDocuments: processedFiles.length,
      totalChunks: documentChunks.size,
      documents: processedFiles
    };
  }

  public async query(request: QueryRequest): Promise<QueryResponse> {
    if (this.isInitialized) {
      throw new Error('System not initialized. Please call initialize first.');
    }
    await this.vectorService.initialize();

    const { question, maxResults = 5, includeSource = true } = request;

    // Search similar chunks
    const matches = await this.vectorService.searchSimilar(question, maxResults * 2);
    console.log('matches.length', matches.length)

    if (matches.length === 0) {
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

    console.log('relevantChunks.length', relevantChunks.length)

    if (relevantChunks.length === 0) {
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
    
    console.log('context', context)

    // Generate answer using GPT
    const answer = await this.vectorService.generateAnswer(question, context);

    // Calculate confidence based on relevance scores
    const avgScore = relevantChunks.reduce((sum, match) => 
      sum + (match.score || 0), 0) / relevantChunks.length;

    return {
      answer,
      sources: includeSource ? relevantChunks.map(match => ({
        document: match.metadata?.source || 'Unknown',
        page: match.metadata?.page || 1,
        relevanceScore: Math.round((match.score || 0) * 100) / 100,
        excerpt: (match.metadata?.content || '').substring(0, 150) + '...',
      })) : [],
      confidence: Math.round(avgScore * 100) / 100,
      timestamp: new Date(),
    };
  }

  public getDocumentStats() {
    return this.documentProcessor.getDocumentStats();
  }

  public isSystemInitialized(): boolean {
    return this.isInitialized;
  }
}