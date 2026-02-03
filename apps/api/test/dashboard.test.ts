import { describe, expect, it, beforeAll } from 'bun:test'
import { app } from '../src/index'
import { db } from '../src/db'
import { users } from '../src/db/schema'
import { hashPassword } from '../src/utils/password'
import { eq } from 'drizzle-orm'

describe('Dashboard API', () => {
    const testEmail = 'stats-test@example.com'
    const testPassword = 'Password123!'
    let cookies = ''

    beforeAll(async () => {
        // Setup test user
        const existing = await db.query.users.findFirst({
            where: eq(users.email, testEmail)
        })

        if (!existing) {
            const pwdHash = await hashPassword(testPassword)
            await db.insert(users).values({
                email: testEmail,
                passwordHash: pwdHash,
                firstName: 'Stats',
                lastName: 'Test',
                isAdmin: false,
                createdAt: new Date().toISOString()
            })
        }

        // Login to get cookie
        const response = await app.handle(new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        }))
        cookies = response.headers.get('set-cookie') || ''
    })

    it('should return stats when authenticated', async () => {
        const response = await app.handle(new Request('http://localhost/api/dashboard/stats', {
            headers: { 'Cookie': cookies }
        }))

        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.stats).toBeDefined()
        expect(typeof json.stats.events_today).toBe('number')
        expect(typeof json.stats.shopping_count).toBe('number')
        expect(typeof json.stats.chores_count).toBe('number')
        expect(Array.isArray(json.activities)).toBe(true)
    })

    it('should return 401 when unauthenticated', async () => {
        const response = await app.handle(new Request('http://localhost/api/dashboard/stats'))
        expect(response.status).toBe(401)
    })
})
