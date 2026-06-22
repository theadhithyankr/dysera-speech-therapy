import { useState, useEffect, useRef } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, Calendar, Mic, Loader2, Download, Bot } from "lucide-react"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"

const SEV_COLOR = { Healthy: "mild", Moderate: "moderate", Severe: "severe" }

function weekKey(dateStr) {
  const d = new Date(dateStr)
  const start = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`
}

function buildWeeklyData(sessions) {
  const map = {}
  sessions.forEach(s => {
    const k = weekKey(s.created_at)
    if (!map[k]) map[k] = { scores: [], count: 0 }
    map[k].scores.push(s.score)
    map[k].count++
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v], i) => ({
      week: `W${i + 1}`,
      score: Math.round(v.scores.reduce((a, b) => a + b) / v.scores.length),
      sessions: v.count,
    }))
}

// Per-session series for the line chart: oldest → newest so the trend reads left-to-right.
function buildSessionData(sessions) {
  return [...sessions].reverse().map((s, i) => ({
    label: `S${i + 1}`,
    score: Math.round(s.score),
  }))
}

export default function PatientReportPage() {
  const { user }   = useUser()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const printRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/sessions?limit=100`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handlePrint() {
    window.print()
  }

  const latest     = sessions[0]
  const earliest   = sessions[sessions.length - 1]
  const avgScore   = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length)
    : 0
  const weeklyData  = buildWeeklyData(sessions)
  const sessionData = buildSessionData(sessions)
  const firstDate  = earliest
    ? new Date(earliest.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "—"

  // Trend: compare last 5 vs previous 5 sessions
  const last5 = sessions.slice(0, 5)
  const prev5 = sessions.slice(5, 10)
  const last5avg = last5.length ? Math.round(last5.reduce((a, s) => a + s.score, 0) / last5.length) : null
  const prev5avg = prev5.length ? Math.round(prev5.reduce((a, s) => a + s.score, 0) / prev5.length) : null
  const trend = last5avg !== null && prev5avg !== null
    ? last5avg > prev5avg ? "↑ Improving" : last5avg < prev5avg ? "↓ Declining" : "→ Stable"
    : "—"

  const fullName = user?.full_name || ""

  return (
    <AppLayout role="patient" userName={fullName}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">My Report</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Comprehensive overview of your assessment history and progress.
          </p>
        </div>
        {!loading && sessions.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-sm text-[#2A9D8F] border border-[#2A9D8F]/40 rounded-md px-3 py-1.5 hover:bg-[#f0faf9] transition-colors print:hidden"
          >
            <Download className="h-4 w-4" />
            Download / Print
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-[#94a3b8]">
            No sessions recorded yet.{" "}
            <a href="/patient/record" className="text-[#2A9D8F] underline">
              Record & Detect →
            </a>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary strip */}
          <Card className="mb-6">
            <CardContent className="pt-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { icon: Mic,        label: "Current Severity", value: latest?.severity || "—",                        sub: "Most recent result" },
                  { icon: TrendingUp, label: "Latest Score",     value: latest ? `${Math.round(latest.score)}/100` : "—", sub: `Avg: ${avgScore}/100` },
                  { icon: Calendar,   label: "Total Sessions",   value: String(sessions.length),                         sub: `Since ${firstDate}` },
                  { icon: Bot,        label: "AI Therapist",    value: "Vibra",                                         sub: "Your speech coach" },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F1F5F9]">
                      <Icon className="h-4 w-4 text-[#2A9D8F]" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-0.5">{label}</p>
                      <p className="font-semibold text-[#1E3A5F] text-sm">{value}</p>
                      <p className="text-xs text-[#94a3b8]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="sessions">
            <TabsList className="mb-4">
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="charts">Progress Charts</TabsTrigger>
            </TabsList>

            {/* Sessions tab */}
            <TabsContent value="sessions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Session History</CardTitle>
                  <CardDescription>{sessions.length} sessions recorded</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">
                            {new Date(s.created_at).toLocaleString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-[#1E3A5F]">{Math.round(s.score)}</span>
                            <span className="text-xs text-[#94a3b8]">/100</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={SEV_COLOR[s.severity] || "outline"}>{s.severity}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-[#64748b]">
                            {s.confidence != null ? `${Math.round(s.confidence * 100)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-[#64748b]">
                            {s.audio_duration ? `${Math.round(s.audio_duration)}s` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Charts tab */}
            <TabsContent value="charts">
              <div className="grid sm:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Speech Score Over Time</CardTitle>
                    <CardDescription>Per session score</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={sessionData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#2A9D8F"
                          strokeWidth={2}
                          dot={sessionData.length <= 30 ? { r: 3, fill: "#2A9D8F" } : false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sessions per Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={weeklyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12 }} />
                        <Bar dataKey="sessions" fill="#1E3A5F" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  )
}

