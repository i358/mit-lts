import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Archive, Search, Calendar, Copy, Users } from 'lucide-react';
import { mitAPI } from '../../services/api';
import toast from 'react-hot-toast';
import badgesJson from '../../data/badges.json';
import type { BadgesData } from '../../types/badges';

const badges = badgesJson as BadgesData;

interface BulkPromotionRecord {
  id: number;
  promoter_id: number;
  promoter_codename: string;
  promoted_users: Array<{
    username: string;
    old_badge: number;
    old_rank: number;
    new_badge: number;
    new_rank: number;
    habbo_id: string;
  }>;
  action_timestamp: number;
  action_date: string;
  action_time: string;
  created_at: string;
}

// Badge index'ten badge ismi döndür
function getBadgeName(badgeIndex: number): string {
  const badgeNames = Object.keys(badges);
  return badgeNames[badgeIndex - 1] || `Bilinmeyen (${badgeIndex})`;
}

// Badge index + rank index'ten rank ismi döndür
function getRankName(badgeIndex: number, rankIndex: number): string {
  const badgeNames = Object.keys(badges);
  const badgeName = badgeNames[badgeIndex - 1];
  if (!badgeName) return `Bilinmeyen Rütbe (${rankIndex})`;
  
  const ranks = badges[badgeName]?.ranks || [];
  return ranks[rankIndex - 1] || `Bilinmeyen Rütbe (${rankIndex})`;
}

export function BulkPromotionArchiveView() {
  const [selectedDate, setSelectedDate] = useState('');
  const [archiveData, setArchiveData] = useState<BulkPromotionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState<number | null>(null);

  const handleSearchArchive = async () => {
    setLoading(true);
    try {
      const query: any = {};
      if (selectedDate) {
        query.date = selectedDate;
      }

      const response = await mitAPI.getBulkPromotionArchive(query);
      if (response.success === 1) {
        setArchiveData(response.data);
        toast.success('Toplu terfi arşivi yüklendi!');
      } else {
        toast.error('Arşiv verileri alınamadı!');
        setArchiveData([]);
      }
    } catch (error: any) {
      toast.error(error.message);
      setArchiveData([]);
    }
    setLoading(false);
  };

  const copyArchiveData = () => {
    if (archiveData.length > 0) {
      const archiveText = archiveData
        .map(item => {
          const date = new Date(item.action_date).toLocaleDateString('tr-TR');
          const users = item.promoted_users
            .map(u => `${u.username}: ${getBadgeName(u.old_badge)} ${getRankName(u.old_badge, u.old_rank)} → ${getBadgeName(u.new_badge)} ${getRankName(u.new_badge, u.new_rank)}`)
            .join('\n');
          return `Toplu Terfi - ${date} ${item.action_time} [Terfi veren: ${item.promoter_codename}]\n${users}`;
        })
        .join('\n\n');

      navigator.clipboard.writeText(archiveText);
      toast.success('Arşiv verileri panoya kopyalandı!');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Users className="w-6 h-6 mr-3 text-gray-400" />
            Toplu Terfi Arşivi
          </h2>
        </div>

        {/* Search Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Input
            label="Tarih Filtresi"
            type="date"
            placeholder="Tarih seçin"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            icon={Calendar}
            fullWidth
          />

          <div className="flex items-end">
            <Button
              onClick={handleSearchArchive}
              loading={loading}
              disabled={loading}
              icon={Search}
              size="lg"
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 w-full"
            >
              Arşivi Ara
            </Button>
          </div>
        </div>
      </Card>

      {/* Archive Results */}
      {archiveData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center mb-6 px-6">
            <h3 className="text-lg font-semibold text-white">
              Toplu Terfi Kayıtları ({archiveData.length})
            </h3>
            <Button
              onClick={copyArchiveData}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              size="sm"
              icon={Copy}
            >
              Kopyala
            </Button>
          </div>

          <div className="max-h-[calc(100vh-300px)] overflow-y-auto space-y-3 px-6">
            {archiveData.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative p-6 bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-lg backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white leading-none mb-1">
                          Toplu Terfi
                        </h4>
                        <p className="text-sm text-gray-400">
                          {new Date(item.action_date).toLocaleDateString('tr-TR')} {item.action_time}
                        </p>
                      </div>
                    </div>

                    {/* Users Count */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-400">Terfi Görevlisi</p>
                          <p className="text-blue-400 font-medium">{item.promoter_codename}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Toplam Kullanıcı</p>
                          <p className="text-blue-400 font-medium">{item.promoted_users.length}</p>
                        </div>
                      </div>

                      {/* Users List Preview */}
                      <div>
                        <p className="text-sm text-gray-400 mb-3">Terfi Edilen Kullanıcılar</p>
                        <div className="space-y-2">
                          {item.promoted_users.slice(0, 3).map((user, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-800/40 rounded">
                              <span className="text-sm text-gray-200">{user.username}</span>
                              <span className="text-xs text-blue-400 font-medium ml-2">
                                → {getRankName(user.new_badge, user.new_rank)}
                              </span>
                            </div>
                          ))}
                          {item.promoted_users.length > 3 && (
                            <div
                              onClick={() => setExpandedArchiveId(item.id)}
                              className="text-sm text-blue-400 italic pl-2 pt-1 cursor-pointer hover:text-blue-300 transition-colors"
                            >
                              +{item.promoted_users.length - 3} daha...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Copy Button */}
                  <Button
                    onClick={() => {
                      const logText = item.promoted_users
                        .map(u => `${u.username}: ${getBadgeName(u.old_badge)} ${getRankName(u.old_badge, u.old_rank)} → ${getBadgeName(u.new_badge)} ${getRankName(u.new_badge, u.new_rank)}`)
                        .join('\n');
                      navigator.clipboard.writeText(logText).then(() => {
                        toast.success('Kopyalandı!');
                      }).catch(() => {
                        toast.error('Hata!');
                      });
                    }}
                    variant="outline"
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                    icon={Copy}
                  >
                    Kopyala
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && archiveData.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 px-6"
        >
          <Archive className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Henüz toplu terfi kaydı bulunamadı</p>
        </motion.div>
      )}

      {/* Full List Modal */}
      {expandedArchiveId !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setExpandedArchiveId(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-lg border border-gray-700 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Tüm Terfi Edilen Kullanıcılar</h3>
              <button
                onClick={() => setExpandedArchiveId(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {archiveData.find(item => item.id === expandedArchiveId) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Quote Block Style List */}
                  <div className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-500/5 rounded-r-lg">
                    <div className="space-y-3">
                      {archiveData
                        .find(item => item.id === expandedArchiveId)
                        ?.promoted_users.map((user, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center justify-between p-3 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors"
                          >
                            <span className="text-gray-200 font-medium">{user.username}</span>
                            <span className="text-blue-400 font-semibold ml-4">
                              → {getRankName(user.new_badge, user.new_rank)}
                            </span>
                          </motion.div>
                        ))}
                    </div>
                  </div>

                  {/* Stats */}
                  {archiveData.find(item => item.id === expandedArchiveId) && (
                    <div className="mt-6 pt-6 border-t border-gray-700">
                      <p className="text-sm text-gray-400">
                        <span className="text-blue-400 font-semibold">
                          {archiveData.find(item => item.id === expandedArchiveId)?.promoted_users.length}
                        </span>{' '}
                        toplam kullanıcı terfi edildi
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
