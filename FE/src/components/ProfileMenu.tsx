import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import Icon, { type IconName } from "./Icon"
import * as api from "../api"
import {
  getNotificationPermission,
  requestNotificationPermission,
  showAppNotification,
} from "../utils/notifications"

type ProfileSection = "profile" | "notifications" | "settings"

export function ProfileMenu({
  dark,
  setDark,
  showHabits,
  setShowHabits,
  compactCards,
  setCompactCards,
  weekStartsSunday,
  setWeekStartsSunday,
  name,
  setName,
  email,
  setEmail,
  onOpenTrash,
  onLogout,
}: {
  dark?: boolean
  setDark?: (value: boolean) => void
  showHabits: boolean
  setShowHabits: (value: boolean) => void
  compactCards: boolean
  setCompactCards: (value: boolean) => void
  weekStartsSunday: boolean
  setWeekStartsSunday: (value: boolean) => void
  name: string
  setName: (value: string) => void
  email: string
  setEmail: (value: string) => void
  onOpenTrash: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<ProfileSection | null>(null)
  const [message, setMessage] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)

  // Cấu hình thông báo & nhắc nhở
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<number | null>(
    15,
  )
  const [reminderTime, setReminderTime] = useState("20:00")
  const [playSound, setPlaySound] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState("")
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission | "unsupported">("default")

  // Hồ sơ cá nhân & Xóa tài khoản
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileNotice, setProfileNotice] = useState("")
  const [profileError, setProfileError] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  async function handleSaveProfile() {
    setSavingProfile(true)
    setProfileNotice("")
    setProfileError("")
    try {
      const updated = await api.updateProfile(name.trim() || null)
      setName(updated.fullName || "")
      setProfileNotice("Cập nhật hồ sơ thành công!")
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Lỗi khi cập nhật hồ sơ.",
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    setDeleteError("")
    try {
      await api.deleteAccount()
      setShowDeleteConfirm(false)
      setOpen(false)
      onLogout()
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Lỗi khi xóa tài khoản. Vui lòng thử lại!",
      )
      setDeletingAccount(false)
    }
  }

  useEffect(() => {
    setNotifPermission(getNotificationPermission())
  }, [open, section])

  useEffect(() => {
    if (open && section === "notifications") {
      api
        .getSettings()
        .then((s) => {
          setReminderLeadMinutes(s.reminderLeadMinutes)
          setReminderTime(s.reminderTime)
        })
        .catch(() => {})
    }
  }, [open, section])

  async function handleSaveSettings() {
    setSavingSettings(true)
    setSettingsNotice("")
    try {
      await api.updateSettings({
        reminderLeadMinutes,
        reminderTime,
      })
      setSettingsNotice(
        "Đã lưu cấu hình nhắc nhở thành công! (Múi giờ Asia/Ho_Chi_Minh)",
      )
    } catch {
      setSettingsNotice("Lỗi khi lưu cấu hình. Vui lòng thử lại!")
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleRequestPermission() {
    const res = await requestNotificationPermission()
    setNotifPermission(res)
    if (res === "granted") {
      setSettingsNotice("Đã cấp quyền thông báo thành công!")
    } else {
      setSettingsNotice("Quyền thông báo bị từ chối hoặc bị chặn bởi hệ thống.")
    }
  }

  function handleTestNotification() {
    showAppNotification({
      title: "⏰ FocusFlow · Kiểm tra thông báo",
      body: "Hệ thống thông báo và âm báo Windows đang hoạt động chính xác!",
      playSound,
      onClick: () => {
        window.focus()
      },
    })
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      )
        setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const options: {
    section: ProfileSection
    icon: IconName
    title: string
    description: string
  }[] = [
    {
      section: "profile",
      icon: "user",
      title: "My Profile & Account",
      description: "Name, email & password",
    },
    {
      section: "notifications",
      icon: "bell",
      title: "Notification Preferences",
      description: "Reminders & daily summary",
    },
    {
      section: "settings",
      icon: "settings",
      title: "App Settings",
      description: "Habits & week layout",
    },
  ]

  return (
    <div ref={menuRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setMessage("")
          setSettingsNotice("")
        }}
        aria-label="Open user profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-[#e6dbcb] text-[13px] font-bold text-[#6b594c] shadow-[0_0_0_1px_#e8eeea] transition hover:shadow-[0_0_0_2px_#4ade80]"
      >
        {name
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "JD"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 w-84 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-[#0f172a] shadow-xl"
            role="menu"
            aria-label="User profile"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 px-3 py-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e6dbcb] text-[13px] font-bold text-[#6b594c]">
                {name
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "JD"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{name}</p>
                <p className="truncate text-[11px] text-[#849489]">{email}</p>
              </div>
              <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[9px] font-bold text-[#267c47]">
                PRO
              </span>
            </div>
            <div className="my-1 border-t border-[#edf1ee]" />
            {options.map((option) => (
              <button
                type="button"
                key={option.section}
                role="menuitem"
                onClick={() => {
                  setSection((current) =>
                    current === option.section ? null : option.section,
                  )
                  setMessage("")
                  setSettingsNotice("")
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f4faf5] ${
                  section === option.section ? "bg-[#f0faf2]" : ""
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f8f1] text-[#50a76c]">
                  <Icon name={option.icon} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-[#253d2e]">
                    {option.title}
                  </span>
                  <span className="block text-[10px] text-[#8b9c8f]">
                    {option.description}
                  </span>
                </span>
                <Icon
                  name="chevronRight"
                  size={14}
                  className="text-[#96a99b]"
                />
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenTrash()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#fff5f4]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0ef] text-[#cf756e]">
                <Icon name="trash" size={16} />
              </span>
              <span className="flex-1">
                <span className="block text-[12px] font-semibold text-[#253d2e]">
                  Trash bin
                </span>
                <span className="block text-[10px] text-[#8b9c8f]">
                  Restore or permanently delete tasks
                </span>
              </span>
            </button>
            {section && (
              <div className="mx-2 my-2 rounded-xl border border-[#e1efe4] bg-[#f7fcf8] p-3 text-[11px] text-[#344c3b]">
                {section === "profile" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#253d2e]">
                        Tên hiển thị (Display name)
                      </label>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nhập tên hiển thị..."
                        maxLength={100}
                        className="mt-1 w-full rounded-lg border border-[#dfeae0] bg-white px-2 py-1.5 text-[11px] font-medium outline-none focus:border-[#4ade80]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#253d2e]">
                        Email đăng nhập
                      </label>
                      <input
                        type="email"
                        value={email}
                        readOnly
                        disabled
                        className="mt-1 w-full cursor-not-allowed rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1.5 text-[11px] text-[#64748b] outline-none"
                      />
                      <p className="mt-0.5 text-[9px] text-[#819486]">
                        Email tài khoản cố định, dùng để đăng nhập.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => void handleSaveProfile()}
                      className="w-full rounded-lg bg-[#4ade80] py-1.5 text-center text-[11px] font-bold text-white transition hover:bg-[#3ec470] disabled:opacity-50"
                    >
                      {savingProfile ? "Đang lưu..." : "Lưu tên hiển thị"}
                    </button>
                    {profileNotice && (
                      <p
                        role="status"
                        className="text-[10px] font-medium text-emerald-700"
                      >
                        {profileNotice}
                      </p>
                    )}
                    {profileError && (
                      <p
                        role="alert"
                        className="text-[10px] font-medium text-rose-600"
                      >
                        {profileError}
                      </p>
                    )}

                    {/* Vùng nguy hiểm - Xóa tài khoản */}
                    <div className="mt-3 border-t border-rose-100 pt-2.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-600">
                        Vùng nguy hiểm
                      </span>
                      <p className="mt-0.5 text-[9.5px] text-[#718096]">
                        Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu cá nhân.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(true)
                          setDeleteError("")
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        <Icon name="trash" size={13} />
                        Xóa tài khoản cá nhân
                      </button>
                    </div>
                  </div>
                )}

                {/* Notification Preferences */}
                {section === "notifications" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-[11px] text-[#253d2e]">
                        Nhắc trước deadline:
                      </label>
                      <select
                        value={
                          reminderLeadMinutes === null
                            ? "disabled"
                            : String(reminderLeadMinutes)
                        }
                        onChange={(e) =>
                          setReminderLeadMinutes(
                            e.target.value === "disabled"
                              ? null
                              : Number(e.target.value),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-[#dfeae0] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[#4ade80]"
                      >
                        <option value="15">
                          15 phút trước deadline (Mặc định)
                        </option>
                        <option value="5">5 phút trước deadline</option>
                        <option value="10">10 phút trước deadline</option>
                        <option value="30">30 phút trước deadline</option>
                        <option value="disabled">
                          Tắt nhắc trước deadline
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[11px] text-[#253d2e]">
                        Giờ tổng kết cuối ngày:
                      </label>
                      <input
                        type="time"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#dfeae0] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[#4ade80]"
                      />
                      <p className="mt-0.5 text-[9px] text-[#819486]">
                        Múi giờ máy chủ: Asia/Ho_Chi_Minh (GMT+7)
                      </p>
                    </div>

                    <label className="flex items-center justify-between gap-2 pt-1">
                      <span className="font-semibold text-[11px] text-[#253d2e]">
                        Âm báo Windows / Chuông:
                      </span>
                      <input
                        type="checkbox"
                        checked={playSound}
                        onChange={(e) => setPlaySound(e.target.checked)}
                        className="accent-[#4ade80]"
                      />
                    </label>

                    <div className="border-t border-[#dfeae0] pt-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span>Quyền thông báo:</span>
                        <span
                          className={`font-bold ${
                            notifPermission === "granted"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {notifPermission === "granted"
                            ? "✓ Đã cấp quyền"
                            : "⚠️ Chưa cấp quyền"}
                        </span>
                      </div>
                      {notifPermission !== "granted" && (
                        <button
                          type="button"
                          onClick={() => void handleRequestPermission()}
                          className="w-full rounded-lg border border-amber-300 bg-amber-50 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          Cấp quyền thông báo Desktop / Web
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleTestNotification}
                        className="w-full rounded-lg border border-[#dfeae0] bg-white py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        🔔 Thử gửi thông báo mẫu
                      </button>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={() => void handleSaveSettings()}
                        className="w-full rounded-lg bg-[#4ade80] py-1.5 text-center text-[11px] font-bold text-white transition hover:bg-[#3ec470] disabled:opacity-50"
                      >
                        {savingSettings
                          ? "Đang lưu..."
                          : "Lưu cấu hình nhắc nhở"}
                      </button>
                    </div>
                    {settingsNotice && (
                      <p
                        role="status"
                        className="mt-1 text-[10px] font-medium text-emerald-700"
                      >
                        {settingsNotice}
                      </p>
                    )}
                  </div>
                )}

                {section === "settings" && (
                  <div className="space-y-2">
                    <label className="flex items-center justify-between gap-2">
                      Show habit tracker{" "}
                      <input
                        type="checkbox"
                        checked={showHabits}
                        onChange={(event) =>
                          setShowHabits(event.target.checked)
                        }
                        className="accent-[#4ade80]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      Compact task cards{" "}
                      <input
                        type="checkbox"
                        checked={compactCards}
                        onChange={(event) =>
                          setCompactCards(event.target.checked)
                        }
                        className="accent-[#4ade80]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      Week starts on{" "}
                      <select
                        value={weekStartsSunday ? "sunday" : "monday"}
                        onChange={(event) =>
                          setWeekStartsSunday(event.target.value === "sunday")
                        }
                        className="rounded-lg border border-[#dfeae0] bg-white px-2 py-1 outline-none"
                      >
                        <option value="monday">Monday</option>
                        <option value="sunday">Sunday</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}
            <div className="my-1 border-t border-[#edf1ee]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-[#ef4444] hover:bg-[#fff5f4]"
            >
              <Icon name="logout" size={17} /> Log Out
            </button>
            {message && (
              <p role="status" className="px-3 pb-2 text-[10px] text-[#9a615c]">
                {message}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showDeleteConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <Icon name="trash" size={22} />
              </div>
              <h3
                id="delete-account-title"
                className="mt-3 text-[15px] font-bold text-[#1e293b]"
              >
                Xác nhận xóa tài khoản vĩnh viễn?
              </h3>
              <p className="mt-2 text-[12px] leading-relaxed text-[#64748b]">
                Hành động này sẽ{" "}
                <strong className="text-rose-600">xóa vĩnh viễn</strong> tài
                khoản cá nhân cùng tất cả công việc, thói quen và lịch sử dữ
                liệu của bạn khỏi hệ thống.
              </p>
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                ⚠️ Thao tác này hoàn toàn không thể khôi phục!
              </p>
              {deleteError && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg bg-rose-50 p-2 text-[11px] font-medium text-rose-700"
                >
                  {deleteError}
                </p>
              )}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-[12px] font-medium text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => void handleDeleteAccount()}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {deletingAccount ? "Đang xóa..." : "Xác nhận xóa tài khoản"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
