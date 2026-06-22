import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  Activity,
  ClipboardList,
  LineChart,
  Users,
  ShieldCheck,
  ArrowRight,
} from "lucide-react"

const features = [
  {
    icon: Mic,
    title: "AI-Powered Detection",
    description:
      "Upload or record speech samples. Our model analyzes acoustic patterns to detect and classify dysarthria severity.",
  },
  {
    icon: Activity,
    title: "Real-Time Waveform",
    description:
      "Visualize speech signals live during recording. Immediate feedback on recording quality.",
  },
  {
    icon: ClipboardList,
    title: "Guided Therapy Exercises",
    description:
      "Step-by-step articulation and phonation exercises curated by certified speech-language pathologists.",
  },
  {
    icon: LineChart,
    title: "Progress Tracking",
    description:
      "Longitudinal charts show improvement over time. Spot trends and share reports with your care team.",
  },
  {
    icon: Users,
    title: "Therapist Collaboration",
    description:
      "Clinicians monitor patient sessions, annotate recordings, and adjust therapy programs remotely.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & HIPAA-Ready",
    description:
      "All data is encrypted in transit and at rest. Role-based access ensures patient privacy.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#cbd5e1] bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Dysera" className="h-7 w-7" />
            <span className="font-semibold text-[#1E3A5F] text-sm">Dysera</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#64748b]">
            <a href="#features" className="hover:text-[#1E3A5F] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#1E3A5F] transition-colors">How It Works</a>
            <a href="#about" className="hover:text-[#1E3A5F] transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-4 text-[#2A9D8F] border-[#2A9D8F]">
            AI-Assisted Speech Analysis
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1E3A5F] leading-tight mb-6">
            Detect. Understand.<br />Recover Together.
          </h1>
          <p className="text-lg text-[#64748b] mb-8 leading-relaxed">
            A clinical-grade platform for dysarthria assessment and guided speech therapy.
            Empowering patients and therapists with objective data, personalised exercises,
            and real-time progress monitoring.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" asChild>
              <Link to="/login">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
          {[
            { value: "94%",  label: "Detection accuracy" },
            { value: "AI",   label: "Personalised coaching" },
            { value: "6+",   label: "Exercises per session" },
            { value: "Free", label: "Open access" },
          ].map(({ value, label }) => (
            <div key={label} className="border-l-2 border-[#2A9D8F] pl-4">
              <p className="text-2xl font-bold text-[#1E3A5F]">{value}</p>
              <p className="text-xs text-[#64748b] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white border-y border-[#e2e8f0] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">Platform Features</h2>
            <p className="text-[#64748b]">Everything you need for end-to-end speech assessment and rehabilitation.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardContent className="pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F1F5F9] mb-4">
                    <Icon className="h-5 w-5 text-[#2A9D8F]" />
                  </div>
                  <h3 className="font-semibold text-[#1E3A5F] mb-2">{title}</h3>
                  <p className="text-sm text-[#64748b] leading-relaxed">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold text-[#1E3A5F] mb-10">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Record Your Speech",
              description: "Use the built-in recorder to capture a short speech sample. The waveform visualizer confirms quality.",
            },
            {
              step: "02",
              title: "Get Your Assessment",
              description: "Our AI model analyses acoustic features and returns a severity classification — Mild, Moderate, or Severe.",
            },
            {
              step: "03",
              title: "Follow Your Therapy Plan",
              description: "Receive a personalised sequence of exercises. Track scores session-by-session and share with your therapist.",
            },
          ].map(({ step, title, description }) => (
            <div key={step} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1E3A5F] text-[#1E3A5F] font-bold text-sm">
                {step}
              </div>
              <div>
                <h3 className="font-semibold text-[#1E3A5F] mb-1">{title}</h3>
                <p className="text-sm text-[#64748b] leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section id="about" className="bg-[#1E3A5F] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to get started?</h2>
          <p className="text-[#94b4d4] mb-8 max-w-xl mx-auto">
            Dysera is a free, AI-powered platform for dysarthria assessment and guided speech therapy.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Dysera" className="h-6 w-6" />
            <span className="text-sm font-semibold text-[#1E3A5F]">Dysera</span>
          </div>
          <p className="text-xs text-[#94a3b8]">© 2026 Dysera. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
