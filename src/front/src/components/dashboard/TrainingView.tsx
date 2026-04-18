import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, GraduationCap, Calendar, Clock, User, CheckCircle } from 'lucide-react';
import { mitAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface TrainingRecord {
  trainee_username: string;
  trainer_username: string;
  training_date: string;
  training_time: string;
  discord_verified: number;
}

export function TrainingView() {
  const [searchUsername, setSearchUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [trainingRecord, setTrainingRecord] = useState<TrainingRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [discordVerified, setDiscordVerified] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleSearch = async () => {
    if (!searchUsername.trim()) {
      toast.error('Lütfen bir kullanıcı adı girin');
      return;
    }

    setLoading(true);
    try {
      const response = await mitAPI.checkTraining(searchUsername);

      if (response.success === 1) {
        if (response.found) {
          // Eğitim kaydı var
          setTrainingRecord(response.data);
          setDiscordVerified(response.data.discord_verified === 1);
          setShowForm(false);
          setIsEditMode(false);
          toast.success('Eğitim kaydı bulundu!');
        } else {
          // Eğitim kaydı yok - form göster
          setTrainingRecord(response.data);
          setDiscordVerified(false);
          setShowForm(true);
          setIsEditMode(false);
          toast.info('Eğitim kaydı bulunamadı. Yeni kayıt oluşturunuz.');
        }
      } else {
        toast.error(response.error || 'Bir hata oluştu');
      }
    } catch (error: any) {
      toast.error(error.message || 'İşlem başarısız');
    }
    setLoading(false);
  };

  const handleCreateTraining = async () => {
    if (!searchUsername.trim()) {
      toast.error('Lütfen bir kullanıcı adı girin');
      return;
    }

    setLoading(true);
    try {
      const response = await mitAPI.createTraining(searchUsername, discordVerified);

      if (response.success === 1) {
        setTrainingRecord(response.data);
        setShowForm(false);
        setIsEditMode(false);
        toast.success('Eğitim kaydı başarıyla oluşturuldu!');
      } else {
        toast.error(response.error || 'Bir hata oluştu');
      }
    } catch (error: any) {
      toast.error(error.message || 'İşlem başarısız');
    }
    setLoading(false);
  };

  const handleUpdateTraining = async () => {
    if (!trainingRecord) return;

    setLoading(true);
    try {
      const response = await mitAPI.updateTraining(trainingRecord.trainee_username, discordVerified);

      if (response.success === 1) {
        setTrainingRecord(response.data);
        setIsEditMode(false);
        toast.success('Eğitim kaydı başarıyla güncellendi!');
      } else {
        toast.error(response.error || 'Bir hata oluştu');
      }
    } catch (error: any) {
      toast.error(error.message || 'İşlem başarısız');
    }
    setLoading(false);
  };

  const handleReset = () => {
    setSearchUsername('');
    setTrainingRecord(null);
    setShowForm(false);
    setDiscordVerified(false);
    setIsEditMode(false);
  };

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <Card className="p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <GraduationCap className="w-6 h-6 mr-3 text-gray-400" />
            Eğitim Sistemi
          </h2>
        </div>

        {/* Search Input */}
        <div className="flex gap-4 flex-col md:flex-row">
          <div className="flex-1">
            <Input
              label="Kullanıcı Adı"
              placeholder="Eğitim kaydını kontrol etmek için kullanıcı adı girin"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              icon={User}
              fullWidth
              disabled={trainingRecord !== null}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={handleSearch}
              loading={loading}
              disabled={loading || trainingRecord !== null}
              icon={Search}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              Ara
            </Button>
            {trainingRecord && (
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Temizle
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Training Record Display */}
      {trainingRecord && !showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-8 bg-gradient-to-br from-green-900/20 to-emerald-900/20 backdrop-blur-sm border border-green-700/50">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-green-400 mb-6">
                  ✓ Eğitim Kaydı Bulundu
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Trainee Info */}
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <p className="text-sm text-gray-400 mb-2">Eğitim Alan</p>
                      <p className="text-lg font-semibold text-white">
                        {trainingRecord.trainee_username}
                      </p>
                    </div>
                  </div>

                  {/* Trainer Info */}
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <p className="text-sm text-gray-400 mb-2">Eğitimci</p>
                      <p className="text-lg font-semibold text-blue-400">
                        {trainingRecord.trainer_username}
                      </p>
                    </div>
                  </div>

                  {/* Date Info */}
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Tarih</p>
                        <p className="text-lg font-semibold text-white">
                          {trainingRecord.training_date}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Time Info */}
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Saat</p>
                        <p className="text-lg font-semibold text-white">
                          {trainingRecord.training_time}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Discord Verified */}
                  <div className="space-y-4 md:col-span-2">
                    {!isEditMode ? (
                      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-sm text-gray-400 mb-3">Discord Sunucusunda Var</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={trainingRecord.discord_verified === 1}
                            disabled
                            className="w-5 h-5 rounded cursor-not-allowed accent-blue-500"
                          />
                          <span className={trainingRecord.discord_verified === 1 ? 'text-green-400' : 'text-gray-400'}>
                            {trainingRecord.discord_verified === 1 ? '✓ Doğrulandı' : '✗ Doğrulanmadı'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-800/30 rounded-lg border border-blue-600/50">
                        <p className="text-sm text-gray-300 mb-3">Discord Sunucusunda Var</p>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={discordVerified}
                            onChange={(e) => setDiscordVerified(e.target.checked)}
                            className="w-5 h-5 rounded accent-blue-500"
                          />
                          <span className="text-white">{discordVerified ? '✓ Discord\'da Var' : '✗ Discord\'da Yok'}</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex gap-3 justify-end">
                  {!isEditMode ? (
                    <Button
                      onClick={() => {
                        setIsEditMode(true);
                        setDiscordVerified(trainingRecord.discord_verified === 1);
                      }}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                      Düzenle
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => setIsEditMode(false)}
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        İptal
                      </Button>
                      <Button
                        onClick={handleUpdateTraining}
                        loading={loading}
                        disabled={loading}
                        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                      >
                        Kaydet
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Training Form */}
      {trainingRecord && showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-8 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 backdrop-blur-sm border border-blue-700/50">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <GraduationCap className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-blue-400">
                  Yeni Eğitim Kaydı Oluştur
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Bu kullanıcı için henüz bir eğitim kaydı bulunmamaktadır.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Trainee */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Eğitim Alan
                </label>
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-lg font-semibold text-white">
                    {trainingRecord.trainee_username}
                  </p>
                </div>
              </div>

              {/* Trainer - Disabled (auto-filled) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Eğitimci
                </label>
                <p className="text-sm text-gray-400 py-1">
                  (Otomatik olarak sizin kullanıcı adınız kaydedilecektir)
                </p>
                <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                  <p className="text-sm text-gray-400 italic">
                    Sisteme bağlı kullanıcı
                  </p>
                </div>
              </div>

              {/* Discord Verified Checkbox */}
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Discord Doğrulaması
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={discordVerified}
                    onChange={(e) => setDiscordVerified(e.target.checked)}
                    className="w-5 h-5 rounded accent-blue-500"
                  />
                  <span className="text-white">
                    {discordVerified ? '✓ Discord Sunucusunda Var' : '✗ Discord Sunucusunda Yok'}
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex gap-3 justify-end">
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                İptal
              </Button>
              <Button
                onClick={handleCreateTraining}
                loading={loading}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                Kaydı Oluştur
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {!trainingRecord && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 px-6"
        >
          <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">
            Eğitim kaydını kontrol etmek için yukarıda kullanıcı adı arayın
          </p>
        </motion.div>
      )}
    </div>
  );
}
