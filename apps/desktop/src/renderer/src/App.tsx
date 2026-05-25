import OrbCanvas from './orb/OrbCanvas'
import StatusPanel from './components/StatusPanel'
import { useEffect } from 'react'
import { startMicrophone } from './audio/microphone'

function App() {
    useEffect(() => {
        startMicrophone((chunk) => {
            window.jarvis.sendAudioChunk(chunk)
        })
    }, [])

    useEffect(() => {
        window.jarvis.onWake(() => {
            console.log('WAKE')

            // orb → listening
            // son
            // ouvrir STT
        })
    }, [])

    window.electron.ipcRenderer.on('assistant:partial_transcript', (_, text) => {
        console.log('partial:', text)
    })

    window.electron.ipcRenderer.on('assistant:final_transcript', (_, text) => {
        console.log('final:', text)
    })

    return (
        <div className="app">
            <OrbCanvas />
            <StatusPanel />
        </div>
    )
}

export default App
