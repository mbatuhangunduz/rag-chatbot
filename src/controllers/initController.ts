import { Request, Response } from "express";
import { RAGService } from "../services/ragService";

export class InitController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public async initialize(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.ragService.initialize();
      if (!result.documents) {
        res.json({
          message: "System already initialized",
          ...result,
        });
      } else {
        res.json({
          message: "System initialized successfully",
          ...result,
        });
      }
    } catch (error) {
      console.error("Initialization error:", error);

      res.status(500).json({
        error: "Failed to initialize system",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
