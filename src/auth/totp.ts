import crypto from 'crypto';

// Base32 alphabet according to RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpService {
  /**
   * Generates a cryptographically secure random base32 secret (160 bits / 20 bytes => 32 base32 chars).
   */
  public static generateSecret(byteLength = 20): string {
    const buffer = crypto.randomBytes(byteLength);
    return TotpService.encodeBase32(buffer);
  }

  /**
   * Encodes a buffer to RFC 4648 Base32 string (without padding).
   */
  public static encodeBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Decodes an RFC 4648 Base32 string to a Buffer.
   */
  public static decodeBase32(base32Str: string): Buffer {
    const clean = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < clean.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(clean[i]);
      if (idx === -1) {
        continue; // ignore invalid characters or padding
      }

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Generates an otpauth:// URI suitable for Google Authenticator / standard TOTP apps.
   */
  public static generateOtpAuthUrl(account: string, issuer: string, secret: string): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(account);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Computes the 6-digit TOTP code for a secret at a given timestamp (default: now).
   */
  public static generateCode(secret: string, timestampMs = Date.now(), periodSeconds = 30): string {
    const key = TotpService.decodeBase32(secret);
    const counter = Math.floor(timestampMs / 1000 / periodSeconds);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Validates a candidate 6-digit code with time drift window tolerance (-1, 0, +1 time steps).
   */
  public static verifyCode(token: string, secret: string, window = 1): boolean {
    if (!token || !secret) return false;
    const cleanToken = token.trim().replace(/\s+/g, '');
    if (cleanToken.length !== 6) return false;

    const now = Date.now();
    const period = 30;

    for (let i = -window; i <= window; i++) {
      const stepTime = now + i * period * 1000;
      const expected = TotpService.generateCode(secret, stepTime, period);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanToken))) {
        return true;
      }
    }

    return false;
  }
}
