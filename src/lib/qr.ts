// QR payload shared by the admin display and the employee scanner: `shiftline:v1:<token>`.
export const QR_PREFIX = "shiftline:v1:";
export const MIN_TOKEN_LENGTH = 32; // firestore.rules validQr()

export function encodeQr(token: string): string {
  return `${QR_PREFIX}${token}`;
}

/** Returns the token, or null when the scanned value is not one of our codes. */
export function parseQr(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v.startsWith(QR_PREFIX)) return null;
  const token = v.slice(QR_PREFIX.length);
  return token.length >= MIN_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

/** Random token that satisfies the rules' length requirement. */
export function newQrToken(): string {
  const bytes = new Uint8Array(24);
  const c: any = (globalThis as any).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
