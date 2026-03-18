import { describe, expect, it, beforeAll } from 'bun:test'
import { app } from '../src/index'
import { prisma } from '../src/db'
import { hashPassword } from '../src/utils/password'

const hasDb = !!process.env.DATABASE_URL;

describe('Shopping API', () => {
    const testEmail = 'shopping-test@example.com'
    const testPassword = 'Password123!'
    let cookies = ''

    beforeAll(async () => {
        if (!hasDb) return;

        const existing = await prisma.user.findFirst({ where: { email: testEmail } })
        if (!existing) {
            const pwdHash = await hashPassword(testPassword)
            await prisma.user.create({
                data: {
                    email: testEmail,
                    passwordHash: pwdHash,
                    firstName: 'Shopping',
                    lastName: 'Test',
                    isAdmin: true,
                    createdAt: new Date(),
                }
            })
        }

        const response = await app.handle(new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        }))
        cookies = response.headers.get('set-cookie') || ''
    })

    it('should return 401 when unauthenticated on GET /', async () => {
        if (!hasDb) return;
        const response = await app.handle(new Request('http://localhost/api/shopping'))
        expect(response.status).toBe(401)
    })

    it('should return items list when authenticated', async () => {
        if (!hasDb) return;
        const response = await app.handle(new Request('http://localhost/api/shopping', {
            headers: { 'Cookie': cookies }
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(Array.isArray(json.items)).toBe(true)
    })

    it('should return 401 when unauthenticated on POST /', async () => {
        if (!hasDb) return;
        const response = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name: 'Milk' })
        }))
        expect(response.status).toBe(401)
    })

    it('should create a shopping item', async () => {
        if (!hasDb) return;
        const response = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'Test Item', notes: 'some notes' })
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.success).toBe(true)
        expect(typeof json.id).toBe('number')
    })

    it('should toggle a shopping item completion', async () => {
        if (!hasDb) return;
        // Create item first
        const createRes = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'Toggle Test Item' })
        }))
        const { id } = await createRes.json() as any

        const response = await app.handle(new Request(`http://localhost/api/shopping/${id}/toggle`, {
            method: 'POST',
            headers: { 'Cookie': cookies }
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.success).toBe(true)
        expect(json.completed).toBe(true)
    })

    it('should update a shopping item', async () => {
        if (!hasDb) return;
        const createRes = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'Old Name' })
        }))
        const { id } = await createRes.json() as any

        const response = await app.handle(new Request(`http://localhost/api/shopping/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'New Name' })
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.success).toBe(true)
    })

    it('should delete a shopping item', async () => {
        if (!hasDb) return;
        const createRes = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'Delete Me' })
        }))
        const { id } = await createRes.json() as any

        const response = await app.handle(new Request(`http://localhost/api/shopping/${id}`, {
            method: 'DELETE',
            headers: { 'Cookie': cookies }
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.success).toBe(true)
    })

    it('should return 404 for non-existent item on toggle', async () => {
        if (!hasDb) return;
        const response = await app.handle(new Request('http://localhost/api/shopping/999999/toggle', {
            method: 'POST',
            headers: { 'Cookie': cookies }
        }))
        expect(response.status).toBe(404)
    })

    it('should clear completed items', async () => {
        if (!hasDb) return;
        const response = await app.handle(new Request('http://localhost/api/shopping/clear-completed', {
            method: 'POST',
            headers: { 'Cookie': cookies }
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.success).toBe(true)
        expect(typeof json.count).toBe('number')
    })

    it('should reorder shopping items', async () => {
        if (!hasDb) return;
        // Create two items to reorder
        const r1 = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'Reorder Item A' })
        }))
        const r2 = await app.handle(new Request('http://localhost/api/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_name: 'Reorder Item B' })
        }))
        const { id: id1 } = await r1.json() as any
        const { id: id2 } = await r2.json() as any

        const response = await app.handle(new Request('http://localhost/api/shopping/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
            body: JSON.stringify({ item_ids: [id2, id1] })
        }))
        expect(response.status).toBe(200)
        const json = await response.json() as any
        expect(json.success).toBe(true)
    })
})
