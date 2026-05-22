import { execa } from "execa"
import path from "path"

export function startWakeWord(
  onDetect: () => void
) {

  const script =
    path.join(
      process.cwd(),
      "resources",
      "wake_word_listener.py"
    )

  const model =
    path.join(
      process.cwd(),
      "resources",
      "jarvis.onnx"
    )

  const proc = execa(
    "python3",
    [
      script,
      "--model",
      model
    ]
  )

  proc.stdout?.on(
    "data",
    (data) => {

      const text =
        data.toString().trim()

      console.log(
        "[wakeword]",
        text
      )

      if (text === "DETECTED") {
        onDetect()
      }
    }
  )

  proc.stderr?.on(
    "data",
    (data) => {
      console.log(
        "[wakeword:err]",
        data.toString()
      )
    }
  )

  return proc
}