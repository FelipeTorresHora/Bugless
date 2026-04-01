import { createHash, randomBytes } from "crypto";
import envLoader from "./env-loader.service";
import jwtService, { TokenPayload } from "./jwt.service";

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = "15m";
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = "30d";

type DurationUnit = "ms" | "s" | "m" | "h" | "d";

const durationUnitToMs: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationToMs(duration: string): number {
  const trimmed = duration.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error(`Invalid duration "${duration}". Expected format like 15m or 30d.`);
  }

  const value = Number(match[1]);
  const unit = match[2] as DurationUnit;
  return value * durationUnitToMs[unit];
}

class SessionTokenService {
  getAccessTokenExpiresIn(): string {
    return envLoader.getEnv("ACCESS_TOKEN_EXPIRES_IN") || DEFAULT_ACCESS_TOKEN_EXPIRES_IN;
  }

  getRefreshTokenExpiresIn(): string {
    return envLoader.getEnv("REFRESH_TOKEN_EXPIRES_IN") || DEFAULT_REFRESH_TOKEN_EXPIRES_IN;
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  createAccessToken(payload: TokenPayload): string {
    return jwtService.generateToken(payload, this.getAccessTokenExpiresIn());
  }

  createRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  createRefreshTokenExpiresAt(now = new Date()): Date {
    const durationMs = parseDurationToMs(this.getRefreshTokenExpiresIn());
    return new Date(now.getTime() + durationMs);
  }

  buildTokenBundle(payload: TokenPayload) {
    const accessToken = this.createAccessToken(payload);
    const refreshToken = this.createRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshTokenExpiresAt = this.createRefreshTokenExpiresAt();

    return {
      accessToken,
      accessTokenExpiresIn: this.getAccessTokenExpiresIn(),
      refreshToken,
      refreshTokenHash,
      refreshTokenExpiresAt,
    };
  }
}

export default new SessionTokenService();
