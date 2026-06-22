import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Mail, Calendar } from "lucide-react"
import { useUser } from "@/lib/UserContext"

export default function PatientProfile() {
  const { user } = useUser()

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—"

  return (
    <AppLayout role="patient" userName={user?.full_name || ""}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Profile</h1>
        <p className="text-sm text-[#64748b] mt-1">Your account information.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-sm bg-[#1E3A5F] text-white">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{user?.full_name}</CardTitle>
              <Badge variant="default" className="mt-1 capitalize text-xs">{user?.role}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-[#64748b]" />
            <span className="text-[#334155]">{user?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-[#64748b]" />
            <span className="text-[#334155]">Member since {memberSince}</span>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
