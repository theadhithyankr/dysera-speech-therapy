import { useState } from "react"
import Navbar from "./Navbar"
import Sidebar from "./Sidebar"
import FloatingChat from "./FloatingChat"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AppLayout({ children, role = "patient", userName = "Alex Johnson" }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar role={role} collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 flex h-full">
            <Sidebar role={role} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <Navbar role={role} userName={userName} />
        <div className="flex items-center gap-2 px-4 py-2 md:hidden border-b border-[#e2e8f0] bg-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-[#64748b]">Menu</span>
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
      <FloatingChat />
    </div>
  )
}
