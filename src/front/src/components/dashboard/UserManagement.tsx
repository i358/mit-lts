import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Users,
  UserPlus,
  UserMinus,
  UserCog,
  Ban,
  ListFilter,
  Search,
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { UserList } from './UserList';
import { UserEdit } from './UserEdit';
import { UserCreate } from './UserCreate';
import { UserBan } from './UserBan';
import { UserDelete } from './UserDelete';

// User management modülleri
const userModules = [
  {
    id: 'list',
    title: 'Kullanıcıları Listele',
    icon: ListFilter,
    description: 'Tüm kullanıcıları görüntüle ve filtrele',
    permissions: ['users.LIST'],
    status: 'active'
  },
  {
    id: 'create',
    title: 'Kullanıcı Oluştur',
    icon: UserPlus,
    description: 'Yeni kullanıcı hesabı oluştur',
    permissions: ['users.CREATE'],
    status: 'active'
  },
  {
    id: 'edit',
    title: 'Kullanıcı Düzenle',
    icon: UserCog,
    description: 'Kullanıcı bilgilerini güncelle',
    permissions: ['users.UPDATE'],
    status: 'active'
  },
  {
    id: 'delete',
    title: 'Kullanıcı Sil',
    icon: UserMinus,
    description: 'Kullanıcı hesabını kaldır',
    permissions: ['users.DELETE'],
    status: 'active'
  },
  {
    id: 'ban',
    title: 'Kullanıcı Yasakla',
    icon: Ban,
    description: 'Kullanıcıyı sistemden yasakla',
    permissions: ['users.BAN'],
    status: 'active'
  }
];

export function UserManagement() {
  const { user } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // İzin kontrolü
  const hasPermission = (requiredPerms: string[]) => {
    if (!user?.permissions) return false;
    
    return requiredPerms.some(perm => {
      const [category, action] = perm.split('.');
      return user.permissions?.[category.toLowerCase() as keyof typeof user.permissions]?.[action as any];
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
            <Users className="w-6 h-6 mr-2" />
            Kullanıcı Yönetimi
          </h1>
          <p className="text-gray-400">
            Sistem kullanıcılarını yönetin
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex space-x-4">
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
          <Button onClick={() => console.log('Search:', searchTerm)}>
            Ara
          </Button>
        </div>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userModules.map((module, index) => {
          const hasAccess = hasPermission(module.permissions);
          // Nothing here
          
          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`p-6 transition-all duration-300 ${
                  hasAccess && module.status !== 'soon'
                    ? `cursor-pointer hover:shadow-xl hover:scale-[1.02] ${
                        module.id === activeModule
                          ? 'bg-gray-800/50 border-green-500/50' 
                          : 'hover:bg-gray-800/50'
                      }`
                    : 'cursor-not-allowed opacity-50'
                }`}
                onClick={() => {
                  if (hasAccess && module.status !== 'soon') {
                    setActiveModule(module.id);
                  }
                }}
              >
                <div className="w-12 h-12 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mb-4">
                  <module.icon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{module.title}</h3>
                <p className="text-sm text-gray-400">{module.description}</p>
                
                {/* Soon & Access badges */}
                <div className="mt-4 flex items-center space-x-2">
                  {!hasAccess && (
                    <div className="flex items-center text-yellow-500 text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Yetkiniz yok
                    </div>
                  )}
                  {module.status === 'soon' && (
                    <Badge variant="soon" className="ml-auto">
                      Yakında
                    </Badge>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Content Area */}
      {activeModule ? (
        activeModule === 'list' ? (
          hasPermission(['users.LIST']) ? (
            <UserList />
          ) : (
            <Card className="p-6">
              <div className="text-center text-gray-400 py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p>Bu alanı görüntülemek için yetkiniz yok</p>
              </div>
            </Card>
          )
        ) : activeModule === 'edit' ? (
          hasPermission(['users.UPDATE']) ? (
            <UserEdit />
          ) : (
            <Card className="p-6">
              <div className="text-center text-gray-400 py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p>Bu alanı görüntülemek için yetkiniz yok</p>
              </div>
            </Card>
          )
        ) : activeModule === 'create' ? (
          hasPermission(['users.CREATE']) ? (
            <UserCreate />
          ) : (
            <Card className="p-6">
              <div className="text-center text-gray-400 py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p>Bu alanı görüntülemek için yetkiniz yok</p>
              </div>
            </Card>
          )
        ) : activeModule === 'ban' ? (
          hasPermission(['users.BAN']) ? (
            <UserBan />
          ) : (
            <Card className="p-6">
              <div className="text-center text-gray-400 py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p>Bu alanı görüntülemek için yetkiniz yok</p>
              </div>
            </Card>
          )
        ) : activeModule === 'delete' ? (
          hasPermission(['users.DELETE']) ? (
            <UserDelete />
          ) : (
            <Card className="p-6">
              <div className="text-center text-gray-400 py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p>Bu alanı görüntülemek için yetkiniz yok</p>
              </div>
            </Card>
          )
        ) : (
          <Card className="p-6">
            <div className="text-center text-gray-400 py-8">
              <ListFilter className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p>Bu modül henüz aktif değil</p>
            </div>
          </Card>
        )
      ) : (
        <Card className="p-6">
          <div className="text-center text-gray-400 py-8">
            <ListFilter className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p>Bir seçenek seçin.</p>
          </div>
        </Card>
      )}
    </div>
  );
}