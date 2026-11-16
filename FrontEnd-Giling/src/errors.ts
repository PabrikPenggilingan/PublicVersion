/**
 * AppError - an "Operational" error.
 *
 * Throw this when the error message is explicitly written by us and is
 * SAFE to surface directly to the end-user (e.g. validation failures,
 * business-rule violations, 404 "not found" messages).
 *
 * Any other error (network crash, DB exception, unexpected runtime Error)
 * is treated as a system error and gets replaced with a generic fallback.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.isOperational = true; // Flag: safe to display to end-users

        // Preserves correct stack trace in V8 environments (not in TS DOM lib, hence the cast)
        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Returns a message that is safe to display in the UI.
 *
 * - If the error is an AppError (isOperational = true) -> show its message.
 * - For any other error -> log it for debugging, return a generic fallback.
 */
export function getCleanErrorMessage(err: unknown): string {
    if (err instanceof AppError && err.isOperational) {
        // We wrote this message; it is safe to show the user.
        return err.message;
    }

    // Log sensitive / unexpected errors on the console for developers,
    // but never leak them to the UI.
    console.error('[SYSTEM ERROR]', err);

    return 'Terjadi kesalahan sistem. Silakan hubungi administrator.';
}
