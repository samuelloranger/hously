import { describe, expect, it } from 'bun:test'
import { db } from '../src/db'
import { users } from '../src/db/schema'
import { sql } from 'drizzle-orm'

describe('Database Connection', () => {
    it('can query users table', async () => {
        const result = await db.select({ count: sql<number>`count(*)` }).from(users)
        console.log('User count:', result[0].count)
        expect(result[0]).toBeDefined()
    })
})
