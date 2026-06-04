import { useState } from "react"
import toast from "react-hot-toast"
import { Loader2, LogIn } from "lucide-react"
import { login } from "@/api/auth.api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SitePageId } from "@/configs/site"
import type { LoginResponse } from "@/types/api"

export type LoginPageProps = {
  session: LoginResponse | null
  onLogin: (session: LoginResponse) => void
  onLogout: () => void
  onNavigate: (pageId: SitePageId) => void
}

export function LoginPage({
  session,
  onLogin,
  onLogout,
  onNavigate,
}: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [entraIdObjectId, setEntraIdObjectId] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      onLogin(
        await login({
          email: email.trim(),
          entraIdObjectId: entraIdObjectId.trim(),
        })
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign in.")
    } finally {
      setSaving(false)
    }
  }

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9f8] p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-xl">Signed in</CardTitle>
            <CardDescription>{session.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">{session.fullName}</div>
              <div className="mt-1 text-xs text-muted-foreground">{session.role}</div>
            </div>
            <Button className="w-full" onClick={() => onNavigate("dashboard")}>
              Open dashboard
            </Button>
            <Button className="w-full" variant="ghost" onClick={onLogout}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9f8] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="p-5">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-entra">Entra Object ID</Label>
              <Input
                id="login-entra"
                required
                placeholder="your-entra-object-id"
                value={entraIdObjectId}
                onChange={(e) => setEntraIdObjectId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
