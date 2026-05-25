import record from 'node-record-lpcm16'
import logger from '../../../logger'

export function startMicrophone(
    onAudio: (chunk: Float32Array) => void,
    onError?: (err: Error) => void
) {
    let mic: any
    try {
        mic = record.record({
            sampleRate: 16000,
            channels: 1,
            audioType: 'raw',
            threshold: 0,
            verbose: false,
            recorder: 'sox'
        })
    } catch (err: any) {
        logger.error(
            "Erreur d'accès au micro :" + (err instanceof Error ? err.message : String(err))
        )
        if (onError) onError(err)
        return null
    }

    const stream = mic.stream()

    stream.on('data', (buffer: Buffer) => {
        try {
            if (!buffer || buffer.length === 0) return
            const samples = new Float32Array(buffer.length / 2)
            for (let i = 0; i < samples.length; i++) {
                const int16 = buffer.readInt16LE(i * 2)
                samples[i] = int16 / 32768
            }
            try {
                onAudio(samples)
            } catch (cbErr) {
                logger.error(
                    'Erreur dans le callback onAudio:' +
                        (cbErr instanceof Error ? cbErr.message : String(cbErr))
                )
                if (onError) onError(cbErr as Error)
            }
        } catch (err) {
            logger.error(
                'Erreur de traitement audio :' + (err instanceof Error ? err.message : String(err))
            )
            if (onError) onError(err as Error)
        }
    })

    stream.on('error', (err: Error) => {
        logger.error('Erreur du flux micro :' + (err instanceof Error ? err.message : String(err)))
        if (onError) onError(err)
    })

    // Optionnel : gestion hotplug (déconnexion/reconnexion)
    // stream.on('close', ...)

    return mic
}
