import { useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Users, TrendingUp, Calendar, FileText, ChevronRight, MessageSquare } from "lucide-react"

const patients = [
  {
    id: "P001",
    name: "Alex Johnson",
    age: 42,
    diagnosis: "ALS-related",
    sessions: 48,
    lastSession: "2026-03-06",
    severity: "Mild",
    score: 74,
    trend: "up",
  },
  {
    id: "P002",
    name: "Maria Santos",
    age: 55,
    diagnosis: "Stroke-related",
    sessions: 32,
    lastSession: "2026-03-05",
    severity: "Moderate",
    score: 52,
    trend: "up",
  },
  {
    id: "P003",
    name: "James O'Brien",
    age: 63,
    diagnosis: "Parkinson's",
    sessions: 61,
    lastSession: "2026-03-04",
    severity: "Moderate",
    score: 49,
    trend: "stable",
  },
  {
    id: "P004",
    name: "Preethi Kumar",
    age: 38,
    diagnosis: "TBI-related",
    sessions: 19,
    lastSession: "2026-03-03",
    severity: "Severe",
    score: 28,
    trend: "up",
  },
  {
    id: "P005",
    name: "Robert Chen",
    age: 71,
    diagnosis: "MS-related",
    sessions: 44,
    lastSession: "2026-03-01",
    severity: "Mild",
    score: 77,
    trend: "up",
  },
]

const sessionHistoryData = {
  P001: [
    { week: "W1", score: 42 }, { week: "W2", score: 48 }, { week: "W3", score: 55 },
    { week: "W4", score: 60 }, { week: "W5", score: 63 }, { week: "W6", score: 69 }, { week: "W7", score: 74 },
  ],
  P002: [
    { week: "W1", score: 35 }, { week: "W2", score: 38 }, { week: "W3", score: 40 },
    { week: "W4", score: 44 }, { week: "W5", score: 47 }, { week: "W6", score: 50 }, { week: "W7", score: 52 },
  ],
  P003: [
    { week: "W1", score: 47 }, { week: "W2", score: 48 }, { week: "W3", score: 46 },
    { week: "W4", score: 49 }, { week: "W5", score: 48 }, { week: "W6", score: 50 }, { week: "W7", score: 49 },
  ],
  P004: [
    { week: "W1", score: 18 }, { week: "W2", score: 20 }, { week: "W3", score: 22 },
    { week: "W4", score: 23 }, { week: "W5", score: 25 }, { week: "W6", score: 27 }, { week: "W7", score: 28 },
  ],
  P005: [
    { week: "W1", score: 58 }, { week: "W2", score: 62 }, { week: "W3", score: 65 },
    { week: "W4", score: 68 }, { week: "W5", score: 71 }, { week: "W6", score: 74 }, { week: "W7", score: 77 },
  ],
}

const patientNotes = {
  P001: "Good compliance. Continue current programme. Consider adding rate control exercises in W9.",
  P002: "Improved lip closure. Still struggles with post-alveolar consonants. Refer to ENT for secondary check.",
  P003: "Score plateau — consider adjusting intensity. Scheduled re-assessment for 2026-03-15.",
  P004: "Rapid improvement from baseline. Motivation is high. Increase session frequency to 5x/week.",
  P005: "Nearing Mild–Normal boundary. Discuss discharge planning in next session.",
}

const severityColor = { Mild: "mild", Moderate: "moderate", Severe: "severe" }

const trendIcon = (t) => t === "up" ? "↑" : t === "down" ? "↓" : "→"
const trendColor = (t) => t === "up" ? "text-emerald-600" : t === "down" ? "text-red-500" : "text-[#94a3b8]"

// Combined trend chart for all patients
const allTrendData = sessionHistoryData.P001.map((_, i) => ({
  week: `W${i + 1}`,
  Alex: sessionHistoryData.P001[i].score,
  Maria: sessionHistoryData.P002[i].score,
  James: sessionHistoryData.P003[i].score,
  Preethi: sessionHistoryData.P004[i].score,
  Robert: sessionHistoryData.P005[i].score,
}))

const patientColors = ["#1E3A5F", "#2A9D8F", "#64748b", "#f59e0b", "#6366f1"]

export default function TherapistDashboard() {
  const [selectedPatient, setSelectedPatient] = useState(patients[0])
  const [note, setNote] = useState(patientNotes[patients[0].id])

  function handleSelectPatient(p) {
    setSelectedPatient(p)
    setNote(patientNotes[p.id])
  }

  return (
    <AppLayout role="therapist" userName="Dr. Priya Nair">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Therapist Dashboard</h1>
        <p className="text-sm text-[#64748b] mt-1">Overview of your patient caseload and outcomes.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Patients", value: "5", icon: Users },
          { label: "Sessions This Week", value: "23", icon: Calendar },
          { label: "Avg. Score", value: "56", icon: TrendingUp },
          { label: "Reports Due", value: "2", icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[#64748b] uppercase tracking-wide font-medium mb-1">{label}</p>
                  <p className="text-2xl font-bold text-[#1E3A5F]">{value}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F1F5F9]">
                  <Icon className="h-4 w-4 text-[#2A9D8F]" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Patient list & per-patient detail */}
      <div className="grid lg:grid-cols-5 gap-6 mb-6">
        {/* Patient table */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Patient List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer ${selectedPatient.id === p.id ? "bg-[#F1F5F9]" : ""}`}
                    onClick={() => handleSelectPatient(p)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-[#94a3b8]">Age {p.age} · {p.id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#64748b]">{p.diagnosis}</TableCell>
                    <TableCell className="text-sm">{p.sessions}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-[#1E3A5F]">{p.score}</span>
                      <span className={`ml-1 text-xs font-bold ${trendColor(p.trend)}`}>
                        {trendIcon(p.trend)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColor[p.severity]}>{p.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-[#cbd5e1]" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Per-patient session history */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{selectedPatient.name}</CardTitle>
            <CardDescription>{selectedPatient.diagnosis} · {selectedPatient.sessions} sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Badge variant={severityColor[selectedPatient.severity]}>{selectedPatient.severity}</Badge>
              <Badge variant="outline">Score: {selectedPatient.score}/100</Badge>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart
                data={sessionHistoryData[selectedPatient.id]}
                margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#2A9D8F"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "#2A9D8F" }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Notes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b] mb-2 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Clinical Notes
              </p>
              <textarea
                className="w-full rounded-md border border-[#cbd5e1] bg-[#F1F5F9] px-3 py-2 text-xs text-[#334155] resize-none focus:outline-none focus:ring-2 focus:ring-[#2A9D8F]/40"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button size="sm" className="mt-2 w-full">Save Notes</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity trend chart — all patients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Severity Score Trends — All Patients</CardTitle>
          <CardDescription>Last 7 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={allTrendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {["Alex", "Maria", "James", "Preethi", "Robert"].map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={patientColors[i]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
