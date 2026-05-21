import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import type { CommentaryItem, CricketMatch, LiveScore } from "../types/cricket.js";

export class LiveSocket {
  readonly io: Server;

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ["GET", "POST"]
      }
    });

    this.io.on("connection", (socket) => {
      socket.emit("system_notice", { message: "Connected to cricket live engine" });

      socket.on("join_match", (matchId: string) => {
        socket.join(matchRoom(matchId));
      });

      socket.on("leave_match", (matchId: string) => {
        socket.leave(matchRoom(matchId));
      });
    });
  }

  emitMatches(matches: CricketMatch[]) {
    this.io.emit("matches_update", matches);
  }

  emitMatchChanged(match: CricketMatch) {
    this.io.emit("match_changed", match);
  }

  emitScore(score: LiveScore) {
    this.io.emit("score_update", score);
    this.io.to(matchRoom(score.matchId)).emit("score_update", score);
  }

  emitCommentary(matchId: string, commentary: CommentaryItem[]) {
    this.io.emit("commentary_update", { matchId, commentary });
    this.io.to(matchRoom(matchId)).emit("commentary_update", { matchId, commentary });
  }
}

function matchRoom(matchId: string) {
  return `match:${matchId}`;
}
