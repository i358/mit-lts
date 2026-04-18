// Test için kullanıcı çalışma süresini artırma fonksiyonu
import { localAuthService } from '../services/authService';

export function addWorkTimeToUser(username: string, minutes: number) {
  localAuthService.updateUserWorkTime(username, minutes);
}

// Test kullanıcıları için hızlı çalışma süresi ekleme
export function setupTestData() {
  // Test kullanıcısına terfi için yeterli süre ekle
  addWorkTimeToUser('test', 30);
  
  // Admin kullanıcısına daha fazla süre ekle
  addWorkTimeToUser('admin', 500);
  
  // Diğer test kullanıcılarına da süre ekle
  addWorkTimeToUser('mehmet123', 25);
  addWorkTimeToUser('ayse456', 35);
  addWorkTimeToUser('ali789', 65);
  addWorkTimeToUser('fatma321', 30);
}