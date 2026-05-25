class SpeechSession {
    private awake
    private speaking
    private speechEndTimeout

    start()
    stop()

    onSpeechStart()
    onSpeechEnd()

    pushAudio(samples)

    handlePartial(text)
    handleFinal(text)
}
