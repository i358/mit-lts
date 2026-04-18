export const TIME = {
  VIEW: 0x1,      // 1
  EDIT: 0x2,      // 2
  DELETE: 0x4,    // 4
  RESET: 0x8,     // 8
} as const;

export function hasPermission(permission: number): boolean {
  // Yetkiyi localStorage'dan al
  const userPermissions = localStorage.getItem('permissions');
  if (!userPermissions) return false;

  // Kullanıcının yetkisini sayıya çevir
  const permissionValue = parseInt(userPermissions, 10);
  
  // Bitwise AND operatörü ile yetkiyi kontrol et
  return (permissionValue & permission) === permission;
}
