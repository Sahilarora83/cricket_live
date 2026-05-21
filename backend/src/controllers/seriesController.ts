import type { Request, Response } from "express";
import type { SeriesService } from "../services/seriesService.js";

export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  getIplSeries = async (_request: Request, response: Response) => {
    response.json({ data: await this.seriesService.getIplSeries() });
  };

  refreshIplSeries = async (_request: Request, response: Response) => {
    response.json({ data: await this.seriesService.refreshIplSeries() });
  };
}
