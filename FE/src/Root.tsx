import { useCallback, useEffect, useState } from "react"
import * as api from "./api"
import App from "./App"
import type { SignedOutReason } from "./hooks/useAppData"
import Login from "./pages/Login"
import Register from "./pages/Register"

type Screen = "loading" | "login" | "register" | "app"

/** Quyết định hiện Đăng nhập, Đăng ký hay ứng dụng chính. */
export default function Root() {
  const [screen, setScreen] = useState<Screen>("loading")
  const [email, setEmail] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    void api
      .initAuth()
      .then((hasToken) => setScreen(hasToken ? "app" : "login"))
  }, [])

  const onSignedOut = useCallback((reason: SignedOutReason) => {
    setNotice(
      reason === "expired"
        ? "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."
        : "",
    )
    setScreen("login")
  }, [])

  if (screen === "loading") return null
  if (screen === "app") return <App onSignedOut={onSignedOut} />
  if (screen === "register") {
    return (
      <Register
        onGoLogin={() => {
          setNotice("")
          setScreen("login")
        }}
        onRegistered={(registeredEmail) => {
          setEmail(registeredEmail)
          setNotice("Đăng ký thành công, vui lòng đăng nhập.")
          setScreen("login")
        }}
      />
    )
  }
  return (
    <Login
      initialEmail={email}
      notice={notice}
      onLoggedIn={() => {
        setNotice("")
        setScreen("app")
      }}
      onGoRegister={() => {
        setNotice("")
        setEmail("")
        setScreen("register")
      }}
    />
  )
}
