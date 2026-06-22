import { useState, useRef, useEffect } from "react"
import { Bot, X, Send, Sparkles, Minus, Zap } from "lucide-react"
import { useLocation } from "react-router-dom"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"

// Page-aware quick prompts — shown as chips above the input
const PAGE_PROMPTS = {
  "/patient/report": [
    "Summarise my report",
    "What does my severity score mean?",
    "How can I improve my score?",
  ],
  "/patient/dashboard": [
    "How am I progressing?",
    "What should I focus on today?",
  ],
  "/patient/record": [
    "Tips for a good recording",
    "What acoustic features are measured?",
  ],
  "/patient/therapy": [
    "Explain today's exercises",
    "Add a breathing exercise to my plan",
    "Add a tongue twister exercise",
  ],
}

// Pill label per page
const PAGE_PILL_LABEL = {
  "/patient/report":    "Summarise Report",
  "/patient/dashboard": "How am I doing?",
  "/patient/record":    "Recording Tips",
  "/patient/therapy":   "Today's Exercises",
}

export default function FloatingChat() {
  const { user } = useUser()
  const { pathname } = useLocation()
  const token = getToken()

  const [open, setOpen]         = useState(false)
  const [minimised, setMinimised] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [severity, setSeverity] = useState("Moderate")
  const [score, setScore]       = useState(50)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const quickPrompts = PAGE_PROMPTS[pathname] ?? []
  const pillLabel    = PAGE_PILL_LABEL[pathname] ?? "Ask Vibra"

  // Load severity from latest session & chat history on first open
  useEffect(() => {
    if (!open || historyLoaded || !token) return
    setHistoryLoaded(true)

    // Fetch latest session for context
    fetch(`${API_BASE}/api/sessions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data[0]) {
          setSeverity(data[0].severity ?? "Moderate")
          setScore(data[0].score ?? 50)
        }
      })
      .catch(() => {})

    // Load chat history
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
            text: "Hi! I'm Vibra 👋 Ask me anything about your exercises or speech therapy.",
          }])
        }
      })
      .catch(() => {
        setMessages([{
          role: "assistant",
          text: "Hi! I'm Vibra 👋 Ask me anything about your exercises or speech therapy.",
        }])
      })
  }, [open])

  useEffect(() => {
    if (open && !minimised) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [messages, open, minimised])

  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    await _send(text)
  }

  async function sendQuick(text) {
    if (loading) return
    setOpen(true)
    setMinimised(false)
    await _send(text)
  }

  async function _send(text) {
    setMessages(prev => [...prev, { role: "user", text }])
    setInput("")
    setLoading(true)

    const historyToSend = messages.slice(-20).map(m => ({ role: m.role, content: m.text }))
    try {
      const res = await fetch(`${API_BASE}/api/ai-coach/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, severity, score, history: historyToSend }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "assistant",
        text: data.reply || "Sorry, I couldn't get a response.",
        added_exercise: data.added_exercise || null,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: "Connection error. Please make sure the backend is running.",
      }])
    } finally {
      setLoading(false)
    }
  }

  if (!user || pathname === "/patient/ai-coach") return null

  return (
    <>
      {/* Floating button — always visible */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimised(false) }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#1E3A5F] text-white px-4 py-3 shadow-lg hover:bg-[#16304f] transition-all"
        >
          <Sparkles className="h-4 w-4 text-[#2A9D8F]" />
          <span className="text-sm font-medium">{pillLabel}</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-80 transition-all duration-200 ${
            minimised ? "h-14" : "h-[460px]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#1E3A5F] rounded-t-2xl text-white shrink-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2A9D8F]">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="flex-1 text-sm font-semibold">Vibra</span>
            <button
              onClick={() => setMinimised(v => !v)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title={minimised ? "Expand" : "Minimise"}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!minimised && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] mt-0.5">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1 max-w-[82%]">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#1E3A5F] text-white rounded-tr-sm"
                          : "bg-[#F1F5F9] text-[#1E3A5F] rounded-tl-sm"
                      }`}>
                        {msg.text}
                      </div>
                      {msg.added_exercise && (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                          <span className="font-semibold">{msg.added_exercise.title}</span> added to today's training
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] mt-0.5">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-sm px-3 py-2">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompt chips — always visible when prompts exist for this page */}
              {quickPrompts.length > 0 && !loading && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-[#e2e8f0] pt-2">
                  {quickPrompts.map(q => (
                    <button
                      key={q}
                      onClick={() => sendQuick(q)}
                      className="flex items-center gap-1 text-[10px] bg-[#F1F5F9] hover:bg-[#e2e8f0] text-[#1E3A5F] border border-[#e2e8f0] rounded-full px-2.5 py-1 transition-colors"
                    >
                      <Zap className="h-2.5 w-2.5 text-[#2A9D8F]" />
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-[#e2e8f0] shrink-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask Vibra…"
                  disabled={loading}
                  className="flex-1 rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A9D8F] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex items-center justify-center rounded-lg bg-[#1E3A5F] hover:bg-[#16304f] text-white px-3 py-1.5 disabled:opacity-40 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
