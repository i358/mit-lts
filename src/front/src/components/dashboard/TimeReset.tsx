import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Search, RotateCcw, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { formatTime } from '../../utils/timeFormat';
import type { APIUser } from '../../types/api';

interface TimeData {
  username: string;
  id: string | number;
  totalTime: number;
  workTime?: number;
  avatar?: string | null;
}

type TimeType = 'total' | 'work' | 'both';

export function TimeReset() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TimeData | null>(null);

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
        } as TimeData;
      });

      setSearchResults(timeResults);
    } catch (error) {
      toast.error('Sunucu hatası!');
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Süre sıfırlama
  const [selectedTimeType, setSelectedTimeType] = useState<TimeType>('both');
  
  const handleTimeReset = async () => {
    if (!selectedUser) return;

    try {
      const response = await apiClient.post(`/management/times/${selectedUser.username}/reset`, {
        type: selectedTimeType
      });

      if (response.data.success) {
        toast.success('Süre başarıyla sıfırlandı!');
        setShowConfirmDialog(false);
        setSelectedUser(null);
        
        // Arama sonuçlarını güncelle
        const updatedResults = searchResults.map(user => {
          if (user.username === selectedUser.username) {
            const updatedUser = { ...user };
            if (selectedTimeType === 'total' || selectedTimeType === 'both') {
              updatedUser.totalTime = 0;
            }
            if (selectedTimeType === 'work' || selectedTimeType === 'both') {
              updatedUser.workTime = 0;
            }
            return updatedUser;
          }
          return user;
        });
        setSearchResults(updatedResults);
      } else {
        toast.error('Süre sıfırlanamadı!');
      }
    } catch (error) {
      toast.error('Sunucu hatası!');
      console.error('Error resetting time:', error);
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
          <h2 className="text-xl font-bold text-white mb-2">Süre Sıfırla</h2>
          <p className="text-gray-400">Kullanıcı terfi süresini sıfırla</p>
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
                  setShowConfirmDialog(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <RotateCcw className="w-5 h-5 text-gray-400" />
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
                  <Button variant="ghost">
                    <RotateCcw className="w-4 h-4" />
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

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Süre Sıfırlama Onayı</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="flex items-center space-x-2 text-yellow-500">
              <AlertTriangle className="w-5 h-5" />
              <p>Bu işlem geri alınamaz!</p>
            </div>
            <p className="text-gray-400">
              {selectedUser?.username} kullanıcısının süresini sıfırlamak istediğinizden emin misiniz?
            </p>
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex space-x-2 justify-center">
                  <Button
                    variant={selectedTimeType === 'total' ? 'primary' : 'outline'}
                    onClick={() => setSelectedTimeType('total')}
                  >
                    Toplam Süre
                  </Button>
                  <Button
                    variant={selectedTimeType === 'work' ? 'primary' : 'outline'}
                    onClick={() => setSelectedTimeType('work')}
                  >
                    Terfi Süresi
                  </Button>
                  <Button
                    variant={selectedTimeType === 'both' ? 'primary' : 'outline'}
                    onClick={() => setSelectedTimeType('both')}
                  >
                    Tüm Süreleri Sıfırla
                  </Button>
                </div>
                <div className="text-sm text-gray-400">
                  {selectedTimeType === 'total' && (
                    <p>Kullanıcının toplam süresini sıfırlar. Terfi süresi etkilenmez.</p>
                  )}
                  {selectedTimeType === 'work' && (
                    <p>Kullanıcının sadece terfi süresini sıfırlar. Toplam süre etkilenmez.</p>
                  )}
                  {selectedTimeType === 'both' && (
                    <p>Kullanıcının hem toplam süresini hem de terfi süresini sıfırlar.</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                  İptal
                </Button>
                <Button variant="destructive" onClick={handleTimeReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Sıfırla
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}