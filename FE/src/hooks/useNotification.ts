import { useEffect } from 'react';
import { Task } from '../types';

export function useNotification(tasks: Task[]) {

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      
      tasks.forEach((task) => {
        if (!task.done && task.reminderTime === currentTimeStr) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏰ Nhắc nhở công việc', {
              body: `Đã đến giờ làm: "${task.title}"`,
              icon: '/favicon.ico',
            });

            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.play().catch(() => {});
            } catch (e) {
              console.log('Audio playback error:', e);
            }
          }
        }
      });

      if (currentTimeStr === '20:00') {
        const totalCount = tasks.length;
        const completedCount = tasks.filter((t) => t.done).length;
        const pendingCount = totalCount - completedCount;

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('📊 Tổng kết công việc cuối ngày (20:00)', {
            body: `Hôm nay bạn đã hoàn thành ${completedCount}/${totalCount} công việc. Còn ${pendingCount} công việc chưa xong!`,
            icon: '/favicon.ico',
          });
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [tasks]);
}