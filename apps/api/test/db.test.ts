import { describe, expect, it } from 'bun:test'
import { prisma } from '../src/db'

describe('Database Connection', () => {
    it('can query users table', async () => {
        const count = await prisma.user.count()
        console.log('User count:', count)
        expect(count).toBeGreaterThanOrEqual(0)
    })
})
