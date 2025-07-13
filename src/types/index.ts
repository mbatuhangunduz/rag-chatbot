export interface DocumentChunk {
    id: string;
    content: string;
    metadata: {
      source: string;
      page: number;
      chunkIndex: number;
      timestamp: Date;
    };
  }
  
  export interface QueryRequest {
    question: string;
    maxResults?: number;
    includeSource?: boolean;
  }
  
  export interface QueryResponse {
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
  
  export interface DocumentInfo {
    name: string;
    chunkCount: number;
    lastUpdated: Date;
  }