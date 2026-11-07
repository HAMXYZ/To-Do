import React, { useState } from "react"
import * as api from "../api"
import Icon from "../components/Icon"

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-[#e2e8f0] bg-white px-3 py-2.5 text-[13px] text-[#334e3c] outline-none placeholder:text-[#a2afa5] focus:border-[#62d786] focus:ring-2 focus:ring-[#4ade80]/15"

export default function Login({
  initialEmail = "",
  notice = "",
  onLoggedIn,
  onGoRegister,
  /** thông báo hiện phía trên form (ví dụ: đăng ký thành công, phiên hết hạn) */
}: {
  initialEmail?: string
  notice?: string
  onLoggedIn: () => void
  onGoRegister: () => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError("Vui lòng nhập email và mật khẩu!")
      return
    }
    setError("")
    setBusy(true)
    try {
      await api.login(email.trim().toLowerCase(), password)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại")
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4">
      <div className="w-full max-w-[400px] rounded-2xl border border-[#edf1ee] bg-white p-7 shadow-[0_5px_18px_rgba(30,65,43,0.05)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#4ade80] text-[#155b34]">
            <Icon name="sparkle" size={22} />
          </div>
          <span className="text-[20px] font-bold tracking-[-0.05em] text-[#182a23]">
            FocusFlow <span className="text-[#31b963]">AI</span>
          </span>
        </div>
        <h1 className="text-[22px] font-bold tracking-[-0.04em] text-[#1d3025]">
          Đăng Nhập
        </h1>
        <p className="mt-1 text-[12px] text-[#839087]">
          Chào mừng bạn quay lại.
        </p>

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-[10px] bg-[#effbf2] px-3 py-2.5 text-[12px] font-medium text-[#2f7d4f]"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[10px] bg-[#fff1f0] px-3 py-2.5 text-[12px] font-medium text-[#c0443f]"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <label className="block text-[12px] font-bold text-[#385140]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus={!initialEmail}
              className={inputClass}
            />
          </label>
          <label className="block text-[12px] font-bold text-[#385140]">
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus={Boolean(initialEmail)}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-[10px] bg-[#4ade80] text-[13px] font-bold text-[#14492b] transition hover:bg-[#36d871] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Đang đăng nhập…" : "Đăng Nhập"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12px] text-[#839087]">
          Chưa có tài khoản?{" "}
          <button
            type="button"
            onClick={onGoRegister}
            className="font-bold text-[#2f9a58] hover:underline"
          >
            Đăng ký
          </button>
        </p>
      </div>
    </div>
  )
}
