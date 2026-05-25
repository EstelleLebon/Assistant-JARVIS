import type { OrbAPI, OrbState } from './types'
import { eventBus } from '../runtime/event-bus'

export class OrbController {
    private orb: OrbAPI | null = null

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

    attach(orb: OrbAPI) {
        this.orb = orb
    }

    detach() {
        this.orb = null
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
