function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

export function randomToken(prefix: string, byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return `${prefix}${bytesToHex(bytes)}`;
}

export function hintFor(value: string): string {
  return value.slice(-4);
}

async function aesKey(): Promise<CryptoKey> {
  const secret = process.env.MSE_SECRETS_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("MSE_SECRETS_KEY must be set (16+ characters) to store webhook secrets");
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await aesKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${bytesToHex(iv)}:${bytesToHex(cipher)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const [ivHex, dataHex] = payload.split(":");
  if (!ivHex || !dataHex) throw new Error("Invalid encrypted secret");
  const key = await aesKey();
  const iv = hexToBytes(ivHex);
  const data = hexToBytes(dataHex);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
