import crypto from "crypto";

function getSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.GOOGLE_PRIVATE_KEY ||
    "transfinitte-secure-scanner-session-secret-key-tf26"
  );
}

/**
 * Validates login credentials against environment variables.
 * Default credentials: username="admin", password="transfinitte26"
 */
export function validateCredentials(username, password) {
  const expectedUser = (process.env.ADMIN_USERNAME || "admin").trim();
  const expectedPass = (process.env.ADMIN_PASSWORD || "transfinitte26").trim();

  if (!username || !password) return false;
  return (
    username.trim().toLowerCase() === expectedUser.toLowerCase() &&
    password.trim() === expectedPass
  );
}

/**
 * Creates a cryptographically signed sessionId.
 * Format: <randomHex16>.<timestampMs>.<hmacSha256>
 * 
 * Multiple users can authenticate with the same username/password concurrently;
 * each login receives a unique sessionId with distinct randomness and timestamp.
 */
export function createSession() {
  const randomId = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `${randomId}.${timestamp}`;
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

/**
 * Verifies that the sessionId has a valid HMAC-SHA256 signature and has not expired.
 * Valid for 7 days.
 */
export function verifySession(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return false;

  const parts = sessionId.split(".");
  if (parts.length !== 3) return false;

  const [randomId, timestampStr, signature] = parts;
  if (!randomId || !timestampStr || !signature) return false;
  if (!/^[0-9a-f]{32}$/i.test(randomId)) return false;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Session expiry: 7 days
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now - timestamp > MAX_AGE_MS || timestamp > now + 60000) {
    return false;
  }

  const payload = `${randomId}.${timestampStr}`;
  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
