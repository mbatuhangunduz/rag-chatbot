import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { DocumentChunk } from "../types";
import { config } from "../config/config";
import logger from "../utils/logger";

export class VectorService {
  private static instance: VectorService;
  private openai: OpenAI;
  private pinecone: Pinecone;
  private vectorIndex: any;
  private isInitialized = false;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.pinecone = new Pinecone({
      apiKey: config.pinecone.apiKey,
    });

    logger.info("VectorService instance created");
  }

  public static getInstance(): VectorService {
    if (!VectorService.instance) {
      VectorService.instance = new VectorService();
    }
    return VectorService.instance;
  }

  public async getIndexStats(): Promise<any> {
    try {
      if (!this.vectorIndex) {
        this.vectorIndex = this.pinecone.index(config.pinecone.indexName);
      }

      const stats = await this.vectorIndex.describeIndexStats();
      logger.info(`Index stats retrieved: ${stats.totalRecordCount} vectors`);
      return stats;
    } catch (error) {
      logger.error(`Error getting index stats: ${error}`);
      throw error;
    }
  }

  public async initialize(): Promise<void> {
    try {
      this.vectorIndex = this.pinecone.index(config.pinecone.indexName);
      this.isInitialized = true;
      logger.info(`Vector index initialized: ${config.pinecone.indexName}`);
    } catch (error) {
      logger.error(`Error initializing vector index: ${error}`);
      throw error;
    }
  }

  public async ensureIndexExists(): Promise<void> {
    try {
      logger.info("Checking if index exists...");

      // Check if the index already exists
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(
        (index) => index.name === config.pinecone.indexName
      );

      if (!indexExists) {
        logger.info("Creating new index...");
        await this.pinecone.createIndex({
          name: config.pinecone.indexName,
          dimension: 1536,
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1",
            },
          },
          metric: "cosine",
        });

        await this.waitForIndexReady();
        logger.info("Index created and ready");
      } else {
        logger.info("Index already exists");
      }
    } catch (error) {
      logger.error(`Error ensuring index exists: ${error}`);
      throw error;
    }
  }

  private async waitForIndexReady(): Promise<void> {
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (!isReady && attempts < maxAttempts) {
      try {
        const indexDescription = await this.pinecone.describeIndex(
          config.pinecone.indexName
        );
        isReady = indexDescription.status?.ready === true;

        if (!isReady) {
          attempts++;
          logger.info(
            `Waiting for index to be ready... (${attempts}/${maxAttempts})`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Error checking index status: ${error}`);
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!isReady) {
      throw new Error("Index failed to become ready within timeout period");
    }
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      logger.debug(`Generating embeddings for ${texts.length} texts`);

      const response = await this.openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: texts,
      });

      logger.debug(`Generated ${response.data.length} embeddings`);
      return response.data.map((item) => item.embedding);
    } catch (error) {
      logger.error(`Error generating embeddings: ${error}`);
      throw error;
    }
  }

  public async processBatch(chunks: DocumentChunk[]): Promise<void> {
    if (!this.isInitialized || !this.vectorIndex) {
      const error = "VectorService not initialized. Call initialize() first.";
      logger.error(error);
      throw new Error(error);
    }

    try {
      logger.info(`Processing batch of ${chunks.length} chunks`);

      const texts = chunks.map((chunk) => chunk.content);
      const embeddings = await this.generateEmbeddings(texts);
      const vectors = chunks.map((chunk, index) => ({
        id: chunk.id,
        values: embeddings[index],
        metadata: {
          source: chunk.metadata.source,
          page: chunk.metadata.page,
          chunkIndex: chunk.metadata.chunkIndex,
          content: chunk.content,
        },
      }));

      // Upload to Pinecone
      await this.vectorIndex.upsert(vectors);
      logger.info(
        `Successfully uploaded ${vectors.length} vectors to Pinecone`
      );
    } catch (error) {
      logger.error(`Error processing batch: ${error}`);
      throw error;
    }
  }

  public async detectSourceFromQuestion(
    question: string
  ): Promise<string | null> {
    const lower = question.toLowerCase();
    let detectedSource = null;

    if (lower.includes("centurion") || lower.includes("alcon")) {
      detectedSource = "Alcon_Centurion_Vision_System_Operator_s_Manual.pdf";
    } else if (
      lower.includes("karl storz") ||
      lower.includes("endoscope") ||
      lower.includes("equimat")
    ) {
      detectedSource = "Karl_Storz_-_Endoscope.pdf";
    } else if (
      lower.includes("zeiss") ||
      lower.includes("opmi") ||
      lower.includes("pentero")
    ) {
      detectedSource = "Zeiss_OPMI_Pentero.pdf";
    }

    if (detectedSource) {
      logger.info(
        `Detected source filter: ${detectedSource} for question: ${question.substring(
          0,
          50
        )}...`
      );
    } else {
      logger.debug(
        `No source filter detected for question: ${question.substring(
          0,
          50
        )}...`
      );
    }

    return detectedSource;
  }

  public async searchSimilar(
    query: string,
    topK: number = 10,
    sourceFilter?: string
  ): Promise<any[]> {
    try {
      logger.info(
        `Searching for similar documents: topK=${topK}, sourceFilter=${sourceFilter}`
      );

      const queryEmbedding = await this.generateEmbeddings([query]);
      const filter = sourceFilter
        ? { source: { $eq: sourceFilter } }
        : undefined;

      const searchResponse = await this.vectorIndex.query({
        vector: queryEmbedding[0],
        topK,
        includeMetadata: true,
        filter,
      });

      const matches = searchResponse.matches || [];
      logger.info(`Found ${matches.length} similar documents`);

      return matches;
    } catch (error) {
      logger.error(`Error searching similar documents: ${error}`);
      throw error;
    }
  }

  public async generateAnswer(
    question: string,
    context: string
  ): Promise<string> {
    try {
      logger.info(
        `Generating answer for question: ${question.substring(0, 50)}...`
      );

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
            role: "system",
            content:
              "You are a helpful medical device assistant. Always base your answers on the provided context and be precise about medical procedures and safety requirements.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: config.search.temperature,
        max_tokens: config.search.maxTokens,
      });

      const answer =
        response.choices[0]?.message?.content ||
        "I apologize, but I could not generate an appropriate response.";

      logger.info(`Generated answer with length: ${answer.length} characters`);
      return answer;
    } catch (error) {
      logger.error(`Error generating answer: ${error}`);
      throw error;
    }
  }
}
