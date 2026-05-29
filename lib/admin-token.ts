import jwt from 'jsonwebtoken'

/** Issue a JWT for admin/HOD sessions verified by local API routes */
export function signAdminToken(admin: Record<string, unknown>): string | null {
    const secret = process.env.JWT_SECRET
    if (!secret) return null

    const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: typeof admin.UserType === 'string' ? admin.UserType.trim() : admin.UserType,
        data: admin,
    }

    return jwt.sign(payload, secret, { algorithm: 'HS256' })
}
