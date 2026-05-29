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

    constructor() {
        eventBus.on('wake-word-detected', () => {
            this.setState('listening')
        })

        eventBus.on('thinking-start', () => {
            this.setState('thinking')
        })

        eventBus.on('speech-start', () => {
            this.setState('listening')
        })

        eventBus.on('speaking-start', () => {
            this.setState('speaking')
        })

        eventBus.on('speaking-end', () => {
            this.setState('idle')
        })

        eventBus.on('error', () => {
            this.setState('error')
        })
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
        // futur
    }

    notify() {
        // futur
    }
}

export const orbController = new OrbController()
