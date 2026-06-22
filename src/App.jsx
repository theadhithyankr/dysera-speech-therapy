import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { UserProvider, useUser } from "@/lib/UserContext"
import LandingPage from "@/pages/LandingPage"
import LoginPage from "@/pages/LoginPage"
import PatientDashboard from "@/pages/PatientDashboard"
import RecordDetectPage from "@/pages/RecordDetectPage"
import TherapyExercisePage from "@/pages/TherapyExercisePage"
import PatientReportPage from "@/pages/PatientReportPage"
import AiCoachPage from "@/pages/AiCoachPage"

function PrivateRoute({ element }) {
  const { user, authLoading } = useUser()
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }
  return user ? element : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected patient routes */}
      <Route path="/patient/dashboard" element={<PrivateRoute element={<PatientDashboard />} />} />
      <Route path="/patient/record"    element={<PrivateRoute element={<RecordDetectPage />} />} />
      <Route path="/patient/therapy"   element={<PrivateRoute element={<TherapyExercisePage />} />} />
      <Route path="/patient/report"    element={<PrivateRoute element={<PatientReportPage />} />} />
      <Route path="/patient/ai-coach"  element={<PrivateRoute element={<AiCoachPage />} />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  )
}
