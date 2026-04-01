CREATE TABLE "web_session" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "refresh_token_hash" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "replaced_by_session_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "web_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "web_session_refresh_token_hash_key" ON "web_session"("refresh_token_hash");
CREATE INDEX "web_session_user_id_idx" ON "web_session"("user_id");
CREATE INDEX "web_session_expires_at_idx" ON "web_session"("expires_at");
CREATE INDEX "web_session_revoked_at_idx" ON "web_session"("revoked_at");

ALTER TABLE "web_session"
ADD CONSTRAINT "web_session_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
