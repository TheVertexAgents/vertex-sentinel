/**
 * @title errors.ts
 * @dev Custom security exceptions for the Vertex Sentinel layer.
 */
export class CriticalSecurityException extends Error {
  public code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CriticalSecurityException';
    this.code = code;
    // Ensure the stack trace is correctly captured in Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CriticalSecurityException);
    }
  }
}
