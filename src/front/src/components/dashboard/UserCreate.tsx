import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { UserPlus, Info, Check } from 'lucide-react';
import badgesJson from '../../data/badges.json';
import extrasJson from '../../data/extras.json';
import type { BadgesData } from '../../types/badges';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api';

const badges = badgesJson as BadgesData;

export function UserCreate() {
  const [formData, setFormData] = useState({
    username: '',
    password: '', // optional
    badge_name: Object.keys(badges)[0] || '', // ilk rozeti varsayılan seç
    rank_name: '', // rozete göre güncellenecek
    user_flags: '0', // default: 0, değiştirilemez
    extras: [] as string[] // extra rozetler için array
  });

  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Seçilen rozetin rütbelerini al
  useEffect(() => {
    if (formData.badge_name && badges[formData.badge_name]?.ranks.length > 0) {
      setFormData(prev => ({
        ...prev,
        rank_name: badges[formData.badge_name].ranks[0] // ilk rütbeyi seç
      }));
    }
  }, [formData.badge_name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExtraChange = (extra: string) => {
    setSelectedExtras(prev => {
      if (prev.includes(extra)) {
        return prev.filter(item => item !== extra);
      } else {
        return [...prev, extra];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim()) {
      toast.error('Kullanıcı adı gerekli!');
      return;
    }

    if (!formData.badge_name) {
      toast.error('Rozet seçimi gerekli!');
      return;
    }

    try {
      // Rozet indexini bul (0-based index, +1 ekleyerek gönderiyoruz)
      const badgeIndex = Object.keys(badges).findIndex(name => name === formData.badge_name);
      if (badgeIndex === -1) {
        toast.error('Geçersiz rozet seçimi!');
        return;
      }

      // Rütbe indexini bul (0-based index, +1 ekleyerek gönderiyoruz)
      const badge = badges[formData.badge_name];
      const rankIndex = badge.ranks.findIndex(name => name === formData.rank_name);
      
      const payload = {
        username: formData.username,
        password: formData.password.trim() || '&random',
        badge: badgeIndex + 1, // 1-based index
        rank: rankIndex + 1, // 1-based index
        user_flags: '0', // Varsayılan olarak 0
        extras: selectedExtras.map(extra => extrasJson.groups[extra].type)
      };

      await toast.promise(
        apiClient.post('/management/users', payload),
        {
          loading: 'Kullanıcı oluşturuluyor...',
          success: () => {
            // Formu sıfırla
            setFormData({
              username: '',
              password: '',
              badge_name: Object.keys(badges)[0] || '',
              rank_name: badges[Object.keys(badges)[0]]?.ranks[0] || '',
              user_flags: '0'
            });
            return 'Kullanıcı başarıyla oluşturuldu!';
          },
          error: (err) => {
            if (err.response?.status === 404) {
              return 'Habbo\'da böyle bir kullanıcı bulunamadı.';
            }
            if (err.response?.status === 400 && err.response?.data?.error === 'Kullanıcı odada bulunamadı') {
              return 'Kullanıcı JÖH odasında bulunamadı. Lütfen kullanıcının odada olduğundan emin olun.';
            }
            return `Hata: ${err.response?.data?.error || err.message}`;
          }
        }
      );
    } catch (error: any) {
      console.error('Error creating user:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6">
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mr-4">
            <UserPlus className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Yeni Kullanıcı Oluştur</h2>
            <p className="text-sm text-gray-400">Sisteme yeni bir kullanıcı ekle</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <Input
            label="Kullanıcı Adı"
            value={formData.username}
            onChange={handleChange}
            name="username"
            placeholder="Kullanıcı adı girin"
            required
          />

          {/* Password (optional) */}
          <Input
            label="Şifre (Opsiyonel)"
            type="password"
            value={formData.password}
            onChange={handleChange}
            name="password"
            placeholder="Boş bırakılırsa otomatik oluşturulur"
          />

          {/* Badge */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
              Rozet
            </label>
            <select
              name="badge_name"
              value={formData.badge_name}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                paddingRight: '2.5rem'
              }}
            >
              <option value="" disabled>Rozet seçin</option>
              {Object.entries(badges)
                .map(([name, badge]) => (
                  <option key={name} value={name}>
                    {name} {badge.ranks.length > 0 ? `(${badge.ranks.length} rütbe)` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Rank */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
              Rütbe
            </label>
            <select
              name="rank_name"
              value={formData.rank_name}
              onChange={handleChange}
              disabled={!formData.badge_name}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156 163 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                paddingRight: '2.5rem'
              }}
            >
              <option value="" disabled>
                {formData.badge_name ? "Rütbe seçin" : "Önce rozet seçin"}
              </option>
              {formData.badge_name && badges[formData.badge_name]?.ranks.map((rank: string) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          </div>

          {/* Extra Badges */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
              Extra Rozetler
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(extrasJson.groups).map(([name, info]) => (
                <div
                  key={name}
                  onClick={() => handleExtraChange(name)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                    selectedExtras.includes(name)
                      ? 'bg-red-500/20 border-red-500/50 text-white'
                      : 'bg-gray-800/30 border-gray-700/30 text-gray-400 hover:bg-gray-800/50'
                  }`}
                >
                  <span className="text-sm">{name}</span>
                  {selectedExtras.includes(name) && (
                    <Check className="w-4 h-4 text-red-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Permissions Info */}
          <div className="p-4 bg-gray-800/30 border border-gray-700/30 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-300">Kullanıcı Yetkileri</p>
                <p className="text-xs text-gray-400 mt-1">
                  Yeni kullanıcılar varsayılan olarak 0 yetki ile oluşturulur. Yetkileri düzenlemek için kullanıcıyı oluşturduktan sonra "Kullanıcı Düzenle" bölümünü kullanın.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" className="w-full md:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              Kullanıcı Oluştur
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}