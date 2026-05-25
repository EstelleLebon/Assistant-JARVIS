import child_process from 'child_process'
import logger from '../logger'

export type PyServerStatus = 'stopped' | 'starting' | 'running' | 'error'

export default class PyServer {
    protected _status: PyServerStatus = 'stopped'
    private process: child_process.ChildProcess | null = null
    private pythonPath: string
    private scriptPath: string
    private args: string[]
    private options: child_process.SpawnOptions
    private handlers: {
        onStdout?: (data: any) => void
        onStderr?: (error: any) => void
        onProcessError?: (error: any) => void
        onProcessExit?: (code: number | null, signal: NodeJS.Signals | null) => void
    } = {}

    public get status() {
        return this._status
    }
    public set status(value: PyServerStatus) {
        this._status = value
        logger.info(`Python server status changed to: ${value}`)
    }

    constructor(
        scriptPath: string,
        pythonPath: string,
        args: string[],
        options: child_process.SpawnOptions,
        onStdout?: (data: any) => void,
        onStderr?: (error: any) => void,
        onProcessError?: (error: any) => void,
        onProcessExit?: (code: number | null, signal: NodeJS.Signals | null) => void
    ) {
        this.scriptPath = scriptPath
        this.pythonPath = pythonPath
        this.args = args
        this.options = options
        this.handlers.onStdout = onStdout
        this.handlers.onStderr = onStderr
        this.handlers.onProcessError = onProcessError
        this.handlers.onProcessExit = onProcessExit
    }

    start(): void {
        try {
            logger.info(`Starting Python server with script: ${this.scriptPath}`)
            if (this._status !== 'stopped') {
                logger.warn('Python server is already running or starting')
                return
            }

            this._status = 'starting'
            this.process = child_process.spawn(
                this.pythonPath,
                [this.scriptPath, ...this.args],
                this.options
            )

            this.process.stdout?.on(
                'data',
                this.handlers.onStdout ||
                    ((data) => {
                        logger.info(`Python server stdout: ${data}`)
                    })
            )
            this.process.stderr?.on(
                'data',
                this.handlers.onStderr ||
                    ((data) => {
                        logger.error(`Python server stderr: ${data}`)
                    })
            )
            this.process.on(
                'error',
                this.handlers.onProcessError ||
                    ((err) => {
                        const errStr = err instanceof Error ? err.message : String(err)
                        logger.error('Python server process error: ' + errStr)
                        this._status = 'error'
                    })
            )
            this.process.on(
                'exit',
                this.handlers.onProcessExit ||
                    ((code, signal) => {
                        logger.info(`Python server exited with code ${code} and signal ${signal}`)
                        this._status = 'stopped'
                    })
            )
        } catch (err) {
            const errStr = err instanceof Error ? err.message : String(err)
            logger.error('Failed to start Python server: ' + errStr)
            this._status = 'error'
        }
    }
    stop(): void {
        if (this.process) {
            try {
                this.process.kill()
            } catch (err) {
                const errStr = err instanceof Error ? err.message : String(err)
                logger.error('Failed to stop Python server: ' + errStr)
            }
            this.process = null
        }
        this._status = 'stopped'
    }
    send(data: any): void {
        if (this.process && this.process.stdin) {
            this.process.stdin.write(data)
        } else {
            logger.warn('Cannot send data, Python server process is not running')
        }
    }
}
