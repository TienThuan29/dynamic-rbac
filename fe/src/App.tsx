import { useEffect, useMemo, useState } from "react"
import { siteConfig, type SitePageId } from "@/configs/site"
import { DashboardPage } from "@/pages/DashboardPage"
import { LoginPage } from "@/pages/LoginPage"
import type { LoginResponse } from "@/types/api"

const SESSION_STORAGE_KEY = "swo-dashboard-session"

function readStoredSession() {
  try {
    const value = window.localStorage.getItem(SESSION_STORAGE_KEY)
    return value ? (JSON.parse(value) as LoginResponse) : null
  } catch {
    return null
  }
}

function storeSession(session: LoginResponse | null) {
  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  }
}

function App() {
  const [session, setSession] = useState<LoginResponse | null>(() => readStoredSession())
  const [activePageId, setActivePageId] = useState<SitePageId>(() =>
    readStoredSession() ? "dashboard" : siteConfig.defaultPageId
  )

  const activePage = useMemo(() => {
    return (
      siteConfig.pages.find((page) => page.id === activePageId) ??
      siteConfig.pages.find((page) => page.id === siteConfig.defaultPageId)!
    )
  }, [activePageId])

  const resolvedPageId =
    activePage.requiresAuth && !session ? siteConfig.defaultPageId : activePage.id

  useEffect(() => {
    storeSession(session)
  }, [session])

  function handleNavigate(pageId: SitePageId) {
    const nextPage = siteConfig.pages.find((page) => page.id === pageId)

    if (!nextPage) {
      setActivePageId(siteConfig.defaultPageId)
      return
    }

    if (nextPage.requiresAuth && !session) {
      setActivePageId(siteConfig.defaultPageId)
      return
    }

    setActivePageId(nextPage.id)
  }

  function handleLogin(nextSession: LoginResponse) {
    setSession(nextSession)
    setActivePageId("dashboard")
  }

  function handleLogout() {
    setSession(null)
    setActivePageId(siteConfig.defaultPageId)
  }

  if (resolvedPageId === "dashboard") {
    return (
      <DashboardPage
        session={session}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  return (
    <LoginPage
      session={session}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
    />
  )
}

export default App
