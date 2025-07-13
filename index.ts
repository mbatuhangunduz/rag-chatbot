import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import pdf from 'pdf-parse';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

// Types
interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page: number;
    chunkIndex: number;
    timestamp: Date;
  };
}

interface QueryRequest {
  question: string;
  maxResults?: number;
  includeSource?: boolean;
}

interface QueryResponse {
  answer: string;
  sources: Array<{
    document: string;
    page: number;
    relevanceScore: number;
    excerpt: string;
  }>;
  confidence: number;
  timestamp: Date;
}

class MedicalDeviceRAGChatbot {
  private app: express.Application;
  private openai: OpenAI;
  private pinecone: Pinecone;
  private vectorIndex: any;
  private documentChunks: Map<string, DocumentChunk> = new Map();
  private isInitialized = false;

  constructor() {
    this.app = express();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });

    this.app.use(limiter);
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Security headers
    this.app.use((req, res, next) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        initialized: this.isInitialized,
        timestamp: new Date().toISOString()
      });
    });

    // Initialize system with PDFs
    this.app.post('/initialize', this.handleInitialize.bind(this));

    // Main query endpoint
    this.app.post('/ask', this.handleQuery.bind(this));

    // Get available documents
    this.app.get('/documents', this.handleGetDocuments.bind(this));

    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  private async handleInitialize(req: express.Request, res: express.Response) {
    try {
      if (this.isInitialized) {
        return res.json({ message: 'System already initialized' });
      }

      // Initialize Pinecone
        this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
      });
  

      this.vectorIndex = this.pinecone.index(process.env.PINECONE_INDEX_NAME!);

      // Process PDFs from the pdfs directory
      const pdfsPath = path.join(__dirname, 'documents');
      if (!fs.existsSync(pdfsPath)) {
        fs.mkdirSync(pdfsPath, { recursive: true });
      }

      const pdfFiles = fs.readdirSync(pdfsPath).filter(file => 
        file.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length === 0) {
        return res.status(400).json({ 
          error: 'No PDF files found in pdfs directory' 
        });
      }

      let processedCount = 0;
      for (const filename of pdfFiles) {
        const filePath = path.join(pdfsPath, filename);
        await this.processPDF(filePath, filename);
        processedCount++;
      }

      this.isInitialized = true;

      res.json({
        message: 'System initialized successfully',
        processedDocuments: processedCount,
        totalChunks: this.documentChunks.size,
        documents: pdfFiles
      });

    } catch (error) {
      console.error('Initialization error:', error);
      res.status(500).json({ 
        error: 'Failed to initialize system',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async processPDF(filePath: string, filename: string) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      
      // Clean and split text into chunks
      const cleanText = this.cleanText(pdfData.text);
      const chunks = this.splitIntoChunks(cleanText, 1000, 200); // 1000 chars with 200 overlap
      
      console.log(`Processing ${filename}: ${chunks.length} chunks`);

      // Process chunks in batches
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await this.processBatch(batch, filename, i);
      }

    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      throw error;
    }
  }

  private async processBatch(chunks: string[], filename: string, startIndex: number) {
    const embeddings = await this.generateEmbeddings(chunks);
    
    const vectors = chunks.map((chunk, index) => {
      const chunkId = crypto.randomUUID();
      const documentChunk: DocumentChunk = {
        id: chunkId,
        content: chunk,
        metadata: {
          source: filename,
          page: Math.floor((startIndex + index) / 5) + 1, // Approximate page
          chunkIndex: startIndex + index,
          timestamp: new Date(),
        }
      };

      this.documentChunks.set(chunkId, documentChunk);

      return {
        id: chunkId,
        values: embeddings[index],
        metadata: {
          source: filename,
          page: documentChunk.metadata.page,
          chunkIndex: documentChunk.metadata.chunkIndex,
          content: chunk.substring(0, 500), // Store first 500 chars in metadata
        }
      };
    });

    // Upload to Pinecone
    await this.vectorIndex.upsert({ vectors });
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,;:!?()]/g, '')
      .trim();
  }

  private splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.substring(start, end);

      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.');
        if (lastSentence > chunk.length * 0.7) {
          chunk = chunk.substring(0, lastSentence + 1);
        }
      }

      chunks.push(chunk.trim());
      start = end - overlap;
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out tiny chunks
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    return response.data.map(item => item.embedding);
  }

  private async handleQuery(req: express.Request, res: express.Response) {
    try {
      if (!this.isInitialized) {
        return res.status(503).json({ 
          error: 'System not initialized. Please call /initialize first.' 
        });
      }

      // Validate input
      const querySchema = z.object({
        question: z.string().min(5).max(500),
        maxResults: z.number().optional().default(5),
        includeSource: z.boolean().optional().default(true),
      });

      const { question, maxResults, includeSource } = querySchema.parse(req.body);

      // Generate embedding for the question
      const questionEmbedding = await this.generateEmbeddings([question]);

      // Search similar chunks
      const searchResponse = await this.vectorIndex.query({
        vector: questionEmbedding[0],
        topK: maxResults * 2, // Get more results for better filtering
        includeMetadata: true,
      });

      if (!searchResponse.matches || searchResponse.matches.length === 0) {
        return res.json({
          answer: 'I could not find relevant information about your question in the medical device manuals.',
          sources: [],
          confidence: 0,
          timestamp: new Date(),
        });
      }

      // Get relevant chunks
      const relevantChunks = searchResponse.matches
        .filter(match => match.score && match.score > 0.7) // Filter by relevance
        .slice(0, maxResults);

      // Build context from relevant chunks
      const context = relevantChunks
        .map(match => {
          const chunk = this.documentChunks.get(match.id!);
          return chunk ? chunk.content : match.metadata?.content || '';
        })
        .join('\n\n');

      // Generate answer using GPT
      const answer = await this.generateAnswer(question, context);

      // Calculate confidence based on relevance scores
      const avgScore = relevantChunks.reduce((sum, match) => 
        sum + (match.score || 0), 0) / relevantChunks.length;

      const response: QueryResponse = {
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

      res.json(response);

    } catch (error) {
      console.error('Query error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async generateAnswer(question: string, context: string): Promise<string> {
    const prompt = `You are a medical device assistant helping healthcare professionals understand medical equipment manuals. 

Context from medical device manuals:
${context}

Question: ${question}

Instructions:
- Answer based ONLY on the provided context from medical device manuals
- If the context doesn't contain relevant information, say so clearly
- Be precise and technical when discussing medical device procedures
- Include specific steps, warnings, or specifications when mentioned in the context
- If discussing safety procedures, emphasize their importance
- Do not make assumptions or provide information not in the context

Answer:`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful medical device assistant. Always base your answers on the provided context and be precise about medical procedures and safety requirements.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || 
           'I apologize, but I could not generate an appropriate response.';
  }

  private async handleGetDocuments(req: express.Request, res: express.Response) {
    try {
      const documents = Array.from(this.documentChunks.values())
        .reduce((acc, chunk) => {
          if (!acc[chunk.metadata.source]) {
            acc[chunk.metadata.source] = {
              name: chunk.metadata.source,
              chunkCount: 0,
              lastUpdated: chunk.metadata.timestamp,
            };
          }
          acc[chunk.metadata.source].chunkCount++;
          return acc;
        }, {} as any);

      res.json({
        documents: Object.values(documents),
        totalChunks: this.documentChunks.size,
        initialized: this.isInitialized,
      });

    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ 
        error: 'Failed to get documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private errorHandler(
    error: Error, 
    req: express.Request, 
    res: express.Response, 
    next: express.NextFunction
  ) {
    console.error('Unhandled error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }

  public async start(port: number = 3000) {
    try {
      this.app.listen(port, () => {
        console.log(`🚀 Medical Device RAG Chatbot API running on port ${port}`);
        console.log(`📚 Place your PDF files in the 'pdfs' directory`);
        console.log(`🔧 Call POST /initialize to process PDFs`);
        console.log(`💬 Call POST /ask to query the system`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const chatbot = new MedicalDeviceRAGChatbot();
chatbot.start(process.env.PORT ? parseInt(process.env.PORT) : 3000);

export default MedicalDeviceRAGChatbot;