import type { OrbAPI, OrbState } from './types'
import { eventBus } from '../runtime/event-bus'

export class OrbController {
    private orb:
        | (OrbAPI & {
              getParticleScreenPosition?: (index: number) => { x: number; y: number }
              registerPanelConnection?: (
                  id: string,
                  getPoints: () => { x: number; y: number }[],
                  options?: any
              ) => void
              unregisterPanelConnection?: (id: string) => void
              updatePanelConnection?: (id: string, options: any) => void
          })
        | null = null

    private unsubs: (() => void)[] = []
    private pulseTimeout: ReturnType<typeof setTimeout> | null = null

    constructor() {
        this.unsubs = [
            eventBus.on('wake-word-detected', () => {
                console.log('[OrbCtrl:DEBUG] wake-word-detected → setState listening')
                this.setState('listening')
            }),
            eventBus.on('thinking-start', () => {
                console.log('[OrbCtrl:DEBUG] thinking-start → setState thinking')
                this.setState('thinking')
            }),
            eventBus.on('speech-start', () => {
                console.log('[OrbCtrl:DEBUG] speech-start → setState listening')
                this.setState('listening')
            }),
            eventBus.on('speech-expired', () => {
                console.log('[OrbCtrl:DEBUG] speech-expired → setState idle')
                this.setState('idle')
            }),
            eventBus.on('speaking-start', () => {
                console.log('[OrbCtrl:DEBUG] speaking-start → setState speaking, orb=', this.orb)
                this.setState('speaking')
            }),
            eventBus.on('speaking-end', () => {
                console.log('[OrbCtrl:DEBUG] speaking-end → setState idle')
                this.setState('idle')
            }),
            eventBus.on('error', () => {
                console.log('[OrbCtrl:DEBUG] error → setState error')
                this.setState('error')
            }),
            eventBus.on('tool-finished', () => this.pulse())
        ]
    }

    attach(
        orb: OrbAPI & {
            getParticleScreenPosition?: (index: number) => { x: number; y: number }
            registerPanelConnection?: (
                id: string,
                getPoints: () => { x: number; y: number }[],
                options?: any
            ) => void
            unregisterPanelConnection?: (id: string) => void
            updatePanelConnection?: (id: string, options: any) => void
        }
    ) {
        this.orb = orb
    }
    /**
     * Enregistre un panel pour les lignes de connexion orb-panel
     */
    registerPanelConnection(
        id: string,
        getPoints: () => { x: number; y: number }[],
        options?: any
    ) {
        this.orb?.registerPanelConnection?.(id, getPoints, options)
    }
    unregisterPanelConnection(id: string) {
        this.orb?.unregisterPanelConnection?.(id)
    }
    updatePanelConnection(id: string, options: any) {
        this.orb?.updatePanelConnection?.(id, options)
    }

    detach() {
        this.orb = null
        if (this.pulseTimeout !== null) {
            clearTimeout(this.pulseTimeout)
            this.pulseTimeout = null
        }
    }

    destroy() {
        this.orb = null
        this.unsubs.forEach((u) => u())
        this.unsubs = []
        if (this.pulseTimeout !== null) {
            clearTimeout(this.pulseTimeout)
            this.pulseTimeout = null
        }
    }

    /**
     * Get the screen position (in px) of a particle by index, or fallback to orb center if not available.
     */
    getParticleScreenPosition(index: number): { x: number; y: number } {
        if (this.orb && typeof this.orb.getParticleScreenPosition === 'function') {
            return this.orb.getParticleScreenPosition(index)
        }
        // fallback: center of window
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }

    setState(state: OrbState) {
        this.orb?.setState(state)
    }

    setVolume(volume: number) {
        this.orb?.setVolume(volume)
    }

    pulse() {
        this.orb?.setVolume(0.85)
        if (this.pulseTimeout !== null) clearTimeout(this.pulseTimeout)
        this.pulseTimeout = setTimeout(() => {
            this.orb?.setVolume(0)
            this.pulseTimeout = null
        }, 250)
    }

    notify() {
        this.pulse()
    }
}

export const orbController = new OrbController()
