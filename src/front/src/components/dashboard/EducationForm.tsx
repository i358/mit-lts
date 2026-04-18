import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { GraduationCap, Search, User, Calendar, CheckCircle, X, Copy } from 'lucide-react';
import { mitAPI, discordAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface EducationLog {
  id: string;
  studentName: string;
  instructorName: string;
  date: string;
  attended: boolean;
  timestamp: string;
}

export function EducationForm() {
  const [userName, setUserName] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [educationLogs, setEducationLogs] = useState<EducationLog[]>([]);
  
  const [educationData, setEducationData] = useState({
    instructorName: '',
    date: new Date().toISOString().split('T')[0],
    attended: true
  });

  const handleUserSearch = async () => {
    if (!userName.trim()) {
      toast.error('Lütfen kullanıcı adı girin!');
      return;
    }

    setLoading(true);
    try {
      const userData = await mitAPI.getUserInfo(userName.trim());
      
      // Eğitim durumunu kontrol et (mock data)
      const hasEducation = Math.random() > 0.5; // %50 şans ile eğitimi var
      
      setUserInfo({
        ...userData,
        hasEducation: hasEducation
      });
      
      setShowEducationForm(false);
      toast.success('Kullanıcı bilgileri yüklendi!');
    } catch (error: any) {
      toast.error(error.message);
      setUserInfo(null);
    }
    setLoading(false);
  };

  const handleEducationSubmit = async () => {
    if (!userInfo || !educationData.instructorName.trim()) {
      toast.error('Lütfen tüm alanları doldurun!');
      return;
    }

    setLoading(true);
    try {
      await discordAPI.sendLog({
        title: '🎓 Eğitim Kaydı',
        description: `${userInfo.username} için eğitim kaydı oluşturuldu`,
        color: 0x6b7280,
        fields: [
          { name: 'Eğitim Alan', value: userInfo.username, inline: true },
          { name: 'Eğitim Veren', value: educationData.instructorName, inline: true },
          { name: 'Tarih', value: new Date(educationData.date).toLocaleDateString('tr-TR'), inline: true },
          { name: 'Katılım Durumu', value: educationData.attended ? '✅ Katıldı' : '❌ Katılmadı', inline: true }
        ],
        username: userInfo.username
      });

      // Log'a ekle
      const newLog: EducationLog = {
        id: Date.now().toString(),
        studentName: userInfo.username,
        instructorName: educationData.instructorName,
        date: educationData.date,
        attended: educationData.attended,
        timestamp: new Date().toLocaleString('tr-TR')
      };
      setEducationLogs(prev => [newLog, ...prev]);

      // Kullanıcının eğitim durumunu güncelle
      setUserInfo(prev => ({ ...prev, hasEducation: true }));
      
      toast.success('Eğitim kaydı başarıyla oluşturuldu!');
      setShowEducationForm(false);
      
      // Form temizle
      setEducationData({
        instructorName: '',
        date: new Date().toISOString().split('T')[0],
        attended: true
      });
    } catch (error: any) {
      toast.error('Eğitim kaydı oluşturma sırasında hata oluştu!');
    }
    setLoading(false);
  };

  const copyEducationLog = (log: EducationLog) => {
    const logText = `${log.studentName} - Eğitmen: ${log.instructorName} - Tarih: ${new Date(log.date).toLocaleDateString('tr-TR')} - ${log.attended ? 'Katıldı' : 'Katılmadı'}`;
    navigator.clipboard.writeText(logText);
    toast.success('Log panoya kopyalandı!');
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-gray-900/80 backdrop-blur-sm border border-gray-800/50">
        <h2 className="text-2xl font-bold text-white mb-8 flex items-center">
          <GraduationCap className="w-7 h-7 mr-3 text-gray-500" />
          Eğitim Yönetimi
        </h2>

        {/* User Search */}
        <div className="mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label="Kullanıcı Adı"
                placeholder="Eğitim durumu kontrol edilecek kullanıcının adını girin"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                icon={User}
                fullWidth
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleUserSearch}
                loading={loading}
                disabled={loading}
                icon={Search}
                className="px-8 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
              >
                Kullanıcı Ara
              </Button>
            </div>
          </div>
        </div>

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
                  <p className="text-sm font-medium text-gray-400">Mevcut Rütbe</p>
                  <p className="text-lg font-bold text-gray-400">
                    {userInfo.currentRank || 'Stajyer'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400 flex items-center">
                    <GraduationCap className="w-4 h-4 mr-1" />
                    Eğitim Durumu
                  </p>
                  <p className={`text-lg font-bold ${
                    userInfo.hasEducation ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {userInfo.hasEducation ? 'Eğitimi Var' : 'Eğitimi Yok'}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Education Action */}
        {userInfo && !userInfo.hasEducation && !showEducationForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={() => setShowEducationForm(true)}
              fullWidth
              size="lg"
              icon={GraduationCap}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
            >
              Eğitim Ver
            </Button>
          </motion.div>
        )}

        {/* Education Form */}
        {showEducationForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6 bg-gradient-to-r from-gray-800/20 to-gray-700/20 border border-gray-600/50">
              <h4 className="text-lg font-semibold text-white mb-6">Eğitim Bilgileri</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Input
                  label="Eğitim Veren"
                  placeholder="Eğitimi veren kişinin adı"
                  value={educationData.instructorName}
                  onChange={(e) => setEducationData(prev => ({ ...prev, instructorName: e.target.value }))}
                  icon={User}
                  fullWidth
                />

                <Input
                  label="Eğitim Tarihi"
                  type="date"
                  value={educationData.date}
                  onChange={(e) => setEducationData(prev => ({ ...prev, date: e.target.value }))}
                  icon={Calendar}
                  fullWidth
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Discord'a Katıldı mı?
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setEducationData(prev => ({ ...prev, attended: true }))}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      educationData.attended
                        ? 'bg-green-600/20 border-green-500/50 text-green-300'
                        : 'bg-gray-800/50 border-gray-600/50 text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Katıldı</span>
                  </button>
                  
                  <button
                    onClick={() => setEducationData(prev => ({ ...prev, attended: false }))}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      !educationData.attended
                        ? 'bg-red-600/20 border-red-500/50 text-red-300'
                        : 'bg-gray-800/50 border-gray-600/50 text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    <span>Katılmadı</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleEducationSubmit}
                  loading={loading}
                  disabled={loading}
                  icon={CheckCircle}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  Eğitim Kaydını Oluştur
                </Button>
                <Button
                  onClick={() => setShowEducationForm(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  İptal
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Education Status for users who have education */}
        {userInfo && userInfo.hasEducation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-green-900/20 rounded-lg border border-green-700/50"
          >
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
              <div>
                <h4 className="text-lg font-semibold text-green-200">Eğitim Tamamlandı</h4>
                <p className="text-green-300">Bu kullanıcı eğitimini başarıyla tamamlamıştır.</p>
              </div>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Education Logs */}
      {educationLogs.length > 0 && (
        <Card className="p-6 bg-gray-900/80 backdrop-blur-sm border border-gray-800/50">
          <h3 className="text-lg font-semibold text-white mb-4">
            Eğitim Logları ({educationLogs.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {educationLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {log.studentName} - Eğitmen: {log.instructorName}
                    </p>
                    <p className="text-sm text-gray-400">
                      Tarih: {new Date(log.date).toLocaleDateString('tr-TR')} - 
                      <span className={log.attended ? 'text-green-400' : 'text-red-400'}>
                        {log.attended ? ' Katıldı' : ' Katılmadı'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{log.timestamp}</p>
                  </div>
                  <Button
                    onClick={() => copyEducationLog(log)}
                    variant="outline"
                    size="sm"
                    icon={Copy}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Kopyala
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}