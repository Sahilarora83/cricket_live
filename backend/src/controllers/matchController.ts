import type { Request, Response } from "express";
import type { MatchService } from "../services/matchService.js";
import type { ScoreService } from "../services/scoreService.js";

export class MatchController {
  constructor(
    private readonly matchService: MatchService,
    private readonly scoreService: ScoreService
  ) {}

  getMatches = async (_request: Request, response: Response) => {
    response.json({ data: await this.matchService.getMatches() });
  };

  getLiveMatch = async (_request: Request, response: Response) => {
    const match = await this.matchService.getActiveMatch();
    response.json({ data: match });
  };

  trackMatch = async (request: Request, response: Response) => {
    const query = typeof request.body?.query === "string" ? request.body.query : "";
    if (!query.trim()) {
      response.status(400).json({ error: "Query is required" });
      return;
    }

    const match = await this.matchService.trackMatch(query);
    if (!match) {
      response.status(404).json({ error: "No matching Cricbuzz match found" });
      return;
    }

    response.json({ data: match });
  };

  getScore = async (request: Request, response: Response) => {
    const score = await this.scoreService.getScore(String(request.params.matchId));
    response.json({ data: score });
  };

  getScoreHistory = async (request: Request, response: Response) => {
    const limit = Number(request.query.limit ?? 60);
    const history = await this.scoreService.getScoreHistory(String(request.params.matchId), limit);
    response.json({ data: history });
  };

  getCommentary = async (request: Request, response: Response) => {
    const commentary = await this.scoreService.getCommentary(String(request.params.matchId));
    response.json({ data: commentary });
  };
}
