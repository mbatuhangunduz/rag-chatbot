import pdf from "pdf-parse";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DocumentChunk } from "../types";
import { config } from "../config/config";

export class DocumentProcessor {
  private documentChunks: Map<string, DocumentChunk> = new Map();

  constructor() {}

  public getDocumentChunks(): Map<string, DocumentChunk> {
    return this.documentChunks;
  }

  public async processPDFsFromDirectory(
    directoryPath: string
  ): Promise<string[]> {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    const pdfFiles = fs
      .readdirSync(directoryPath)
      .filter((file) => file.toLowerCase().endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      throw new Error("No PDF files found in directory");
    }

    const processedFiles: string[] = [];
    for (const filename of pdfFiles) {
      const filePath = path.join(directoryPath, filename);
      await this.processPDF(filePath, filename);
      processedFiles.push(filename);
    }
    console.log("processedFiles", processedFiles);

    return processedFiles;
  }

  public async processPDF(
    filePath: string,
    filename: string
  ): Promise<DocumentChunk[]> {
    try {
      console.log("processing PDF");
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      console.log("burada");

      // Clean and split text into chunks
      const cleanText = this.cleanText(pdfData.text);
      console.log("şimdi geldij");
      const chunks = this.splitIntoChunks(
        cleanText,
        config.documents.chunkSize,
        config.documents.chunkOverlap
      );

      console.log(`Processing ${filename}: ${chunks.length} chunks`);

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

      return documentChunks;
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      throw error;
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-.,;:!?()]/g, "")
      .trim();
  }

  private splitIntoChunks(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    console.log("yettim");

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.substring(start, end);

      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf(".");
        if (lastSentence > chunk.length * 0.7) {
          chunk = chunk.substring(0, lastSentence + 1);
        }
      }

      chunks.push(chunk.trim());
      const nextStart = end - overlap;
      if (nextStart <= start) {
        console.warn("Breaking to prevent infinite loop:", {
          start,
          nextStart,
        });
        break;
      }

      start = nextStart;
    }

    return chunks.filter(
      (chunk) => chunk.length > config.documents.minChunkLength
    );
  }

  public getDocumentStats(): { [key: string]: any } {
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

    return {
      documents: Object.values(documents),
      totalChunks: this.documentChunks.size,
    };
  }
}
