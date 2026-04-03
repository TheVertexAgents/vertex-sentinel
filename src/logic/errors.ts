/**
 * @title errors.ts
 * @dev Custom security exceptions for the Vertex Sentinel layer.
 */
export class CriticalSecurityException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CriticalSecurityException';
    // Ensure the stack trace is correctly captured in Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CriticalSecurityException);
    }
  }
}
