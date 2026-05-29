import { google } from 'googleapis'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const configDir = join(homedir(), '.config', 'jarvis')
if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })

const tokenPath = join(configDir, 'google-token.json')

export function createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'urn:ietf:wg:oauth:2.0:oob'

    if (!clientId || !clientSecret) {
        throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars')
    }

    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    if (existsSync(tokenPath)) {
        const token = JSON.parse(readFileSync(tokenPath, 'utf8'))
        client.setCredentials(token)
        client.on('tokens', (tokens) => {
            const current = existsSync(tokenPath)
                ? JSON.parse(readFileSync(tokenPath, 'utf8'))
                : {}
            writeFileSync(tokenPath, JSON.stringify({ ...current, ...tokens }))
        })
    }

    return client
}

export function saveToken(tokens: object) {
    writeFileSync(tokenPath, JSON.stringify(tokens))
}

export function hasToken(): boolean {
    return existsSync(tokenPath)
}

export function getAuthUrl(client: ReturnType<typeof createOAuth2Client>): string {
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/tasks',
        ],
    })
}
