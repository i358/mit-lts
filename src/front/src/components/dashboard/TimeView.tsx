import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from '../ui/Table';
import { Search, Clock, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';

interface User {
  userId: number;
  username: string;
  avatar?: string | null;
  time: {
    storedTotal: number;
    currentSessionTime: number;
    realTimeTotal: number;
    isActive: boolean;
    lastSeen: number;
    workTime: number;
    requiredWorkTime: number;
    isInStack: boolean;
  };
}

export function TimeView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // GraphQL sorgusu
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await mitAPI.getAllUserTimes();
        if (data.success && data.data) {
          setUsers(data.data);
          setError(null);
        } else {
          throw new Error('Veri formatı hatalı');
        }
      } catch (err) {
        setError(err as Error);
        toast.error('Veriler yüklenirken bir hata oluştu!');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Her 30 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  // Arama filtrelemesi
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined || isNaN(ms)) return '0s 0d';
    
    // workTime is already in minutes, other times are in milliseconds
    const totalMinutes = ms < 1000 ? ms : Math.floor(ms / (1000 * 60));
    
    // Convert minutes to hours and remaining minutes
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
    return `${hours}s ${remainingMinutes}d`;
  };

  if (error) {
    toast.error('Veriler yüklenirken bir hata oluştu!');
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          Veri yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 mb-6 border border-gray-800 bg-gradient-to-r from-gray-900/50 to-gray-800/50">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              type="text"
              placeholder="Kullanıcı ara..."
              className="pl-10 bg-gray-900/50 border-gray-700 text-gray-200 placeholder:text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center px-4 py-2 bg-gray-900/30 rounded-md border border-gray-800">
            <div className="flex items-center space-x-2 text-sm text-emerald-500">
              <Clock className="w-4 h-4" />
              <span>Otomatik güncelleniyor</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border border-gray-800">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-800 bg-gray-900/50">
              <TableHead className="text-gray-400">Kullanıcı</TableHead>
              <TableHead className="text-gray-400">Toplam Süre</TableHead>
              <TableHead className="text-gray-400">Bugünkü Süre</TableHead>
              <TableHead className="text-gray-400">Terfi Süresi</TableHead>
              <TableHead className="text-gray-400">Mevcut Oturum</TableHead>
              <TableHead className="text-gray-400">Durum</TableHead>
              <TableHead className="text-gray-400">Son Görülme</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeletons
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
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
                    <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user, index) => (
                <TableRow 
                  key={index} 
                  className={`border-b border-gray-800 transition-colors duration-200 hover:bg-gray-900/30 ${
                    index % 2 === 0 ? 'bg-gray-900/10' : 'bg-transparent'
                  }`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-700/50">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${user.time.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-gray-200">{user.username}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-gray-300">{formatDuration(user.time.storedTotal)}</TableCell>
                  <TableCell className="font-medium text-gray-300">{formatDuration(Math.floor(user.time.realTimeTotal / (1000 * 60 * 60 * 24)))}</TableCell>
                  <TableCell className="font-medium text-gray-300">{formatDuration(user.time.workTime)}</TableCell>
                  <TableCell className="font-medium text-gray-300">{formatDuration(user.time.currentSessionTime)}</TableCell>
                  <TableCell>
                    <div className={`flex items-center space-x-2 ${
                      user.time.isActive ? 'text-green-500' : 'text-gray-500'
                    } font-medium`}>
                      <Activity className="w-4 h-4" />
                      <span>{user.time.isActive ? 'Aktif' : 'Çevrimdışı'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-gray-300">
                    {user.time.lastSeen ? (
                      new Date(user.time.lastSeen).toLocaleString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    ) : 'Bilinmiyor'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="text-center text-gray-500 py-8" style={{ gridColumn: 'span 6' }}>
                  <div className="flex flex-col items-center justify-center">
                    <Search className="w-8 h-8 mb-2 text-gray-600" />
                    <span>Kayıt bulunamadı</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}