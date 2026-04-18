import { NavLink } from 'react-router-dom';
import { Clock, Users, Settings, BarChart, Bell } from 'lucide-react';
import { hasPermission } from '../../utils/permissions';
import { TIME } from '../../constants/permissions';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: BarChart,
    permission: null
  },
  {
    name: 'Süre Yönetimi',
    href: '/dashboard/time',
    icon: Clock,
    permission: TIME.VIEW,
    children: [
      {
        name: 'Süreleri Görüntüle',
        href: '/dashboard/time/view',
        permission: TIME.VIEW
      },
      {
        name: 'Süre Sıfırla',
        href: '/dashboard/time/reset',
        permission: TIME.RESET
      }
    ]
  },
  {
    name: 'Kullanıcılar',
    href: '/dashboard/users',
    icon: Users,
    permission: null
  },
  {
    name: 'Duyurular',
    href: '/dashboard/announcements',
    icon: Bell,
    permission: null
  },
  {
    name: 'Ayarlar',
    href: '/dashboard/settings',
    icon: Settings,
    permission: null
  }
];

export function Sidebar() {
  // Get user data from store or session
  let userFlags = 0n;
  try {
    const userStr = localStorage.getItem('mit_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      userFlags = BigInt(user.user_flags || 0);
    }
  } catch (error) {
    console.error('Error parsing user data:', error);
  }

  const ADMIN_FLAG = 1n << 29n;
  const MODERATOR_FLAG = 1n << 30n;
  const isAdminOrModerator = (userFlags & ADMIN_FLAG) === ADMIN_FLAG || (userFlags & MODERATOR_FLAG) === MODERATOR_FLAG;

  return (
    <div className="w-64 min-h-screen bg-gray-800">
      <nav className="mt-5 px-2 space-y-1">
        {navigation.map((item: any) => {
          // Check permission
          if (item.requiresAdminOrModerator && !isAdminOrModerator) {
            return null;
          }

          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }

          return (
            <div key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
                end
              >
                <item.icon
                  className="mr-3 flex-shrink-0 h-6 w-6"
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>

              {/* Alt menü öğeleri */}
              {item.children && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map((child: any) => {
                    // Alt menü öğesi için yetki kontrolü
                    if (child.permission && !hasPermission(child.permission)) {
                      return null;
                    }

                    return (
                      <NavLink
                        key={child.name}
                        to={child.href}
                        className={({ isActive }) =>
                          `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                            isActive
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          }`
                        }
                      >
                        {child.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}