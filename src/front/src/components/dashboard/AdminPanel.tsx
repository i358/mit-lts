import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Users, 
  Shield, 
  Clock, 
  Wrench,
  Database,
  FileText,
  Settings,
  Key
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

// Admin modülleri
const adminModules = [
  {
    id: 'users',
    title: 'Kullanıcı Yönetimi',
    icon: Users,
    description: 'Kullanıcı hesaplarını ve yetkilerini yönetin',
    permissions: ['users.MANAGE']
  },
  {
    id: 'time',
    title: 'Süre Yönetimi',
    icon: Clock,
    description: 'Kullanıcı çalışma sürelerini yönetin',
    permissions: ['time.MANAGE'],
  
  },
  {
    id: 'system',
    title: 'Sistem Ayarları',
    icon: Wrench,
    description: 'Genel sistem ayarlarını yapılandırın',
    permissions: ['system.SETTINGS'],
    status: 'soon'
  },
  {
    id: 'database',
    title: 'Veritabanı Yönetimi',
    icon: Database,
    description: 'Veritabanı tablolarını görüntüle ve yönet',
    dbAdminOnly: true
  },
  {
    id: 'logs',
    title: 'Sistem Logları',
    icon: FileText,
    description: 'Sistem log kayıtlarını görüntüleyin',
    permissions: ['system.VIEW_LOGS'],
    status: 'soon'
  },
];

  // Kullanıcının izinlerini kontrol et
export function AdminPanel() {
  const { user, setCurrentPage } = useAppStore();

  const hasPermission = (requiredPerms: string[]) => {
    if (!user?.permissions) return false;
    return requiredPerms.some(perm => {
      const [category, permission] = perm.split('.');
      return user.permissions[category.toLowerCase()]?.[permission];
    });
  };

  const DB_ADMIN_USER_ID = 11111111111;
  const isDbAdmin = user?.id != null && String(user.id) === String(DB_ADMIN_USER_ID);

  const isModuleClickable = (module: (typeof adminModules)[0]) => {
    if ('dbAdminOnly' in module && module.dbAdminOnly) return isDbAdmin;
    return hasPermission(module.permissions || []) && module.status !== 'soon';
  };

  const handleModuleClick = (module: (typeof adminModules)[0]) => {
    if (!isModuleClickable(module)) return;
    if (module.id === 'users') setCurrentPage('admin-users');
    if (module.id === 'time') setCurrentPage('admin-time');
    if (module.id === 'database') setCurrentPage('admin-database');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Yönetim Paneli
          </h1>
          <p className="text-gray-400">
            Sistem yönetimi ve konfigürasyon
          </p>
        </div>
      </div>

      {/* Modüller Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {adminModules.map((module, index) => (
          <motion.div
            key={module.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className={`p-6 transition-all duration-300 ${
                isModuleClickable(module)
                  ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:bg-gray-800/50'
                  : 'cursor-not-allowed opacity-50'
              }`}
              onClick={() => handleModuleClick(module)}
            >
              <div className="w-12 h-12 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mb-4">
                <module.icon className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-bold text-white">{module.title}</h3>
                {module.status && <Badge variant={module.status} className="ml-2" />}
              </div>
              <p className="text-sm text-gray-400">{module.description}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
