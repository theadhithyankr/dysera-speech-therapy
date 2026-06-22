import { useState, useEffect } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Mic, Dumbbell, TrendingUp, Calendar, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"

const severityColor = { Healthy: "mild", Moderate: "moderate", Severe: "severe" }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function buildChartData(sessions) {
  // Group sessions by ISO week label (most recent 8 weeks)
  const byWeek = {}
  sessions.forEach(s => {
    const d = new Date(s.created_at)
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
    const key = `${d.getFullYear()}-W${weekNum}`
    if (!byWeek[key]) byWeek[key] = []
    byWeek[key].push(s.score)
  })
  const weeks = Object.keys(byWeek).sort().slice(-8)
  return weeks.map((w, i) => ({
    week: `W${i + 1}`,
    score: Math.round(byWeek[w].reduce((a, b) => a + b, 0) / byWeek[w].length),
  }))
}

export default function PatientDashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const { user } = useUser()
  const fullName = user?.full_name || "User"

  const firstName = fullName.split(" ")[0]

  useEffect(() => {
    fetch(`${API_BASE}/api/sessions?limit=50`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const total    = sessions.length
  const latest   = sessions[0]
  const latestScore    = latest ? Math.round(latest.score) : "—"
  const latestSeverity = latest ? latest.severity : "—"

  // streak: consecutive distinct days with sessions (most recent first)
  const streak = (() => {
    const days = [...new Set(sessions.map(s => new Date(s.created_at).toDateString()))]
    let count = 0
    let cursor = new Date(); cursor.setHours(0,0,0,0)
    for (const day of days) {
      const d = new Date(day); d.setHours(0,0,0,0)
      if (Math.abs(cursor - d) <= 86400000) { count++; cursor = d }
      else break
    }
    return count
  })()

  const chartData  = buildChartData(sessions)
  const recent5    = sessions.slice(0, 5)

  return (
    <AppLayout role="patient" userName={fullName}>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">{greeting()}, {firstName}</h1>
        <p className="text-sm text-[#64748b] mt-1">Here's your therapy overview for today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Sessions", value: String(total), icon: Calendar, delta: total === 0 ? "Start recording!" : "All time" },
          { label: "Current Score",  value: String(latestScore), icon: TrendingUp, delta: latest ? new Date(latest.created_at).toLocaleDateString() : "No sessions yet" },
          { label: "Streak",         value: streak ? `${streak} day${streak > 1 ? "s" : ""}` : "—", icon: Dumbbell, delta: streak >= 3 ? "Keep it up!" : "Record daily to build a streak" },
          { label: "Severity",       value: latestSeverity, icon: Mic, delta: latest ? "Latest result" : "No analysis yet" },
        ].map(({ label, value, icon: Icon, delta }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[#64748b] uppercase tracking-wide font-medium mb-1">{label}</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">{loading ? "…" : value}</p>
                  <p className="text-xs text-[#2A9D8F] mt-1">{delta}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F1F5F9]">
                  <Icon className="h-4 w-4 text-[#2A9D8F]" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Quick action card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Vibra</CardTitle>
            <CardDescription>Your AI speech coach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md bg-[#F1F5F9] px-4 py-3">
                <p className="font-semibold text-[#1E3A5F] text-sm">Exercises & Speech Therapy</p>
                <p className="text-xs text-[#64748b] mt-1">Tailored to your latest severity level</p>
              </div>
              <Button className="w-full" asChild>
                <Link to="/patient/ai-coach">
                  Open Vibra
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/patient/record">
                  New Recording
                  <Mic className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Score progress chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Speech Score — History</CardTitle>
            <CardDescription>Higher is better (0–100 scale)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-[#94a3b8]">
                No sessions recorded yet. <Link to="/patient/record" className="ml-1 text-[#2A9D8F] underline">Record now →</Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12 }}
                    cursor={{ stroke: "#e2e8f0" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2A9D8F"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#2A9D8F" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent session history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/patient/report">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recent5.length === 0 ? (
            <p className="text-sm text-[#94a3b8] text-center py-10">
              {loading ? "Loading…" : "No sessions yet — record your first speech sample!"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent5.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-[#1E3A5F]">{Math.round(s.score)}</span>
                      <span className="text-xs text-[#94a3b8]">/100</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColor[s.severity] || "outline"}>{s.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#64748b]">
                      {s.audio_duration ? `${Math.round(s.audio_duration)}s` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
