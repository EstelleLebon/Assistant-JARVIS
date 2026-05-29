import { ConversationMessage } from './Message'

export default class Conversation {
    private messages: ConversationMessage[] = []

    addUserMessage(content: string) {
        this.messages.push({ role: 'user', content })
    }

    addAssistantMessage(content: string) {
        this.messages.push({ role: 'assistant', content })
    }

    getHistory(): ConversationMessage[] {
        return [...this.messages]
    }

    clear() {
        this.messages = []
    }
}
