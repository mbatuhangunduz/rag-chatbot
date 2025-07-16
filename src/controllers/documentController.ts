import { Request, Response } from "express";
import { RAGService } from "../services/ragService";

export class DocumentController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.ragService.getDocumentStats();
      const initialized = await this.ragService.isSystemInitialized();

      res.json({
        ...stats,
        initialized,
      });
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({
        error: "Failed to get documents",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
