import { useEffect, useRef } from 'react'
import createOrb from './createorb'
import { orbController } from './OrbController'

export default function OrbCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!canvasRef.current) return

        const orb = createOrb(canvasRef.current)

        orbController.attach(orb)

        return () => {
            orb.destroy()
            orbController.detach()
        }
    }, [])

    return <canvas ref={canvasRef} />
}
