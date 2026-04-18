import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Users, Search, User, CheckCircle, Trash2, X, TrendingUp, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';
import { extractCode } from '../../utils';
import badgesJson from '../../data/badges.json';
import type { BadgesData } from '../../types/badges';


interface BulkPromotionUser {
  id: string;
  habbo_id: number;
  username: string;
  avatar?: string;
  badge: string;
  badgeIndex: number;
  rank: string;
  rankIndex: number;
  isEditable: boolean;
  registered?: boolean;
  badgeError?: string;
}

interface ProcessedUser {
  username: string;
  oldBadge: string;
  oldRank: string;
  newBadge: string;
  newRank: string;
  badgeSkipped?: boolean;
  error?: string;
  action?: 'promoted' | 'registered' | 'skipped';
}

interface UserSearchResult {
  id: string;
  habbo_id: number;
  username: string;
  look?: string;
  nextBadge?: number;
  nextRank?: number;
}

export function BulkPromotionForm() {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMultiplier, setSelectedMultiplier] = useState(1);
  const [promotionUsers, setPromotionUsers] = useState<BulkPromotionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [promotionResults, setPromotionResults] = useState<ProcessedUser[]>([]);
  const [promoterCodename, setPromoterCodename] = useState<string>('');

  const multiplierOptions = [1, 2, 3, 4, 5];
  const badges = badgesJson as BadgesData;
  const badgeNames = Object.keys(badges);
  const istihbaratIndex = badgeNames.indexOf('İstihbarat');
  void istihbaratIndex;

  // Her yazışta arama yap (debounce yok)
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const performSearch = async () => {
      setSearchLoading(true);
      try {
        const response = await mitAPI.searchBulkPromotionUsers(searchInput);
        if (response.success && response.data) {
          setSearchResults(response.data);
          setShowDropdown(true);
        } else {
          setSearchResults([]);
        }
      } catch (error: any) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    performSearch();
  }, [searchInput]);

  const handleAddUser = async (user: UserSearchResult) => {
    setShowDropdown(false);
    
    // Kullanıcının zaten ekli olup olmadığını kontrol et
    if (promotionUsers.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
      toast.error('Bu kullanıcı zaten eklenmişti!');
      return;
    }

    try {
      // Database'de kontrol et
      const checkResponse = await mitAPI.checkBulkPromotionUser(user.username, user.habbo_id);
      
      if (checkResponse.success) {
        if (checkResponse.found) {
          // Kullanıcı veritabanında var
          if (!checkResponse.eligible) {
            // Kullancı DB'de var ama terfi alamaz (İstihbarat üstü)
            toast.error(`${user.username}: ${checkResponse.message || 'Toplu terfiye uygun değil'}`);
            return;
          }

          if (checkResponse.data) {
            // Veritabanında var ve uygun - otomatik badge/rank göster
            const newUser: BulkPromotionUser = {
              id: user.id,
              habbo_id: user.habbo_id,
              username: user.username,
              avatar: checkResponse.data.avatar,
              badge: checkResponse.data.badge || "No Badge",
              badgeIndex: checkResponse.data.badgeIndex,
              rank: checkResponse.data.rank || "No Rank",
              rankIndex: checkResponse.data.rankIndex,
              isEditable: false,
              registered: true
            };
            
            setPromotionUsers(prev => [newUser, ...prev]);
            toast.success(`${user.username} eklendi!`);
            setSearchInput('');
            setSearchResults([]);
            setShowDropdown(false);
            return;
          }
        }

        // Veritabanında yok - rozet otomatik tespit, sadece rütbe seçtir
        let detectedBadgeIndex = 0;
        let detectedBadgeName = '';
        let detectedError: string | undefined;

        try {
          const badgeCheck = await mitAPI.bulkPromotionBadgeCheck(user.habbo_id);
          if (badgeCheck?.success === 1 && badgeCheck?.user?.badge) {
            detectedBadgeIndex = Number(badgeCheck.user.badge);
            detectedBadgeName = badgeNames[detectedBadgeIndex - 1] || '';
          } else if (badgeCheck?.hasHigherRank) {
            detectedError = 'İstihbarat üzeri kullanıcılar toplu terfiye eklenemez';
          } else {
            detectedError = badgeCheck?.error || 'Kullanıcının JÖH rozeti tespit edilemedi';
          }
        } catch (e: any) {
          detectedError = e?.message || 'Kullanıcının JÖH rozeti tespit edilemedi';
        }

        const defaultBadgeName = detectedBadgeName || badgeNames[0];
        const badgeData = badges[defaultBadgeName];

        const defaultRankName = badgeData?.ranks?.[0] || 'Bilinmeyen';
        const defaultRankIndex = 1;

        const newUser: BulkPromotionUser = {
          id: user.id,
          habbo_id: user.habbo_id || 0,
          username: user.username,
          avatar: `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(user.username)}&direction=2&head_direction=2&gesture=nrm&size=l`,
          badge: defaultBadgeName || 'Memurlar',
          badgeIndex: detectedBadgeIndex || (badgeNames.indexOf(defaultBadgeName) + 1),
          rank: defaultRankName,
          rankIndex: defaultRankIndex,
          isEditable: true,
          registered: false,
          badgeError: detectedError
        };

        setPromotionUsers(prev => [newUser, ...prev]);
        if (detectedError) {
          toast.error(`${user.username}: ${detectedError}`);
        } else {
          toast.success(`${user.username} eklendi! (Sadece rütbe seçin)`);
        }
      }
    } catch (error) {
      toast.error('Kullanıcı kontrol edilirken hata oluştu');
      console.error('Add user error:', error);
    }

    setSearchInput('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleRemoveUser = (username: string) => {
    setPromotionUsers(prev => {
      const filtered = prev.filter(u => u.username.toLowerCase() !== username.toLowerCase());
      toast.success(`${username} kaldırıldı!`);
      return filtered;
    });
  };

  const handleUpdateRank = (username: string, rankName: string) => {
    setPromotionUsers(prev =>
      prev.map(u => {
        if (u.username === username) {
          const rankIndex0 = badges[u.badge]?.ranks?.indexOf(rankName);
          const rankIndex = typeof rankIndex0 === 'number' && rankIndex0 >= 0 ? rankIndex0 + 1 : 1;
          return { ...u, rank: rankName, rankIndex };
        }
        return u;
      })
    );
  };

  const handleBulkPromotion = async () => {
    if (promotionUsers.length === 0) {
      toast.error('Lütfen en az bir kullanıcı ekleyin!');
      return;
    }

    setLoading(true);
    try {
      const usersToPromote = promotionUsers.map(u => ({
        username: u.username,
        badge: u.isEditable ? undefined : u.badgeIndex,
        rank: u.rankIndex,
        multiplier: selectedMultiplier
      }));
      
      const response = await mitAPI.promoteBulk(usersToPromote);
      
      if (response.success) {
        setPromotionResults(response.processedUsers);
        if (response.codename) {
            setPromoterCodename(response.codename);
        }
        toast.success('Toplu terfi işlemi başarılı!');
        setPromotionUsers([]);
        setSelectedMultiplier(1);
      } else {
        toast.error(response.error || 'Toplu terfi işlemi başarısız oldu!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Toplu terfi işlemi başarısız oldu!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-lg border border-gray-700/50 shadow-xl">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-8 flex items-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mr-4">
            <Users className="w-7 h-7 text-blue-400" />
          </div>
          Toplu Terfi İşlemleri
        </h2>

        {/* Search Section */}
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-400" />
            Kullanıcı Ekle
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Input
                label="Kullanıcı Adı Ara"
                placeholder="Terfi verilecek kullanıcıyı yazın..."
                value={searchInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                icon={Search}
                fullWidth
                className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20"
              />

              {/* Search Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                >
                  {searchResults.map((user, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddUser(user)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-700/50 border-b border-gray-700/30 last:border-b-0 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white font-medium">{user.username}</p>
                        <p className="text-xs text-gray-400">
                          Badge: {user.nextBadge} - Rank: {user.nextRank}
                        </p>
                      </div>
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </button>
                  ))}
                </motion.div>
              )}

              {showDropdown && searchInput.trim() && searchResults.length === 0 && !searchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-4 text-center text-gray-400"
                >
                  Kullanıcı bulunamadı
                </motion.div>
              )}
            </div>

            <div>
              <label className="text-gray-300 font-medium text-sm block mb-2">
                Terfi Miktarı
              </label>
              <select
                value={selectedMultiplier}
                onChange={(e) => setSelectedMultiplier(Number(e.target.value))}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-blue-500/20 transition-colors"
              >
                {multiplierOptions.map(m => (
                  <option key={m} value={m}>
                    {m}x Terfi
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Added Users List */}
        {promotionUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
              Ekli Kullanıcılar ({promotionUsers.length})
            </h3>

            <div className="space-y-3">
              <AnimatePresence>
                {promotionUsers.map(user => (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-700/50 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-12 h-12 rounded-lg border border-gray-600"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%23444' width='48' height='48'/%3E%3Ctext x='24' y='28' font-size='20' fill='%23999' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E`;
                          }}
                        />
                      </div>

                      <div className="flex-1">
                        <p className="text-white font-semibold mb-2">{user.username}</p>
                        
                        {user.isEditable ? (
                          <div className="grid grid-cols-2 gap-3">
                            {/* Rozet Dropdown */}
                            <div className="space-y-1">
                              <label className="text-xs text-gray-300 uppercase font-semibold block">Rozet</label>
                              <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm">
                                <span className="font-medium">{user.badge}</span>
                                {user.badgeError && (
                                  <span className="ml-2 text-red-400">({user.badgeError})</span>
                                )}
                              </div>
                            </div>

                            {/* Rütbe Dropdown */}
                            <div className="space-y-1">
                              <label className="text-xs text-gray-300 uppercase font-semibold block">Rütbe</label>
                              <select
                                value={user.rank}
                                onChange={(e) => {
                                  const rankName = e.target.value;
                                  handleUpdateRank(user.username, rankName);
                                }}
                                disabled={!!user.badgeError}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all hover:border-gray-500 appearance-none"
                                style={{
                                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 0.75rem center',
                                  backgroundSize: '1rem',
                                  paddingRight: '2.5rem'
                                }}
                              >
                                {badges[user.badge]?.ranks.map((rank) => (
                                  <option key={rank} value={rank}>
                                    {rank}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">
                            <span className="text-blue-400 font-medium">{user.badge}</span> • <span className="text-green-400">{user.rank}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveUser(user.username)}
                        className="p-2 hover:bg-red-600/20 rounded-lg text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                        title="Kaldır"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-4">
              <Button
                onClick={handleBulkPromotion}
                loading={loading}
                disabled={loading || promotionUsers.length === 0}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
              >
                Toplu Terfi Ver ({promotionUsers.length} Kullanıcı)
              </Button>

              <Button
                onClick={() => setPromotionUsers([])}
                disabled={loading || promotionUsers.length === 0}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                <X className="w-4 h-4" />
                Temizle
              </Button>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Toplam Kullanıcı</p>
                  <p className="text-2xl font-bold text-white">{promotionUsers.length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Seçili Terfi</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {selectedMultiplier}x
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Toplam Terfi</p>
                  <p className="text-2xl font-bold text-green-400">
                    {promotionUsers.length * selectedMultiplier}x
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {promotionUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">Henüz kullanıcı eklenmedi</p>
            <p className="text-sm text-gray-500">Arama alanında kullanıcı adı yazarak başlayın</p>
          </div>
        )}
      </Card>

      {/* Promotion Results */}
      {promotionResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-8 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-700/50">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
              Terfi Sonuçları
            </h3>

            <div className="space-y-3">
              {promotionResults.map((result) => (
                <motion.div
                  key={result.username}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-gray-800/50 rounded-lg border border-green-700/30 hover:border-green-700/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-white text-lg">{result.username}</p>
                      {result.error ? (
                        <p className="text-sm text-red-400 font-medium">{result.error}</p>
                      ) : (
                        <p className="text-sm text-gray-400">
                          <span className="text-gray-300">{result.oldBadge}</span>
                          <span className="text-gray-500 mx-2">•</span>
                          <span className="text-gray-300">{result.oldRank}</span>
                          <span className="text-green-400 mx-2">→</span>
                          <span className="text-green-300">{result.newBadge}</span>
                          <span className="text-gray-500 mx-2">•</span>
                          <span className="text-green-300">{result.newRank}</span>
                          {result.badgeSkipped && (
                            <span className="ml-2 text-yellow-400 font-semibold">(Rozet Atladı)</span>
                          )}
                          {result.action === 'registered' && (
                            <span className="ml-2 text-blue-400 font-semibold">(Kayıt)</span>
                          )}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => copyPromotionMotto(result, promoterCodename)}
                      variant="outline"
                      size="sm"
                      disabled={!!result.error}
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Motto Kopyala
                    </Button> 
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">
                <span className="font-semibold text-white">Toplam {promotionResults.length} kullanıcı</span> başarıyla terfi verildi
              </p>
            </div>

            <Button
              onClick={() => setPromotionResults([])}
              fullWidth
              className="mt-6 bg-gray-700 hover:bg-gray-600"
            >
              Kapat
            </Button>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function copyPromotionMotto(result: ProcessedUser, codename: string) {
  const motto = `${result.username} -> JÖH ${result.newRank} ${extractCode(codename)}`;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(motto).then(() => {
      toast.success(`Motto kopyalandı: ${motto}`);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = motto;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`Motto kopyalandı: ${motto}`);
    });
  }
}
