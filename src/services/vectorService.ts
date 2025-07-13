import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { DocumentChunk } from '../types';
import { config } from '../config/config';

export class VectorService {
  private openai: OpenAI;
  private pinecone!: Pinecone;
  private vectorIndex: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  public async initialize(): Promise<void> {
    this.pinecone = new Pinecone({
      apiKey: config.pinecone.apiKey
    });

    this.vectorIndex = this.pinecone.index(config.pinecone.indexName);
    console.log('Vector index initialized:', !!this.vectorIndex);

  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: texts,
    });

    return response.data.map(item => item.embedding);
  }

  public async processBatch(chunks: DocumentChunk[]): Promise<void> {
    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await this.generateEmbeddings(texts);
    const vectors = chunks.map((chunk, index) => ({
      id: chunk.id,
      values: embeddings[index],
      metadata: {
        source: chunk.metadata.source,
        page: chunk.metadata.page,
        chunkIndex: chunk.metadata.chunkIndex,
        content: chunk.content.substring(0, 500), // Store first 500 chars in metadata
      }
    }));

    // Upload to Pinecone
    await this.vectorIndex.upsert( vectors );
  }

  public async detectSourceFromQuestion(question: string): Promise<string | null> {
    const lower = question.toLowerCase();
  
    if (lower.includes("centurion") || lower.includes("alcon")) {
      return "Alcon_Centurion_Vision_System_Operator_s_Manual.pdf";
    } else if (lower.includes("karl storz") || lower.includes("endoscope") || lower.includes("equimat")) {
      return "Karl_Storz_-_Endoscope.pdf";
    } else if (lower.includes("zeiss") || lower.includes("opmi") || lower.includes("pentero")) {
      return "Zeiss_OPMI_Pentero.pdf";
    }
  
    return null; // fallback: tüm kaynaklarda ara
  }

  public async searchSimilar(
    query: string, 
    topK: number = 10
  ): Promise<any[]> {
    const queryEmbedding = await this.generateEmbeddings([query]);
    
    const searchResponse = await this.vectorIndex.query({
      vector: queryEmbedding[0],
      topK,
      includeMetadata: true,
    });

    return searchResponse.matches || [];
  }

  public async generateAnswer(question: string, context: string): Promise<string> {
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
      model: config.openai.chatModel,
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
      temperature: config.search.temperature,
      max_tokens: config.search.maxTokens,
    });

    return response.choices[0]?.message?.content || 
           'I apologize, but I could not generate an appropriate response.';
  }
}