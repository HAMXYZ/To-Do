"""Chạy script nạp dữ liệu mẫu từ thư mục BE:
    python -m scripts.seed
    python -m scripts.seed --force
    python -m scripts.seed --email=oyuu147258@gmail.com
"""

import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.seed import main

if __name__ == "__main__":
    asyncio.run(main())
