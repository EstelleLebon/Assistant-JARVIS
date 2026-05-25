# Plan : UI Chat Conversationnelle — Jarvis Desktop

**Objectif** : Transformer l'interface minimaliste existante en un vrai chat conversationnel avec bulles de messages, indicateurs d'état, scroll automatique, et boucle complète voix → transcription → réponse LLM local → affichage + animation orbe.

**Contexte technique actuel**
- Electron + React 19 + Zustand + Vite
- `ConversationView.tsx` existe mais sans style
- `sessionStore.ts` gère `messages[]` et `partialTranscript`
- IPC: `assistant:partial_transcript`, `assistant:final_transcript` fonctionnent
- `eventBus` + `OrbController` existent avec tous les états (`idle | listening | thinking | speaking | sleep | error`) mais **ne sont pas encore alimentés depuis `App.tsx`**
- Pas encore de connexion LLM → `addAssistantMessage()` existe dans le store mais n'est jamais appelée

---

## Phase 0 — Documentation Discovery ✅ (déjà complété)

**Findings :**
- Zustand API : `create<Store>()`, `set()`, `useStore()` — patterns dans `sessionStore.ts`
- IPC Electron : `ipcMain.on/handle`, `webContents.send()`, `ipcRenderer.on()` — patterns dans `index.ts` / `App.tsx`
- `eventBus.emit(event, payload)` — `runtime/event-bus.ts:31`
- `OrbController` écoute : `wake-word-detected`, `thinking-start`, `speech-start`, `speech-end`, `error` — `orb/OrbController.ts`
- `OrbState` disponibles : `startup | idle | listening | thinking | speaking | sleep | muted | tool-running | error` — `orb/types.ts`
- Ollama API locale : HTTP `POST http://localhost:11434/api/chat` — body JSON avec `model`, `messages[]`, `stream: false`

**Allowed APIs (vérifiées) :**
- `ipcMain.handle(channel, handler)` / `ipcMain.on(channel, handler)` — `index.ts`
- `sendToRenderer(channel, payload)` — `index.ts:73`
- `window.electron.ipcRenderer.on(channel, callback)` — `App.tsx:24`
- `eventBus.emit('thinking-start', undefined)` — `runtime/event-bus.ts`
- `orbController.setState(state)` — `orb/OrbController.ts`
- `useSessionStore()` → `{ messages, partialTranscript, addUserMessage, setPartial, addAssistantMessage }` — `store/sessionStore.ts`

---

## Phase 1 — Styling et UX du chat (renderer uniquement)

**Objectif** : Rendre `ConversationView` visuellement utilisable — bulles, scroll automatique, animation partial transcript.

### 1.1 — Styles CSS dans `main.css`

Ajouter à `src/renderer/src/assets/main.css` :

```css
.conversation {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, 90vw);
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 8px;
  scrollbar-width: none;
}

.message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 18px;
  font-family: system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.4;
  word-break: break-word;
}

.message--user {
  align-self: flex-end;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message--assistant {
  align-self: flex-start;
  background: rgba(100, 160, 255, 0.2);
  color: #e0eaff;
  border-bottom-left-radius: 4px;
}

.message--partial {
  opacity: 0.55;
  font-style: italic;
}
```

### 1.2 — Auto-scroll dans `ConversationView.tsx`

```tsx
const bottomRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages, partialTranscript])
// + <div ref={bottomRef} /> à la fin du JSX
```

**Vérification :**
- [ ] Bulles user à droite, assistant à gauche
- [ ] Partial transcript en italique semi-transparent
- [ ] Scroll automatique sur nouveau message
- [ ] Pas de débordement hors écran

---

## Phase 2 — Connexion LLM local (Ollama)

**Objectif** : Quand la transcription finale arrive, interroger Ollama en local et afficher la réponse.

### Architecture

```
[Renderer] final_transcript → IPC "assistant:final_transcript"
    ↓
[Main] index.ts : onFinal() → appelle askOllama(history)
    ↓
[Main] ollamaClient.ts : fetch POST http://localhost:11434/api/chat
    ↓
[Main] sendToRenderer("assistant:llm_response", { text })
    ↓
[Renderer] App.tsx : addAssistantMessage(text)
```

### 2.1 — Créer `src/main/llm/ollamaClient.ts`

```typescript
interface OllamaMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function askOllama(messages: OllamaMessage[]): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',         // configurable
      messages: [
        { role: 'system', content: 'Tu es Jarvis, un assistant vocal. Réponds de façon concise et naturelle.' },
        ...messages
      ],
      stream: false
    })
  })
  const data = await res.json()
  return data.message?.content ?? ''
}
```

### 2.2 — Brancher dans `index.ts`

Dans `onFinal()`, remplacer le bloc "Back to sleep" par :

```typescript
onFinal(async (text) => {
  sendToRenderer('assistant:final_transcript', { text })
  sendToRenderer('assistant:thinking_start')

  try {
    const reply = await askOllama([{ role: 'user', content: text }])
    sendToRenderer('assistant:llm_response', { text: reply })
  } catch (err) {
    logger.error('[MAIN] Ollama error: ' + String(err))
    sendToRenderer('assistant:llm_error', { message: String(err) })
  }

  assistantAwake = false
  isUserSpeaking = false
  resumeWakeWord()
})
```

### 2.3 — Historique de conversation côté main

Stocker l'historique en mémoire dans `index.ts` (array `conversationHistory`) et le passer à `askOllama()`. Ajouter chaque message user/assistant après réception.

### 2.4 — Brancher dans `App.tsx`

```typescript
window.electron.ipcRenderer.on('assistant:llm_response', (_, { text }) => addAssistantMessage(text))
```

**Vérification :**
- [ ] `curl http://localhost:11434/api/tags` retourne des modèles disponibles
- [ ] Parler → transcription → réponse Ollama apparaît en bleu
- [ ] Erreurs Ollama (service down) loggées sans crasher l'app

---

## Phase 3 — États de l'orbe 3D corrélés à l'assistant

**Objectif** : Alimenter l'`eventBus` depuis les événements IPC dans `App.tsx` pour que l'orbe reflète fidèlement l'état de l'assistant.

### Mapping état ↔ eventBus ↔ OrbState

| Événement IPC            | `eventBus.emit()`       | `OrbState`  |
|--------------------------|-------------------------|-------------|
| `assistant:wake`         | `wake-word-detected`    | `listening` |
| `assistant:speech_start` | `speech-start`          | `speaking`  |
| `assistant:speech_end`   | `speech-end`            | `idle`      |
| `assistant:thinking_start` | `thinking-start`      | `thinking`  |
| `assistant:llm_response` | `thinking-end`          | `idle`      |
| `assistant:llm_error`    | `error`                 | `error`     |

### 3.1 — Brancher les IPC → eventBus dans `App.tsx`

```typescript
import { eventBus } from './runtime/event-bus'

// Dans un useEffect :
window.electron.ipcRenderer.on('assistant:wake', () =>
  eventBus.emit('wake-word-detected', undefined))

window.electron.ipcRenderer.on('assistant:speech_start', () =>
  eventBus.emit('speech-start', undefined))

window.electron.ipcRenderer.on('assistant:speech_end', () =>
  eventBus.emit('speech-end', undefined))

window.electron.ipcRenderer.on('assistant:thinking_start', () =>
  eventBus.emit('thinking-start', undefined))

window.electron.ipcRenderer.on('assistant:llm_response', () =>
  eventBus.emit('thinking-end', undefined))

window.electron.ipcRenderer.on('assistant:llm_error', (_, { message }) =>
  eventBus.emit('error', { message }))
```

> L'`OrbController` (déjà instancié dans `OrbCanvas.tsx` ou similaire) écoute déjà ces events et appelle `orb.setState()` — rien à modifier dans `OrbController.ts`.

### 3.2 — Vérifier que `orbController` est bien initialisé avant les events

Confirmer que `new OrbController()` / `orbController` est importé dans le render tree avant que `App.tsx` n'émette des events.

**Vérification :**
- [ ] Wake word → orbe passe en `listening` (animation bleue/pulsante)
- [ ] Parole détectée → orbe en `speaking`
- [ ] Transcription envoyée à Ollama → orbe en `thinking`
- [ ] Réponse reçue → orbe revient en `idle`
- [ ] Erreur Ollama → orbe en `error`

---

## Phase 4 — Vérification finale

- [ ] `grep -r "eventBus.emit" src/renderer/` → appelé depuis `App.tsx` pour chaque IPC
- [ ] `grep -r "askOllama" src/main/` → appelé une seule fois dans `onFinal()`
- [ ] Boucle complète : wake → parler → transcription → réponse → orbe idle
- [ ] Pas de listener IPC orphelin (tous les `on()` ont leur `removeListener` dans le `return` du `useEffect`)

---

## Ordre d'exécution

1. **Phase 1** — CSS + scroll (aucun risque, visible immédiatement)
2. **Phase 2** — Ollama (nécessite `ollama serve` en local)
3. **Phase 3** — Orbe (dépend des IPC de Phase 2 pour `thinking_start` / `llm_response`)
