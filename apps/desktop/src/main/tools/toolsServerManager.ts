import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import logger from '../logger'
import { updateServiceStatus } from '../serviceStatus'

interface ServerConfig {
    name: string
    serviceKey: string
    port: number
    dir: string
    envFile?: string
}

const REPO_ROOT = '/data/assistant/'

const SERVERS: ServerConfig[] = [
    {
        name: 'tools-server',
        serviceKey: 'tools-server',
        port: 3001,
        dir: join(REPO_ROOT, 'apps/tools-server'),
        envFile: join(REPO_ROOT, 'apps/tools-server/.env')
    },
    {
        name: 'system-tools-server',
        serviceKey: 'system-tools-server',
        port: 7824,
        dir: join(REPO_ROOT, 'apps/system-tools-server')
    }
]

const processes = new Map<string, ChildProcess>()

async function isPortResponding(port: number): Promise<boolean> {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
            signal: AbortSignal.timeout(1500)
        })
        return res.ok
    } catch {
        return false
    }
}

function spawnServer(config: ServerConfig): void {
    const { name, serviceKey, dir, envFile } = config

    if (processes.has(name)) return

    logger.info(`[toolsServerManager] Spawning ${name}`)
    updateServiceStatus(serviceKey, 'starting')

    const nodeArgs: string[] = []
    if (envFile) nodeArgs.push(`--env-file=${envFile}`)
    nodeArgs.push('dist/index.js')

    const child = spawn('node', nodeArgs, {
        cwd: dir,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout?.on('data', (d) => logger.debug(`[${name}] ${d.toString().trim()}`))
    child.stderr?.on('data', (d) => logger.warn(`[${name}] ${d.toString().trim()}`))

    child.on('exit', (code) => {
        logger.warn(`[toolsServerManager] ${name} exited with code ${code}`)
        processes.delete(name)
        updateServiceStatus(serviceKey, 'stopped')
    })

    processes.set(name, child)
}

async function waitUntilReady(config: ServerConfig, retries = 10, delayMs = 500): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        if (await isPortResponding(config.port)) return true
        await new Promise((r) => setTimeout(r, delayMs))
    }
    return false
}

export async function ensureToolServers(): Promise<void> {
    for (const config of SERVERS) {
        const running = await isPortResponding(config.port)

        if (running) {
            logger.info(`[toolsServerManager] ${config.name} already running on :${config.port}`)
            updateServiceStatus(config.serviceKey, 'running')
            continue
        }

        spawnServer(config)

        const ready = await waitUntilReady(config)
        if (ready) {
            logger.info(`[toolsServerManager] ${config.name} ready on :${config.port}`)
            updateServiceStatus(config.serviceKey, 'running')
        } else {
            logger.error(`[toolsServerManager] ${config.name} failed to start`)
            updateServiceStatus(config.serviceKey, 'error')
        }
    }
}

export function stopToolServers(): void {
    for (const [name, child] of processes) {
        logger.info(`[toolsServerManager] Stopping ${name}`)
        child.kill()
    }
    processes.clear()
}

export async function getToolServerStatuses(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    for (const config of SERVERS) {
        results[config.serviceKey] = await isPortResponding(config.port)
    }
    return results
}
