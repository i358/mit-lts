import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TrendingUp, User, Award, CheckCircle, AlertCircle, Copy, Activity, Clock, MessageSquare, UserCircle, XCircle } from 'lucide-react';
import { promotionsAPI } from '../../services/promotions';
import { extractCode } from '../../utils';
import badgesJson from '../../data/badges.json';
import type { BadgesData } from '../../types/badges';

import toast from 'react-hot-toast';

interface PromotionLog {
  id: string;
  username: string;
  oldRank: string;
  newRank: string;
  timestamp: string;
  codename?: string;
  workTime?: number;
  workTimeMinutes?: number;
}

export function PromotionForm() {
  const [userName, setUserName] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [promotionLogs, setPromotionLogs] = useState<PromotionLog[]>([]);

  const [searchResults, setSearchResults] = useState<Array<{ username: string; hid: number; registered: boolean }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<null | { hid: number; username: string; badgeLevel: number }>(null);
  const [selectedRank, setSelectedRank] = useState<string>('');

  const skipSearchRef = useRef(false);
  const promoteInFlightRef = useRef(false);
  const badges = badgesJson as BadgesData;
  const badgeNames = Object.keys(badges);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const query = userName.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const handle = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await promotionsAPI.searchUsers(query);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [userName]);

  const handleSelectUser = async (target: { username: string; hid: number; registered: boolean }) => {
    skipSearchRef.current = true;
    setUserName(target.username);
    setSearchResults([]);
    setUserInfo(null);
    setShowConfirmation(false);
    setPendingRegistration(null);
    setSelectedRank('');

    setLoading(true);
    try {
      const checkResponse = await promotionsAPI.badgeCheck(target.hid, 'check');

      if (checkResponse?.success !== 1) {
        if (checkResponse?.hasHigherRank) {
          toast.error('Bu kullanıcı İstihbarat üzeri olduğu için listelenemez.');
          return;
        }
        toast.error(checkResponse?.error || 'Kullanıcı kontrolü başarısız');
        return;
      }

      if (checkResponse?.registered) {
        const finalUsername = checkResponse?.user?.username || target.username;
        const userData = await promotionsAPI.getUserInfo(finalUsername);
        setUserInfo(userData);
        toast.success('Kullanıcı bilgileri yüklendi!');
        return;
      }

      const badgeLevel = checkResponse?.user?.badge;
      const usernameFromApi = checkResponse?.user?.username || target.username;
      if (!badgeLevel || !usernameFromApi) {
        toast.error('Kullanıcı bilgileri alınamadı');
        return;
      }

      setPendingRegistration({
        hid: target.hid,
        username: usernameFromApi,
        badgeLevel
      });
    } catch (error: any) {
      toast.error(error.message || 'Kullanıcı kontrol edilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndContinue = async () => {
    if (!pendingRegistration) return;

    const badgeName = badgeNames[pendingRegistration.badgeLevel - 1];
    const ranks = badgeName ? badges[badgeName]?.ranks || [] : [];
    const selectedRankIndex = ranks.indexOf(selectedRank);

    if (!badgeName || ranks.length === 0) {
      toast.error('Rozet rütbeleri bulunamadı');
      return;
    }

    if (!selectedRank || selectedRankIndex < 0) {
      toast.error('Lütfen bir rütbe seçin!');
      return;
    }

    setLoading(true);
    try {
      const createResponse = await promotionsAPI.badgeCheck(pendingRegistration.hid, 'create', selectedRankIndex + 1);
      if (createResponse?.success !== 1 || !createResponse?.registered) {
        if (createResponse?.hasHigherRank) {
          toast.error('Bu kullanıcı İstihbarat üzeri olduğu için işlenemez.');
          return;
        }
        toast.error(createResponse?.error || 'Kullanıcı oluşturulamadı');
        return;
      }

      const finalUsername = createResponse?.user?.username || pendingRegistration.username;
      const userData = await promotionsAPI.getUserInfo(finalUsername);
      setUserInfo(userData);
      setPendingRegistration(null);
      setSelectedRank('');
      toast.success('Kullanıcı oluşturuldu ve bilgiler yüklendi!');
    } catch (error: any) {
      toast.error(error.message || 'Kullanıcı oluşturulurken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handlePromotionConfirm = async () => {
    if (!userInfo || userInfo.success === 0) return;
    if (promoteInFlightRef.current) return;
    promoteInFlightRef.current = true;

    setLoading(true);
    try {
      const response = await promotionsAPI.promoteUser(userName.trim());

      if (response.success === 1) {
        // Logları konsola yazdır
        console.log('API Response:', response);
        console.log('User Info:', userInfo);

        // Log'a ekle
        const newLog: PromotionLog = {
          id: Date.now().toString(),
          username: userName.trim(),
          oldRank: `${userInfo.current_badge_name} - ${userInfo.current_rank_name}`,
          newRank: `${userInfo.next_badge_name} - ${userInfo.next_rank_name}`,
          timestamp: new Date().toLocaleString('tr-TR'),
          codename: response.codename || userInfo?.codename,
          workTime: Math.floor(userInfo.current_time / 60),
          workTimeMinutes: userInfo.current_time % 60
        };
        setPromotionLogs(prev => [newLog, ...prev]);

        toast.success('Terfi başarıyla verildi!');
        setShowConfirmation(false);
        setUserName('');
        setUserInfo(null);
      } else {
        toast.error(response.message || 'Terfi işlemi başarısız oldu!');
        setShowConfirmation(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Terfi işlemi sırasında hata oluştu!');
    } finally {
      promoteInFlightRef.current = false;
      setLoading(false);
    }
  };

  const copyPromotionLog = async (log: PromotionLog) => {
    try {
      // Rütbe adını ayıkla (örn: "Rozet - Rütbe" formatından "Rütbe" kısmını al)
      const newRankParts = log.newRank.split(' - ');
      const rankName = newRankParts[1] || newRankParts[0];
      
      const oldRankParts = log.oldRank.split(' - ');
      const oldRankName = oldRankParts[1] || oldRankParts[0];
      
      // Çok satırlı log metni oluştur
      const logText = [
        `--------------------------------------------------`,
        `Terfi alan: ${log.username}`,
        `Rütbe: ${oldRankName} >> ${rankName}`,
        `Terfi görevlisi: ${log.codename || 'X'}`,
        `Terfi Süresi: ${log.workTime || 0} saat ${log.workTimeMinutes || 0} dakika`,
        '',
        `Motto: JÖH ${rankName} ${extractCode(log.codename)}`,
        `--------------------------------------------------`
      ].join('\n');
      
      // writeText yerine write metodunu kullan (daha geniş tarayıcı desteği)
      if (navigator.clipboard) {
        if (navigator.clipboard.write) {
          const clipboardItem = new ClipboardItem({
            'text/plain': new Blob([logText], { type: 'text/plain' })
          });
          await navigator.clipboard.write([clipboardItem]);
        } else {
          await navigator.clipboard.writeText(logText);
        }
        toast.success('Log panoya kopyalandı!');
      } else {
        // Fallback: textarea kullanarak kopyalama
        const textarea = document.createElement('textarea');
        textarea.value = logText;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          toast.success('Log panoya kopyalandı!');
        } catch (e) {
          toast.error('Kopyalama başarısız oldu. Lütfen manuel olarak kopyalayın.');
        }
        document.body.removeChild(textarea);
      }
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Kopyalama başarısız oldu. Lütfen manuel olarak kopyalayın.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-lg border border-gray-700/50 shadow-xl">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-8 flex items-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mr-4">
            <TrendingUp className="w-7 h-7 text-blue-400" />
          </div>
          Terfi İşlemleri
        </h2>

        {/* User Search */}
        <div className="mb-8 overflow-visible">
          <div className="relative z-10">
            <Input
              label={<span className="text-gray-300 font-medium">Kullanıcı Adı</span>}
              placeholder="Terfi edilecek kullanıcının adını girin"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                setUserInfo(null);
                setShowConfirmation(false);
                setPendingRegistration(null);
                setSelectedRank('');
              }}
              icon={User}
              fullWidth
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20"
            />

            {searchLoading && userName.trim() && (
              <div className="absolute right-3 top-10 text-xs text-gray-400">Aranıyor...</div>
            )}

            {searchResults.length > 0 && (
              <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-700/60 bg-gray-900/95 backdrop-blur shadow-xl overflow-y-auto max-h-64">
                {searchResults.map((item) => (
                  <button
                    key={`${item.username}-${item.hid}`}
                    type="button"
                    onClick={() => handleSelectUser(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/70 transition-colors"
                  >
                    <img
                      src={`https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(item.username)}&direction=2&head_direction=2&gesture=nrm&size=l`}
                      alt={item.username}
                      className="w-10 h-10 rounded-md bg-gray-800"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{item.username}</div>
                      <div className="text-xs text-gray-400">{item.registered ? 'Kayıtlı' : 'Kayıtlı değil'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {pendingRegistration && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6 bg-gradient-to-r from-gray-900/20 to-gray-800/20 border border-gray-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-yellow-400" />
                Hedef Kullanıcı Kayıtlı Değil
              </h3>
              <p className="text-sm text-gray-300 mb-6">
                Hedef kullanıcı sisteme kayıtlı değil, kayıt etmek için aşağıdan bir rütbe seçin.
              </p>

              <div className="flex items-center gap-4 mb-6">
                <img
                  src={`https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(pendingRegistration.username)}&direction=2&head_direction=2&gesture=nrm&size=l`}
                  alt={pendingRegistration.username}
                  className="w-16 h-16 rounded-lg bg-gray-800"
                />
                <div>
                  <div className="text-lg font-bold text-white">{pendingRegistration.username}</div>
                  <div className="text-sm text-gray-400">
                    {badgeNames[pendingRegistration.badgeLevel - 1] || `Rozet #${pendingRegistration.badgeLevel}`}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label className="block text-sm font-medium text-gray-200">Rütbe</label>
                <select
                  value={selectedRank}
                  onChange={(e) => setSelectedRank(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="" disabled>Rütbe seçin</option>
                  {(badges[badgeNames[pendingRegistration.badgeLevel - 1]]?.ranks || []).map((rank) => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleCreateAndContinue}
                loading={loading}
                disabled={loading}
                fullWidth
                icon={CheckCircle}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              >
                Oluştur
              </Button>
            </Card>
          </motion.div>
        )}

        {/* User Information */}
        {userInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6 bg-gradient-to-r from-gray-900/20 to-gray-800/20 border border-gray-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-gray-500" />
                Kullanıcı Bilgileri
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400">Kullanıcı Adı</p>
                  <p className="text-lg font-bold text-white">
                    {userInfo.username || userName}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400 flex items-center">
                    <Award className="w-4 h-4 mr-1" />
                    Mevcut Rozet/Rütbe
                  </p>
                  <p className="text-lg font-bold text-gray-400">
                    {userInfo.current_badge_name}/{userInfo.current_rank_name}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Sonraki Rozet/Rütbe
                  </p>
                  <p className="text-lg font-bold text-gray-300">
                    {userInfo.next_badge_name}/{userInfo.next_rank_name}
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-400">
                      Terfi Süresi
                    </p>
                    <p className="text-lg font-bold text-gray-400">
                      {Math.floor(userInfo.current_time / 60)} saat ({userInfo.current_time} dk)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-400">
                      Terfi Durumu
                    </p>
                    <p className={`text-lg font-bold ${
                      userInfo.success === 1
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {userInfo.success === 1 ? 'Terfi Edilebilir' : 'Süre Yetersiz'}
                    </p>
                  </div>
                </div>
              </div>

              {userInfo.success === 0 && (
                <div className="mt-4 p-4 bg-red-900/30 rounded-lg border border-red-700/50">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                    <p className="text-sm text-red-200">
                      Gerekli süre: {userInfo.required_time} dk - 
                      Eksik süre: {userInfo.remaining_time} dk
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Actions */}
        {userInfo && !showConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={() => setShowConfirmation(true)}
              fullWidth
              size="lg"
              disabled={userInfo.success === 0}
              icon={TrendingUp}
              className={`${
                userInfo.success === 1 
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800' 
                  : 'bg-gradient-to-r from-gray-500 to-gray-600 cursor-not-allowed'
              }`}
            >
              {userInfo.success === 1 ? 'Terfi Ver' : 'Terfi Verilemez'}
            </Button>
          </motion.div>
        )}

        {/* Confirmation */}
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-xl border border-yellow-600/30 backdrop-blur-sm shadow-xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <h4 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                Terfi Onayı
              </h4>
            </div>
            
            <div className="bg-gray-900/50 rounded-lg p-6 mb-8 border border-yellow-600/20">
              <p className="text-gray-300 text-lg leading-relaxed">
                <strong className="text-yellow-400">{userInfo.username}</strong> kullanıcısını
                <br />
                <span className="text-gray-400">
                  <strong className="text-yellow-300">{userInfo.current_badge_name}/{userInfo.current_rank_name}</strong>
                  <span className="mx-3">➔</span>
                  <strong className="text-orange-300">{userInfo.next_badge_name}/{userInfo.next_rank_name}</strong>
                </span>
                <br />
                rütbesine terfi ettirmek istediğinizden emin misiniz?
              </p>
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={handlePromotionConfirm}
                loading={loading}
                disabled={loading}
                icon={CheckCircle}
                className="flex-1 py-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg text-lg font-medium"
              >
                Terfi Ver
              </Button>
              <Button
                onClick={() => setShowConfirmation(false)}
                variant="outline"
                className="flex-1 py-6 border-2 border-gray-600 text-gray-300 hover:bg-gray-800 text-lg font-medium"
              >
                İptal Et
              </Button>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Recent Activities */}
      {promotionLogs.length > 0 && (
        <div className="relative">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-purple-500 to-red-500"></div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Son Aktiviteler</h2>
              <p className="text-sm text-gray-400">{promotionLogs.length} işlem kaydı</p>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {promotionLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative p-6 bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-lg backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all group"
              >
                {/* Background gradient effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">
                          {log.username}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {log.timestamp}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Rütbe Değişimi</p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">{log.oldRank.split(' - ')[1] || log.oldRank}</span>
                          {' '}
                          <span className="text-gray-500 mx-2">{'>>'}</span>
                          {' '}
                          <span className="text-blue-400 font-medium">{log.newRank.split(' - ')[1] || log.newRank}</span>
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Terfi Görevlisi</p>
                        <p className="text-blue-400 font-medium">{log.codename || 'X'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Terfi Süresi</p>
                        <p className="text-gray-300">
                          {log.workTime || '0'} saat {log.workTimeMinutes || '0'} dakika
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-400">Motto</p>
                          <Button
                            onClick={() => {
                              const motto = `JÖH ${log.newRank.split(' - ')[1] || log.newRank} ${extractCode(log.codename)}`;
                              if (navigator.clipboard) {
                                if (navigator.clipboard.write) {
                                  const clipboardItem = new ClipboardItem({
                                    'text/plain': new Blob([motto], { type: 'text/plain' })
                                  });
                                  navigator.clipboard.write([clipboardItem])
                                    .then(() => toast.success('Motto kopyalandı!'))
                                    .catch(() => {
                                      // Fallback to writeText
                                      navigator.clipboard.writeText(motto)
                                        .then(() => toast.success('Motto kopyalandı!'))
                                        .catch(() => {
                                          // Fallback to execCommand
                                          const textarea = document.createElement('textarea');
                                          textarea.value = motto;
                                          document.body.appendChild(textarea);
                                          textarea.select();
                                          try {
                                            document.execCommand('copy');
                                            toast.success('Motto kopyalandı!');
                                          } catch {
                                            toast.error('Kopyalama başarısız oldu');
                                          }
                                          document.body.removeChild(textarea);
                                        });
                                    });
                                } else {
                                  navigator.clipboard.writeText(motto)
                                    .then(() => toast.success('Motto kopyalandı!'))
                                    .catch(() => toast.error('Kopyalama başarısız oldu'));
                                }
                              } else {
                                // Fallback for browsers without clipboard API
                                const textarea = document.createElement('textarea');
                                textarea.value = motto;
                                document.body.appendChild(textarea);
                                textarea.select();
                                try {
                                  document.execCommand('copy');
                                  toast.success('Motto kopyalandı!');
                                } catch {
                                  toast.error('Kopyalama başarısız oldu');
                                }
                                document.body.removeChild(textarea);
                              }
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-blue-400 font-medium">
                          JÖH {log.newRank.split(' - ')[1] || log.newRank} {extractCode(log.codename)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => copyPromotionLog(log).catch(console.error)}
                    variant="outline"
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Kopyala
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}