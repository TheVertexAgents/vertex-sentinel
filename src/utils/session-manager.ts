import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

/**
 * @title SessionManager
 * @dev Manages user sessions and authentication tokens using SQLite.
 */
export class SessionManager {
    private db: sqlite3.Database;

    constructor() {
        const dbPath = path.join(process.cwd(), 'logs/sessions.db');
        const logsDir = path.dirname(dbPath);
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

        this.db = new sqlite3.Database(dbPath);
        this.initDb();
    }

    private initDb() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    api_key TEXT UNIQUE,
                    address TEXT,
                    role TEXT DEFAULT 'admin',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            this.db.run(`
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
            `);
        });
    }

    public async createSession(apiKey: string): Promise<{ token: string, expiresAt: string } | null> {
        return new Promise((resolve, reject) => {
            // Find or create user for this API key
            this.db.get('SELECT id FROM users WHERE api_key = ?', [apiKey], (err, user: any) => {
                if (err) return reject(err);

                const userId = user ? user.id : null;
                if (!userId) {
                    // For demo, we might want to auto-create user or require registration
                    // Here we assume the user must exist (e.g. from beta registration)
                    return resolve(null);
                }

                const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

                this.db.run(
                    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
                    [token, userId, expiresAt],
                    (err) => {
                        if (err) return reject(err);
                        resolve({ token, expiresAt });
                    }
                );
            });
        });
    }

    public async verifySession(token: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            this.db.get(
                `SELECT u.id, u.api_key, u.role FROM sessions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.token = ? AND s.expires_at > ?`,
                [token, now],
                (err, row: any) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve({ userId: row.id, apiKey: row.api_key, role: row.role });
                }
            );
        });
    }

    public async revokeSession(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM sessions WHERE token = ?', [token], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    // Helper for testing/beta registration
    public async registerUser(apiKey: string, address: string, role: string = 'admin'): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO users (api_key, address, role) VALUES (?, ?, ?)',
                [apiKey, address, role],
                function(err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        // Already exists, find id
                        const db = new sqlite3.Database(path.join(process.cwd(), 'logs/sessions.db'));
                        db.get('SELECT id FROM users WHERE api_key = ?', [apiKey], (err, row: any) => {
                            db.close();
                            if (err) return reject(err);
                            resolve(row.id);
                        });
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }
}

export const sessionManager = new SessionManager();
