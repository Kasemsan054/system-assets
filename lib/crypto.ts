/**
 * Secure cryptographic helpers using Web Crypto API
 * Works uniformly across Browser, Node.js (18+), and Cloudflare Workers / Edge Runtimes
 */

export async function hashPassword(plain: string): Promise<string> {
  if (!plain) return '';
  // If already a 64-char hex string, don't double hash
  if (/^[a-f0-9]{64}$/i.test(plain)) {
    return plain.toLowerCase();
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`ams_pwd_salt::${plain}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(inputPlain: string, storedHashOrPlain?: string): Promise<boolean> {
  if (!storedHashOrPlain) return false;
  // Backward compatibility with legacy plaintext passwords in DB
  if (storedHashOrPlain === inputPlain) {
    return true;
  }
  const hashedInput = await hashPassword(inputPlain);
  return hashedInput.toLowerCase() === storedHashOrPlain.toLowerCase();
}
