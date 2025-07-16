import { Request, Response } from "express";
import { z } from "zod";
import { RAGService } from "../services/ragService";

const querySchema = z.object({
  question: z.string().min(5).max(500),
  maxResults: z.number().optional().default(5),
  includeSource: z.boolean().optional().default(true),
});

export class QueryController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public async processQuery(req: Request, res: Response): Promise<void> {
    try {
      const isInitialized = await this.ragService.isSystemInitialized();
      if (!isInitialized) {
        res.status(503).json({
          error: "System not initialized. Please call /initialize first.",
        });
        return;
      }

      // Validate input
      const queryRequest = querySchema.parse(req.body);
      const response = await this.ragService.query(queryRequest);

      res.json(response);
    } catch (error) {
      console.error("Query error:", error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid input",
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: "Failed to process query",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
