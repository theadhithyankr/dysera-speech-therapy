import { useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, CheckCircle2, AlertCircle } from "lucide-react"
import { getToken, API_BASE } from "@/lib/auth"
import { useUser } from "@/lib/UserContext"

export default function PatientSettings() {
  const { user, login } = useUser()
  const [name, setName] = useState(user?.full_name || "")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setSuccess(false)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ full_name: name.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to save")
      }
      const data = await res.json()
      setSuccess(true)
      login({ access_token: getToken(), full_name: data.full_name, role: data.role })
      setTimeout(() => setSuccess(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout role="patient" userName={user?.full_name || ""}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Settings</h1>
        <p className="text-sm text-[#64748b] mt-1">Manage your account settings.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Display Name</CardTitle>
          <CardDescription>This is how you appear across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Name updated successfully.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  )
}
