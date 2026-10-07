Hướng dẫn nhanh: Thiết lập DB (PostgreSQL) cho FastAPI + SQLAlchemy + Alembic

Chạy các lệnh dưới đây từ thư mục `BE`:

1) Cài phụ thuộc (tạo virtualenv nếu cần):
   pip install -r requirements.txt

2) Khởi động PostgreSQL bằng Docker Compose:
   docker compose up -d

3) Tạo file .env từ .env.example và chỉnh nếu cần.

4) Khởi tạo Alembic (nếu chưa):
   alembic revision --autogenerate -m "create initial tables"
   alembic upgrade head

   (alembic.ini hiện mặc định dùng psycopg2 sync URL. Nếu dùng asyncpg cho runtime, chỉnh lại sqlalchemy.url trước khi chạy alembic hoặc tạm cài psycopg2-binary.)

5) Phát triển: `src/db.py` cung cấp `init_db()` để nhanh tạo bảng trong dev, và `get_session()` dependency cho FastAPI.

Các ORM model được định nghĩa trong `src/models.py`. Alembic autogenerate và `init_db()` cùng sử dụng `Base.metadata`.
