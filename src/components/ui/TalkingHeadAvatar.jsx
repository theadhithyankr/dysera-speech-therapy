import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { Loader2 } from "lucide-react"

const TH_URL     = "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7.0/modules/talkinghead.mjs"
const AVATAR_URL = "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7.0/avatars/brunette.glb"

const TalkingHeadAvatar = forwardRef(function TalkingHeadAvatar(
  { onSpeakingChange, className = "" },
  ref
) {
  const containerRef = useRef(null)
  const headRef      = useRef(null)
  const [status, setStatus] = useState("idle") // idle | loading | ready | error

  useImperativeHandle(ref, () => ({
    speak(text, onWord) {
      if (!headRef.current || status !== "ready") return false
      const head = headRef.current

      // Resume AudioContext synchronously — must be in the user-gesture call stack
      head.audioContext?.resume().catch(() => {})

      onSpeakingChange?.(true)

      // speakText drives both audio AND lip-sync via our ttsEndpoint.
      // We wrap it in a promise so we can clean up when done.
      head.speakText(text, { lipsyncLang: "en" },
        () => { onWord?.(""); onSpeakingChange?.(false) }
      )

      return true
    },

    stop() {
      try { headRef.current?.stopSpeaking() } catch { /* ignore */ }
      onSpeakingChange?.(false)
    }
  }), [status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true

    async function init() {
      setStatus("loading")
      try {
        const { TalkingHead } = await import(/* @vite-ignore */ TH_URL)
        if (!mounted) return

        const head = new TalkingHead(containerRef.current, {
          // Point to our backend POST /api/tts — TalkingHead sends {text,lang}, gets MP3 back
          ttsEndpoint:        "/api/tts",
          ttsLang:            "en-US",
          cameraView:         "head",
          cameraRotateEnable: false,
          cameraZoomEnable:   false,
          cameraEnable:       false,
        })

        await head.showAvatar({
          url:         AVATAR_URL,
          body:        "F",
          avatarMood:  "neutral",
          ttsLang:     "en-US",
          lipsyncLang: "en",
        })

        headRef.current = head
        if (mounted) setStatus("ready")
      } catch (err) {
        console.warn("TalkingHead failed to load:", err)
        if (mounted) setStatus("error")
      }
    }

    init()

    return () => {
      mounted = false
      try { headRef.current?.stopSpeaking() } catch { /* ignore */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`relative rounded-xl overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{ background: "linear-gradient(160deg,#1a1a3e 0%,#0f2d2d 100%)" }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 pointer-events-none">
          <Loader2 className="h-6 w-6 animate-spin text-[#2A9D8F]" />
          <span className="text-xs">Loading avatar…</span>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/40 text-xs text-center px-3">3-D avatar unavailable</span>
        </div>
      )}

      {status === "ready" && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-[#2A9D8F]/40 pointer-events-none" />
      )}
    </div>
  )
})

export default TalkingHeadAvatar