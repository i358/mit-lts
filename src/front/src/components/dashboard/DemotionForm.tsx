import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TrendingDown, User, Award, CheckCircle, AlertCircle, Copy, Activity } from 'lucide-react';
import { demotionsAPI } from '../../services/demotions';
import { extractCode } from '../../utils';
import badgesJson from '../../data/badges.json';
import type { BadgesData } from '../../types/badges';
import toast from 'react-hot-toast';

interface DemotionLog {
  id: string;
  username: string;
  oldRank: string;
  newRank: string;
  timestamp: string;
  codename?: string;
}

export function DemotionForm() {
  const [userName, setUserName] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [demotionLogs, setDemotionLogs] = useState<DemotionLog[]>([]);

  const [searchResults, setSearchResults] = useState<Array<{ username: string; hid: number; registered: boolean }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<null | { hid: number; username: string; badgeLevel: number }>(null);
  const [selectedRank, setSelectedRank] = useState<string>('');

  const skipSearchRef = useRef(false);
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
        const results = await demotionsAPI.searchUsers(query);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [userName]);

  const proceedWithDemotionInfo = async (username: string) => {
    const userData = await demotionsAPI.getUserInfo(username);
    setUserInfo(userData);
    setShowConfirmation(false);
    toast.success('Kullanıcı bilgileri yüklendi!');
  };

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
      const checkResponse = await demotionsAPI.demoteCheck(target.hid, 'check');

      if (checkResponse?.success !== 1) {
        toast.error(checkResponse?.error || 'Kullanıcı kontrolü başarısız');
        return;
      }

      if (checkResponse?.registered) {
        const finalUsername = checkResponse?.user?.username || target.username;
        await proceedWithDemotionInfo(finalUsername);
        return;
      }

      const badgeLevel = checkResponse?.user?.badge;
      const usernameFromApi = checkResponse?.user?.username || target.username;
      if (!badgeLevel || !usernameFromApi) {
        toast.error('Kullanıcı bilgileri alınamadı');
        return;
      }

      setPendingRegistration({ hid: target.hid, username: usernameFromApi, badgeLevel });
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
      const createResponse = await demotionsAPI.demoteCheck(pendingRegistration.hid, 'create', selectedRankIndex + 1);
      if (createResponse?.success !== 1 || !createResponse?.registered) {
        toast.error(createResponse?.error || 'Kullanıcı oluşturulamadı');
        return;
      }

      const finalUsername = createResponse?.user?.username || pendingRegistration.username;
      setPendingRegistration(null);
      setSelectedRank('');
      await proceedWithDemotionInfo(finalUsername);
      toast.success('Kullanıcı oluşturuldu!');
    } catch (error: any) {
      toast.error(error.message || 'Kullanıcı oluşturulurken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDemotionConfirm = async () => {
    if (!userInfo) return;

    setLoading(true);
    try {
      const response = await demotionsAPI.demoteUser(userName.trim());

      if (response.success === 1) {
        // Log'a ekle
        const newLog: DemotionLog = {
          id: Date.now().toString(),
          username: userName.trim(),
          oldRank: `${userInfo.current_badge_name} - ${userInfo.current_rank_name}`,
          newRank: `${response.new_badge_name} - ${response.new_rank_name}`,
          timestamp: new Date().toLocaleString('tr-TR'),
          codename: response.codename
        };
        setDemotionLogs(prev => [newLog, ...prev]);

        toast.success('Tenzil başarıyla verildi!');
        setShowConfirmation(false);
        setUserName('');
        setUserInfo(null);
      } else {
        toast.error(response.error || 'Tenzil işlemi başarısız oldu');
      }
    } catch (error: any) {
      toast.error(error.message || 'Tenzil işlemi sırasında bir hata oluştu');
    }
    setLoading(false);
  };

  const copyDemotionLog = async (log: DemotionLog) => {
    const logText = [
      `--------------------------------------------------`,
      `Tenzil alan: ${log.username}`,
      `Rütbe: ${log.oldRank} >> ${log.newRank}`,
      `Tenzil görevlisi: ${log.codename || 'X'}`,
      ``,
      `Motto: JÖH ${log.newRank.split(' - ')[1] || log.newRank} ${extractCode(log.codename)}`,
      `--------------------------------------------------`
    ].join('\n');

    try {
      if (navigator.clipboard) {
        if (navigator.clipboard.write) {
          const clipboardItem = new ClipboardItem({
            'text/plain': new Blob([logText], { type: 'text/plain' })
          });
          await navigator.clipboard.write([clipboardItem]);
        } else {
          await navigator.clipboard.writeText(logText);
        }
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = logText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Log kopyalandı!');
    } catch (err) {
      console.error('Copying error:', err);
      toast.error('Log kopyalanırken bir hata oluştu');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-lg border border-gray-700/50 shadow-xl">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 mb-8 flex items-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mr-4">
            <TrendingDown className="w-7 h-7 text-red-400" />
          </div>
          Tenzil İşlemleri
        </h2>

        {/* User Search */}
        <div className="mb-8 overflow-visible">
          <div className="relative z-10">
            <Input
              label="Kullanıcı Adı"
              placeholder="Tenzil edilecek kullanıcının adını girin"
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
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-red-500 focus:ring-red-500/20"
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
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg"
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>
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
              icon={TrendingDown}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
            >
              Tenzil Ver
            </Button>
          </motion.div>
        )}

        {/* Confirmation */}
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-xl border border-red-600/30 backdrop-blur-sm shadow-xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h4 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                Tenzil Onayı
              </h4>
            </div>
            
            <div className="bg-gray-900/50 rounded-lg p-6 mb-8 border border-red-600/20">
              <p className="text-gray-300 text-lg leading-relaxed">
                <strong className="text-red-400">{userInfo.username}</strong> kullanıcısını
                <br />
                <span className="text-gray-400">
                  <strong className="text-red-300">{userInfo.current_badge_name}/{userInfo.current_rank_name}</strong> rütbesinden tenzil etmek istediğinizden emin misiniz?
                </span>
              </p>
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={handleDemotionConfirm}
                loading={loading}
                disabled={loading}
                icon={CheckCircle}
                className="flex-1 py-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg text-lg font-medium"
              >
                Tenzil Ver
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
      {demotionLogs.length > 0 && (
        <div className="relative">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-orange-500 to-yellow-500"></div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Son Aktiviteler</h2>
              <p className="text-sm text-gray-400">{demotionLogs.length} işlem kaydı</p>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {demotionLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative p-6 bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-lg backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-red-400" />
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
                          <span className="text-red-400 font-medium">{log.newRank.split(' - ')[1] || log.newRank}</span>
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Tenzil Görevlisi</p>
                        <p className="text-red-400 font-medium">{log.codename || 'X'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => copyDemotionLog(log).catch(console.error)}
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
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
