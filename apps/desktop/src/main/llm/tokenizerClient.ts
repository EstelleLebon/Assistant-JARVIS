// Node.js client for the Python tokenizer microservice
export type TokenizerModel = 'llama3' | 'qwen' | 'mistral'

const TOKENIZER_URL = 'http://127.0.0.1:8123/count_tokens'

export async function countTokensRemote(model: TokenizerModel, text: string): Promise<number> {
    const res = await fetch(TOKENIZER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, text })
    })
    if (!res.ok) throw new Error(`Tokenizer server error: ${res.status}`)
    const data = await res.json()
    if (typeof data.tokens === 'number') return data.tokens
    throw new Error(data.error || 'Unknown error from tokenizer server')
}
