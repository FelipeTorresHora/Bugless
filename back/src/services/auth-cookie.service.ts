import { Request, Response, CookieOptions } from "express";
import envLoader from "./env-loader.service";

type SameSite = "lax" | "strict" | "none";

class AuthCookieService {
  private getRefreshCookieName(): string {
    return envLoader.getEnv("AUTH_REFRESH_COOKIE_NAME") || "bugless_rt";
  }

  private getSameSite(): SameSite {
    const sameSite = (envLoader.getEnv("AUTH_COOKIE_SAMESITE") || "lax").toLowerCase();
    if (sameSite === "strict" || sameSite === "none") {
      return sameSite;
    }
    return "lax";
  }

  private isSecureCookie(): boolean {
    const envValue = (envLoader.getEnv("AUTH_COOKIE_SECURE") || "").toLowerCase();
    if (envValue === "true" || envValue === "1") return true;
    if (envValue === "false" || envValue === "0") return false;
    return process.env.NODE_ENV === "production";
  }

  private getCookieDomain(): string | undefined {
    const domain = envLoader.getEnv("AUTH_COOKIE_DOMAIN") || "";
    return domain.trim() || undefined;
  }

  private buildOptions(expires: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: this.getSameSite(),
      path: "/auth/session",
      domain: this.getCookieDomain(),
      expires,
    };
  }

  setRefreshCookie(res: Response, refreshToken: string, expiresAt: Date) {
    res.cookie(this.getRefreshCookieName(), refreshToken, this.buildOptions(expiresAt));
  }

  clearRefreshCookie(res: Response) {
    res.cookie(this.getRefreshCookieName(), "", this.buildOptions(new Date(0)));
  }

  getRefreshTokenFromRequest(req: Request): string | null {
    const value = req.cookies?.[this.getRefreshCookieName()];
    return value || null;
  }
}

export default new AuthCookieService();
