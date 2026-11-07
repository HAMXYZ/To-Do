# FocusFlow AI - Backend

Backend dịch vụ FocusFlow AI xây dựng bằng FastAPI, Python 3.12, SQLAlchemy (Async), PostgreSQL và SQLite.

## Cấu trúc thư mục (`src/`)
- `@types/`: Kiểu dữ liệu & Type Definitions (TypedDict, Protocols, TypeScript types).
- `config/`: Cấu hình môi trường (`settings.py`), kết nối cơ sở dữ liệu (`database.py`).
- `controllers/`: Tầng điều khiển tiếp nhận và xử lý logic nghiệp vụ.
- `helpers/`: Các hàm phụ trợ (xác thực, mã hóa mật khẩu, tính toán thời gian, giới hạn).
- `middlewares/`: Các middleware xử lý CORS, kiểm soát rate limit và AI quota, xử lý ngoại lệ.
- `models/`: Khai báo bảng SQLAlchemy ORM (`User`, `Task`, `Habit`, `WeeklyReview`,...).
- `routes/`: Các bộ định tuyến API RESTful (`ai`, `tasks`, `habits`, `auth`, `reminders`,...).
- `services/`: Tích hợp dịch vụ bên ngoài và xử lý logic AI (`ai_service.py`).
- `validators/`: Pydantic schemas kiểm tra và chuẩn hóa dữ liệu đầu vào.
- `server.py`: Điểm khởi chạy chính của máy chủ FastAPI (`uvicorn src.server:app`).
