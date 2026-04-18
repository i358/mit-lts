import { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from '../ui/Table';
import { Search, Clock, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';

interface WeeklyRow {
  user_id: number;
  username: string | null;
  week_start: string;
  total_time: number;
  work_time: number;
  updated_at: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getLastWeeks(count: number): string[] {
  const weeks: string[] = [];
  const base = new Date(getCurrentWeekStart() + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - 7 * i);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

export function WeeklyTimeQueryView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [weekStart, setWeekStart] = useState<string>(() => getCurrentWeekStart());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await mitAPI.getWeeklyTimes(weekStart);
        if (data.success && data.data) {
          setRows(data.data);
          setError(null);
        } else {
          throw new Error('Veri formatı hatalı');
        }
      } catch (err) {
        setError(err as Error);
        toast.error('Haftalık veriler yüklenirken bir hata oluştu!');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [weekStart]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(r => (r.username || '').toLowerCase().includes(q));
  }, [rows, searchTerm]);

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, weekStart]);

  const formatDuration = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined || isNaN(ms)) return '0s 0d';
    const totalMinutes = ms < 1000 ? ms : Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    return `${hours}s ${remainingMinutes}d`;
  };

  const formatWeekLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          Veri yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <CalendarDays className="w-6 h-6" />
          Haftalık Süre Sorgu
        </h1>
        <p className="text-gray-400">
          Bu ekran `weekly_time` tablosunu gösterir. Haftalık süreler dakika dakika (delta) eklenir; günlük 09:00 resetten etkilenmez.
        </p>
      </div>

      <Card className="p-4 mb-6 border border-gray-800 bg-gradient-to-r from-gray-900/50 to-gray-800/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Kullanıcı ara..."
              className="pl-10 bg-gray-900/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Hafta:</label>
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {getLastWeeks(8).map((w) => (
                <option key={w} value={w}>
                  {formatWeekLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center px-4 py-2 bg-gray-900/30 rounded-md border border-gray-800">
            <div className="flex items-center space-x-2 text-sm text-emerald-500">
              <Clock className="w-4 h-4" />
              <span>Otomatik güncelleniyor</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border border-gray-800">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-800 bg-gray-900/50">
              <TableHead className="text-gray-400">Kullanıcı</TableHead>
              <TableHead className="text-gray-400">Hafta</TableHead>
              <TableHead className="text-gray-400">Toplam Süre</TableHead>
              <TableHead className="text-gray-400">Terfi Süresi</TableHead>
              <TableHead className="text-gray-400">Son Güncelleme</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-24 bg-gray-700 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-32 bg-gray-700 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-gray-700 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-gray-700 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-gray-700 rounded animate-pulse" /></TableCell>
                </TableRow>
              ))
            ) : filteredRows.length > 0 ? (
              paginatedRows.map((row, index) => (
                <TableRow
                  key={`${row.user_id}-${row.week_start}`}
                  className={`border-b border-gray-800 transition-colors duration-200 hover:bg-gray-900/30 ${
                    index % 2 === 0 ? 'bg-gray-900/10' : 'bg-transparent'
                  }`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-700/50">
                        {row.username ? (
                          <img
                            src={`https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(row.username)}&direction=2&head_direction=2&gesture=nrm&size=l`}
                            alt={row.username}
                            className="w-full h-full object-cover"
                          />
                        ) : <div className="w-full h-full bg-gray-700" /> }
                      </div>
                      <span className="text-gray-200">{row.username || `ID ${row.user_id}`}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">{formatWeekLabel(row.week_start)}</TableCell>
                  <TableCell className="font-medium text-gray-300">{formatDuration(row.total_time)}</TableCell>
                  <TableCell className="font-medium text-gray-300">{formatDuration(row.work_time)}</TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {row.updated_at
                      ? new Date(row.updated_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Search className="w-8 h-8 mb-2 text-gray-600" />
                    <span>Bu hafta için kayıt bulunamadı</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {!loading && totalItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-gray-800 bg-gray-900/30">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {totalItems === 0
                  ? 'Kayıt yok'
                  : `${startIndex + 1}-${Math.min(startIndex + pageSize, totalItems)} / ${totalItems}`}
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} / sayfa
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-md border border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                aria-label="Önceki sayfa"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400 min-w-[6rem] text-center">
                Sayfa {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-md border border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                aria-label="Sonraki sayfa"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
