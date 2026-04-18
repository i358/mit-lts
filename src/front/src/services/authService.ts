interface LocalUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  password: string;
  habboUsername: string;
  rank: string;
  badge: string;
  workTime: number;
  salary: number;
  avatar?: string;
  joinDate: string;
  lastPromotion?: string;
  isActive: boolean;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  habboUsername: string;
}

class LocalAuthService {
  private readonly USERS_KEY = 'mit_users';
  private readonly CURRENT_USER_KEY = 'mit_current_user';
  private readonly TOKEN_KEY = 'mit_token';

  // Varsayılan kullanıcıları oluştur
  private initializeDefaultUsers() {
    const existingUsers = this.getUsers();
    if (existingUsers.length === 0) {
      const defaultUsers: LocalUser[] = [];
      
      localStorage.setItem(this.USERS_KEY, JSON.stringify(defaultUsers));
    }
  }

  private getUsers(): LocalUser[] {
    try {
      const users = localStorage.getItem(this.USERS_KEY);
      return users ? JSON.parse(users) : [];
    } catch {
      return [];
    }
  }

  private saveUsers(users: LocalUser[]) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async login(credentials: LoginCredentials): Promise<LocalUser> {
    this.initializeDefaultUsers();
    
    const users = this.getUsers();
    const user = users.find(u => 
      u.username.toLowerCase() === credentials.username.toLowerCase() && 
      u.password === credentials.password
    );

    if (!user) {
      throw new Error('Kullanıcı adı veya şifre hatalı!');
    }

    if (!user.isActive) {
      throw new Error('Hesabınız deaktif durumda!');
    }

    // Token oluştur ve kaydet
    const token = this.generateToken();
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));

    return user;
  }

  async register(data: RegisterData): Promise<LocalUser> {
    this.initializeDefaultUsers();
    
    const users = this.getUsers();
    
    // Kullanıcı adı kontrolü
    if (users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor!');
    }

    // Email kontrolü
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('Bu email adresi zaten kullanılıyor!');
    }

    // Habbo kullanıcı adı kontrolü
    if (users.some(u => u.habboUsername.toLowerCase() === data.habboUsername.toLowerCase())) {
      throw new Error('Bu Habbo kullanıcı adı zaten kayıtlı!');
    }

    const newUser: LocalUser = {
      id: Date.now().toString(),
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      habboUsername: data.habboUsername,
      rank: 'Stajyer',
      badge: 'memurlar',
      workTime: 0,
      salary: 0,
      avatar: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000)}?w=300&h=300&fit=crop&crop=face`,
      joinDate: new Date().toISOString(),
      isActive: true
    };

    users.push(newUser);
    this.saveUsers(users);

    return newUser;
  }

  getCurrentUser(): LocalUser | null {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!token) return null;

      const userStr = localStorage.getItem(this.CURRENT_USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  async getUserInfo(username: string): Promise<any> {
    this.initializeDefaultUsers();
    
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) {
      throw new Error('Kullanıcı bulunamadı!');
    }

    // Eğitim durumunu belirle (test için sabit)
    const educationStatus: Record<string, boolean> = {
      'admin': true,        // Eğitimi var
      'test': false,        // Eğitimi yok
      'mehmet123': false,   // Eğitimi yok
      'ayse456': true,      // Eğitimi var
      'ali789': true,       // Eğitimi var
      'fatma321': false,    // Eğitimi yok
      'emre999': false,     // Eğitimi yok
      'zeynep555': false,   // Eğitimi yok
      'can777': false,      // Eğitimi yok
      'selin444': false     // Eğitimi yok
    };

    // Terfi hesaplaması için gerekli bilgileri döndür
    const requiredTime = this.getRequiredTimeForPromotion(user.badge, user.rank);
    const canPromote = user.workTime >= requiredTime;
    const nextRank = this.getNextRank(user.badge, user.rank);

    return {
      username: user.username,
      currentRank: user.rank,
      nextRank: nextRank,
      workTime: user.workTime,
      workHours: user.workTime / 60, // Dakikayı saate çevir (ondalıklı)
      badge: user.badge,
      canPromote: canPromote,
      requiredTime: requiredTime,
      salaryRating: Math.floor(user.workTime / 480), // Her 8 saatte 1 rozet
      totalSalaryRating: user.salary,
      hasEducation: educationStatus[user.username.toLowerCase()] || false
    };
  }

  private getRequiredTimeForPromotion(badge: string, rank: string): number {
    // Basit bir hesaplama - gerçek sistemde daha karmaşık olabilir
    const baseTimes: Record<string, number> = {
      memurlar: 25,
      guvenlik: 30,
      egitmen: 60,
      icisleri: 90,
      yuksek: 120,
      diplomat: 140,
      operasyon: 160,
      disisleri: 200,
      yonetim: 240,
      roomctrl: 260,
      liderler: 300,
      udy: 340,
      mudurler: 380,
      kumandan: 420,
      albay: 460,
      basbakan: 500,
      istihbarat: 560,
      cumhurbaskani: 1440
    };

    return baseTimes[badge] || 25;
  }

  private getNextRank(badge: string, currentRank: string): string {
    const rankLists: Record<string, string[]> = {
      memurlar: ["Stajyer", "Memur I", "Memur II", "Memur III", "Memur IV", "Memur V", "Kıdemli Memur", "Uzman Memur"],
      guvenlik: ["Güvenlik Memuru I", "Güvenlik Memuru II", "Güvenlik Memuru III", "Güvenlik Danışmanı I", "Güvenlik Danışmanı II", "Güvenlik Danışmanı III", "Güvenlik Şefi"],
      egitmen: ["Eğitmen I", "Eğitmen II", "Eğitmen III", "Kıdemli Eğitmen", "Eğitim Şefi", "Eğitim Generali", "Eğitim Koordinatörü", "Yönetici Eğitmen", "Eğitim Müdürü", "Eğitim Başkanı Asst.", "Eğitim Başkanı"]
    };

    const ranks = rankLists[badge] || rankLists.memurlar;
    const currentIndex = ranks.indexOf(currentRank);
    
    if (currentIndex >= 0 && currentIndex < ranks.length - 1) {
      return ranks[currentIndex + 1];
    }
    
    return currentRank; // Son rütbe
  }

  async getArchive(type: 'mr' | 'badge', date?: string): Promise<any[]> {
    // Mock arşiv verisi
    const mockArchive = [
      {
        username: 'kullanici1',
        details: type === 'mr' ? 'Maaş Rozeti: 5' : 'Rozet: Memurlar',
        date: date || new Date().toLocaleDateString('tr-TR')
      },
      {
        username: 'kullanici2',
        details: type === 'mr' ? 'Maaş Rozeti: 3' : 'Rozet: Güvenlik',
        date: date || new Date().toLocaleDateString('tr-TR')
      },
      {
        username: 'kullanici3',
        details: type === 'mr' ? 'Maaş Rozeti: 8' : 'Rozet: Eğitmen',
        date: date || new Date().toLocaleDateString('tr-TR')
      }
    ];

    return mockArchive;
  }

  // Kullanıcı çalışma süresini güncelle (test için)
  updateUserWorkTime(username: string, additionalMinutes: number) {
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (userIndex >= 0) {
      users[userIndex].workTime += additionalMinutes;
      this.saveUsers(users);
      
      // Eğer mevcut kullanıcıysa, current user'ı da güncelle
      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.username.toLowerCase() === username.toLowerCase()) {
        currentUser.workTime += additionalMinutes;
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(currentUser));
      }
    }
  }
}

export const localAuthService = new LocalAuthService();