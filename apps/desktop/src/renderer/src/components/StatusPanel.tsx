import { useEffect, useState } from "react"
import {
  runtimeState,
  type RuntimeState,
} from "../runtime/runtime-state"

export default function StatusPanel() {
  const [state, setState] = useState<RuntimeState>(
    runtimeState.getState()
  )

  useEffect(() => {
    return runtimeState.subscribe(setState)
  }, [])

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 320,

        padding: 20,

        borderRadius: 20,

        background: "rgba(10,10,15,0.6)",

        backdropFilter: "blur(20px)",

        border: "1px solid rgba(255,255,255,0.08)",

        color: "white",

        fontFamily: "sans-serif",
      }}
    >
      <h3>Jarvis Runtime</h3>

      <p>Mode: {state.mode}</p>

      <p>
        Wake Word:{" "}
        {state.wakeWordEnabled ? "Enabled" : "Disabled"}
      </p>

      <p>
        Mic:{" "}
        {state.microphoneMuted ? "Muted" : "Active"}
      </p>

      <p>
        Tool: {state.activeTool ?? "None"}
      </p>
    </div>
  )
}