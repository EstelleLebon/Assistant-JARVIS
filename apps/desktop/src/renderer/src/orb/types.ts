export type OrbState =
    | 'startup'
    | 'idle'
    | 'listening'
    | 'thinking'
    | 'speaking'
    | 'sleep'
    | 'muted'
    | 'tool-running'
    | 'error'

export interface OrbAPI {
    setState(state: OrbState): void
    setVolume(volume: number): void
    setAnalyser(analyser: AnalyserNode | null): void
    triggerDemo(): void
    destroy(): void
}
