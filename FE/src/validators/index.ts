export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 6) {
    return { valid: false, reason: "Mật khẩu phải có ít nhất 6 ký tự" }
  }
  return { valid: true }
}

export function validateTaskTitle(title: string): { valid: boolean; reason?: string } {
  const trimmed = title.trim()
  if (!trimmed) {
    return { valid: false, reason: "Tiêu đề công việc không được để trống" }
  }
  if (trimmed.length > 255) {
    return { valid: false, reason: "Tiêu đề không được vượt quá 255 ký tự" }
  }
  return { valid: true }
}

export function validateHabitTitle(title: string): { valid: boolean; reason?: string } {
  const trimmed = title.trim()
  if (!trimmed) {
    return { valid: false, reason: "Tên thói quen không được để trống" }
  }
  if (trimmed.length > 100) {
    return { valid: false, reason: "Tên thói quen không được vượt quá 100 ký tự" }
  }
  return { valid: true }
}
