import { useState, useEffect, useRef, type FormEvent } from "react"
import * as api from "../api"
import Icon from "./Icon"

interface Message {
  id: string
  sender: "user" | "assistant"
  text: string
  action?: api.AssistantAction | null
  added?: boolean
  error?: boolean
}

type Props = {
  currentDay: number
  todayDate?: string
  weekOffset?: number
  onClose: () => void
  onAddTask: (task: api.AssistantActionTask) => Promise<boolean>
}

const dayNames = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
]

export default function AIAssistantModal({
  currentDay,
  todayDate,
  weekOffset,
  onClose,
  onAddTask,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greeting",
      sender: "assistant",
      text: "Xin chào! Tôi là Trợ lý FocusFlow AI. Bạn có thể nhấn nút Micro để nói hoặc gõ tin nhắn để tôi hỗ trợ hỏi đáp nhanh hoặc tạo công việc vào lịch tuần nhé! ✨",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [micError, setMicError] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [quota, setQuota] = useState<api.AiQuotaInfo | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [speechSupported, setSpeechSupported] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  // Tải thông tin quota (US-38)
  useEffect(() => {
    api
      .getAiQuota()
      .then(setQuota)
      .catch(() => {})
  }, [])

  // Kiểm tra hỗ trợ Web Speech API
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      setSpeechSupported(false)
    }
  }, [])

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Đếm ngược Rate Limit (US-38)
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return
    const timer = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [retryCountdown])

  // Khởi động / Dừng nhận diện giọng nói (US-33 & US-33.EX1)
  function toggleListening() {
    setMicError("")
    setError("")

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      setMicError(
        "⚠️ Trình duyệt hiện tại không hỗ trợ Web Speech API. Bạn vui lòng sử dụng khung nhập liệu văn bản bên dưới.",
      )
      return
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRec()
      recognition.lang = "vi-VN"
      recognition.continuous = false
      recognition.interimResults = true

      recognition.onstart = () => {
        setIsListening(true)
        setMicError("")
      }

      recognition.onresult = (event: any) => {
        let transcript = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        if (transcript.trim()) {
          setInput(transcript)
        }
      }

      // Xử lý ngoại lệ theo US-33.EX1 (Quyền micro, lỗi kết nối)
      recognition.onerror = (event: any) => {
        setIsListening(false)
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          setMicError(
            "⚠️ Quyền truy cập microphone bị từ chối hoặc bị chặn. Bạn vui lòng cấp quyền truy cập micro trong cài đặt trình duyệt hoặc nhập liệu bằng văn bản.",
          )
        } else if (event.error === "no-speech") {
          setMicError(
            "Chưa nhận được âm thanh. Hãy thử lại hoặc gõ tin nhắn vào ô bên dưới.",
          )
        } else if (event.error === "network") {
          setMicError(
            "Dịch vụ giọng nói Google Speech API không hỗ trợ trong cửa sổ Electron Desktop do chính sách mạng của Google. Vui lòng mở bằng trình duyệt Google Chrome (http://localhost:8443) để nói, hoặc nhập liệu trực tiếp bằng văn bản!",
          )
        } else if (event.error === "network") {
          setMicError(
            "Dịch vụ giọng nói Google Speech API không hỗ trợ trong cửa sổ Electron Desktop do chính sách mạng của Google. Vui lòng mở bằng trình duyệt Google Chrome (http://localhost:8443) để nói, hoặc nhập liệu trực tiếp bằng văn bản!",
          )
        } else {
          setMicError(
            `Không thể nhận diện giọng nói (${event.error}). Bạn có thể nhập liệu bằng văn bản.`,
          )
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      setIsListening(false)
      setMicError(
        "Không thể khởi tạo micro. Bạn vui lòng thử lại hoặc gõ bằng bàn phím.",
      )
    }
  }

  async function handleSend(customText?: string) {
    const textToSend = (customText ?? input).trim()
    if (!textToSend || loading) return
    if (retryCountdown !== null && retryCountdown > 0) return

    if (isListening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
      setIsListening(false)
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setError("")
    setMicError("")

    try {
      const res = await api.askAssistant(textToSend, {
        currentDay,
        todayDate,
        weekOffset,
      })

      // Cập nhật lại Quota
      api
        .getAiQuota()
        .then(setQuota)
        .catch(() => {})

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: res.reply,
        action: res.action,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (cause) {
      if (cause instanceof api.ApiError) {
        if (cause.status === 429) {
          const waitTime =
            cause.retryAfter && cause.retryAfter > 0 ? cause.retryAfter : 60
          setRetryCountdown(waitTime)
          if (cause.code === "PROVIDER_QUOTA_EXCEEDED") {
            setError(
              "⚠️ Nhà cung cấp AI đang quá tải lượt yêu cầu. Vui lòng thử lại sau.",
            )
          } else {
            setError(
              "⚠️ Bạn đã đạt giới hạn 10 yêu cầu AI trong 10 phút (US-38).",
            )
          }
          api
            .getAiQuota()
            .then(setQuota)
            .catch(() => {})
        } else if (cause.status === 504) {
          setError(
            "⏱️ Yêu cầu phản hồi từ AI đã quá thời gian chờ (Timeout). Bạn hãy thử lại.",
          )
        } else if (cause.status === 503) {
          setError(
            "🔧 Dịch vụ AI chưa sẵn sàng hoặc API key chưa được cấu hình.",
          )
        } else {
          setError(cause.message)
        }
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Có lỗi khi kết nối với Trợ lý AI.",
        )
      }
      // Giữ lại text cho người dùng nếu lỗi (EX1)
      setInput(textToSend)
    } finally {
      setLoading(false)
    }
  }

  async function confirmAddTask(msgId: string, task: api.AssistantActionTask) {
    const success = await onAddTask(task)

    if (success) {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === msgId ? { ...msg, added: true } : msg)),
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#10231a]/60 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-assistant-title"
        className="flex h-[620px] max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#e5eee7] bg-[#f7faf8] px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-sm">
              <Icon name="sparkle" size={18} />
            </div>
            <div>
              <h2
                id="ai-assistant-title"
                className="text-sm font-bold text-slate-800"
              >
                Trợ lý FocusFlow AI
              </h2>
              <p className="text-[10px] text-slate-500">
                Hỏi đáp & Nhập liệu nhanh
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quota && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  quota.remaining === 0
                    ? "border border-rose-300 bg-rose-50 text-rose-700"
                    : quota.remaining <= 3
                      ? "border border-amber-300 bg-amber-50 text-amber-700"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-700"
                }`}
                title={`Hạn mức AI: ${quota.remaining}/${quota.limit} lượt khả dụng`}
              >
                ⚡ AI: {quota.remaining}/{quota.limit}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trợ lý AI"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>

        {/* Thông báo quyền micro (US-33.EX1) */}
        {micError && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            <p className="font-medium">{micError}</p>
          </div>
        )}

        {/* Lỗi Rate limit / AI (US-38) */}
        {error && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
            <p className="font-semibold">{error}</p>
            {retryCountdown !== null && retryCountdown > 0 && (
              <p className="mt-0.5 text-[11px] text-rose-600">
                ⏳ Bạn có thể gửi lại yêu cầu sau {retryCountdown} giây.
              </p>
            )}
          </div>
        )}

        {/* Danh sách tin nhắn */}
        <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {msg.sender === "assistant" ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Icon name="sparkle" size={14} />
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                  <Icon name="user" size={14} />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : "bg-[#f3f6f4] text-slate-800 rounded-tl-none border border-[#e5ebe7]"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Thẻ đề xuất tạo task (Action) */}
                {msg.action?.type === "create_task" && msg.action.task && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-slate-800 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Đề xuất công việc mới
                        </span>
                        <h4 className="mt-0.5 text-xs font-bold text-slate-800">
                          {msg.action.task.title}
                        </h4>
                      </div>
                      {msg.action.task.isStarred && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          ⭐ Ưu tiên
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                        📅{" "}
                        {msg.action.task.date
                          ? (() => {
                              const parts = msg.action.task.date.split("-")
                              const d = parts[2]
                              const m = parts[1]
                              const dName =
                                msg.action.task.day !== null &&
                                msg.action.task.day !== undefined
                                  ? dayNames[msg.action.task.day]
                                  : ""
                              return dName ? `${dName}, ${d}/${m}` : `${d}/${m}`
                            })()
                          : msg.action.task.day !== null &&
                            msg.action.task.day !== undefined
                            ? dayNames[msg.action.task.day]
                            : "Hôm nay"}
                      </span>
                      {msg.action.task.time && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                          ⏰ {msg.action.task.time}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={msg.added}
                      onClick={() => confirmAddTask(msg.id, msg.action!.task!)}
                      className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                        msg.added
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                      }`}
                    >
                      {msg.added
                        ? "✓ Đã thêm vào kế hoạch"
                        : "➕ Thêm công việc vào lịch"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 animate-pulse">
                <Icon name="sparkle" size={14} />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-[#e5ebe7] bg-[#f3f6f4] px-4 py-2.5 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:0.4s]" />
                  <span className="ml-1 text-[11px] text-emerald-800 font-medium">
                    Trợ lý AI đang xử lý...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Gợi ý mẫu */}
        <div className="flex flex-wrap gap-1.5 border-t border-[#edf2ee] bg-[#fafcfb] px-4 py-2 text-[11px]">
          <span className="text-[10px] font-semibold text-slate-400 self-center mr-1">
            Gợi ý:
          </span>
          <button
            type="button"
            onClick={() => handleSend("Hôm nay tôi nên tập trung vào việc gì?")}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 text-[11px]"
          >
            💡 Việc cần làm hôm nay?
          </button>

          <button
            type="button"
            onClick={() =>
              handleSend("Cách quản lý thời gian hiệu quả theo Pomodoro?")
            }
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 text-[11px]"
          >
            ⏱️ Mẹo quản lý thời gian
          </button>
        </div>

        {/* Khung nhập tin nhắn & nút Giọng nói (Voice) */}
        <footer className="border-t border-[#e5eee7] bg-white p-3 sm:p-4">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            {/* Nút Micro (Speech-to-Text - US-33) */}
            <button
              type="button"
              onClick={toggleListening}
              title={
                isListening
                  ? "Đang lắng nghe... Bấm để dừng"
                  : speechSupported
                    ? "Nói để nhập liệu bằng giọng nói"
                    : "Trình duyệt không hỗ trợ Web Speech"
              }
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                isListening
                  ? "bg-rose-500 text-white animate-pulse shadow-md shadow-rose-200"
                  : "border border-slate-200 bg-[#f7faf8] text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <Icon name="mic" size={18} />
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                </span>
              )}
            </button>

            {/* Ô nhập văn bản */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? "Đang lắng nghe giọng nói của bạn... Hãy nói yêu cầu"
                  : 'Hỏi đáp hoặc gõ: "Tạo việc họp nhóm lúc 10h thứ Ba"...'
              }
              disabled={
                loading || (retryCountdown !== null && retryCountdown > 0)
              }
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-[#fbfdfb] px-3.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />

            {/* Nút gửi */}
            <button
              type="submit"
              disabled={
                loading ||
                !input.trim() ||
                (retryCountdown !== null && retryCountdown > 0)
              }
              className="flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Gửi
            </button>
          </form>

          {/* Ghi chú minh bạch theo US-33.EX1 */}
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Micro chuyển giọng nói thành văn bản trên máy. Trợ lý AI phân tích
            để trả lời và đề xuất việc.
          </p>
        </footer>
      </section>
    </div>
  )
}
