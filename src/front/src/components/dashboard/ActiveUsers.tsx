//@ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { 
  Users, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  Clock, 
  MapPin,
  Star,
  Shield,
  Crown,
  Award,
  Activity,
  User
} from 'lucide-react';
import client, { GET_ACTIVE_USERS } from '../../services/graphqlClient';
import toast from 'react-hot-toast';

interface ActiveUser {
  username: string;
  avatar: string;
  motto: string;
  time: {
    storedTotal: number;
    currentSessionTime: number;
    realTimeTotal: number;
    isActive: boolean;
    lastSeen: number;
  };
  badgeInfo: {
    badge: number;
    rank: number;
    badgeName: string | null;
    rankName: string | null;
  };
}

export function ActiveUsers() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<ActiveUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    loadActiveUsers();
  }, []);

  const loadActiveUsers = async () => {
    setLoading(true);
    try {
      const { data } = await client.query({ 
        query: GET_ACTIVE_USERS,
        variables: { limit: 50, offset: 0 },
        fetchPolicy: 'network-only' // Her zaman fresh data al
      });
      
      setUsers(data.activeUsers);
      toast.success(`${data.activeUsers.length} aktif kullanıcı yüklendi!`);
    } catch (error) {
      console.error('GraphQL Error:', error);
      toast.error('Aktif kullanıcılar yüklenirken hata oluştu!');
    }
    setLoading(false);
  };

  // Süreyi dakikaya çevir
  const millisecondsToMinutes = (ms: number) => {
    return Math.floor(ms / (1000 * 60));
  };

  // Süreyi saat:dakika formatına çevir
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}s ${remainingMinutes}dk`;
  };

  // Rütbeyi motto'dan çıkar
  const extractRank = (motto: string) => {
    // "JÖH Güvenlik Memuru I BRL" -> "Güvenlik Memuru I"
    const parts = motto.split(' ');
    if (parts[0] === 'JÖH' && parts.length > 1) {
      return parts.slice(1, -1).join(' ') || 'Bilinmiyor';
    }
    return motto;
  };

  // Badge bilgisinden badge type'ını çıkar
  const getBadgeType = (badgeInfo: ActiveUser['badgeInfo']) => {
    // Badge bilgisi yoksa memurlar varsayılan
    if (!badgeInfo?.badgeName) return 'memurlar';
    
    const badgeName = badgeInfo.badgeName.toLowerCase();
    if (badgeName.includes('güvenlik')) return 'guvenlik';
    if (badgeName.includes('kurucu')) return 'kurucular';
    if (badgeName.includes('başbakan')) return 'basbakan';
    if (badgeName.includes('yönetici')) return 'yonetim';
    return 'memurlar';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.motto.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getBadgeColor = (badge: string) => {
    const colors: Record<string, string> = {
      kurucular: 'from-yellow-500 to-orange-500',
      basbakan: 'from-purple-500 to-pink-500',
      yonetim: 'from-blue-500 to-indigo-500',
      liderler: 'from-green-500 to-emerald-500',
      memurlar: 'from-gray-500 to-gray-600',
      guvenlik: 'from-red-500 to-red-600'
    };
    return colors[badge] || 'from-gray-500 to-gray-600';
  };

  const getBadgeIcon = (badge: string) => {
    const icons: Record<string, any> = {
      kurucular: Crown,
      basbakan: Star,
      yonetim: Shield,
      liderler: Award,
      memurlar: User,
      guvenlik: Shield
    };
    return icons[badge] || User;
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500' : 'bg-gray-500';
  };

  const openUserDetails = (user: ActiveUser) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-gray-900/80 backdrop-blur-sm border border-gray-800/50">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Users className="w-7 h-7 mr-3 text-green-500" />
            Aktif Kullanıcılar
            <span className="ml-3 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-300 text-sm font-medium">
              {users.filter(u => u.time.isActive).length} Çevrimiçi
            </span>
          </h2>
          
          <Button
            onClick={loadActiveUsers}
            loading={loading}
            disabled={loading}
            icon={RefreshCw}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
          >
            Yenile
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-green-500 focus:ring-green-500/20 focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <Card className="p-6 bg-gray-800/50">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-700 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredUsers.map((user, index) => {
                const badgeType = getBadgeType(user.badgeInfo);
                const BadgeIcon = getBadgeIcon(badgeType);
                return (
                  <motion.div
                    key={user.username}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className="p-6 bg-gray-800/50 hover:bg-gray-800 transition-all duration-300 cursor-pointer group"
                      onClick={() => openUserDetails(user)}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="relative">
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-16 h-16 rounded-full border-2 border-gray-600 group-hover:border-green-500 transition-colors"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=64&h=64&fit=crop&crop=face`;
                            }}
                          />
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${getStatusColor(user.time.isActive)} rounded-full border-2 border-gray-800`}></div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-bold text-white truncate">{user.username}</h3>
                            <div className={`p-1 rounded-lg bg-gradient-to-r ${getBadgeColor(badgeType)}`}>
                              <BadgeIcon className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          
                          {/* Rank only shows if badge <= 0 or rank >= 1 */}
                          {(user.badgeInfo?.badge > 0 && user.badgeInfo?.rank < 1) ? null : (
                            <p className={`text-sm mb-2 ${
                              user.badgeInfo?.badge < 1 && user.badgeInfo?.rank < 1 
                                ? 'text-gray-400'
                                : 'text-gray-400'
                            }`}>
                              {(user.badgeInfo?.badge < 1 && user.badgeInfo?.rank < 1) ? 'Stajyer' :
                               user.badgeInfo?.rankName}
                            </p>
                          )}
                          
                          {/* Extra Rozetler */}
                          {user.extras && user.extras.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {user.extras.map((extra) => {
                                let gradientColors = '';
                                if (extra.toLowerCase().includes('maaş')) {
                                  gradientColors = 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30';
                                } else if (extra.toLowerCase().includes('afk')) {
                                  gradientColors = 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30';
                                } else if (extra.toLowerCase().includes('vip')) {
                                  gradientColors = 'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30';
                                } else if (extra.toLowerCase().includes('special')) {
                                  gradientColors = 'from-yellow-500/20 to-amber-500/20 text-yellow-300 border-yellow-500/30';
                                } else if (extra.toLowerCase().includes('rozet')) {
                                  gradientColors = 'from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/30';
                                } else if (extra.toLowerCase().includes('sertifika')) {
                                  gradientColors = 'from-cyan-500/20 to-sky-500/20 text-cyan-300 border-cyan-500/30';
                                } else {
                                  gradientColors = 'from-gray-500/20 to-slate-500/20 text-gray-300 border-gray-500/30';
                                }
                                return (
                                  <span key={extra} className={`px-2 py-0.5 text-xs rounded-full bg-gradient-to-r ${gradientColors}`}>
                                    {extra}
                                  </span>
                                );
                              })}
                            </div>
                          )}                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{millisecondsToMinutes(user.time.realTimeTotal)} dk</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Activity className="w-3 h-3" />
                              <span>{user.time.isActive ? 'Aktif' : 'Pasif'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <p className="text-xs text-gray-400 truncate">{user.motto}</p>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm 
                ? 'Arama kriterlerine uygun kullanıcı bulunamadı.' 
                : 'Şu anda aktif kullanıcı bulunmuyor.'
              }
            </p>
          </div>
        )}
      </Card>

      {/* User Details Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="Kullanıcı Detayları"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.username}
                  className="w-24 h-24 rounded-full border-4 border-gray-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=96&h=96&fit=crop&crop=face`;
                  }}
                />
                <div className={`absolute -bottom-2 -right-2 w-6 h-6 ${getStatusColor(selectedUser.time.isActive)} rounded-full border-4 border-gray-800`}></div>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{selectedUser.username}</h3>
                {/* Rank only shows if badge <= 0 or rank >= 1 */}
                {(selectedUser.badgeInfo?.badge > 0 && selectedUser.badgeInfo?.rank < 1) ? null : (
                  <p className={`mb-2 ${
                    selectedUser.badgeInfo?.badge < 1 && selectedUser.badgeInfo?.rank < 1 
                      ? 'text-gray-400'
                      : 'text-gray-400'
                  }`}>
                    {(selectedUser.badgeInfo?.badge < 1 && selectedUser.badgeInfo?.rank < 1) ? 'Stajyer' :
                     selectedUser.badgeInfo?.rankName}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getBadgeColor(getBadgeType(selectedUser.badgeInfo))} text-white text-sm font-medium`}>
                    {selectedUser.badgeInfo?.badgeName || 'Stajyer'}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedUser.time.isActive ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'
                  }`}>
                    {selectedUser.time.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                  {selectedUser.extras && selectedUser.extras.map((extra) => {
                    let gradientColors = '';
                    if (extra.toLowerCase().includes('maaş')) {
                      gradientColors = 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30';
                    } else if (extra.toLowerCase().includes('afk')) {
                      gradientColors = 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30';
                    } else if (extra.toLowerCase().includes('vip')) {
                      gradientColors = 'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30';
                    } else if (extra.toLowerCase().includes('special')) {
                      gradientColors = 'from-yellow-500/20 to-amber-500/20 text-yellow-300 border-yellow-500/30';
                    } else if (extra.toLowerCase().includes('rozet')) {
                      gradientColors = 'from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/30';
                    } else if (extra.toLowerCase().includes('sertifika')) {
                      gradientColors = 'from-cyan-500/20 to-sky-500/20 text-cyan-300 border-cyan-500/30';
                    } else {
                      gradientColors = 'from-gray-500/20 to-slate-500/20 text-gray-300 border-gray-500/30';
                    }
                    return (
                      <span key={extra} className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${gradientColors}`}>
                        {extra}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card className="p-4 bg-gray-800/50">
                <div className="flex items-center space-x-3 mb-3">
                  <Activity className="w-5 h-5 text-green-500" />
                  <h4 className="font-semibold text-white">Aktivite</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toplam Süre:</span>
                    <span className="text-white font-semibold">{formatTime(selectedUser.time.realTimeTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mevcut Oturum:</span>
                    <span className="text-white">{formatTime(selectedUser.time.currentSessionTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Son Görülme:</span>
                    <span className="text-white">{new Date(selectedUser.time.lastSeen).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-4 bg-gray-800/50">
              <div className="flex items-center space-x-3 mb-3">
                <User className="w-5 h-5 text-purple-500" />
                <h4 className="font-semibold text-white">Profil</h4>
              </div>
              <p className="text-gray-300 text-sm">{selectedUser.motto}</p>
            </Card>

            <div className="flex gap-4">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(selectedUser.username);
                  toast.success('Kullanıcı adı kopyalandı!');
                }}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Kullanıcı Adını Kopyala
              </Button>
              <Button
                onClick={() => setShowUserModal(false)}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
              >
                Kapat
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}