import { useState, useRef, useEffect } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Mic, MicOff, Upload, RotateCcw, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"
// Convert any audio blob to 16 kHz mono WAV using the Web Audio API.
// MediaRecorder produces audio/webm which librosa cannot decode on Windows without ffmpeg.
async function toWavBlob(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext()
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)
  await audioCtx.close()

  const TARGET_SR = 16000
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET_SR), TARGET_SR)
  const source = offlineCtx.createBufferSource()
  source.buffer = decoded
  source.connect(offlineCtx.destination)
  source.start()
  const rendered = await offlineCtx.startRendering()

  // Encode as 16-bit PCM WAV
  const samples = rendered.getChannelData(0)
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)))
  }
  const wavBuffer = new ArrayBuffer(44 + pcm.byteLength)
  const v = new DataView(wavBuffer)
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.byteLength, true); str(8, "WAVE")
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, 1, true); v.setUint32(24, TARGET_SR, true)
  v.setUint32(28, TARGET_SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, "data"); v.setUint32(40, pcm.byteLength, true)
  new Int16Array(wavBuffer, 44).set(pcm)
  return new Blob([wavBuffer], { type: "audio/wav" })
}

const SEVERITY_CONFIG = {
  Control: {
    variant: "mild",
    message: "No dysarthric speech markers were detected by the current model. Speech characteristics are closest to the control group.",
  },
  Dysarthric: {
    variant: "severe",
    message: "The current model detected dysarthric speech patterns in this sample. Review the acoustic markers below and continue with targeted exercises.",
  },
  Healthy: {
    variant: "mild",
    message: "No dysarthria detected. Speech intelligibility is normal. Keep up your exercises to maintain performance.",
  },
  Mild: {
    variant: "mild",
    message: "Mild dysarthria detected. Speech intelligibility is mostly preserved. Continue with your exercise programme.",
  },
  Moderate: {
    variant: "moderate",
    message: "Moderate dysarthria detected. Some loss of intelligibility. Consider increasing your exercise frequency.",
  },
  Severe: {
    variant: "severe",
    message: "Severe dysarthria detected. Significant speech intelligibility impairment. Please follow the recommended exercises consistently.",
  },
}

// Real-time microphone waveform driven by Web Audio API AnalyserNode
function Waveform({ active, stream }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")

    if (!active || !stream) {
      // Draw flat idle line
      cancelAnimationFrame(rafRef.current)
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = "#cbd5e1"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
      return
    }

    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const source   = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    analyserRef.current = analyser
    const dataArray = new Uint8Array(analyser.fftSize)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      ctx.lineWidth = 2
      ctx.strokeStyle = "#2A9D8F"
      ctx.shadowColor = "#2A9D8F"
      ctx.shadowBlur = 6
      ctx.beginPath()

      const sliceWidth = W / dataArray.length
      let x = 0
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * H) / 2
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(W, H / 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      audioCtx.close()
    }
  }, [active, stream])

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={64}
      className="w-full h-16 rounded"
    />
  )
}

export default function RecordDetectPage() {
  const { user } = useUser()
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [result, setResult] = useState(null) // full API response object
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioBlobRef = useRef(null)
  const fileInputRef = useRef(null)
  const resultRef = useRef(null)
  const [liveStream, setLiveStream] = useState(null)

  useEffect(() => {
    if (recording) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [recording])

  async function handleStartStop() {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
    } else {
      setError(null)
      setResult(null)
      setElapsed(0)
      chunksRef.current = []
      audioBlobRef.current = null
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setLiveStream(stream)
        const mr = new MediaRecorder(stream)
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop())
          setLiveStream(null)
          try {
            const raw = new Blob(chunksRef.current, { type: "audio/webm" })
            audioBlobRef.current = await toWavBlob(raw)
          } catch {
            audioBlobRef.current = new Blob(chunksRef.current, { type: "audio/webm" })
          }
          setRecorded(true)
          setTimeout(() => handleAnalyze(), 100)
        }
        mr.start()
        mediaRecorderRef.current = mr
        setRecording(true)
        setRecorded(false)
      } catch (e) {
        setError("Microphone access denied. Please allow microphone permission and try again.")
      }
    }
  }

  function handleReset() {
    setRecording(false)
    setRecorded(false)
    setResult(null)
    setError(null)
    setElapsed(0)
    setLiveStream(null)
    audioBlobRef.current = null
    chunksRef.current = []
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setError(null)
    setElapsed(0)
    try {
      audioBlobRef.current = await toWavBlob(file)
    } catch {
      audioBlobRef.current = file
    }
    setRecorded(true)
    setTimeout(() => handleAnalyze(), 100)
  }

  async function handleAnalyze() {
    if (!audioBlobRef.current) return
    setAnalyzing(true)
    setError(null)
    setAnalyzeProgress(10)
    try {
      setAnalyzeProgress(25)
      const token = getToken()
      setAnalyzeProgress(50)
      const form = new FormData()
      form.append("file", audioBlobRef.current, "recording.wav")
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      setAnalyzeProgress(85)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setAnalyzeProgress(100)
      setResult(data)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    } catch (e) {
      console.error("Analysis error:", e)
      setError(e.message || "Analysis failed. Please try again.")
    } finally {
      setAnalyzing(false)
      setAnalyzeProgress(0)
    }
  }

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  const severity = result?.severity
  const config = severity ? SEVERITY_CONFIG[severity] ?? {
    variant: "outline",
    message: `Model returned \"${severity}\" for this recording.`,
  } : null
  const isBinaryModel = severity === "Control" || severity === "Dysarthric"
  const severityScale = isBinaryModel
    ? ["Control", "Dysarthric"]
    : ["Severe", "Moderate", "Mild", "Healthy"]
  const isPositiveOutcome = ["Healthy", "Mild", "Control"].includes(severity)

  return (
    <AppLayout role="patient" userName={user?.full_name || ""}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Record & Detect</h1>
        <p className="text-sm text-[#64748b] mt-1">Record a speech sample to assess your current dysarthria severity.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recorder card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="h-4 w-4 text-[#2A9D8F]" />
              Speech Recorder
            </CardTitle>
            <CardDescription>Read the prompted sentence aloud while recording.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prompt sentence */}
            <div className="rounded-md border border-[#e2e8f0] bg-[#F1F5F9] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-1">Read aloud:</p>
              <p className="text-sm text-[#334155] italic leading-relaxed">
                "The quick brown fox jumps over the lazy dog near the river bank."
              </p>
            </div>

            {/* Waveform */}
            <div className="rounded-md border border-[#e2e8f0] bg-white px-4 py-4">
              <Waveform active={recording} stream={liveStream} />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-[#94a3b8]">
                  {recording ? "Recording…" : recorded ? "Recording complete" : "Waiting to record"}
                </span>
                <span className="text-xs font-mono text-[#64748b]">{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <Button
                size="lg"
                variant={recording ? "destructive" : "default"}
                className="flex-1"
                onClick={handleStartStop}
              >
                {recording ? (
                  <><MicOff className="mr-2 h-4 w-4" /> Stop Recording</>
                ) : (
                  <><Mic className="mr-2 h-4 w-4" /> {recorded ? "Re-record" : "Start Recording"}</>
                )}
              </Button>
              {recorded && !recording && (
                <Button variant="outline" size="lg" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Upload alternative */}
            <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
              <div className="flex-1 h-px bg-[#e2e8f0]" />
              or
              <div className="flex-1 h-px bg-[#e2e8f0]" />
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <Button variant="outline" className="w-full" size="sm" onClick={handleUploadClick}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Audio File (.wav / .mp3 / .webm)
            </Button>
          </CardContent>
        </Card>

        {/* Analysis card */}
        <div className="space-y-4">
          {/* Submit button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                className="w-full"
                size="lg"
                disabled={!recorded || analyzing}
                onClick={handleAnalyze}
                variant="secondary"
              >
                {analyzing ? "Analysing…" : "Submit for Analysis"}
              </Button>
              {analyzing && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>Extracting acoustic features…</span>
                    <span>{analyzeProgress}%</span>
                  </div>
                  <Progress value={analyzeProgress} className="transition-all duration-500" />
                </div>
              )}
              {error && (
                <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-0.5">Analysis failed</p>
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result card */}
          <div ref={resultRef}>
            {result && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Analysis Result</CardTitle>
                    <Badge variant={config.variant} className="text-sm px-3 py-1">
                      {severity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Score meter */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-[#64748b]">Speech intelligibility score</span>
                      <span className="text-sm font-bold text-[#1E3A5F]">{result.score.toFixed(1)}/100</span>
                    </div>
                    <Progress value={result.score} />
                  </div>

                  {/* Confidence */}
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>Model confidence</span>
                    <span className="font-medium text-[#334155]">{(result.confidence * 100).toFixed(1)}%</span>
                  </div>

                  {/* Severity scale */}
                  <div className="flex gap-1 text-[10px] font-medium">
                    {severityScale.map((s) => (
                      <div
                        key={s}
                        className={`flex-1 text-center rounded py-1 ${
                          s === severity
                            ? s === "Healthy" || s === "Mild" || s === "Control"
                              ? "bg-emerald-100 text-emerald-700"
                              : s === "Moderate"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                            : "bg-[#F1F5F9] text-[#94a3b8]"
                        }`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>

                  {/* Message */}
                  <div className="flex gap-2 rounded-md border border-[#e2e8f0] bg-[#F1F5F9] p-3">
                    {isPositiveOutcome ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    )}
                    <p className="text-xs text-[#334155] leading-relaxed">{config.message}</p>
                  </div>

                  {/* Acoustic features */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2">
                      Acoustic Features Analysed
                    </p>
                    <div className="space-y-2">
                      {[
                        { label: "Pitch Mean (F0)", value: result.acoustic_features.f0_mean, max: 300, unit: " Hz" },
                        { label: "Pitch Stability", value: Math.max(0, 100 - (result.acoustic_features.f0_std / 50) * 100), max: 100, unit: "%" },
                        { label: "Voice Onset (Voiced)", value: (1 - result.acoustic_features.unvoiced_ratio) * 100, max: 100, unit: "%" },
                        { label: "Pause Ratio", value: result.acoustic_features.pause_ratio * 100, max: 100, unit: "%" },
                      ].map(({ label, value, max, unit }) => {
                        const pct = Math.min(100, Math.max(0, (value / max) * 100))
                        return (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-[#64748b]">{label}</span>
                              <span className="text-xs font-medium text-[#334155]">{value.toFixed(1)}{unit}</span>
                            </div>
                            <Progress value={pct} className="h-1" />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-[#94a3b8]">Session #{result.session_id} saved • Duration: {result.audio_duration_s.toFixed(1)}s</p>
                </CardContent>
              </Card>
            )}

            {/* Info card if no result yet */}
            {!result && !analyzing && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 shrink-0 text-[#2A9D8F]" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#1E3A5F]">How analysis works</p>
                      <p className="text-xs text-[#64748b] leading-relaxed">
                        The AI model extracts acoustic features — pitch, articulation rate, voice quality, and pause patterns —
                        then classifies the current recording using the trained model labels returned by the backend.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
