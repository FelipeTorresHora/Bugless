import { Request, Response } from "express";
import { compareSync } from "bcrypt";
import { ZodError, flattenError } from "zod";
import HttpHelper from "../utils/http-helper";
import { loginSchema, userSchema } from "../schemas/user.schema";
import userService from "../services/user.service";
import sessionTokenService from "../services/session-token.service";
import webSessionService from "../services/web-session.service";
import authCookieService from "../services/auth-cookie.service";

function getRequestMetadata(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim();

  return {
    userAgent: req.headers["user-agent"] || null,
    ipAddress: forwardedIp || req.ip || req.socket.remoteAddress || null,
  };
}

async function buildSessionResponse(
  req: Request,
  res: Response,
  user: { id: string; name: string; email: string }
) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
  const metadata = getRequestMetadata(req);
  const tokens = sessionTokenService.buildTokenBundle(payload);

  await webSessionService.createSession({
    userId: user.id,
    refreshTokenHash: tokens.refreshTokenHash,
    expiresAt: tokens.refreshTokenExpiresAt,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
  });

  authCookieService.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);

  console.info(
    JSON.stringify({
      event: "session_login",
      userId: user.id,
    })
  );

  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

class AuthSessionController {
  async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const user = await userService.getUserByEmail({ email: data.email });

      if (!user || !compareSync(data.password, user.password)) {
        return HttpHelper.unauthorized(res, "Invalid email or password");
      }

      const session = await buildSessionResponse(req, res, user);
      return HttpHelper.success(res, session, "Web session login successful");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }
      console.error("[AuthSession] login error:", error);
      return HttpHelper.serverError(res);
    }
  }

  async register(req: Request, res: Response) {
    try {
      const data = userSchema.parse(req.body);
      const userExists = await userService.checkIfUserExistsByEmail(data);
      if (userExists) {
        return HttpHelper.conflict(res, "User already exists");
      }

      const user = await userService.createUser(data);
      const session = await buildSessionResponse(req, res, user);
      return HttpHelper.created(res, session, "Web session register successful");
    } catch (error) {
      if (error instanceof ZodError) {
        return HttpHelper.badRequest(res, "Validation error", flattenError(error));
      }
      console.error("[AuthSession] register error:", error);
      return HttpHelper.serverError(res);
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const refreshToken = authCookieService.getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        return HttpHelper.unauthorized(res, "Missing refresh token");
      }

      const refreshTokenHash = sessionTokenService.hashRefreshToken(refreshToken);
      const session = await webSessionService.findByRefreshTokenHash(refreshTokenHash);

      if (!session) {
        return HttpHelper.unauthorized(res, "Invalid refresh token");
      }

      if (session.revokedAt) {
        if (session.replacedBySessionId) {
          return HttpHelper.unauthorized(res, "Refresh token already rotated");
        }

        await webSessionService.revokeAllByUser(session.userId);
        console.warn(
          JSON.stringify({
            event: "session_refresh_reuse_detected",
            userId: session.userId,
            sessionId: session.id,
          })
        );
        return HttpHelper.unauthorized(res, "Refresh token reuse detected");
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        await webSessionService.revokeSession(session.id);
        return HttpHelper.unauthorized(res, "Refresh token expired");
      }

      const user = await userService.getUserById(session.userId);
      if (!user) {
        await webSessionService.revokeSession(session.id);
        authCookieService.clearRefreshCookie(res);
        return HttpHelper.unauthorized(res, "Invalid session user");
      }

      const payload = {
        userId: user.id,
        email: user.email,
        name: user.name,
      };
      const metadata = getRequestMetadata(req);
      const tokens = sessionTokenService.buildTokenBundle(payload);

      try {
        await webSessionService.rotateSession(session.id, {
          userId: session.userId,
          refreshTokenHash: tokens.refreshTokenHash,
          expiresAt: tokens.refreshTokenExpiresAt,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Current session is not active for rotation"
        ) {
          return HttpHelper.unauthorized(res, "Refresh token already rotated");
        }
        throw error;
      }

      authCookieService.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      console.info(
        JSON.stringify({
          event: "session_refresh",
          userId: session.userId,
          sessionId: session.id,
        })
      );

      return HttpHelper.success(
        res,
        {
          accessToken: tokens.accessToken,
          accessTokenExpiresIn: tokens.accessTokenExpiresIn,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
        "Session refreshed successfully"
      );
    } catch (error) {
      console.error("[AuthSession] refresh error:", error);
      return HttpHelper.serverError(res);
    }
  }

  async me(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      const profile = await userService.getUserProfileById(userId);
      if (!profile) {
        return HttpHelper.notFound(res, "User not found");
      }

      return HttpHelper.success(
        res,
        {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          hasApiKey: profile.hasApiKey,
          activeProvider: profile.activeProvider,
          plan: profile.plan,
        },
        "Session profile fetched successfully"
      );
    } catch (error) {
      console.error("[AuthSession] me error:", error);
      return HttpHelper.serverError(res);
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const refreshToken = authCookieService.getRefreshTokenFromRequest(req);
      if (refreshToken) {
        const refreshTokenHash = sessionTokenService.hashRefreshToken(refreshToken);
        const session = await webSessionService.findByRefreshTokenHash(refreshTokenHash);
        if (session && !session.revokedAt) {
          await webSessionService.revokeSession(session.id);
          console.info(
            JSON.stringify({
              event: "session_logout",
              userId: session.userId,
              sessionId: session.id,
            })
          );
        }
      }

      authCookieService.clearRefreshCookie(res);
      return HttpHelper.success(res, { loggedOut: true }, "Session logout successful");
    } catch (error) {
      console.error("[AuthSession] logout error:", error);
      return HttpHelper.serverError(res);
    }
  }

  async logoutAll(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return HttpHelper.unauthorized(res, "Unauthorized");
      }

      await webSessionService.revokeAllByUser(userId);
      authCookieService.clearRefreshCookie(res);
      console.info(
        JSON.stringify({
          event: "session_logout_all",
          userId,
        })
      );

      return HttpHelper.success(res, { loggedOutAll: true }, "All sessions revoked successfully");
    } catch (error) {
      console.error("[AuthSession] logout-all error:", error);
      return HttpHelper.serverError(res);
    }
  }
}

export default new AuthSessionController();
