import { motion } from 'framer-motion';
import { Wrench, Clock, Sparkles, AlertTriangle, RefreshCcw } from 'lucide-react';

export function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl text-center"
      >
        {/* Ana kart */}
        <div className="bg-gradient-to-br from-blue-950/30 to-indigo-900/30 rounded-lg border border-blue-800/30 p-8 backdrop-blur-sm">
          {/* Üst başlık animasyonu */}
          <motion.div
            animate={{ 
              rotateZ: [0, -2, 2, -2, 0],
              y: [0, -2, 2, -2, 0] 
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <Wrench className="w-12 h-12 text-blue-400" />
            <RefreshCcw className="w-12 h-12 text-blue-400 animate-spin-slow" />
          </motion.div>

          {/* Başlık */}
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent mb-4">
            Bakım Çalışması
          </h1>

          {/* Alt başlık */}
          <p className="text-blue-300/90 text-lg mb-8">
            Sizlere daha iyi hizmet verebilmek için sistemimizde geliştirmeler yapıyoruz
          </p>

          {/* Bilgi kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Süre kartı */}
            <div className="bg-blue-950/20 border border-blue-800/20 rounded-lg p-6">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <Clock className="w-6 h-6 text-blue-400" />
                <h3 className="text-blue-300 font-semibold">Tahmini Süre</h3>
              </div>
              <p className="text-blue-200/70">
                Çalışmalarımız yaklaşık birkaç saat sürecektir
              </p>
            </div>

            {/* Yapılan işlemler kartı */}
            <div className="bg-blue-950/20 border border-blue-800/20 rounded-lg p-6">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <Sparkles className="w-6 h-6 text-blue-400" />
                <h3 className="text-blue-300 font-semibold">Yapılan İşlemler</h3>
              </div>
              <p className="text-blue-200/70">
                Performans iyileştirmeleri ve yeni özellikler ekleniyor
              </p>
            </div>
          </div>

          {/* Bilgilendirme kartı */}
          <div className="bg-blue-950/20 border border-blue-800/20 rounded-lg p-6 mb-8">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div className="text-left">
                <h3 className="text-blue-300 font-semibold mb-2">Önemli Bilgilendirme</h3>
                <p className="text-blue-200/70">
                  Bakım süresince sistemimize erişim geçici olarak kapalı olacaktır. 
                  Gösterdiğiniz anlayış için teşekkür ederiz.
                </p>
              </div>
            </div>
          </div>

          {/* Alt bilgi */}
          <div className="flex flex-col items-center space-y-4">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="text-2xl text-blue-400"
            >
              ⚡
            </motion.div>
            <p className="text-blue-300/50">
              Daha iyi bir deneyim için çalışıyoruz
            </p>
          </div>
        </div>

        {/* Footer bilgi */}
        <p className="text-blue-300/30 text-sm mt-6">
          Güncellemelerden haberdar olmak için Discord sunucumuzu takip edin
        </p>
      </motion.div>

      {/* Arkaplan animasyonlu parçacıklar */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="absolute inset-0 bg-gradient-to-br from-blue-900/5 to-indigo-900/5"
        />
      </div>
    </div>
  );
}