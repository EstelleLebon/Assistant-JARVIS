interface Window {
  jarvis: {
    wakewordLoaded: () => Promise<boolean>
    sendAudioChunk: (chunk: Float32Array) => void
    onWake: (
      callback: () => void
    ) => void
  }
}