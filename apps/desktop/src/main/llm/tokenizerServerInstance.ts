import logger from '../logger'
import pyServer from '../pyServers/pyServer'

const PYTHON_PATH = '/data/assistant/.venv/bin/python' // Adjust as needed for your environment
const SCRIPT_PATH = '/data/assistant/apps/desktop/src/main/llm/tokenizer_server.py' // Adjust as needed for your environment

const tokenizerProc = new pyServer(
    SCRIPT_PATH,
    PYTHON_PATH,
    [],
    { cwd: '/data/assistant' },
    (data) => {
        const str = data.toString()
        logger.info(`[TokenizerServer] ${str}`)
    },
    (error) => {
        const errStr = error instanceof Error ? error.message : String(error)
        if (errStr.includes('INFO')) {
            logger.info(`[TokenizerServer] ${errStr}`)
            if (errStr.includes('TOKENIZER SERVER STARTED')) {
                tokenizerProc.status = 'running'
            }
        } else {
            logger.error('[TokenizerServer] Tokenizer server process error:' + errStr)
        }
    },
    (error) => {
        const errStr = error instanceof Error ? error.message : String(error)
        logger.error('[TokenizerServer] Tokenizer server process error:' + errStr)
        tokenizerProc.status = 'error'
    },
    (code, signal) => {
        logger.warn(
            `[TokenizerServer] Tokenizer server exited with code ${code} and signal ${signal}`
        )
        tokenizerProc.status = 'stopped'
    }
)

export function startTokenizerServer() {
    if (tokenizerProc.status !== 'stopped') {
        logger.debug('[TokenizerServer] Tokenizer server is already running.')
        return
    }
    tokenizerProc.start()
}

export function stopTokenizerServer() {
    tokenizerProc.stop()
}
