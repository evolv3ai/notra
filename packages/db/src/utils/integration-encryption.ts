import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const CURRENT_VERSION = "v1";

export function decodeIntegrationEncryptionKey(
  key: string | undefined,
  envName = "INTEGRATION_ENCRYPTION_KEY"
) {
  if (!key) {
    throw new Error(`${envName} environment variable is not set`);
  }

  const decodedKey = Buffer.from(key, "base64");

  if (decodedKey.length !== 32) {
    throw new Error(
      `${envName} must be a base64-encoded 32-byte key, but decoded length is ${decodedKey.length} bytes (expected 32 bytes). Please supply a valid base64-encoded 32-byte key.`
    );
  }

  return decodedKey;
}

export function encryptIntegrationSecret(value: string, key: Buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  return `${CURRENT_VERSION}:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted}`;
}

export function decryptIntegrationSecret(encryptedValue: string, key: Buffer) {
  const parts = encryptedValue.split(":");
  const [version, ivHex, authTagHex, encrypted] =
    parts.length === 4 ? parts : [undefined, ...parts];

  if (!(ivHex && authTagHex && encrypted)) {
    throw new Error("Invalid encrypted token format");
  }

  if (version !== undefined && version !== CURRENT_VERSION) {
    throw new Error(`Unsupported encrypted token version: ${version}`);
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

function integrationEncryptionKeyFromEnv() {
  return decodeIntegrationEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY);
}

export function encryptToken(token: string) {
  return encryptIntegrationSecret(token, integrationEncryptionKeyFromEnv());
}

export function decryptToken(encryptedToken: string) {
  return decryptIntegrationSecret(
    encryptedToken,
    integrationEncryptionKeyFromEnv()
  );
}
