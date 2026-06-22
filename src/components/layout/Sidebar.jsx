import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Mic,
  Dumbbell,
  FileText,
  Sparkles,
  Settings,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const patientNav = [
  { label: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
  { label: "Record & Detect", href: "/patient/record", icon: Mic },
  { label: "Therapy Exercises", href: "/patient/therapy", icon: Dumbbell },
  { label: "My Reports", href: "/patient/report", icon: FileText },
  { label: "Vibra",            href: "/patient/ai-coach",  icon: Sparkles },
]

export default function Sidebar({ role = "patient", collapsed = false, onToggle }) {
  const location = useLocation()
  const navItems = patientNav

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-[#cbd5e1] bg-white min-h-screen transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Branding + toggle */}
      <div className={cn(
        "flex items-center border-b border-[#e2e8f0] py-5",
        collapsed ? "justify-center px-2" : "gap-3 px-4"
      )}>
        {!collapsed && (
          <img src="/favicon.svg" alt="Dysera" className="h-8 w-8 shrink-0" />
        )}
        {!collapsed && (
          <span className="flex-1 text-sm font-semibold text-[#1E3A5F] leading-tight">
            Dysera
          </span>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1 rounded-md text-[#64748b] hover:bg-[#F1F5F9] transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Role label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#64748b]">
            Patient Portal
          </p>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = location.pathname === href
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#1E3A5F] text-white"
                  : "text-[#334155] hover:bg-[#F1F5F9]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
              {!collapsed && active && <ChevronRight className="ml-auto h-3 w-3" />}
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-4 border-t border-[#e2e8f0] pt-2">
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#F1F5F9]"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  )
}
