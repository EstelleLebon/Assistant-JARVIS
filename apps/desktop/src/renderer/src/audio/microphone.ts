export async function startMicrophone(onChunk: (data: Float32Array) => void) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    })

    const context = new AudioContext({
        sampleRate: 16000
    })

    await context.audioWorklet.addModule('/audio-processor.js')

    const source = context.createMediaStreamSource(stream)

    const worklet = new AudioWorkletNode(context, 'jarvis-processor')

    worklet.port.onmessage = (event) => {
        onChunk(new Float32Array(event.data))
    }

    source.connect(worklet)

    return {
        stop() {
            source.disconnect()
            worklet.disconnect()

            stream.getTracks().forEach((t) => t.stop())

            context.close()
        }
    }
}
