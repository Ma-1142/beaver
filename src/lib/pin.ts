// PIN utilities for simple respondent authentication

// Hash a 4-digit PIN using SHA-256 (legacy, unsalted)
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify a PIN against a stored hash (legacy, unsalted)
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
}

// Validate PIN format (4 digits)
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// Generate a 16-byte random salt as hex string
export function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash a PIN with a salt using SHA-256
export async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify a PIN against a salted hash
export async function verifyPinWithSalt(pin: string, salt: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPinWithSalt(pin, salt);
  return inputHash === storedHash;
}
