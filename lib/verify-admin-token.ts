import jwt from 'jsonwebtoken'

export function verifyAdminToken(authHeader: string | null): { ok: true } | { ok: false; status: number; error: string } {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { ok: false, status: 401, error: 'Missing or invalid authorization header' }
    }

    if (!process.env.JWT_SECRET) {
        return { ok: false, status: 500, error: 'JWT_SECRET is not configured' }
    }

    const token = authHeader.split(' ')[1]
    try {
        jwt.verify(token, process.env.JWT_SECRET)
        return { ok: true }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid token'
        return { ok: false, status: 401, error: `Invalid or expired token: ${message}` }
    }
}
