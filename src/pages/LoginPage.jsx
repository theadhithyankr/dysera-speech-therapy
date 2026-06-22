import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useUser } from "@/lib/UserContext"
import { API_BASE } from "@/lib/auth"

export default function LoginPage() {
  const navigate  = useNavigate()
  const { login }  = useUser()
  const [tab, setTab]           = useState("login")   // "login" | "register"
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [showPw, setShowPw]     = useState(false)

  // form fields
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let res, data

      if (tab === "login") {
        res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username: email, password }),
        })
      } else {
        res = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, full_name: fullName, role: "patient" }),
        })
      }

      data = await res.json()

      if (!res.ok) {
        setError(data.detail || "Something went wrong.")
        return
      }

      login(data)
      navigate("/patient/dashboard")
    } catch {
      setError("Unable to connect to server. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col">
      {/* Navbar */}
      <header className="border-b border-[#cbd5e1] bg-white h-14 flex items-center px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Dysera" className="h-7 w-7" />
          <span className="font-semibold text-[#1E3A5F] text-sm">Dysera</span>
        </Link>
      </header>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <img src="/favicon.svg" alt="Dysera" className="h-12 w-12" />
            </div>
            <CardTitle className="text-xl text-[#1E3A5F]">
              {tab === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {tab === "login"
                ? "Sign in to your Dysera account"
                : "Start your speech therapy journey today"}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Tab switcher */}
            <div className="flex rounded-lg bg-[#F1F5F9] p-1 mb-6">
              {["login", "register"].map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError("") }}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? "bg-white text-[#1E3A5F] shadow-sm"
                      : "text-[#64748b] hover:text-[#1E3A5F]"
                  }`}
                >
                  {t === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name — register only */}
              {tab === "register" && (
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F]"
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F]"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1E3A5F] hover:bg-[#16304f] text-white"
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait…</>
                  : tab === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-[#94a3b8]">
              {tab === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setTab(tab === "login" ? "register" : "login"); setError("") }}
                className="text-[#2A9D8F] hover:underline font-medium"
              >
                {tab === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
