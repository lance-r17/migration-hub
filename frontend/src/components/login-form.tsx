import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRoundIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { login as loginService } from "@/services/users"
import { useCurrentUser } from "@/context/UserContext"
import { oidcManager } from "@/auth/oidcManager"
import { isOAuthEnabled, buildOAuthLoginUrl } from "@/auth/oauthConfig"
import { toast } from "sonner"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [loading, setLoading] = useState(false)
  const { login } = useCurrentUser()
  const navigate = useNavigate()

  async function handleLogin() {
    if (isOAuthEnabled) {
      // Custom enterprise OAuth flow
      const state = crypto.randomUUID()
      sessionStorage.setItem('oauth_state', state)
      // Remember where the user was trying to go (optional)
      const currentPath = location.pathname + location.search
      if (currentPath !== '/login') {
        sessionStorage.setItem('oauth_redirect', currentPath)
      }
      window.location.assign(buildOAuthLoginUrl(state))
      return
    }

    if (oidcManager) {
      await oidcManager.signinRedirect()
      return
    }

    // Mock auth mode
    setLoading(true)
    try {
      const user = await loginService("", "")
      login(user)
      navigate("/", { replace: true })
    } catch {
      toast.error("Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await handleLogin()
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Use your corporate SSO credentials to sign in.
          </p>
        </div>
        <Field>
          <Button
            variant="outline"
            type="button"
            disabled={loading}
            onClick={handleLogin}
          >
            <KeyRoundIcon />
            Login with Enterprise SSO
          </Button>
          {/* <FieldDescription className="text-center">
            Use your corporate SSO credentials to sign in.
          </FieldDescription> */}
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" required />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input id="password" type="password" required />
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
