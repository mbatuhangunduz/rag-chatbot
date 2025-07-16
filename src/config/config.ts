import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // API Keys
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    embeddingModel: 'text-embedding-3-small',
    chatModel: 'gpt-3.5-turbo',
  },
  
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY!,
    indexName: process.env.PINECONE_INDEX_NAME!,
  },

  // Server config
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Document processing
  documents: {
    path: path.join(__dirname, '../documents'),
    chunkSize: 1000,
    chunkOverlap: 200,
    batchSize: 100,
    minChunkLength: 50,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },

  // Search settings
  search: {
    minRelevanceScore: 0.5,
    maxContextLength: 2000,
    temperature: 0.3,
    maxTokens: 500,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
    logToFile: process.env.LOG_TO_FILE !== 'false',
    maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || '5242880', 10), // 5MB
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES || '5', 10),
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'PINECONE_API_KEY',
  'PINECONE_INDEX_NAME',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}