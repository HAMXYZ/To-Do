import React, { useState } from 'react';
import { Task, WeeklyReport, AIResponseState } from '../types';

interface AIWeeklyReviewModalProps {
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
}

export const AIWeeklyReviewModal: React.FC<AIWeeklyReviewModalProps> = ({ tasks, isOpen, onClose }) => {
  const [aiState, setAiState] = useState<AIResponseState<WeeklyReport>>({
    isLoading: false,
    error: null,
    isTimeout: false,
    data: null,
  });

  if (!isOpen) return null;

  // US-36: Kiểm tra nếu 7 ngày qua không có công việc
  const hasEnoughData = tasks.length > 0;

  // US-36 & US-37: Gọi API AI xử lý Timeout 15s và Retry
  const handleFetchWeeklyReport = async () => {
    if (!hasEnoughData) return;

    setAiState({ isLoading: true, error: null, isTimeout: false, data: null });

    // US-37: Ngắt kết nối nếu quá 15 giây
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/ai/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Lỗi máy chủ AI');

      const result: WeeklyReport = await response.json();
      setAiState({ isLoading: false, error: null, isTimeout: false, data: result });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
       
        setAiState({
          isLoading: false,
          error: 'Kết nối với AI bị quá thời gian (Timeout 15s). Vui lòng thử lại!',
          isTimeout: true,
          data: null,
        });
      } else {
        setAiState({
          isLoading: false,
          error: 'Hệ thống AI tạm thời gián đoạn. Vui lòng bấm thử lại!',
          isTimeout: false,
          data: null,
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <h3 className="text-lg font-bold text-gray-800">🤖 Báo Cáo Hiệu Suất Tuần (AI)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
        </div>
        {!hasEnoughData && (
          <div className="my-4 rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-800 text-xs">
            ⚠️ <strong>Chưa đủ dữ liệu:</strong> Cần ít nhất 1 công việc trong 7 ngày qua để AI phân tích.
          </div>
        )}
        {aiState.isLoading && (
          <div className="my-8 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-xs font-medium text-emerald-700 animate-pulse">AI đang tổng hợp dữ liệu...</p>
          </div>
        )}

        {aiState.error && (
          <div className="my-4 rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-xs">
            <p className="font-semibold mb-2">❌ {aiState.error}</p>
            <button
              onClick={handleFetchWeeklyReport}
              className="mt-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-red-700 shadow-sm"
            >
              🔄 Thử lại
            </button>
          </div>
        )}

        {aiState.data && !aiState.isLoading && (
          <div className="space-y-3 text-xs text-gray-700">
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
              <p className="font-semibold text-emerald-900 mb-1">📝 Tóm tắt:</p>
              <p>{aiState.data.summary}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t pt-3">
          {hasEnoughData && !aiState.data && !aiState.isLoading && (
            <button onClick={handleFetchWeeklyReport} className="rounded-lg bg-[#4e8260] px-4 py-2 text-xs font-semibold text-white">
              Tạo Báo Cáo Tuần
            </button>
          )}
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-semibold text-gray-600">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};