import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Search, UserMinus, AlertTriangle } from 'lucide-react';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import type { User } from '../../types/user';

export function UserDelete() {
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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
      const newUsers = response.data.data.users;
      setFilteredUsers(newUsers);
      setPagination(prev => ({
        ...prev,
        page,
        total: response.data.data.pagination.total,
        totalPages: response.data.data.pagination.totalPages
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Kullanıcılar yüklenirken bir hata oluştu');
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

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      await apiClient.delete(`/management/users/${selectedUser.id}`);
      toast.success(`${selectedUser.username} başarıyla silindi`);
      setShowConfirmModal(false);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Kullanıcı silme işlemi başarısız oldu');
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
            <UserMinus className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Kullanıcı Sil</h2>
            <p className="text-sm text-gray-400">Kullanıcı hesabını kalıcı olarak sil</p>
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
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-white">
                    {user.username}
                  </p>
                  <p className="text-sm text-gray-400">
                    ID: {user.id}
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                onClick={() => handleDelete(user)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Sil
              </Button>
            </div>
          ))}
        </div>

        {/* Pagination */}
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
                <h3 className="text-lg font-bold text-white">Kullanıcıyı Sil</h3>
                <p className="text-sm text-gray-400">Bu işlem geri alınamaz</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-gray-300">
                <span className="font-bold text-white">{selectedUser.username}</span> kullanıcısını silmek üzeresiniz. Bu işlem kalıcıdır ve geri alınamaz.
              </p>

              <div className="flex space-x-4 pt-4">
                <Button
                  variant="danger"
                  onClick={confirmDelete}
                  loading={loading}
                  className="flex-1"
                >
                  {!loading && <UserMinus className="w-4 h-4 mr-2" />}
                  Sil
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1"
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
