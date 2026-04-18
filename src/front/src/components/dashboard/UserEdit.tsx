import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input } from '../ui/Input';

import { 
  Search, 
  Shield, 
  Star, 
  User, 
  Users,
  Check, 
  Calendar,
  Clock,
  Settings,
  AlertCircle,
  Info
} from 'lucide-react';

import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { APIUser } from '../../types/api';
import badgesJson from '../../data/badges.json';
import extrasJson from '../../data/extras.json';
import type { BadgesData } from '../../types/badges';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const badges = badgesJson as BadgesData;

interface Permission {
  id: bigint;
  name: string;
  description: string;
}

interface PermissionCategory {
  name: string;
  icon: any;
  permissions: Permission[];
}

const permissionCategories: PermissionCategory[] = [
  {
    name: "Üye Yönetimi",
    icon: Users,
    permissions: [
      { id: 1n << 0n, name: "VIEW", description: "Üyeleri Görüntüleme" },
      { id: 1n << 1n, name: "LIST", description: "Üye Listesine Erişim" },
      { id: 1n << 2n, name: "CREATE", description: "Yeni Üye Oluşturma" },
      { id: 1n << 3n, name: "UPDATE", description: "Üye Bilgilerini Düzenleme" },
      { id: 1n << 4n, name: "DELETE", description: "Üye Silme" },
      { id: 1n << 5n, name: "BAN", description: "Üye Yasaklama" },
      { id: 1n << 6n, name: "MANAGE", description: "Tam Üye Yönetimi" }
    ]
  },
  {
    name: "Kayıtlar",
    icon: Calendar,
    permissions: [
      { id: 1n << 7n, name: "VIEW", description: "Kayıtları Görüntüleme" },
      { id: 1n << 8n, name: "CREATE", description: "Yeni Kayıt Oluşturma" },
      { id: 1n << 9n, name: "UPDATE", description: "Kayıtları Düzenleme" },
      { id: 1n << 10n, name: "DELETE", description: "Kayıt Silme" },
      { id: 1n << 11n, name: "MANAGE", description: "Tam Kayıt Yönetimi" }
    ]
  },
  {
    name: "Terfi Süresi",
    icon: Clock,
    permissions: [
      { id: 1n << 12n, name: "VIEW", description: "Süreleri Görüntüleme" },
      { id: 1n << 13n, name: "UPDATE", description: "Süreleri Güncelleme" },
      { id: 1n << 14n, name: "RESET", description: "Süreleri Sıfırlama" },
      { id: 1n << 15n, name: "MANAGE", description: "Tam Süre Yönetimi" }
    ]
  },
  {
    name: "Rozet Yönetimi",
    icon: Star,
    permissions: [
      { id: 1n << 16n, name: "VIEW", description: "Rozetleri Görüntüleme" },
      { id: 1n << 17n, name: "ASSIGN", description: "Rozet Atama" },
      { id: 1n << 18n, name: "CREATE", description: "Yeni Rozet Oluşturma" },
      { id: 1n << 19n, name: "DELETE", description: "Rozet Silme" },
      { id: 1n << 20n, name: "MANAGE", description: "Tam Rozet Yönetimi" }
    ]
  },
  {
    name: "Sistem",
    icon: Settings,
    permissions: [
      { id: 1n << 21n, name: "VIEW_LOGS", description: "Sistem Loglarını Görüntüleme" },
      { id: 1n << 22n, name: "SETTINGS", description: "Sistem Ayarlarını Değiştirme" },
      { id: 1n << 23n, name: "BACKUPS", description: "Yedekleme Yönetimi" },
      { id: 1n << 24n, name: "MANAGE", description: "Tam Sistem Yönetimi" }
    ]
  },
  {
    name: "Roller",
    icon: Shield,
    permissions: [
      { id: 1n << 29n, name: "ADMIN", description: "Yönetici (Tüm Yetkiler)" },
      { id: 1n << 30n, name: "MODERATOR", description: "Moderatör Yetkileri" },
      { id: 1n << 31n, name: "VIEWER", description: "Sadece Görüntüleme" }
    ]
  }
];

export function UserEdit() {
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banPermanent, setBanPermanent] = useState(true);
  const [banExpires, setBanExpires] = useState("");
  const hasPermissionToEdit = true; // Bu değer API'den gelen kullanıcı yetkilerine göre belirlenecek
  const [selectedPermissions, setSelectedPermissions] = useState<bigint[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const [filteredUsers, setFilteredUsers] = useState<APIUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<APIUser | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    if (!selectedUser) return;

    if (selectedUser.user_flags) {
      const currentFlags = BigInt(selectedUser.user_flags);
      const existingPermissions = permissionCategories
        .flatMap(cat => cat.permissions.filter(p => (currentFlags & p.id) === p.id))
        .map(p => p.id);
      setSelectedPermissions(existingPermissions);
    }

    if (selectedUser.extras) {
      setSelectedExtras(selectedUser.extras);
    }
  }, [selectedUser]);

  // Yetki kategorilerini belirle
  const setRolePermissions = (role: 'admin' | 'moderator' | 'viewer') => {
    let newPermissions: bigint[] = [];
    if (role === 'admin') {
      // Admin için tüm yetkileri seç
      newPermissions = permissionCategories.flatMap(cat => cat.permissions.map(p => p.id));
    } else if (role === 'moderator') {
      // Moderatör için gerekli yetkileri seç
      newPermissions = permissionCategories.flatMap(cat => 
        cat.permissions.filter(p => 
          // Moderatör için spesifik yetkiler
          ['VIEW', 'LIST', 'UPDATE', 'MANAGE'].includes(p.name) ||
          (cat.name === 'Üye Yönetimi' && ['BAN'].includes(p.name)) ||
          (cat.name === 'Kayıtlar' && ['CREATE'].includes(p.name)) ||
          (cat.name === 'Terfi Süresi' && ['RESET'].includes(p.name)) ||
          (cat.name === 'Sistem' && ['VIEW_LOGS'].includes(p.name))
        ).map(p => p.id)
      );
    } else if (role === 'viewer') {
      // İzleyici için sadece görüntüleme yetkilerini seç
      newPermissions = permissionCategories.flatMap(cat =>
        cat.permissions.filter(p => ['VIEW', 'LIST'].includes(p.name)).map(p => p.id)
      );
    }
    setSelectedPermissions(newPermissions);
  };

  // Kullanıcı yetkilerini güncelle
  const handlePermissionUpdate = async () => {
    if (!selectedUser) return;
    
    try {
      const totalPermissions = selectedPermissions.reduce((a, b) => a | b, 0n);
      await apiClient.put(`/management/users/${selectedUser.id}/permissions`, {
        permissions: totalPermissions.toString() // Convert BigInt to string before sending
      });
      toast.success('Yetkiler başarıyla güncellendi!');
      setIsPermissionDialogOpen(false);
      loadUsers(pagination.page);
    } catch (error: any) {
      toast.error(`Hata: ${error.message}`);
    }
  };

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
      <Card className="p-6 bg-gradient-to-br from-gray-950/30 to-gray-900/30 border-gray-700/30 mb-6">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              type="text"
              placeholder="Kullanıcı ara..."
              className="pl-10 bg-gray-800/50 border-gray-600/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden bg-gradient-to-br from-gray-950/30 to-gray-900/30 border-gray-700/30">
          <Table>
            <TableHeader className="bg-gray-900/50">
              <TableRow>
              <TableHead className="text-gray-300">Kullanıcı</TableHead>
              <TableHead className="text-gray-300">Rozet</TableHead>
              <TableHead className="text-gray-300">Rütbe</TableHead>
              <TableHead className="text-gray-300">Yetki</TableHead>
              <TableHead className="text-gray-300">Kayıt</TableHead>
              <TableHead className="text-gray-300">İşlemler</TableHead>
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
                  <TableCell>
                    <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8" style={{ gridColumn: "span 6" }}>
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
                  className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-700/50">
                        {user.avatar ? (
                          <img 
                            src={user.avatar}
                            alt={user.username}
                            className={`w-full h-full object-cover ${user.is_banned ? 'opacity-50 grayscale' : ''}`}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-300" />
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
                    <div className="px-3 py-1 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-1 w-fit text-sm">
                      <Star className="w-4 h-4" />
                      {user.badge_name || 'Yok'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="px-3 py-1 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-1 w-fit text-sm">
                      <Shield className="w-4 h-4" />
                      {user.rank_name || 'Yok'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 w-fit ${
                      BigInt(user.user_flags) === 0n 
                        ? 'bg-gray-800/50 border border-gray-600/50 text-gray-400' 
                        : 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 text-red-300'
                    }`}>
                      {BigInt(user.user_flags) === 0n ? 'Standart' : 'Yetkili'}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('tr-TR')}
                  </TableCell>
                  <TableCell>
                    {!user.is_banned && (
                      <Button 
                        variant="outline"
                        size="sm" 
                        onClick={() => setSelectedUser(user)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 font-medium"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Düzenle
                      </Button>
                    )}
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Sayfalama */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1 || loading}
            className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
          >
            Önceki
          </Button>
          <span className="px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-gray-300">
            Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={pagination.page === pagination.totalPages || loading}
            className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
          >
            Sonraki
          </Button>
        </div>
      )}
      </div>

      {/* Kullanıcı Düzenleme Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="bg-gray-900 border border-gray-700">
          <DialogHeader className="border-b border-gray-700/50 pb-4">
            <DialogTitle className="text-lg text-white flex items-center gap-2">
              <User className="w-5 h-5 text-red-400" />
              Kullanıcı Düzenle - {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedUser?.is_banned && (
              <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Yasaklı Kullanıcı</span>
                </div>
                <p className="text-gray-300 text-sm">
                  Bu kullanıcı yasaklı olduğu için düzenlenemez. Düzenleme yapabilmek için önce kullanıcının yasağını kaldırmalısınız.
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Kullanıcı ID</label>
              <Input 
                value={selectedUser?.id ?? ''} 
                onChange={() => {}} 
                disabled 
                className="bg-gray-800/50 border-gray-600/50 text-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Kullanıcı Adı</label>
              <Input 
                value={selectedUser?.username ?? ''} 
                onChange={() => {}} 
                disabled 
                className="bg-gray-800/50 border-gray-600/50 text-gray-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Rozet</label>
              <select
                value={selectedUser?.badge_name || ""}
                onChange={(e) => {
                  if (!selectedUser) return;
                  setSelectedUser({ ...selectedUser, badge_name: e.target.value, rank_name: null });
                }}
                className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-600/50 text-gray-300 
                  focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent
                  [&>option]:bg-gray-900 [&>option]:text-gray-300 
                  [&>option:hover]:bg-gray-800 [&>option:hover]:text-white
                  [&>option:checked]:bg-gradient-to-r [&>option:checked]:from-red-500/20 [&>option:checked]:to-orange-500/20
                  appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="" disabled>Rozet seçin</option>
                {Object.entries(badges)
                  .map(([name, badge]) => (
                    <option key={name} value={name}>
                      {name} {badge.ranks.length > 0 ? `(${badge.ranks.length} rütbe)` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Rütbe</label>
              <select
                value={selectedUser?.rank_name || ""}
                onChange={(e) => {
                  if (!selectedUser) return;
                  setSelectedUser({ ...selectedUser, rank_name: e.target.value });
                }}
                disabled={!selectedUser?.badge_name}
                className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-600/50 text-gray-300 
                  focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  [&>option]:bg-gray-900 [&>option]:text-gray-300 
                  [&>option:hover]:bg-gray-800 [&>option:hover]:text-white
                  [&>option:checked]:bg-gradient-to-r [&>option:checked]:from-red-500/20 [&>option:checked]:to-orange-500/20
                  appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="" disabled>
                  {selectedUser?.badge_name ? "Rütbe seçin" : "Önce rozet seçin"}
                </option>
                {selectedUser?.badge_name && badges[selectedUser.badge_name]?.ranks.map((rank: string) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Extra Rozetler</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(extrasJson.groups).map(([name, _info]) => (
                  <div
                    key={name}
                    onClick={() => {
                      if (selectedExtras.includes(name)) {
                        setSelectedExtras(prev => prev.filter(item => item !== name));
                      } else {
                        setSelectedExtras(prev => [...prev, name]);
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                      selectedExtras.includes(name)
                        ? 'bg-red-500/20 border-red-500/50 text-white'
                        : 'bg-gray-800/30 border-gray-700/30 text-gray-400 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="text-sm">{name}</span>
                    {selectedExtras.includes(name) && (
                      <Check className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsPermissionDialogOpen(true)}
                  disabled={!hasPermissionToEdit || selectedUser?.is_banned}
                  className={`bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white ${!hasPermissionToEdit || selectedUser?.is_banned ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Yetkileri Düzenle
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsBanDialogOpen(true)}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Yasakla
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
              <Button 
                variant="outline" 
                onClick={() => setSelectedUser(null)}
                className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              >
                İptal Et
              </Button>
              <Button 
                onClick={() => {
                  if (!selectedUser || !selectedUser.badge_name) return;

                  // Rozet indexini bul (0-based index, +1 ekleyerek gönderiyoruz)
                  const badgeIndex = Object.keys(badges).findIndex(name => name === selectedUser.badge_name);
                  if (badgeIndex === -1) return;

                  // Rütbe indexini bul (0-based index, +1 ekleyerek gönderiyoruz)
                  const badge = badges[selectedUser.badge_name];
                  const rankIndex = badge.ranks.findIndex(name => name === selectedUser.rank_name);

                  // API'ye gönderilecek data
                  const updateData = {
                    badge: badgeIndex + 1, // 1-based index
                    rank: rankIndex === -1 ? 0 : rankIndex + 1, // Rütbe yoksa 0, varsa 1-based index
                    extras: selectedExtras
                  };

                  toast.promise(
                    apiClient.put(`/management/users/${selectedUser.id}`, updateData),
                    {
                      loading: 'Kullanıcı güncelleniyor...',
                      success: () => {
                        setSelectedUser(null);
                        loadUsers(pagination.page);
                        return 'Kullanıcı başarıyla güncellendi!';
                      },
                      error: (err) => `Hata: ${err.message}`
                    }
                  );
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Yetkiler Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="bg-gray-900 border border-gray-700 max-w-3xl">
          <DialogHeader className="border-b border-gray-700/50 pb-4">
            <DialogTitle className="text-lg text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              Yetkileri Düzenle - {selectedUser?.username}
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">
              <Info className="inline-block w-4 h-4 mr-2" />
              Üyenin sahip olacağı yetkileri seçin. Administrator yetkisi tüm yetkileri içerir.
            </p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRolePermissions('admin')}
                className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin Yetkileri
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRolePermissions('moderator')}
                className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                Moderatör Yetkileri
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRolePermissions('viewer')}
                className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                İzleyici Yetkileri
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
            {permissionCategories.map((category) => (
              <div key={category.name} className="space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <category.icon className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold">{category.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {category.permissions.map((permission) => (
                    <label 
                      key={permission.id} 
                      className="group flex items-start space-x-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:bg-gray-800/50 hover:border-gray-600/50 transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="relative min-w-[20px] mt-0.5">
                        <input 
                          type="checkbox"
                          className="peer sr-only"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (permission.name === 'administrator') {
                                // Eğer administrator seçildiyse, tüm yetkileri seç
                                const allPermissionIds = permissionCategories
                                  .flatMap(cat => cat.permissions)
                                  .map(p => p.id);
                                setSelectedPermissions(allPermissionIds);
                              } else {
                                setSelectedPermissions([...selectedPermissions, permission.id]);
                              }
                            } else {
                              if (permission.name === 'administrator') {
                                // Eğer administrator kaldırıldıysa, tüm yetkileri kaldır
                                setSelectedPermissions([]);
                              } else {
                                setSelectedPermissions(selectedPermissions.filter(id => id !== permission.id));
                              }
                            }
                          }}
                        />
                        <div className="absolute inset-0 w-5 h-5 border rounded bg-transparent peer-checked:bg-gradient-to-r peer-checked:from-red-500/20 peer-checked:to-orange-500/20 border-gray-600 peer-checked:border-red-500/30 transition-all">
                          <Check className="w-4 h-4 text-red-400 opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-white text-sm">{permission.description}</span>
                        <span className="text-xs text-gray-400">{permission.name}</span>
                      </div>
                      {permission.name === 'administrator' && (
                        <AlertCircle className="absolute top-2 right-2 w-4 h-4 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50 sticky bottom-0 bg-gray-900 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsPermissionDialogOpen(false)}
                className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
              >
                İptal Et
              </Button>
              <Button 
                onClick={handlePermissionUpdate}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
        <DialogContent className="bg-gray-900 border border-gray-700">
          <DialogHeader className="border-b border-gray-700/50 pb-4">
            <DialogTitle className="text-lg text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Kullanıcıyı Yasakla - {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          {
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Yasaklama Sebebi</label>
                <Input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Yasaklama sebebini yazın..."
                  className="bg-gray-800/50 border-gray-600/50 text-gray-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Yasaklama Türü</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={banPermanent}
                      onChange={(e) => setBanPermanent(e.target.checked)}
                      className="form-checkbox bg-gray-800 border-gray-600 text-red-500"
                    />
                    <span className="text-gray-300">Kalıcı</span>
                  </label>
                </div>
              </div>
              {!banPermanent && (
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Bitiş Tarihi</label>
                  <input
                    type="datetime-local"
                    value={banExpires}
                    onChange={(e) => setBanExpires(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:border-red-500 focus:ring-red-500/20 focus:outline-none focus:ring-2 bg-gray-800/50 border-gray-600/50 text-gray-300"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
                <Button
                  variant="outline"
                  onClick={() => setIsBanDialogOpen(false)}
                  className="bg-gray-800/50 border-gray-600/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                >
                  İptal
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!selectedUser) return;
                    
                    const banData = {
                      reason: banReason,
                      permanently: banPermanent,
                      expires: banPermanent ? undefined : banExpires
                    };

                    toast.promise(
                      apiClient.post(`/management/users/${selectedUser.id}/ban`, banData),
                      {
                        loading: 'Kullanıcı yasaklanıyor...',
                        success: () => {
                          setIsBanDialogOpen(false);
                          setBanReason('');
                          setBanPermanent(true);
                          setBanExpires('');
                          loadUsers(pagination.page);
                          return 'Kullanıcı başarıyla yasaklandı!';
                        },
                        error: (err) => `Hata: ${err.message}`
                      }
                    );
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Yasakla
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </>
  );
}