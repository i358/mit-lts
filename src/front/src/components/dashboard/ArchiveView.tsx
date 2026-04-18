

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Archive, Search, Calendar, TrendingUp, Copy } from 'lucide-react';
import { mitAPI } from '../../services/api';
import { extractCode } from '../../utils';
import toast from 'react-hot-toast';
import type { ArchiveType, ArchiveRecord } from '../../types/api';

export function ArchiveView() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedType, setSelectedType] = useState<ArchiveType>('all');
  const [archiveData, setArchiveData] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearchArchive = async () => {
    setLoading(true);
    try {
      const response = await mitAPI.getArchive(selectedType, selectedDate);
      if (response.success === 1) {
        setArchiveData(response.data);
        toast.success('Arşiv verileri yüklendi!');
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
          return `${item.username} - ${item.old_badge}/${item.old_rank} → ${item.new_badge}/${item.new_rank} (${date} ${item.action_time}) [Terfi veren: ${item.codename}]`;
        })
        .join('\n\n');
      
      navigator.clipboard.writeText(archiveText);
      toast.success('Arşiv verileri panoya kopyalandı!');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-gray-900/80 backdrop-blur-sm border border-gray-800/50">
        <h2 className="text-2xl font-bold text-white mb-8 flex items-center">
          <Archive className="w-7 h-7 mr-3 text-gray-500" />
          İşlem Arşivi
        </h2>

        {/* Search Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Kayıt Türü
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ArchiveType)}
              className="w-full px-4 py-3 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-red-500 focus:ring-red-500/20 focus:outline-none focus:ring-2"
            >
              <option value="all">Tümü</option>
              <option value="badge_up">Terfi</option>
              <option value="badge_down">Tenzil</option>
              <option value="mr">Maaş Rozeti</option>
              <option value="warning">Uyarı</option>
              <option value="bulk_promotion">Toplu Terfi</option>
            </select>
          </div>

          <Input
            label="Tarih Filtresi (Opsiyonel)"
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
              Arşiv Ara
            </Button>
          </div>
        </div>

        {/* Archive Results */}
        {archiveData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">
                Arşiv Kayıtları ({archiveData.length})
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

            <div className="max-h-[calc(100vh-300px)] overflow-y-auto space-y-3">
              {archiveData.map((item, index) => {
                return (
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
                          <div className={`p-2 ${item.type === 'badge_down' ? 'bg-red-500/20' : 'bg-blue-500/20'} rounded-lg`}>
                            <TrendingUp className={`w-5 h-5 ${item.type === 'badge_down' ? 'text-red-400' : 'text-blue-400'}`} />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-white leading-none mb-1">
                              {item.username}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {new Date(item.action_date).toLocaleDateString('tr-TR')} {item.action_time}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <p className="text-sm text-gray-400">Rozet</p>
                              <p className="text-gray-300">
                                <span className="text-gray-400">{item.old_badge}</span>
                                {' '}
                                <span className="text-gray-500 mx-2">{'>>'}</span>
                                {' '}
                                <span className={`${item.type === 'badge_down' ? 'text-red-400' : 'text-blue-400'} font-medium`}>{item.new_badge}</span>
                              </p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-400">Rütbe</p>
                              <p className="text-gray-300">
                                <span className="text-gray-400">{item.old_rank}</span>
                                {' '}
                                <span className="text-gray-500 mx-2">{'>>'}</span>
                                {' '}
                                <span className={`${item.type === 'badge_down' ? 'text-red-400' : 'text-blue-400'} font-medium`}>{item.new_rank}</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-sm text-gray-400">{item.type === 'badge_down' ? 'Tenzil Görevlisi' : 'Terfi Görevlisi'}</p>
                            <p className={`${item.type === 'badge_down' ? 'text-red-400' : 'text-blue-400'} font-medium`}>{item.codename}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-400">Motto</p>
                            </div>
                            <p className="text-blue-400 font-medium">
                              JÖH {item.new_rank} {extractCode(item.codename)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => {
                          const logText = [
                            `Terfi alan: ${item.username}`,
                            `Rozet: »JÖH»${item.old_badge}» >> »JÖH»${item.new_badge}»`,
                            `Rütbe: ${item.old_rank} >> ${item.new_rank}`,
                            `Terfi görevlisi: ${item.codename}`,
                            `Tarih: ${new Date(item.action_date).toLocaleDateString('tr-TR')} ${item.action_time}`,
                            '',
                            `Motto: JÖH ${item.new_rank} ${extractCode(item.codename)}`
                          ].join('\n');
                          
                          navigator.clipboard.writeText(logText).then(() => {
                            toast.success('Log kopyalandı!');
                          }).catch(() => {
                            toast.error('Kopyalama başarısız oldu!');
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Kopyala
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {archiveData.length === 0 && !loading && (
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">
              Arşiv kaydı bulunamadı.
              {selectedDate && ' Farklı bir tarih deneyin.'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}