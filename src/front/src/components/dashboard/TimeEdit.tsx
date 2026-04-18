import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Search, Clock, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { formatTime, timeToSeconds, secondsToTime } from '../../utils/timeFormat';
import type { APIUser } from '../../types/api';

interface TimeInputs {
    hours: string;
    minutes: string;
    seconds: string;
}

interface TimeEditData {
  username: string;
  totalTime: number;
  workTime?: number;
  id: string | number;
  avatar?: string | null;
}

type TimeType = 'total' | 'work';

export function TimeEdit() {
  const [selectedUser, setSelectedUser] = useState<TimeEditData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TimeEditData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [timeInputs, setTimeInputs] = useState<TimeInputs>({
    hours: '0',
    minutes: '0',
    seconds: '0'
  });
  const [selectedTimeType, setSelectedTimeType] = useState<TimeType>('total');

  // Kullanıcı arama
  const searchUsers = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get(`/management/times/search?username=${encodeURIComponent(searchTerm.trim())}`);

      if (response.data.success !== 1) {
        toast.error('Kullanıcılar aranamadı!');
        return;
      }

      const users = (response.data.users || []) as any[];

      const timeResults = users.map((u) => {
        return {
          username: u.username,
          id: u.id,
          avatar: u.avatar || '',
          totalTime: u.totalTime || 0,
          workTime: u.workTime || 0
        } as TimeEditData;
      });

      setSearchResults(timeResults);
    } catch (error) {
      toast.error('Sunucu hatası!');
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Süre güncelleme
  const handleTimeUpdate = async () => {
    if (!selectedUser) return;

    try {
      const hours = parseInt(timeInputs.hours) || 0;
      const minutes = parseInt(timeInputs.minutes) || 0;
      const seconds = parseInt(timeInputs.seconds) || 0;

      if (hours < 0 || minutes < 0 || seconds < 0) {
        toast.error('Süreler negatif olamaz!');
        return;
      }

      if (minutes >= 60 || seconds >= 60) {
        toast.error('Dakika ve saniye değerleri 60\'tan küçük olmalıdır!');
        return;
      }

      const totalSeconds = timeToSeconds(hours, minutes, seconds);

      const response = await apiClient.put(`/management/times/${selectedUser.username}`, {
        type: selectedTimeType,
        seconds: totalSeconds
      });

      if (response.data.success) {
        toast.success('Süre başarıyla güncellendi!');
        setShowEditDialog(false);
        setSelectedUser(null);
        setTimeInputs({ hours: '0', minutes: '0', seconds: '0' });
      } else {
        toast.error('Süre güncellenemedi!');
      }
    } catch (error) {
      toast.error('Sunucu hatası!');
      console.error('Error updating time:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Süre Düzenle</h2>
          <p className="text-gray-400">Kullanıcı çalışma süresini düzenle</p>
        </div>

        <form
          className="flex space-x-4 mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            searchUsers();
          }}
        >
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Aranıyor...' : 'Ara'}
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-4">
            {searchResults.map((user) => (
              <Card
                key={user.username}
                className="p-4 cursor-pointer hover:bg-gray-800/50"
                onClick={() => {
                  setSelectedUser(user);
                  setSelectedTimeType('total');
                  const { hours, minutes, seconds } = secondsToTime(user.totalTime);
                  setTimeInputs({
                    hours: hours.toString(),
                    minutes: minutes.toString(),
                    seconds: seconds.toString()
                  });
                  setShowEditDialog(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-white">{user.username}</p>
                      <div className="text-sm text-gray-400">
                        <p>Toplam süre: {formatTime(user.totalTime)}</p>
                        {user.workTime !== undefined && (
                          <p>Terfi süresi: {formatTime(user.workTime)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" className="w-8 h-8 p-0">
                    <Clock className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {searchResults.length === 0 && searchTerm && !loading && (
          <div className="text-center text-gray-400 py-8">
            Sonuç bulunamadı
          </div>
        )}
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Süre Düzenle - {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">
                Yeni Süre (dakika)
              </label>
              <div className="flex space-x-2 justify-center mb-4">
                <Button
                  variant={selectedTimeType === 'total' ? 'primary' : 'outline'}
                  onClick={() => {
                    setSelectedTimeType('total');
                    if (selectedUser) {
                      const { hours, minutes, seconds } = secondsToTime(selectedUser.totalTime);
                      setTimeInputs({
                        hours: hours.toString(),
                        minutes: minutes.toString(),
                        seconds: seconds.toString()
                      });
                    }
                  }}
                >
                  Toplam Süre
                </Button>
                <Button
                  variant={selectedTimeType === 'work' ? 'primary' : 'outline'}
                  onClick={() => {
                    setSelectedTimeType('work');
                    if (selectedUser && selectedUser.workTime !== undefined) {
                      const { hours, minutes, seconds } = secondsToTime(selectedUser.workTime);
                      setTimeInputs({
                        hours: hours.toString(),
                        minutes: minutes.toString(),
                        seconds: seconds.toString()
                      });
                    }
                  }}
                >
                  Terfi Süresi
                </Button>
              </div>
              <div className="text-sm text-gray-400 mb-4">
                {selectedTimeType === 'total' ? (
                  <p>Kullanıcının toplam süresini düzenler. Çalışma süresi etkilenmez.</p>
                ) : (
                  <p>Kullanıcının çalışma süresini düzenler. Toplam süre etkilenmez.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Saat</label>
                  <Input
                    type="number"
                    value={timeInputs.hours}
                    onChange={(e) => setTimeInputs(prev => ({ ...prev, hours: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Dakika</label>
                  <Input
                    type="number"
                    value={timeInputs.minutes}
                    onChange={(e) => setTimeInputs(prev => ({ ...prev, minutes: e.target.value }))}
                    placeholder="0"
                    min="0"
                    max="59"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Saniye</label>
                  <Input
                    type="number"
                    value={timeInputs.seconds}
                    onChange={(e) => setTimeInputs(prev => ({ ...prev, seconds: e.target.value }))}
                    placeholder="0"
                    min="0"
                    max="59"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                İptal
              </Button>
              <Button onClick={handleTimeUpdate}>
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}