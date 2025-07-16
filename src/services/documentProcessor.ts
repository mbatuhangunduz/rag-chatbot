import pdf from "pdf-parse";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DocumentChunk } from "../types";
import { config } from "../config/config";
import logger from "../utils/logger";

export class DocumentProcessor {
  private static instance: DocumentProcessor;
  private documentChunks: Map<string, DocumentChunk> = new Map();

  private constructor() {
    logger.info("DocumentProcessor instance created");
  }

  public static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  public getDocumentChunks(): Map<string, DocumentChunk> {
    logger.debug(`Retrieved ${this.documentChunks.size} document chunks`);
    return this.documentChunks;
  }

  public async processPDFsFromDirectory(
    directoryPath: string
  ): Promise<string[]> {
    try {
      logger.info(`Starting PDF processing from directory: ${directoryPath}`);
      
      if (!fs.existsSync(directoryPath)) {
        logger.info(`Directory doesn't exist, creating: ${directoryPath}`);
        fs.mkdirSync(directoryPath, { recursive: true });
      }

      const pdfFiles = fs
        .readdirSync(directoryPath)
        .filter((file) => file.toLowerCase().endsWith(".pdf"));

      logger.info(`Found ${pdfFiles.length} PDF files in directory`);

      if (pdfFiles.length === 0) {
        const error = "No PDF files found in directory";
        logger.error(error);
        throw new Error(error);
      }

      const processedFiles: string[] = [];
      let totalChunks = 0;

      for (const filename of pdfFiles) {
        const filePath = path.join(directoryPath, filename);
        logger.info(`Processing PDF file: ${filename}`);
        
        try {
          const chunks = await this.processPDF(filePath, filename);
          processedFiles.push(filename);
          totalChunks += chunks.length;
          
          logger.info(`Successfully processed ${filename}: ${chunks.length} chunks created`);
        } catch (error) {
          logger.error(`Failed to process ${filename}: ${error}`);
          throw error;
        }
      }

      logger.info(`PDF processing completed: ${processedFiles.length} files processed, ${totalChunks} total chunks created`);
      return processedFiles;
    } catch (error) {
      logger.error(`Error in processPDFsFromDirectory: ${error}`);
      throw error;
    }
  }

  public async processPDF(
    filePath: string,
    filename: string
  ): Promise<DocumentChunk[]> {
    try {
      logger.debug(`Starting PDF processing for: ${filename}`);
      
      if (!fs.existsSync(filePath)) {
        const error = `PDF file not found: ${filePath}`;
        logger.error(error);
        throw new Error(error);
      }

      const fileStats = fs.statSync(filePath);
      logger.debug(`PDF file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

      const dataBuffer = fs.readFileSync(filePath);
      logger.debug(`PDF file read successfully, buffer size: ${dataBuffer.length} bytes`);

      const pdfData = await pdf(dataBuffer);
      logger.debug(`PDF parsed successfully, text length: ${pdfData.text.length} characters, pages: ${pdfData.numpages}`);

      // Clean and split text into chunks
      const cleanText = this.cleanText(pdfData.text);
      logger.debug(`Text cleaned, length after cleaning: ${cleanText.length} characters`);
      
      const chunks = this.splitIntoChunks(
        cleanText,
        config.documents.chunkSize,
        config.documents.chunkOverlap
      );

      logger.info(`Text split into ${chunks.length} chunks for ${filename}`);

      const documentChunks: DocumentChunk[] = [];

      // Create document chunks
      chunks.forEach((chunk, index) => {
        const chunkId = crypto.randomUUID();
        const documentChunk: DocumentChunk = {
          id: chunkId,
          content: chunk,
          metadata: {
            source: filename,
            page: Math.floor(index / 5) + 1, // Approximate page
            chunkIndex: index,
            timestamp: new Date(),
          },
        };

        this.documentChunks.set(chunkId, documentChunk);
        documentChunks.push(documentChunk);
      });

      logger.info(`Created ${documentChunks.length} document chunks for ${filename}`);
      logger.debug(`Total chunks in memory: ${this.documentChunks.size}`);

      return documentChunks;
    } catch (error) {
      logger.error(`Error processing PDF ${filename}: ${error}`);
      throw error;
    }
  }

  private cleanText(text: string): string {
    try {
      logger.debug(`Starting text cleaning, original length: ${text.length} characters`);
      
      const cleaned = text
        .replace(/\s+/g, " ")
        .replace(/[^\w\s\-.,;:!?()]/g, "")
        .trim();
      
      logger.debug(`Text cleaning completed, cleaned length: ${cleaned.length} characters`);
      
      return cleaned;
    } catch (error) {
      logger.error(`Error in text cleaning: ${error}`);
      throw error;
    }
  }

  private splitIntoChunks(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    try {
      logger.debug(`Starting text chunking with chunkSize: ${chunkSize}, overlap: ${overlap}`);
      
      const chunks: string[] = [];
      
      if (text.length <= chunkSize) {
        const result = text.trim().length > 50 ? [text.trim()] : [];
        logger.debug(`Text shorter than chunk size, returning ${result.length} chunks`);
        return result;
      }
      
      let start = 0;
      let chunkCount = 0;
      
      while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);
        
        if (end < text.length) {
          const chunk = text.substring(start, end);
          
          // Try to end at sentence boundary
          const lastDot = chunk.lastIndexOf('.');
          if (lastDot > chunk.length * 0.6) {
            end = start + lastDot + 1;
          } else {
            // Try to end at word boundary
            const lastSpace = chunk.lastIndexOf(' ');
            if (lastSpace > chunk.length * 0.8) {
              end = start + lastSpace;
            }
          }
        }
        
        const chunk = text.substring(start, end).trim();
        
        if (chunk.length > 50) {
          chunks.push(chunk);
          chunkCount++;
        } else {
          logger.debug(`Chunk ${chunkCount}: Skipped short chunk of length ${chunk.length}`);
        }
        
        if (end >= text.length) {
          break; 
        }
        
        let nextStart = end - overlap;
        
        if (nextStart > start) {
          while (nextStart > start && text[nextStart] !== ' ' && text[nextStart] !== '.') {
            nextStart--;
          }
          
          if (text[nextStart] === ' ') {
            nextStart++;
          }
        }
        
        start = Math.max(start + 1, nextStart);
      }
      
      const filteredChunks = chunks.filter(
        (chunk) => chunk.length > config.documents.minChunkLength
      );
      
      logger.info(`Text chunking completed: ${chunks.length} initial chunks, ${filteredChunks.length} chunks after filtering (min length: ${config.documents.minChunkLength})`);
      
      return filteredChunks;
    } catch (error) {
      logger.error(`Error in text chunking: ${error}`);
      throw error;
    }
  }

  public getDocumentStats(): { [key: string]: any } {
    try {
      logger.debug("Generating document statistics");
      
      const documents = Array.from(this.documentChunks.values()).reduce(
        (acc, chunk) => {
          if (!acc[chunk.metadata.source]) {
            acc[chunk.metadata.source] = {
              name: chunk.metadata.source,
              chunkCount: 0,
              lastUpdated: chunk.metadata.timestamp,
            };
          }
          acc[chunk.metadata.source].chunkCount++;
          return acc;
        },
        {} as any
      );

      const stats = {
        documents: Object.values(documents),
        totalChunks: this.documentChunks.size,
      };

      logger.info(`Document stats generated: ${Object.keys(documents).length} documents, ${stats.totalChunks} total chunks`);
      
      return stats;
    } catch (error) {
      logger.error(`Error generating document stats: ${error}`);
      throw error;
    }
  }
}
