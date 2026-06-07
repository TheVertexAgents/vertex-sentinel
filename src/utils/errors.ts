export class SentinelError extends Error {
    public code: string;
    constructor(message: string, code: string = 'SENTINEL_ERROR') {
        super(message);
        this.name = 'SentinelError';
        this.code = code;
    }
}
