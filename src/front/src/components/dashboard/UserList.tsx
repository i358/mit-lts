import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Search, Star, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { APIUser } from '../../types/api';

// Sayfalama için interface
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function UserList() {
  // State'ler
  const [filteredUsers, setFilteredUsers] = useState<APIUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Kullanıcıları yükle (searchTerm doluysa backend search endpoint'i kullanır)
  const loadUsers = async (page = 1, queryOverride?: string) => {
    setLoading(true);
    try {
      const q = (queryOverride ?? searchTerm).trim();
      const endpoint = q
        ? `/management/users/search?q=${encodeURIComponent(q)}&page=${page}&limit=${pagination.limit}`
        : `/management/users?page=${page}&limit=${pagination.limit}`;

      const response = await apiClient.get(endpoint);
      const data = response.data;

      if (data.success) {
        const newUsers = data.data.users;
        setFilteredUsers(newUsers);
        setPagination(data.data.pagination);
        if (!q) toast.success(`${data.data.pagination.total} kullanıcı yüklendi!`);
      } else {
        throw new Error(data.error || 'Kullanıcılar yüklenirken hata oluştu');
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error(error.message);
    }
    setLoading(false);
  };

  // Search term değiştiğinde backend'den çek (debounce) + sayfayı 1'e al
  useEffect(() => {
    const handle = setTimeout(() => {
      const q = searchTerm.trim();
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        loadUsers(1, q);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // İlk yükleme
  useEffect(() => {
    loadUsers();
  }, []);

  // Sayfa değiştirme
  const handlePageChange = (newPage: number) => {
    loadUsers(newPage);
  };

  return (
    <>
      <Card className="p-4 mb-6">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              type="text"
              placeholder="Kullanıcı ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Rozet</TableHead>
              <TableHead>Rütbe</TableHead>
              <TableHead>Yetki</TableHead>
              <TableHead>Kayıt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeletons
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
                      <div className="h-4 w-24 bg-gray-700 rounded animate-pulse"></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8" style={{ gridColumn: "span 5" }}>
                  Kullanıcı bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden">
                        {user.avatar ? (
                          <img 
                            src={user.avatar}
                            alt={user.username}
                            className={`w-full h-full object-cover ${user.is_banned ? 'opacity-50 grayscale' : ''}`}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className={`font-medium text-white ${user.is_banned ? 'line-through text-red-500' : ''}`}>
                          {user.username}
                          {user.is_banned && (
                            <Badge variant="destructive" className="ml-2">
                              {user.ban_info?.permanent ? 'Kalıcı Ban' : 'Geçici Ban'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: {user.id}
                          {user.is_banned && user.ban_info?.reason && (
                            <span className="ml-2 text-red-400">({user.ban_info.reason})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="flex items-center gap-1 w-fit">
                      <Star className="w-4 h-4" />
                      {user.badge_name || 'Yok'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="flex items-center gap-1 w-fit">
                      <Shield className="w-4 h-4" />
                      {user.rank_name || 'Yok'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={BigInt(user.user_flags) === 0n ? 'beta' : 'soon'}>
                      {BigInt(user.user_flags) === 0n ? 'Standart' : 'Yetkili'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('tr-TR')}
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {!loading && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Toplam {pagination.total} kullanıcı
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              Önceki
            </Button>
            <span className="text-sm text-gray-400">
              Sayfa {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </>
  );
}