"""Kiểm tra API Key và liệt kê các model Gemini khả dụng.
Chạy từ thư mục BE:
    python -m scripts.check_ai
"""

import json
import os
import sys
import urllib.request
from urllib.error import HTTPError, URLError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv

load_dotenv(override=True)


def main():
    api_key = os.getenv("AI_API_KEY", "").strip()
    if not api_key or api_key.startswith("YOUR_"):
        print("❌ LỖI: Bạn chưa điền AI_API_KEY thật vào file BE/.env.")
        print("👉 Hãy mở BE/.env và thay YOUR_GEMINI_API_KEY bằng API key của bạn.")
        return

    print(f"🔑 Đang kiểm tra API Key: {api_key[:8]}...{api_key[-4:]}")

    # Gọi endpoint List Models chính thức của Gemini
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = data.get("models", [])
            print(f"✅ API Key HỢP LỆ! Tìm thấy {len(models)} models khả dụng:\n")

            chat_models = []
            for m in models:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    desc = m.get("displayName", name)
                    chat_models.append((name, desc))

            print("Các model bạn có thể điền vào AI_MODEL trong BE/.env:")
            for name, desc in chat_models:
                recommended = " ⭐ (Khuyên dùng)" if name in ("gemini-1.5-flash", "gemini-2.0-flash") else ""
                print(f"  • AI_MODEL={name}{recommended}  [{desc}]")

            print("\n💡 Gợi ý cấu hình tốt nhất cho FocusFlow AI:")
            print("   AI_MODEL=gemini-1.5-flash")

    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"❌ Lỗi HTTP {e.code}: {e.reason}")
        if "API_KEY_INVALID" in body or "API key not valid" in body or e.code in (400, 401, 403):
            print("👉 Nguyên nhân: API Key không chính xác hoặc đã bị xóa. Vui lòng tạo lại key tại https://aistudio.google.com/app/apikey")
        else:
            print(f"Chi tiết phản hồi: {body}")
    except URLError as e:
        print(f"❌ Lỗi kết nối mạng: {e.reason}")
    except Exception as e:
        print(f"❌ Lỗi ngoại lệ: {e}")


if __name__ == "__main__":
    main()

