import { useState, useRef, useEffect } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  Mic,
  StopCircle,
  RotateCcw,
  Info,
  Loader2,
  Sparkles,
  Flame,
  Plus,
  Trophy,
  PlayCircle,
} from "lucide-react"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"
import TalkingHeadAvatar from "@/components/ui/TalkingHeadAvatar"

// ── Convert any audio blob to 16 kHz mono WAV ────────────────────────────────
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

const categoryColor = {
  "Warm-Up":         "bg-blue-50 text-blue-600",
  Articulation:      "bg-[#2A9D8F]/10 text-[#2A9D8F]",
  Phonation:         "bg-purple-50 text-purple-600",
  Respiration:       "bg-amber-50 text-amber-600",
  "Connected Speech": "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  "Cool-Down":       "bg-slate-100 text-slate-500",
  "Bonus":           "bg-pink-50 text-pink-600",
}

const SEV_BADGE = {
  Healthy:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  Moderate: "bg-amber-100   text-amber-700   border-amber-200",
  Severe:   "bg-red-100     text-red-700     border-red-200",
}

// ── Live word-highlighting component ─────────────────────────────────────────
function HighlightedText({ text, activeWord }) {
  if (!activeWord) return <span>{text}</span>
  return (
    <span>
      {text.split(/(\s+)/).map((token, i) => {
        const clean = token.toLowerCase().replace(/[^a-z']/g, "")
        return clean && clean === activeWord
          ? <mark key={i} className="bg-[#2A9D8F]/20 text-[#1E3A5F] rounded px-0.5 not-italic">{token}</mark>
          : <span key={i}>{token}</span>
      })}
    </span>
  )
}

// ── Mini recorder hook ────────────────────────────────────────────────────────
function useMiniRecorder(token) {
  const [recording, setRecording]   = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const mediaRecRef                 = useRef(null)
  const chunksRef                   = useRef([])

  function reset() { setResult(null); setError(null); setRecording(false); setAnalyzing(false) }

  async function start() {
    setResult(null); setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        setAnalyzing(true)
        try {
          const raw = new Blob(chunksRef.current, { type: "audio/webm" })
          const wav = await toWavBlob(raw)
          const fd  = new FormData()
          fd.append("file", wav, "recording.wav")
          const res = await fetch(`${API_BASE}/api/analyze`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          })
          if (!res.ok) throw new Error()
          setResult(await res.json())
        } catch {
          setError("Analysis failed. Please try again.")
        } finally {
          setAnalyzing(false)
        }
      }
      mr.start()
      mediaRecRef.current = mr
      setRecording(true)
    } catch {
      setError("Microphone access denied.")
    }
  }

  function stop() {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop()
    }
  }

  return { recording, analyzing, result, error, start, stop, reset }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TherapyExercisePage() {
  const { user }  = useUser()
  const token     = getToken()

  // Plan state
  const [exercises, setExercises]     = useState([])
  const [streak, setStreak]           = useState(0)
  const [alreadyDone, setAlreadyDone] = useState(false)   // completed before this page load
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [planError, setPlanError]     = useState(null)

  // Session progress state
  const [current, setCurrent]       = useState(0)
  const [completed, setCompleted]   = useState([])
  const [saving, setSaving]         = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false) // completed during this render

  // Extra exercises state
  const [extraLoading, setExtraLoading] = useState(false)
  const extraStartRef = useRef(null)          // index of first bonus exercise
  const initiallyCompletedRef = useRef(false) // was today already done on load

  const recorder = useMiniRecorder(token)
  const avatarRef = useRef(null)
  const [speaking, setSpeaking]   = useState(false)
  const [activeWord, setActiveWord] = useState("")

  useEffect(() => { loadTodayPlan() }, [])
  useEffect(() => {
    recorder.reset()
    avatarRef.current?.stop()
    setActiveWord("")
  }, [current])

  // Pre-warm backend TTS cache so audio is ready before the user clicks "Read aloud"
  useEffect(() => {
    if (!exercises.length || !token) return
    const ex = exercises[current]
    if (!ex) return
    const parts = [ex.title, ex.instruction]
    if (ex.prompt) parts.push("Practice prompt: " + ex.prompt)
    fetch(`${API_BASE}/api/tts?text=${encodeURIComponent(parts.join(". "))}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }, [current, exercises]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTodayPlan() {
    setLoadingPlan(true)
    setPlanError(null)
    try {
      const res = await fetch(`${API_BASE}/api/exercise-plans/today`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const exs = data.exercises ?? []
      setExercises(exs)
      setStreak(data.streak ?? 0)
      setAlreadyDone(data.completed)
      initiallyCompletedRef.current = data.completed
      if (data.completed) setCompleted(exs.map((_, i) => i))
    } catch {
      setPlanError("Could not load today's exercise plan. Please try again.")
    } finally {
      setLoadingPlan(false)
    }
  }

  async function completeSession() {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/exercise-plans/today/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setStreak(data.streak ?? streak + 1)
      setSessionSaved(true)
    } catch {
      // silently ignore
    } finally {
      setSaving(false)
    }
  }

  async function getExtraExercises() {
    setExtraLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/exercise-plans/extra`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const bonus = (data.exercises ?? []).map(ex => ({ ...ex, is_extra: true, category: "Bonus" }))
      setExercises(prev => {
        extraStartRef.current = prev.length
        return [...prev, ...bonus]
      })
      // Navigate to first bonus exercise and enter stepper
      setAlreadyDone(false)
      setCurrent(extraStartRef.current ?? 0)
    } catch {
      // silently ignore
    } finally {
      setExtraLoading(false)
    }
  }

  function markDoneAndNext() {
    if (!completed.includes(current)) setCompleted(c => [...c, current])
    if (current < exercises.length - 1) setCurrent(c => c + 1)
  }

  const exercise    = exercises[current]
  const coreCount   = exercises.filter(e => !e.is_extra).length
  const extraCount  = exercises.filter(e => e.is_extra).length
  const progress    = exercises.length ? Math.round((completed.length / exercises.length) * 100) : 0
  const isCompleted = exercise && completed.includes(current)
  const allDone     = exercises.length > 0 && completed.length === exercises.length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppLayout role="patient">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#2A9D8F]" />
            Therapy Exercises
          </h1>
          <p className="text-sm text-[#64748b] mt-1">Your AI-personalised daily plan</p>
        </div>
        {streak > 0 && !loadingPlan && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 shrink-0">
            <Flame className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">{streak}-day streak</span>
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {loadingPlan ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#64748b]">
          <Loader2 className="h-8 w-8 animate-spin text-[#2A9D8F]" />
          <p className="text-sm">Loading today&apos;s exercise plan…</p>
        </div>

      /* ── Error ── */
      ) : planError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-red-500 text-sm">{planError}</p>
            <Button variant="outline" size="sm" onClick={loadTodayPlan}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Try Again
            </Button>
          </CardContent>
        </Card>

      /* ── Already completed today — offer extras ── */
      ) : alreadyDone && !sessionSaved ? (
        <Card>
          <CardContent className="pt-12 pb-10 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border-2 border-amber-200">
                <Flame className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1E3A5F]">
                Today&apos;s session is complete!
              </h2>
              <p className="text-sm text-[#64748b] mt-1">
                You&apos;re on a{" "}
                <span className="font-semibold text-amber-600">{streak}-day streak</span>.
                Come back tomorrow for your next plan.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center pt-1">
              <Button
                variant="outline"
                onClick={getExtraExercises}
                disabled={extraLoading}
              >
                {extraLoading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Plus className="mr-2 h-4 w-4" />}
                Get Extra Exercises
              </Button>
              <Button onClick={() => window.location.href = "/patient/report"}>
                <Trophy className="mr-2 h-4 w-4" />
                View Report
              </Button>
            </div>
          </CardContent>
        </Card>

      /* ── Main exercise layout ── */
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left: Stepper + streak + extra button ── */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Progress</CardTitle>
                <div className="space-y-1.5 mt-1">
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>{completed.length} of {exercises.length} done</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
                {extraCount > 0 && (
                  <p className="text-xs text-pink-500 mt-1">+{extraCount} bonus</p>
                )}
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="space-y-0.5">
                  {exercises.map((ex, idx) => {
                    const done   = completed.includes(idx)
                    const active = idx === current
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrent(idx)}
                        className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors ${
                          active ? "bg-[#1E3A5F] text-white" : "hover:bg-[#F1F5F9] text-[#334155]"
                        } ${ex.is_extra ? "border-l-2 border-pink-300" : ""}`}
                      >
                        <span className="shrink-0">
                          {done ? (
                            <CheckCircle2 className={`h-3.5 w-3.5 ${active ? "text-[#2A9D8F]" : "text-emerald-500"}`} />
                          ) : (
                            <Circle className={`h-3.5 w-3.5 ${active ? "text-white/60" : "text-[#cbd5e1]"}`} />
                          )}
                        </span>
                        <span className="truncate text-left">{ex.title}</span>
                        {ex.requires_recording && (
                          <Mic className={`ml-auto h-3 w-3 shrink-0 ${active ? "text-[#2A9D8F]" : "text-[#94a3b8]"}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Get extra exercises */}
            <Button
              variant="outline"
              size="sm"
              className="w-full border-pink-200 text-pink-600 hover:bg-pink-50"
              onClick={getExtraExercises}
              disabled={extraLoading}
            >
              {extraLoading
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <Plus className="mr-2 h-3.5 w-3.5" />}
              Get Extra Exercises
            </Button>
          </div>

          {/* ── Right: Exercise card ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── All done + session saved (or bonus session done) ── */}
            {sessionSaved || (allDone && initiallyCompletedRef.current) ? (
              <Card>
                <CardContent className="pt-12 pb-10 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border-2 border-amber-200">
                      <Flame className="h-8 w-8 text-amber-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1E3A5F]">
                      {initiallyCompletedRef.current && !sessionSaved
                        ? "Bonus session complete! 🌟"
                        : `${streak}-day streak! 🎉`}
                    </h2>
                    <p className="text-sm text-[#64748b] mt-1">
                      {initiallyCompletedRef.current && !sessionSaved
                        ? "Great extra work! Come back tomorrow to keep your streak going."
                        : "Session saved. Come back tomorrow to keep your streak going."}
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={getExtraExercises}
                      disabled={extraLoading}
                    >
                      {extraLoading
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Plus className="mr-2 h-4 w-4" />}
                      More Exercises
                    </Button>
                    <Button onClick={() => window.location.href = "/patient/report"}>
                      <Trophy className="mr-2 h-4 w-4" />
                      View Report
                    </Button>
                  </div>
                </CardContent>
              </Card>

            /* ── All done, awaiting save (new session, not already completed) ── */
            ) : allDone ? (
              <Card>
                <CardContent className="pt-10 pb-10 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <h2 className="text-xl font-bold text-[#1E3A5F]">All exercises done!</h2>
                  <p className="text-sm text-[#64748b] max-w-sm mx-auto">
                    Great work — {exercises.filter(e => !e.is_extra).length} exercises completed.
                    Save your session to extend your streak.
                  </p>
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-white px-6"
                    onClick={completeSession}
                    disabled={saving}
                  >
                    {saving
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Flame className="mr-2 h-4 w-4" />}
                    Save Session &amp; Extend Streak
                  </Button>
                </CardContent>
              </Card>

            /* ── Exercise card ── */
            ) : exercise ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${categoryColor[exercise.category] || "bg-slate-100 text-slate-500"}`}>
                          {exercise.is_extra ? "Bonus" : exercise.category}
                        </span>
                        <span className="text-xs text-[#94a3b8]">{exercise.duration}</span>
                        {exercise.requires_recording && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-[#2A9D8F]/10 text-[#2A9D8F]">
                            Recording
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg text-[#1E3A5F]">{exercise.title}</CardTitle>
                      <CardDescription>Step {current + 1} of {exercises.length}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCompleted && <Badge variant="mild">Done</Badge>}
                      <button
                        onClick={() => {
                          if (speaking) {
                            avatarRef.current?.stop()
                            setSpeaking(false)
                            setActiveWord("")
                          } else {
                            const parts = [exercise.title, exercise.instruction]
                            if (exercise.prompt) parts.push("Practice prompt: " + exercise.prompt)
                            avatarRef.current?.speak(parts.join(". "), setActiveWord)
                          }
                        }}
                        title={speaking ? "Stop" : "Read aloud"}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          speaking
                            ? "bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"
                            : "bg-[#2A9D8F]/10 text-[#2A9D8F] hover:bg-[#2A9D8F]/20 border border-[#2A9D8F]/30"
                        }`}
                      >
                        {speaking
                          ? <><StopCircle className="h-3.5 w-3.5" /> Stop</>
                          : <><PlayCircle className="h-3.5 w-3.5" /> Read aloud</>}
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* 3-D Talking avatar — lazy-loads from CDN on first render */}
                  <TalkingHeadAvatar
                    ref={avatarRef}
                    onSpeakingChange={setSpeaking}
                    className="w-full h-52"
                  />

                  {/* Instruction */}
                  <div className="rounded-md border border-[#e2e8f0] bg-[#F1F5F9] p-4 w-full">
                    <p className="text-sm text-[#334155] leading-relaxed"><HighlightedText text={exercise.instruction} activeWord={activeWord} /></p>
                  </div>

                  {/* Prompt */}
                  {exercise.prompt && (
                    <div className="flex items-start gap-2 rounded-md border border-[#2A9D8F]/30 bg-[#2A9D8F]/5 px-4 py-3">
                      <Mic className="h-4 w-4 shrink-0 text-[#2A9D8F] mt-0.5" />
                      <p className="text-sm text-[#334155] italic">{exercise.prompt}</p>
                    </div>
                  )}

                  {/* Tips */}
                  {exercise.tips?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2 flex items-center gap-1.5">
                        <Info className="h-3 w-3" /> Tips
                      </p>
                      <ul className="space-y-1">
                        {exercise.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#64748b]">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2A9D8F]" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── Mini recorder ── */}
                  {exercise.requires_recording && (
                    <div className="rounded-md border border-[#e2e8f0] bg-white p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                        Record &amp; Analyse
                      </p>

                      {recorder.error && (
                        <p className="text-xs text-red-500">{recorder.error}</p>
                      )}

                      {!recorder.analyzing && !recorder.result && (
                        <div className="flex gap-2">
                          {!recorder.recording ? (
                            <Button
                              size="sm"
                              onClick={recorder.start}
                              className="bg-[#2A9D8F] hover:bg-[#238a7e] text-white"
                            >
                              <Mic className="mr-1.5 h-3.5 w-3.5" />
                              Start Recording
                            </Button>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={recorder.stop}>
                              <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                              Stop &amp; Analyse
                            </Button>
                          )}
                        </div>
                      )}

                      {recorder.recording && (
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          Recording…
                        </div>
                      )}

                      {recorder.analyzing && (
                        <div className="flex items-center gap-2 text-xs text-[#64748b]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Analysing speech…
                        </div>
                      )}

                      {recorder.result && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${SEV_BADGE[recorder.result.severity] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                              {recorder.result.severity}
                            </span>
                            <span className="text-sm text-[#1E3A5F] font-semibold">
                              {Math.round(recorder.result.score)}
                              <span className="text-xs font-normal text-[#94a3b8]">/100</span>
                            </span>
                            <span className="text-xs text-[#94a3b8]">
                              {Math.round(recorder.result.confidence * 100)}% confidence
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={recorder.reset}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" /> Record Again
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* ── Navigation ── */}
            {!allDone && !sessionSaved && exercise && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={current === 0}
                  onClick={() => setCurrent(c => c - 1)}
                >
                  <ChevronLeft className="mr-1.5 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  className="flex-1 bg-[#1E3A5F] hover:bg-[#16304f] text-white"
                  onClick={markDoneAndNext}
                >
                  {isCompleted
                    ? current < exercises.length - 1 ? "Next Exercise" : "Finish"
                    : current < exercises.length - 1 ? "Mark Done & Next" : "Mark Done"}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
