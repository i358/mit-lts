import { motion } from 'framer-motion';
import { Ban, AlertTriangle, Clock, Calendar, Shield, LogOut } from 'lucide-react';
import { AuthService } from '../../services/auth.service';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';

interface BanInfo {
  reason?: string;
  expires?: string;
  permanent: boolean;
  authoritative?: string;
  created_at?: string;
}

interface BannedPageProps {
  banInfo: BanInfo;
}

export function BannedPage({ banInfo }: BannedPageProps) {
  const { setAuthenticated, setUser } = useAppStore();

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setAuthenticated(false);
      setUser(null);
      toast.success('Başarıyla çıkış yapıldı');
    } catch (error) {
      toast.error('Çıkış yapılırken bir hata oluştu');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        {/* Ana kart */}
        <div className="bg-gradient-to-br from-red-950/30 to-red-900/30 rounded-lg border border-red-800/30 p-8 backdrop-blur-sm">
          {/* Başlık kısmı */}
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Ban className="w-12 h-12 text-red-500 animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-red-300 bg-clip-text text-transparent">
              Hesabınız Yasaklandı
            </h1>
          </div>

          {/* Uyarı kartı */}
          <div className="bg-red-950/20 border border-red-800/20 rounded-lg p-6 mb-8">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-red-300 font-semibold text-lg mb-2">Yasaklanma Sebebi</h2>
                <p className="text-red-200/70">
                  {banInfo.reason || "Hesabınız topluluk kurallarını ihlal ettiği için yasaklanmıştır."}
                  <br />
                  Bu karara itiraz etmek için yöneticilerle iletişime geçebilirsiniz.
                </p>
              </div>
            </div>
          </div>

          {/* Bilgi kartları grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Yasaklanma Tarihi */}
            <div className="bg-red-950/20 border border-red-800/20 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-red-300/70 text-sm">Yasaklanma Tarihi</p>
                  <p className="text-red-100 font-medium">
                    {banInfo.created_at 
                      ? new Date(banInfo.created_at).toLocaleDateString('tr-TR')
                      : new Date().toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Süre */}
            <div className="bg-red-950/20 border border-red-800/20 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-red-300/70 text-sm">Yasaklanma Süresi</p>
                  <p className="text-red-100 font-medium">
                    {banInfo.permanent
                      ? 'Kalıcı' 
                      : banInfo.expires 
                        ? `${new Date(banInfo.expires).toLocaleDateString('tr-TR')} tarihine kadar`
                        : 'Belirsiz'}
                  </p>
                </div>
              </div>
            </div>

            {/* Yasaklayan */}
            <div className="bg-red-950/20 border border-red-800/20 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-red-300/70 text-sm">Yasaklayan Yetkili</p>
                  <p className="text-red-100 font-medium">{banInfo.authoritative || 'Administrator'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* İtiraz butonu */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-red-600/20 to-red-500/20 hover:from-red-600/30 hover:to-red-500/30 
                     border border-red-500/30 rounded-lg py-4 px-6 text-red-300 font-medium transition-all
                     hover:border-red-500/50 hover:text-red-200 hover:shadow-lg hover:shadow-red-900/20 mb-4"
          >
            İtiraz Et
          </motion.button>

          {/* Çıkış Yap butonu */}
          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-gray-800/50 to-gray-700/50 hover:from-gray-800/70 hover:to-gray-700/70 
                     border border-gray-600/30 rounded-lg py-4 px-6 text-gray-300 font-medium transition-all
                     hover:border-gray-500/50 hover:text-gray-200 hover:shadow-lg hover:shadow-gray-900/20
                     flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Çıkış Yap
          </motion.button>

          {/* Alt bilgi */}
          <p className="text-center text-red-300/50 text-sm mt-6">
            İtiraz süreciniz 24 saat içinde değerlendirilecektir.
          </p>
        </div>
      </motion.div>
    </div>
  );
}