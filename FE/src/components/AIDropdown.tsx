import React, { useEffect, useRef, useState } from "react"
import Icon from "./Icon"

export interface AIDropdownProps {
  onOpenBreakdown: () => void
  onOpenPriority: () => void
  onOpenAssistant: () => void
  className?: string
}

export default function AIDropdown({
  onOpenBreakdown,
  onOpenPriority,
  onOpenAssistant,
  className = "",
}: AIDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Nút chính: AI kèm mũi tên hướng xuống */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Menu các tính năng AI"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Tính năng AI FocusFlow"
        className={`flex h-10 items-center gap-2 rounded-[10px] bg-[#2eae60] px-3.5 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(46,174,96,0.25)] transition hover:bg-[#259650] active:scale-[0.98] ${
          open ? "ring-2 ring-[#4ade80]/50 ring-offset-1" : ""
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Icon name="sparkle" size={15} />
          <span>AI</span>
        </div>
        <Icon
          name="chevronDown"
          size={13}
          className={`transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menu dropdown khi bấm vào nút AI */}
      {open && (
        <div
          role="menu"
          aria-label="Danh sách tính năng AI"
          className="absolute right-0 top-full mt-2 z-50 w-[290px] origin-top-right overflow-hidden rounded-2xl border border-[#e2ede5] bg-white p-2 shadow-[0_18px_45px_rgba(20,55,30,0.16)] transition-all animate-in fade-in zoom-in-95"
        >
          <div className="mb-1.5 px-3 py-1.5 border-b border-[#f0f4f1]">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6aa87d]">
              CÔNG CỤ THÔNG MINH AI
            </span>
          </div>

          <div className="space-y-1">
            {/* 1. Breakdown */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenBreakdown()
              }}
              className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#edf8f1] group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#e6f8ec] text-[#2eae60] transition group-hover:scale-105 group-hover:bg-[#d6f5df]">
                <Icon name="sparkle" size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#233d2c]">
                    Breakdown
                  </span>
                  <span className="rounded bg-[#ebf8ee] px-1.5 py-0.5 text-[9px] font-bold text-[#2d9454]">
                    Phân rã
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#7e9183]">
                  Chia nhỏ mục tiêu lớn thành các bước cụ thể vào lịch tuần.
                </p>
              </div>
            </button>

            {/* 2. Priority */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenPriority()
              }}
              className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#fff9ea] group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#fff5db] text-[#d98b0e] transition group-hover:scale-105 group-hover:bg-[#feebc0]">
                <Icon name="star" size={17} className="fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#233d2c]">
                    Priority
                  </span>
                  <span className="rounded bg-[#fef5df] px-1.5 py-0.5 text-[9px] font-bold text-[#a67112]">
                    Ưu tiên
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#7e9183]">
                  Gợi ý đánh dấu sao (⭐) cho các công việc quan trọng.
                </p>
              </div>
            </button>

            {/* 3. Assistant */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenAssistant()
              }}
              className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#eafaf0] group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#dcfce7] text-[#16a34a] transition group-hover:scale-105 group-hover:bg-[#cbf7d8]">
                <Icon name="mic" size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#233d2c]">
                    Assistant
                  </span>
                  <span className="rounded bg-[#e1f9e8] px-1.5 py-0.5 text-[9px] font-bold text-[#1e8b46]">
                    Giọng nói
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#7e9183]">
                  Trợ lý FocusFlow AI hỏi đáp và nhập liệu nhanh.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
