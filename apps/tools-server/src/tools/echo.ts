import { z } from 'zod'

export const echoTool = {
    name: 'echo',
    description: 'Renvoie le texte fourni',
    schema: z.object({
        text: z.string()
    }),
    async handler(input: { text: string }) {
        return { echoed: input.text }
    }
}

export default echoTool
