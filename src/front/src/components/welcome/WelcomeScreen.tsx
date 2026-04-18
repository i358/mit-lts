import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Users, 
  Trophy, 
  Star, 
  ChevronRight, 
  Play,
  Award,
  Target,
  Zap,
  Crown,
  Sword,
  LogIn,
  UserPlus
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { AuthForm } from './AuthForm';
import { useAppStore } from '../../store/useAppStore';
import { teamMembers } from '../../data/teamData';

export function WelcomeScreen() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authType, setAuthType] = useState<'login' | 'register'>('login');
  const { setUser, setAuthenticated } = useAppStore();

  const handleAuthSuccess = (user: any) => {
    setUser(user);
    setAuthenticated(true);
    setShowAuthModal(false);
  };

  const toggleAuthType = () => {
    setAuthType(authType === 'login' ? 'register' : 'login');
  };

  const openAuth = (type: 'login' | 'register') => {
    setAuthType(type);
    setShowAuthModal(true);
  };

  const features = [
    {
      icon: Shield,
      title: 'Güvenli Sistem',
      description: 'Discord entegrasyonu ile güvenli ve hızlı işlemler',
      color: 'from-red-500 to-red-600'
    },
    {
      icon: Trophy,
      title: 'Terfi Sistemi',
      description: 'Otomatik terfi hesaplama ve takip sistemi',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: Users,
      title: 'Aile Ortamı',
      description: 'Aile ve samimi arkadaş ortamı',
      color: 'from-gray-600 to-gray-700'
    },
    {
      icon: Target,
      title: 'Yenilikçi Sistem',
      description: 'Detaylı ve son derece yenilikçi yönetim sistemi',
      color: 'from-red-600 to-orange-500'
    }
  ];

  const stats = [
    { label: 'Aktif Üye', value: '150+', icon: Users },
    { label: 'Başarılı Toplu Terfi', value: '500+', icon: Target },
    { label: 'Yıllık Deneyim', value: '8+', icon: Award },
    { label: 'Discord Üyesi', value: '300+', icon: Zap }
  ];

  const founders = teamMembers.filter(member => member.category === 'kurucular');
  const leadership = teamMembers.filter(member => 
    ['discord', 'koordinator'].includes(member.category)
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  JÖH
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Jandarma Özel Harekat</p>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button
                onClick={() => openAuth('login')}
                variant="ghost"
                icon={LogIn}
                className="text-white hover:bg-gray-700/50 border border-gray-600"
              >
                Giriş Yap
              </Button>
              <Button
                onClick={() => openAuth('register')}
                icon={UserPlus}
                className="bg-gray-700 hover:bg-gray-600 text-white shadow-lg"
              >
                JÖH'e Katıl
              </Button>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-6">
                <span className="inline-flex items-center px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full text-red-300 text-sm font-medium mb-4">
                  <Crown className="w-4 h-4 mr-2 text-yellow-400" />
                  Habbo'nun En Prestijli Şirketi
                </span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-black mb-6 leading-tight">
                <span className="text-white">
                  JÖH
                </span>
                <br />
                <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                  Jandarma Özel Harekat
                </span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                8 yıllık deneyimimiz ile Habbo Türkiye'nin en köklü ve prestijli şirketi. 
                Profesyonel ekibimiz, modern yönetim sistemimiz ve güçlü Discord entegrasyonumuz ile 
                Habbo dünyasında fark yaratıyoruz.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => openAuth('register')}
                  size="lg"
                  icon={UserPlus}
                  className="bg-gray-700 hover:bg-gray-600 text-white shadow-2xl"
                >
                  Hemen Başvur
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  icon={Play}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
                >
                  Tanıtım Videosu
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10">
                <img
                  src="https://habbojoh.com.tr/bg.png"
                  alt="JÖH Operasyon"
                  className="rounded-2xl shadow-2xl border border-gray-700/50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-2xl"></div>
              </div>
              
              {/* Floating Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="absolute -bottom-6 -left-6 bg-gray-900/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-xl"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">150+</p>
                    <p className="text-sm text-gray-400">Aktif Üye</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="absolute -top-6 -right-6 bg-gray-900/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 shadow-xl"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">8+</p>
                    <p className="text-sm text-gray-400">Yıl Deneyim</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gray-950/40 backdrop-blur-sm border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">{stat.value}</h3>
                <p className="text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              <span className="text-white">
                Neden JÖH?
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Modern teknoloji ve deneyimli kadromuz ile Habbo dünyasında en iyi hizmeti sunuyoruz
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-8 h-full bg-gray-950/40 border-gray-800/30 hover:border-gray-700/50 transition-all duration-300 group backdrop-blur-sm">
                  <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="py-20 px-6 bg-gray-950/40 backdrop-blur-sm border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                Liderlik Kadromuz
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              JÖH'ü bugünlere getiren deneyimli ve kararlı liderlerimiz
            </p>
          </motion.div>

          {/* Kurucular */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-white mb-8 text-center flex items-center justify-center">
              <Crown className="w-6 h-6 mr-2 text-yellow-400" />
              Kurucular
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {founders.map((founder, index) => (
                <motion.div
                  key={founder.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-6 bg-gradient-to-br from-gray-950/30 to-gray-900/30 border-gray-700/30 hover:border-gray-600/50 transition-all duration-300 group text-center backdrop-blur-sm">
                    <div className="relative mb-6">
                      <img
                        src={founder.avatar}
                        alt={founder.name}
                        className="w-[120px] h-[130px] rounded-full mx-auto border-4 border-gray-600/40 group-hover:border-gray-500/60 transition-all duration-300 shadow-lg"
                      />
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center shadow-lg">
                        <Crown className="w-4 h-4 text-yellow-400" />
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">{founder.name}</h4>
                    <p className="text-gray-400 font-medium mb-2">{founder.position}</p>
                    <div className="flex justify-center">
                      <span className="px-3 py-1 bg-gray-700/20 border border-gray-600/30 rounded-full text-gray-300 text-sm font-medium">
                        {founder.rank}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Yönetim Kadrosu */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-8 text-center flex items-center justify-center">
              <Star className="w-6 h-6 mr-2 text-gray-400" />
              Yönetim Kadrosu
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {leadership.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-6 bg-gray-950/40 border-gray-800/30 hover:border-gray-700/50 transition-all duration-300 group backdrop-blur-sm">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={member.avatar}
                        alt={member.name}
                        className="w-[120px] h-[130px] rounded-full border-2 border-gray-600/40 group-hover:border-gray-500/60 transition-all duration-300 shadow-lg"
                      /> 
                      <div>
                        <h4 className="text-lg font-bold text-white mb-1">{member.name}</h4>
                        <p className="text-gray-400 mb-2">{member.position}</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.category === 'discord' 
                            ? 'bg-gray-700/20 text-gray-300 border border-gray-600/30' 
                            : 'bg-gray-700/20 text-gray-300 border border-gray-600/30'
                        }`}>
                          {member.category === 'discord' ? 'Discord Yetkilisi' : 'Koordinatör'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="py-20 px-6 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                Başarılarımız
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              8 yıllık yolculuğumuzda elde ettiğimiz prestijli başarılar
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8 bg-gradient-to-br from-gray-950/30 to-gray-900/30 border-gray-700/30 hover:border-gray-600/50 transition-all duration-300 text-center backdrop-blur-sm">
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">En İyi Şirket</h3>
                <p className="text-gray-400 mb-4">2023 Habbo Türkiye Ödülleri</p>
                <p className="text-gray-400">Habbo Türkiye'nin en prestijli şirketi ödülünü kazandık</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-8 bg-gradient-to-br from-gray-950/30 to-gray-900/30 border-gray-700/30 hover:border-gray-600/50 transition-all duration-300 text-center backdrop-blur-sm">
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Güvenlik Lideri</h3>
                <p className="text-gray-400 mb-4">500+ Başarılı Toplu Terfi</p>
                <p className="text-gray-400">Habbo güvenliğinde öncü rol oynuyoruz</p>
              </Card> 
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
             <Card className="p-8 bg-gradient-to-br from-gray-950/30 to-gray-900/30 border-gray-700/30 hover:border-gray-600/50 transition-all duration-300 text-center backdrop-blur-sm">
               <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Büyük Topluluk</h3>
               <p className="text-gray-400 mb-4">300+ Discord Üyesi</p>
               <p className="text-gray-400">Aktif ve güçlü topluluk desteği</p>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gradient-to-r from-gray-950/30 to-gray-900/30 border border-gray-700/30 rounded-3xl p-12 backdrop-blur-sm">
              <div className="w-20 h-20 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <Sword className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="text-white">
                  JÖH Ailesine Katıl
                </span>
              </h2>
              
              <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                Habbo'nun en prestijli şirketinde yerini al. Profesyonel ekibimizle birlikte 
                büyü, gelişim fırsatlarından yararlan ve Habbo dünyasında iz bırak.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => openAuth('register')}
                  size="lg"
                  icon={UserPlus}
                  className="bg-gray-700 hover:bg-gray-600 text-white shadow-2xl"
                >
                  Şimdi Başvur
                </Button>
                <Button
                  onClick={() => openAuth('login')}
                  variant="outline"
                  size="lg"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
                >
                  Giriş Yap
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-5 bg-gray-950/60 border-t border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-[90rem] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">

            <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Yasal Uyarı</h3>
            <p className="text-xs text-gray-400 leading-relaxed w-[50vw]">
              Bu web sitesi, Sulake Corporation Oy veya bağlı kuruluşları tarafından onaylanmamış, desteklenmemiş, sponsor olunmamış veya özel olarak onaylanmamıştır. habbojoh.com.tr, Sulake Corporation Oy veya bağlı kuruluşlarının ticari markalarını ve diğer fikri mülkiyetlerini kullanabilir; bu kullanım, Fan Sitesi Politikası kapsamında izin verilmiştir.
            </p>
          </div>
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-gray-400">© 2025 JÖH - Tüm hakları saklıdır</p>
              <p className="text-sm text-gray-500">Made by 358 & sinyatur with ♥</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        size="md"
      >
        <AuthForm
          type={authType}
          onSubJÖH={handleAuthSuccess}
          onToggle={toggleAuthType}
        />
      </Modal>
    </div>
  );
}