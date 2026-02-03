import { describe, expect, it, beforeAll } from 'bun:test'
import { app } from '../src/index'
import { db } from '../src/db'
import { users } from '../src/db/schema'
import { hashPassword } from '../src/utils/password'
import { eq } from 'drizzle-orm'

describe('Authentication', () => {
    const testEmail = 'test@example.com'
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
                firstName: 'Test',
                lastName: 'User',
                isAdmin: false,
                createdAt: new Date().toISOString()
            })
        }
    })

    it('should login successfully with correct credentials', async () => {
        const response = await app.handle(new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        }))

        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.user).toBeDefined()
        expect(json.user.email).toBe(testEmail)
        
        // Save cookie for next test
        cookies = response.headers.get('set-cookie') || ''
        expect(cookies).toContain('auth=')
    })

    it('should get current user with valid cookie', async () => {
        const response = await app.handle(new Request('http://localhost/api/auth/me', {
            headers: { 'Cookie': cookies }
        }))

        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.user).toBeDefined()
        expect(json.user.email).toBe(testEmail)
    })

    it('should fail login with wrong password', async () => {
        const response = await app.handle(new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'WrongPassword' })
        }))

        expect(response.status).toBe(401)
    })
})
