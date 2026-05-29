import * as readline from 'readline'
import { createOAuth2Client, getAuthUrl, saveToken } from './oauth.js'

const auth = createOAuth2Client()
const url = getAuthUrl(auth)

console.log('\n🔐 Autorisation Google requise\n')
console.log('Ouvre cette URL dans ton navigateur :\n')
console.log(url)
console.log('\nAprès avoir accordé les permissions, Google te donnera un code.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Colle le code ici : ', async (code) => {
    rl.close()
    try {
        const { tokens } = await auth.getToken(code.trim())
        saveToken(tokens)
        console.log('\n✅ Token sauvegardé dans ~/.config/jarvis/google-token.json')
        console.log('Lance maintenant : pnpm start\n')
    } catch (e: any) {
        console.error('\n❌ Erreur :', e.message)
        process.exit(1)
    }
})
