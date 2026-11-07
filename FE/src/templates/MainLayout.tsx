import React from "react"

export function MainLayout({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-screen bg-[#faf8f5] dark:bg-[#121b14] text-[#1c2e22] dark:text-[#e4efe6] transition-colors ${className}`}>
      {children}
    </div>
  )
}

export function ModalLayout({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#19261c]">
        <div className="mb-4 flex items-center justify-between border-b border-[#e9eee9] pb-3 dark:border-[#273a2c]">
          <h2 className="text-lg font-bold text-[#1a2d1e] dark:text-[#e5efe7]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}

export * from "./MainLayout"
