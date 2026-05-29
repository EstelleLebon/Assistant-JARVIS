import { useEffect, useRef } from 'react'
import createOrb from './createorb'
import { orbController } from './OrbController'
import { eventBus } from '../runtime/event-bus'
import type { OrbState } from './types'

export default function OrbCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const onStateChangeRef = useRef<((s: OrbState) => void) | null>(null)

    useEffect(() => {
        let startupDone = false
        onStateChangeRef.current = (s: OrbState) => {
            if (s === 'idle' && !startupDone) {
                startupDone = true
                eventBus.emit('startup-complete', undefined)
            }
        }

        if (!canvasRef.current) return

        const orb = createOrb(canvasRef.current, onStateChangeRef)

        orbController.attach(orb)

        return () => {
            onStateChangeRef.current = null
            orb.destroy()
            orbController.detach()
        }
    }, [])

    return <canvas ref={canvasRef} />
}
