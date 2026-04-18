import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { mitAPI } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

/** Tüm slotlar (takvimde sütun sırası). Hafta içi: 16,18,20,22. Hafta sonu: 12,15,18,20,22. */
const TIME_SLOTS = ['12:00', '15:00', '16:00', '18:00', '20:00', '22:00'] as const;
/** Hafta sonu (Cumartesi 6, Pazar 7) slotları. */
const WEEKEND_ONLY_SLOTS = ['12:00', '15:00'] as const;
/** Hafta içi (1–5) slotu: sadece 16:00. */
const WEEKDAY_ONLY_SLOT = '16:00';
function isSlotAvailableOnDay(dayOfWeek: number, timeSlot: string): boolean {
  if (WEEKEND_ONLY_SLOTS.includes(timeSlot as any)) return dayOfWeek === 6 || dayOfWeek === 7;
  if (timeSlot === WEEKDAY_ONLY_SLOT) return dayOfWeek >= 1 && dayOfWeek <= 5;
  return true; // 18:00, 20:00, 22:00 her gün
}

const DAY_LABELS: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};

interface ScheduleSlot {
  day_of_week: number;
  time_slot: string;
  user_id: number | null;
  username: string | null;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Pazartesi–Pazar
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('tr-TR', opts)} - ${end.toLocaleDateString('tr-TR', opts)} ${end.getFullYear()}`;
}

/** Seçilen haftada gün indeksine (1–7) göre o günün tarihini YYYY-MM-DD döndürür. */
function getDateForDay(weekStart: string, dayOfWeek: number): string {
  return addDays(weekStart, dayOfWeek - 1);
}

/** Tarihi kısa etiket olarak gösterir (örn. "10 Şub"). */
function formatDayDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function BulkPromotionScheduleView() {
  const { user } = useAppStore();
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchSchedule = useCallback(async (week?: string) => {
    setLoading(true);
    try {
      const res = await mitAPI.getBulkPromotionSchedule(week);
      if (res.success === 1) {
        setWeekStart(res.weekStart);
        setSlots(res.slots || []);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Takvim yüklenemedi');
      setSlots([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const slotMap = new Map<string, ScheduleSlot>();
  slots.forEach((s) => slotMap.set(`${s.day_of_week}-${s.time_slot}`, s));

  const handleClaim = async (dayOfWeek: number, timeSlot: string) => {
    if (!weekStart) return;
    if (!isSlotAvailableOnDay(dayOfWeek, timeSlot)) return;
    const key = `${dayOfWeek}-${timeSlot}`;
    setClaiming(key);
    try {
      await mitAPI.claimBulkPromotionSlot(weekStart, dayOfWeek, timeSlot);
      toast.success('Slot size atandı.');
      await fetchSchedule(weekStart);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Atama yapılamadı');
    }
    setClaiming(null);
  };

  const handleUnclaim = async (dayOfWeek: number, timeSlot: string) => {
    if (!weekStart) return;
    const key = `${dayOfWeek}-${timeSlot}`;
    setClaiming(key);
    try {
      await mitAPI.unclaimBulkPromotionSlot(weekStart, dayOfWeek, timeSlot);
      toast.success('Atanma kaldırıldı.');
      await fetchSchedule(weekStart);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Kaldırılamadı');
    }
    setClaiming(null);
  };

  const goPrev = () => {
    if (!weekStart) return;
    fetchSchedule(addDays(weekStart, -7));
  };

  const goNext = () => {
    if (!weekStart) return;
    fetchSchedule(addDays(weekStart, 7));
  };

  const currentUserId = user?.id != null ? String(user.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-gray-300">
          <CalendarDays className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Haftalık Toplu Terfi Takvimi</h1>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={goPrev} disabled={loading || !weekStart}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[200px] text-center font-medium text-gray-200">
              {weekStart ? formatWeekLabel(weekStart) : '—'}
            </span>
            <Button variant="secondary" size="sm" onClick={goNext} disabled={loading || !weekStart}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-gray-400">Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-700 bg-gray-800/50 px-3 py-2 text-left text-sm font-medium text-gray-300">
                    Gün
                  </th>
                  {TIME_SLOTS.map((t) => (
                    <th
                      key={t}
                      className="border border-gray-700 bg-gray-800/50 px-3 py-2 text-center text-sm font-medium text-gray-300"
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => (
                  <tr key={day}>
                    <td className="border border-gray-700 bg-gray-800/30 px-3 py-2 text-sm font-medium text-gray-300">
                      {weekStart ? (
                        <>
                          {DAY_LABELS[day]} <span className="text-gray-500 font-normal">({formatDayDate(getDateForDay(weekStart, day))})</span>
                        </>
                      ) : (
                        DAY_LABELS[day]
                      )}
                    </td>
                    {TIME_SLOTS.map((timeSlot) => {
                      const available = isSlotAvailableOnDay(day, timeSlot);
                      const slot = slotMap.get(`${day}-${timeSlot}`);
                      const assigned = slot?.user_id != null;
                      const username = slot?.username ?? null;
                      const isCurrentUser = currentUserId != null && slot?.user_id != null && String(slot.user_id) === currentUserId;
                      const key = `${day}-${timeSlot}`;
                      const busy = claiming === key;

                      return (
                        <td
                          key={timeSlot}
                          className="border border-gray-700 px-2 py-2 text-center text-sm text-gray-200"
                        >
                          {!available ? (
                            <span className="text-gray-500">—</span>
                          ) : assigned ? (
                            <div className="flex flex-col items-center gap-1">
                              <span>{username || `#${slot?.user_id}`}</span>
                              {isCurrentUser && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="text-xs"
                                  disabled={busy}
                                  onClick={() => handleUnclaim(day, timeSlot)}
                                >
                                  Atanmayı kaldır
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleClaim(day, timeSlot)}
                            >
                              {busy ? '...' : 'Müsaitim'}
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
