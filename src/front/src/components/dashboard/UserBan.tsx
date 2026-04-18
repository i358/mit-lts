import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Search, Ban, AlertTriangle } from 'lucide-react';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import type { User } from '../../types/user';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function UserBan() {
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [isPermanent, setIsPermanent] = useState(true);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Kullanıcıları yükle (searchTerm doluysa backend search endpoint'i kullanır)
  const fetchUsers = async (page = 1, queryOverride?: string) => {
    try {
      setLoading(true);
      const q = (queryOverride ?? searchTerm).trim();
      const endpoint = q
        ? `/management/users/search?q=${encodeURIComponent(q)}&page=${page}&limit=${pagination.limit}`
        : `/management/users?page=${page}&limit=${pagination.limit}`;

      const response = await apiClient.get(endpoint);
      if (response.data.success === 1) {
        const newUsers = response.data.data.users;
        setFilteredUsers(newUsers);
        setPagination(prev => ({
          ...prev,
          page,
          total: response.data.data.pagination.total,
          totalPages: response.data.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Kullanıcılar yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // İlk yükleme
  useEffect(() => {
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sayfa değişince yükle
  useEffect(() => {
    fetchUsers(pagination.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]);

  // Arama işlemi (debounce) + sayfayı 1'e al
  useEffect(() => {
    const handle = setTimeout(() => {
      const q = searchTerm.trim();
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        fetchUsers(1, q);
      }
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Yasaklama işlemi
  const handleBan = async (user: User) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  const confirmBan = async () => {
    if (!selectedUser) return;
    if (!isPermanent && !expiryDate) {
      toast.error('Lütfen yasak süresini belirtin');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(`/management/users/${selectedUser.id}/ban`, {
        reason: banReason,
        permanently: isPermanent,
        expires: isPermanent ? undefined : expiryDate
      });
      toast.success(`${selectedUser.username} başarıyla yasaklandı`);
      setShowConfirmModal(false);
      setSelectedUser(null);
      setBanReason('');
      setExpiryDate('');
      setIsPermanent(true);
      fetchUsers(pagination.page, searchTerm); // Listeyi yenile
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Yasaklama işlemi başarısız oldu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mr-4">
            <Ban className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Kullanıcı Yasakla</h2>
            <p className="text-sm text-gray-400">Sisteme erişimi yasakla</p>
          </div>
        </div>

        {/* Arama */}
        <div className="mb-6">
          <Input
            icon={Search}
            placeholder="Kullanıcı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Kullanıcı Listesi */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="mt-2 text-gray-400">Kullanıcılar yükleniyor...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-400">Hiç kullanıcı bulunamadı.</p>
            </div>
          ) : filteredUsers.map(user => (
            <div
              key={user.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className={`w-12 h-12 rounded-lg ${user.is_banned ? 'opacity-50 grayscale' : ''}`}
                  />
                )}
                <div>
                  <h3 className={`font-medium ${user.is_banned ? 'line-through text-red-500' : 'text-white'}`}>
                    {user.username}
                    {user.is_banned && (
                      <span className="ml-2 text-sm font-normal text-red-400">
                        (Yasaklı {user.ban_info?.permanent ? '- Kalıcı' : user.ban_info?.expires ? `- ${formatDistanceToNow(new Date(user.ban_info.expires), { addSuffix: true, locale: tr })} bitiyor` : ''})
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {user.created_at && `Katılım: ${formatDistanceToNow(new Date(user.created_at), { 
                      addSuffix: true,
                      locale: tr 
                    })}`}
                    {user.is_banned && user.ban_info?.reason && (
                      <span className="block text-red-400">
                        Sebep: {user.ban_info.reason}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {user.is_banned ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await apiClient.post(`/management/users/${user.id}/unban`);
                      toast.success(`${user.username} kullanıcısının yasağı kaldırıldı`);
                      fetchUsers(pagination.page, searchTerm);
                    } catch (error: any) {
                      toast.error(error.response?.data?.error || 'Yasak kaldırma işlemi başarısız oldu');
                    }
                  }}
                  className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Yasağı Kaldır
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => handleBan(user)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Yasakla
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
            >
              Önceki
            </Button>
            <span className="px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-gray-300">
              Sayfa {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page === pagination.totalPages}
              className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
            >
              Sonraki
            </Button>
          </div>
        )}
      </Card>

      {/* Onay Modalı */}
      {showConfirmModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Kullanıcıyı Yasakla</h3>
                <p className="text-sm text-gray-400">Bu işlem geri alınamaz</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-gray-300">
                <span className="font-bold text-white">{selectedUser.username}</span> kullanıcısını yasaklamak üzeresiniz.
              </p>

              {/* Yasak Süresi */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isPermanent}
                    onChange={(e) => setIsPermanent(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-gray-300">Kalıcı Yasak</span>
                </label>

                {!isPermanent && (
                  <input
                    type="datetime-local"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                )}
              </div>

              {/* Yasak Sebebi */}
              <div className="space-y-2">
                <label className="text-gray-300">Yasaklama Sebebi</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Yasaklama sebebini belirtin..."
                  className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none h-24"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <Button
                  variant="danger"
                  onClick={confirmBan}
                  loading={loading}
                  className="flex-1"
                >
                  {!loading && <Ban className="w-4 h-4 mr-2" />}
                  Yasakla
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedUser(null);
                    setBanReason('');
                    setExpiryDate('');
                    setIsPermanent(true);
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  İptal
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}