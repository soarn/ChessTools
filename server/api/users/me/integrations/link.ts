import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { Database } from '~/types/supabase'

export default defineEventHandler(async (event) => {
    const client = await serverSupabaseClient<Database>(event)
    const body = await readBody(event)
    const user = await serverSupabaseUser(event)
    if (!user) {
        return {
            success: false,
            error: 'User not found.'
        }
    }

    const userId = user.id

    // get ID and platform from body
    const { data, platform } = body

    // Check to see if we already have an integration for this platform
    const { data: integrationData, error: integrationError } = await client.from('integrations').select('*').eq('user_id', userId).eq('platform', platform)

    if (integrationError) {
        return {
            success: false,
            error: integrationError.message
        }
    }

    let newData = data
    let verified = false
    if (platform === 'lichess') {
        try {
            newData = await verifyLichess(data.code, useRuntimeConfig().lichessCodeVerifier, data.redirectUri)
            verified = true
        } catch (e: any) {
            const msg: string = e.message

            if (msg.includes('"https://lichess.org/api/token": 400 Bad Request')) {
                return {
                    success: false,
                    error: 'Lichess code expired. Try linking again!'
                }
            }

            return {
                success: false,
                error: msg
            }
        }
    } else if (platform === 'uscf') {
        newData = {
            id: data
        }
    }

    // If we already have an integration, update it
    if (integrationData !== undefined && integrationData.length > 0) {
        const { data: updateData, error: updateError } = await client.from('integrations').update({
            user_id: userId,
            platform,
            data
        }).eq('id', integrationData[0].id).single()

        if (updateError) {
            return {
                success: false,
                error: updateError.message
            }
        }

        return {
            success: true,
            data: updateData
        }
    } else {
        // Otherwise, create a new integration
        const { data: createData, error: createError } = await client.from('integrations').insert([{
            user_id: userId,
            platform,
            data: newData,
            verified
        }]).select()

        if (createError) {
            return {
                success: false,
                error: createError.message
            }
        }

        return {
            success: true,
            integration: createData[0]
        }
    }
})

async function verifyLichess(code: string, codeVerifier: string, redirectUri: string) {
    const { access_token: accessToken } = await $fetch<{token_type: string, access_token: string}>('https://lichess.org/api/token', {
        method: 'POST',
        body: {
            grant_type: 'authorization_code',
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            client_id: 'chess.tools'
        }
    })

    const { id, username } = await $fetch<{id: string, username: string}>('https://lichess.org/api/account', {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    })

    return {
        id, username
    }
}
