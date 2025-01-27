import { serverSupabaseServiceRole } from '#supabase/server'
import { Database } from '~/types/supabase'

export default defineEventHandler(async (event) => {
    const client = serverSupabaseServiceRole<Database>(event)
    const username = getRouterParam(event, 'id')
    if (!username) {
        return {
            success: false,
            error: 'Username not provided.'
        }
    }

    const { data: userData } = await client.from('users').select('*').eq('username', username)

    if (userData == null || userData.length === 0) {
        return {
            success: false,
            error: 'User not found.'
        }
    }

    return {
        success: true,
        data: userData
    }
})
