# FocusFlow AI - Frontend

Frontend của ứng dụng FocusFlow AI xây dựng bằng React 18, TypeScript, Tailwind CSS, và Vite (đóng gói Electron desktop app).

## Cấu trúc thư mục (`src/`)
- `@types/`: Chứa các khai báo kiểu dữ liệu TypeScript.
- `api/`: Xử lý giao tiếp với RESTful Backend API (`/api/v1`).
- `assets/`: Biểu tượng, logo và tài nguyên tĩnh của ứng dụng.
- `components/`: Các UI components tái sử dụng (Ring, WeekPicker, HabitReviewModal, TaskCard,...).
- `hooks/`: Custom React hooks (`useAppData`, `useReminderNotifications`).
- `pages/`: Các trang màn hình chính (`Login`, `Register`).
- `routes/`: Bộ điều hướng và cấu hình tuyến màn hình.
- `templates/`: Khung mẫu giao diện chuẩn (`MainLayout`, `ModalLayout`).
- `themes/`: Bảng màu, quản lý Dark/Light mode và thiết kế token.
- `utils/`: Các hàm tiện ích hỗ trợ (thời gian, thông báo, tuần, tính toán AI).
- `validators/`: Hàm kiểm tra tính hợp lệ dữ liệu biểu mẫu người dùng.
- `App.tsx`: Thành phần giao diện cốt lõi của ứng dụng.
- `main.tsx`: Điểm khởi chạy của React App.
- `vite-env.d.ts`: Khai báo môi trường TypeScript Vite.
