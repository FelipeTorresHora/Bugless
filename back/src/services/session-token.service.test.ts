import assert from "node:assert/strict";
import sessionTokenService, { parseDurationToMs } from "./session-token.service";

function runSessionTokenServiceTests() {
  assert.equal(parseDurationToMs("15m"), 15 * 60 * 1000);
  assert.equal(parseDurationToMs("30d"), 30 * 24 * 60 * 60 * 1000);
  assert.equal(parseDurationToMs("10s"), 10 * 1000);

  const refreshToken = sessionTokenService.createRefreshToken();
  assert.ok(refreshToken.length >= 60, "refresh token should have strong entropy");

  const hash = sessionTokenService.hashRefreshToken(refreshToken);
  assert.equal(hash.length, 64, "sha256 refresh hash should be 64 hex chars");

  const bundle = sessionTokenService.buildTokenBundle({
    userId: "usr_test",
    email: "session@test.com",
    name: "Session Test",
  });

  assert.ok(bundle.accessToken.length > 20, "access token should be generated");
  assert.ok(bundle.refreshToken.length > 20, "refresh token should be generated");
  assert.equal(
    bundle.refreshTokenHash.length,
    64,
    "refresh token hash should be generated"
  );
  assert.ok(
    bundle.refreshTokenExpiresAt.getTime() > Date.now(),
    "refresh token expiration must be in the future"
  );
}

runSessionTokenServiceTests();
console.log("session-token.service tests: ok");
