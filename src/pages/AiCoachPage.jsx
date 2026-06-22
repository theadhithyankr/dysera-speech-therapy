import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, Activity, Loader2, Mic, CheckCircle2 } from "lucide-react"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"

const SEVERITY_COLOR = {
  Healthy:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  Moderate: "bg-amber-100  text-amber-700  border-amber-200",
  Severe:   "bg-red-100    text-red-700    border-red-200",
  Unknown:  "bg-slate-100  text-slate-600  border-slate-200",
}

const WELCOME = {
  Healthy:  "Great news — your last assessment shows healthy speech patterns! Keep up the good work with maintenance exercises below.",
  Moderate: "Your last assessment detected moderate dysarthria. Regular practice of the exercises below can make a real difference — let's keep going.",
  Severe:   "Your last assessment shows severe dysarthria. Take it one step at a time — even small daily practice leads to meaningful progress.",
  Unknown:  "No assessment on record yet. Record an audio sample on the Record & Detect page to get your personalised coaching.",
}

export default function AiCoachPage() {
  const { user } = useUser()
  const token = getToken()
  const [severity, setSeverity]   = useState("Unknown")
  const [score, setScore]         = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [exercises, setExercises]       = useState([])
  const [exercisesLoading, setExercisesLoading] = useState(false)

  // Fetch the most recent session then generate AI exercises
  useEffect(() => {
    fetch(`${API_BASE}/api/sessions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(async data => {
        let sev = "Moderate", sc = 50
        if (Array.isArray(data) && data[0]) {
          sev = data[0].severity ?? "Moderate"
          sc  = data[0].score    ?? 50
          setSeverity(sev)
          setScore(Math.round(sc))
        }
        // Generate personalised exercises
        setExercisesLoading(true)
        try {
          const exRes = await fetch(`${API_BASE}/api/ai-coach/exercises`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ severity: sev, score: sc }),
          })
          const exData = await exRes.json()
          setExercises(exData.exercises ?? [])
        } catch {}
        finally { setExercisesLoading(false) }
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false))
  }, [])

  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef             = useRef(null)

  // Load chat history once session severity is loaded
  useEffect(() => {
    if (!sessionLoading) {
      fetch(`${API_BASE}/api/ai-coach/chat/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data.map(m => ({ role: m.role, text: m.content })))
          } else {
            setMessages([{
              role: "assistant",
              text: `Hi! I'm Vibra, your AI speech coach. ${WELCOME[severity]} Feel free to ask me anything about your exercises or condition.`,
            }])
          }
        })
        .catch(() => {
          setMessages([{
            role: "assistant",
            text: `Hi! I'm Vibra, your AI speech coach. ${WELCOME[severity]} Feel free to ask me anything about your exercises or condition.`,
          }])
        })
    }
  }, [sessionLoading, severity])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])
  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: "user", text }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    // Build history for context (last 20 messages before this one)
    const historyToSend = messages
      .slice(-20)
      .map(m => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch(`${API_BASE}/api/ai-coach/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          severity,
          score: score ?? 50,
          history: historyToSend,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "assistant",
        text: data.reply || data.detail || "Sorry, I couldn't get a response.",
        added_exercise: data.added_exercise || null,
      }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. Please make sure the backend is running." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout role="patient">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F] flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#2A9D8F]" />
            Vibra
          </h1>
          <p className="text-sm text-[#64748b] mt-1">Your AI speech coach — personalised exercises and guidance.</p>
        </div>
        {severity !== "Unknown" && (
          <div className="flex items-center gap-3">
            <Badge className={`text-xs border ${SEVERITY_COLOR[severity]}`}>{severity}</Badge>
            {score !== null && (
              <span className="flex items-center gap-1 text-sm text-[#64748b]">
                <Activity className="h-3.5 w-3.5" /> Score: <strong className="text-[#1E3A5F]">{score}</strong>/100
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">

        {/* Exercise panel — left 2 cols */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wide">
              Today's Exercises
            </h2>
            {exercisesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#94a3b8]" />}
          </div>
          {exercisesLoading ? (
            <div className="flex items-center gap-2 text-xs text-[#94a3b8] py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating personalised plan…
            </div>
          ) : exercises.length === 0 ? (
            <Card className="border border-[#e2e8f0]">
              <CardContent className="py-8 text-center text-xs text-[#94a3b8]">
                No exercises yet — record a session first.
              </CardContent>
            </Card>
          ) : (
            exercises.map((ex, i) => (
              <Card key={i} className="border border-[#e2e8f0]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-semibold text-[#1E3A5F] truncate">{ex.title}</p>
                        {ex.requires_recording && (
                          <Mic className="h-3 w-3 shrink-0 text-[#2A9D8F]" />
                        )}
                      </div>
                      <p className="text-xs text-[#64748b] mt-0.5 leading-snug line-clamp-2">{ex.instruction}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[#2A9D8F] bg-[#f0faf9] rounded px-2 py-0.5 border border-[#b7e8e3]">
                      {ex.duration}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {exercises.length > 0 && (
            <Link
              to="/patient/therapy"
              className="block text-center text-xs text-[#2A9D8F] hover:underline pt-1"
            >
              Open full exercise session →
            </Link>
          )}
        </div>

        {/* Chat panel — right 3 cols */}
        <Card className="lg:col-span-3 flex flex-col h-[600px] border border-[#e2e8f0]">
          <CardHeader className="pb-3 border-b border-[#e2e8f0]">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#2A9D8F]" />
              Chat with Vibra
            </CardTitle>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F]">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5 max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1E3A5F] text-white rounded-tr-sm"
                        : "bg-[#F1F5F9] text-[#1E3A5F] rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.added_exercise && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>{msg.added_exercise.title}</strong> added to today's training</span>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e2e8f0]">
                    <User className="h-3.5 w-3.5 text-[#64748b]" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F]">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#94a3b8] animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-[#94a3b8] animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-[#94a3b8] animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-[#e2e8f0] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your exercises, progress, or condition…"
              disabled={loading}
              className="flex-1 rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F] disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="sm"
              className="bg-[#1E3A5F] hover:bg-[#16304f] text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </AppLayout>
  )
}
