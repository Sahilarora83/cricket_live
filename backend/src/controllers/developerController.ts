import type { Request, Response } from "express";
import type { ApiKeyService } from "../services/apiKeyService.js";

export class DeveloperController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  createApiKey = async (request: Request, response: Response) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const email = typeof request.body?.email === "string" ? request.body.email : "";

    if (!name.trim() || !email.trim()) {
      response.status(400).json({ error: "Name and email are required" });
      return;
    }

    let result;
    try {
      result = await this.apiKeyService.createApiKey({ name, email });
    } catch (error) {
      response.status(503).json({
        error: error instanceof Error ? error.message : "API key generation is unavailable"
      });
      return;
    }

    response.status(201).json({
      data: result,
      message: "Copy this API key now. It will not be shown again."
    });
  };
}
