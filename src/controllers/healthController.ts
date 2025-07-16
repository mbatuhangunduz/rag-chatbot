import { Request, Response } from "express";
import { RAGService } from "../services/ragService";

export class HealthController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const initialized = await this.ragService.isSystemInitialized();
      res.json({
        status: "healthy",
        initialized,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
