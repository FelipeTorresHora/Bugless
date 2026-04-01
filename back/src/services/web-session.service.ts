import { randomUUID } from "crypto";
import prisma from "../database/prisma";

export type WebSessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  createdAt: Date;
};

type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
};

function mapRow(row: any): WebSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenHash,
    userAgent: row.userAgent ?? null,
    ipAddress: row.ipAddress ?? null,
    expiresAt: new Date(row.expiresAt),
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
    replacedBySessionId: row.replacedBySessionId ?? null,
    createdAt: new Date(row.createdAt),
  };
}

class WebSessionService {
  async createSession(input: CreateSessionInput): Promise<WebSessionRecord> {
    const id = randomUUID();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "web_session"
      ("id", "user_id", "refresh_token_hash", "user_agent", "ip_address", "expires_at")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        "id",
        "user_id" AS "userId",
        "refresh_token_hash" AS "refreshTokenHash",
        "user_agent" AS "userAgent",
        "ip_address" AS "ipAddress",
        "expires_at" AS "expiresAt",
        "revoked_at" AS "revokedAt",
        "replaced_by_session_id" AS "replacedBySessionId",
        "created_at" AS "createdAt"
      `,
      id,
      input.userId,
      input.refreshTokenHash,
      input.userAgent || null,
      input.ipAddress || null,
      input.expiresAt
    );

    return mapRow(rows[0]);
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<WebSessionRecord | null> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        "id",
        "user_id" AS "userId",
        "refresh_token_hash" AS "refreshTokenHash",
        "user_agent" AS "userAgent",
        "ip_address" AS "ipAddress",
        "expires_at" AS "expiresAt",
        "revoked_at" AS "revokedAt",
        "replaced_by_session_id" AS "replacedBySessionId",
        "created_at" AS "createdAt"
      FROM "web_session"
      WHERE "refresh_token_hash" = $1
      LIMIT 1
      `,
      refreshTokenHash
    );

    if (!rows.length) return null;
    return mapRow(rows[0]);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `
      UPDATE "web_session"
      SET "revoked_at" = NOW()
      WHERE "id" = $1 AND "revoked_at" IS NULL
      `,
      sessionId
    );
  }

  async revokeAllByUser(userId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `
      UPDATE "web_session"
      SET "revoked_at" = NOW()
      WHERE "user_id" = $1 AND "revoked_at" IS NULL
      `,
      userId
    );
  }

  async rotateSession(
    currentSessionId: string,
    input: CreateSessionInput
  ): Promise<WebSessionRecord> {
    return prisma.$transaction(async (tx) => {
      const newSessionId = randomUUID();

      const newRows = await tx.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "web_session"
        ("id", "user_id", "refresh_token_hash", "user_agent", "ip_address", "expires_at")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          "id",
          "user_id" AS "userId",
          "refresh_token_hash" AS "refreshTokenHash",
          "user_agent" AS "userAgent",
          "ip_address" AS "ipAddress",
          "expires_at" AS "expiresAt",
          "revoked_at" AS "revokedAt",
          "replaced_by_session_id" AS "replacedBySessionId",
          "created_at" AS "createdAt"
        `,
        newSessionId,
        input.userId,
        input.refreshTokenHash,
        input.userAgent || null,
        input.ipAddress || null,
        input.expiresAt
      );

      const updatedRows = await tx.$executeRawUnsafe(
        `
        UPDATE "web_session"
        SET "revoked_at" = NOW(), "replaced_by_session_id" = $2
        WHERE "id" = $1 AND "revoked_at" IS NULL
        `,
        currentSessionId,
        newSessionId
      );

      if (!Number(updatedRows)) {
        throw new Error("Current session is not active for rotation");
      }

      return mapRow(newRows[0]);
    });
  }
}

export default new WebSessionService();
