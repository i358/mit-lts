# MIT-LTS Management System 🚀

**Repository**: [i358/mit-lts](https://github.com/i358/mit-lts)

Modern TypeScript tabanlı **full-stack yönetim sistemi** ile kullanıcı yönetimi, rozet sistemi, zaman takibi, Discord bot entegrasyonu ve daha fazlasını destekler. React frontend, GraphQL/REST API, PostgreSQL/Redis veritabanları ile güvenli ve ölçeklenebilir bir çözümdür.

## 📋 İçindekiler

- [Özellikler](#özellikler)
- [Teknoloji Stack](#teknoloji-stack)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Kurulum Adımları](#kurulum-adımları)
- [Docker ile Kurulum](#docker-ile-kurulum)
- [Konfigürasyon](#konfigürasyon)
- [Proje Yapısı](#proje-yapısı)
- [NPM Komutları](#npm-komutları)
- [API Endpoints](#api-endpoints)
- [Discord Bot](#discord-bot)
- [Testler](#testler)
- [Güvenlik](#güvenlik)
- [Lisans](#lisans)

## ✨ Özellikler

- **👥 Kullanıcı Yönetimi** - Kayıt, giriş, profil yönetimi, yetki sistemi
- **🎖️ Badge Sistemi** - Rozet atama, yönetim ve görüntüleme
- **⏱️ Zaman Takibi** - Çalışma süresi takibi, eğitim yönetimi, zaman raporları
- **📢 Duyuru Sistemi** - Admin/moderator duyuru yayınlama, filtreleme
- **🚫 Ban Sistemi** - Kullanıcı yasaklama ve ceza yönetimi
- **📦 Arşiv Sistemi** - Veri arşivleme ve geri yükleme
- **🎮 Mini Oyunlar** - Wordle, Chess.js entegrasyonu
- **🔐 OAuth** - Harici kimlik doğrulama desteği
- **🔄 Real-time** - WebSocket tabanlı canlı güncellemeler
- **🤖 Discord Bot** - 40+ komut, etkileşimler, otomatik bildirimler
- **📊 GraphQL API** - Flexible veri sorgulama, subscription'lar
- **🌐 REST API** - Standart HTTP endpoint'leri, v1 versiyonu
- **🛡️ Güvenlik** - JWT, rate limiting, CORS, bitflags permission sistemi

## 🛠 Teknoloji Stack

### Backend
- **Runtime**: Node.js + TypeScript 5
- **Framework**: Fastify 5.x
- **GraphQL**: Apollo Server 4.x
- **Databases**: PostgreSQL 12+, Redis 6+ (ioredis 5.x)
- **Discord**: discord.js v14
- **WebSocket**: ws 8.x
- **Utilities**: Canvas, Chess.js, Axios, Moment.js, js-yaml

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **UI**: Material-UI 5, TailwindCSS 3
- **State**: Zustand
- **Routing**: React Router v6
- **GraphQL**: Apollo Client 3
- **Icons**: Lucide React, React Icons, Heroicons
- **Extras**: html2canvas, Framer Motion

### DevOps
- **Containers**: Docker + Docker Compose
- **Proxy**: Nginx
- **Development**: Nodemon, TypeScript CLI
- **Config**: YAML-based, environment variables

## 🚀 Hızlı Başlangıç

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Environment yapılandırması
cp .env.example .env

# 3. Derle ve geliştirme sunucusu başlat
npm run dev

# (Opsiyonel) Production build
npm run build && npm start
```

**Sonuç**: API `http://localhost:8000` ve frontend `http://localhost:5173` adreslerinde çalışacaktır.

## 🔧 Kurulum Adımları

### Sistem Gereksinimleri

- **Node.js**: v18 veya üzeri
- **npm**: v9 veya üzeri
- **PostgreSQL**: v12+ (Docker ile kurulabilir)
- **Redis**: v6+ (Docker ile kurulabilir)
- **Docker & Docker Compose**: (opsiyonel)

### Backend Kurulumu

```bash
# Proje kökünde
npm install

# TypeScript izleme modunda derle
npm run dev

# Uygulamayı başlat (port 8000)
npm start

# Detaylı log ile başlat
npm run start-verbose

# Proje temizle
npm run clean
```

### Frontend Kurulumu

```bash
cd src/front
npm install
npm run dev    # Geliştirme sunucusu
npm run build  # Production build
```

### Veritabanı Kurulumu

```bash
# PostgreSQL testi
npm run test:postgres

# Redis testi
npm run test:redis

# Tüm veritabanı testleri
npm run test:db

# Bitflags göçü
npm run migrate:bitflags
```

## 🐳 Docker ile Kurulum

### Docker Compose ile Başlatma

```bash
# Tüm servisleri başlat (PostgreSQL + Redis)
docker-compose up -d

# Durumu kontrol et
docker-compose ps

# Logları görüntüle
docker-compose logs -f

# Hizmetleri durdur
docker-compose down

# Hizmetleri ve verileri tamamen sil
docker-compose down -v
```

### Docker Compose Servisleri

| Servis | Port | Açıklama |
|--------|------|----------|
| postgres | 5432 | PostgreSQL 16 Alpine |
| redis | 6379 | Redis 7.2 Alpine |

⚠️ **Uyarı**: `docker-compose.yml` dosyasındaki varsayılan şifreleri production ortamında değiştirin.

## ⚙️ Konfigürasyon

### Config Dosyası

```bash
# Config dosyasını oluştur
cp src/config.yaml.example src/config.yaml
```

### Config Dosyası Örneği

```yaml
app:
  INITIALIZED: true
  ENVIRONMENT: development  # development | production | test
  PRODUCTION_NAME: MIT
  MAIN_ROOM_ID: YOUR_MAIN_ROOM_ID
  LOG_LEVEL: debug  # error | warn | info | debug | verbose
  
  SPOTTER:
    ID: YOUR_SPOTTER_ID
  
  DISCORD_BOT:
    ACTIVE: true
    GUILD_ID: "YOUR_DISCORD_GUILD_ID"
    CLIENT_ID: "YOUR_DISCORD_CLIENT_ID"
    CHANNELS:
      LOGS: "YOUR_DISCORD_LOGS_CHANNEL_ID"
      EVENTS: "YOUR_DISCORD_EVENTS_CHANNEL_ID"
      COMMANDS: "YOUR_DISCORD_COMMANDS_CHANNEL_ID"
    ADMINS:
      - "YOUR_DISCORD_ADMIN_USER_ID"

api:
  ACTIVE: true
  HOST: 0.0.0.0
  PORT: 8000
  CORS_CONFIG:
    origin:
      - https://yourdomain.com
      - https://www.yourdomain.com
    credentials: true
  GRAPHQL:
    ENABLED: true
    PLAYGROUND: true  # Development için, production'da false yapın
```

### Environment Variables

`.env` dosyasında tanımlanır:

```env
# Veritabanı
DATABASE_URL=postgresql://username:password@localhost:5432/mit_lts_db
REDIS_URL=redis://localhost:6379

# Discord Bot Token
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here
```

## 📁 Proje Yapısı

```
mit-lts/
├── src/
│   ├── api/                    # Backend API
│   │   ├── graphql/           # GraphQL schema & resolvers
│   │   ├── routes/            # REST API routes (v1)
│   │   ├── utils/             # Auth, middleware, utilities
│   │   ├── schema/            # GraphQL types
│   │   ├── constants/         # API constants
│   │   └── ws/                # WebSocket endpoints
│   ├── bot/                    # Discord Bot
│   │   ├── commands/          # Bot commands (admin, app, fun, info, util)
│   │   ├── interactions/      # Interactions handler
│   │   └── utils/             # Bot utilities
│   ├── db_utilities/          # Database utilities
│   │   ├── postgres.ts        # PostgreSQL operations
│   │   ├── redis.ts           # Redis operations
│   │   ├── announcements.ts   # Duyuru sistemi
│   │   ├── badge_util.ts      # Badge utilities
│   │   ├── ban.ts             # Ban sistemi
│   │   ├── user_management.ts # Kullanıcı yönetimi
│   │   ├── time_management.ts # Zaman takibi
│   │   └── oauth.ts           # OAuth utilities
│   ├── front/                 # React Frontend
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── pages/         # Page components
│   │   │   ├── services/      # API services
│   │   │   ├── store/         # Zustand store
│   │   │   └── utils/         # Utilities
│   │   └── public/            # Static assets
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Shared utilities
│   │   ├── configChecker.ts   # Config checker
│   │   └── globalStore.ts     # Global state store
│   ├── logger.ts              # Logger system
│   ├── config.ts              # Config loader
│   ├── config.yaml            # Configuration file
│   └── run.ts                 # Application entry point
├── tests/                     # Test files
├── cache/                     # Cache data
├── logs/                      # Log files
├── docs/                      # Documentation
├── nginx/                     # Nginx configuration
├── scripts/                   # Utility scripts
├── docker-compose.yml         # Docker compose config
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript config
```

## 📦 NPM Komutları

### Derleme & Çalıştırma

| Komut | Açıklama |
|-------|----------|
| `npm install` | Bağımlılıkları yükle |
| `npm run build` | TypeScript'i derle |
| `npm run dev` | İzleme modunda derle |
| `npm run clean` | Derleme çıktısını sil |
| `npm start` | Uygulamayı başlat |
| `npm run start-verbose` | Detaylı log ile başlat |

### Test Komutları

| Komut | Açıklama |
|-------|----------|
| `npm test` | Tüm testleri çalıştır |
| `npm run test:db` | Veritabanı testleri |
| `npm run test:postgres` | PostgreSQL testleri |
| `npm run test:redis` | Redis testleri |
| `npm run test:integration` | Integration testleri |
| `npm run test:bitflags` | Bitflags testleri |
| `npm run migrate:bitflags` | Bitflags göçü |

## 📊 API Endpoints

### Authentication
```
POST   /api/v1/auth/login       - Kullanıcı girişi
POST   /api/v1/auth/refresh     - Token yenileme
POST   /api/v1/auth/logout      - Çıkış
```

### Users
```
POST   /api/v1/users/new        - Yeni kullanıcı oluştur
GET    /api/v1/users/:id        - Kullanıcı bilgisi
GET    /api/v1/user             - Mevcut kullanıcı
PUT    /api/v1/user             - Kullanıcı güncelle
```

### Management
```
GET    /api/v1/management/users     - Tüm kullanıcılar
POST   /api/v1/management/users     - Kullanıcı oluştur
PUT    /api/v1/management/users/:id - Kullanıcı güncelle
DELETE /api/v1/management/users/:id - Kullanıcı sil
```

### Badges
```
GET    /api/v1/badge           - Badge listesi
POST   /api/v1/badge           - Badge ata
DELETE /api/v1/badge           - Badge kaldır
```

### Time Management
```
GET    /api/v1/time            - Zaman kayıtları
POST   /api/v1/time            - Zaman kaydı ekle
PUT    /api/v1/time/:id        - Zaman kaydı güncelle
```

### Announcements
```
GET    /api/v1/announcements        - Duyuru listesi
POST   /api/v1/announcements        - Duyuru oluştur (Admin/Moderator)
PUT    /api/v1/announcements/:id    - Duyuru güncelle
DELETE /api/v1/announcements/:id    - Duyuru sil
```

### Other
```
GET    /api/v1/health          - Health check
POST   /api/v1/verify          - Kullanıcı doğrulama
POST   /api/v1/wordle          - Wordle oyunu
POST   /api/v1/bug-report      - Bug raporu
```

### GraphQL
```
POST   /graphql                - GraphQL endpoint
GET    /graphql/playground     - GraphQL Playground (development)
```

### WebSocket
```
WS     /ws/chat-wire           - Genel chat
WS     /ws/high-rank-chat      - Yüksek rütbe chat
WS     /ws/site-activity       - Site aktivite
```

## 🤖 Discord Bot

### Bot Komutları

#### Admin Komutları
- `/config` - Konfigürasyon yönetimi
- `/create-root-user` - Root kullanıcı oluşturma
- `/dbcheck` - Veritabanı kontrolü
- `/reload` - Config yeniden yükleme
- `/timer` - Zamanlayıcı

#### Uygulama Komutları
- `/badge` - Badge yönetimi
- `/time` - Zaman takibi
- `/user` - Kullanıcı bilgisi
- `/users` - Kullanıcı listesi
- `/announcements` - Duyuru yönetimi

#### Eğlence Komutları
- `/wordchain` - Kelime zinciri
- `/reaction` - Reaksiyon oyunu

#### Bilgi Komutları
- `/botinfo` - Bot bilgisi
- `/help` - Yardım

#### Yardımcı Komutlar
- `/link` - Hesap bağlama
- `/unlink` - Bağlantı kaldırma
- `/ping` - Ping testi
- `/code` - Kod paylaşımı

### Bot Özellikleri

- 40+ komut
- Otomatik komut yükleme
- Event handler sistemi
- Autocomplete desteği
- Embed mesajlar
- Discord webhook entegrasyonu
- Otomatik log kanallarına bildirim
- Permission sistemi

## 🧪 Testler

### Test Dosyaları

```
tests/
├── runDatabaseTests.js        - Veritabanı testleri
├── bitflagsTest.js           - Bitflags testleri
├── basicFeaturesTest.ts      - Temel özellikler
├── configCheckerTest.ts      - Config checker testleri
├── databaseIntegrationTest.ts - Integration testleri
├── globalStoreTest.ts        - Global store testleri
└── postgresInstanceTest.ts   - PostgreSQL testleri
```

### Test Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# Spesifik test dosyasını çalıştır
npm run test:postgres
npm run test:redis
npm run test:integration
```

## 🔒 Güvenlik

### Güvenlik Özellikleri

- **JWT Authentication** - Token tabanlı kimlik doğrulama
- **Rate Limiting** - İstek sınırlama (100 istek/dakika)
- **CORS** - Cross-origin resource sharing
- **Permission System** - Bitflags tabanlı yetki sistemi
- **Ban System** - Kullanıcı yasaklama sistemi
- **Input Validation** - Girdi doğrulama
- **SQL Injection Protection** - SQL injection koruması
- **XSS Protection** - XSS koruması
- **Helmet.js** - HTTP header güvenliği

### Güvenlik Dokümantasyonu

Detaylı bilgiler için:
- [docs/SECURITY_FIXES.md](docs/SECURITY_FIXES.md) - Güvenlik düzeltmeleri
- [docs/SECURITY_USAGE.md](docs/SECURITY_USAGE.md) - Güvenlik kullanımı
- [docs/API_ROUTES_PENTEST.md](docs/API_ROUTES_PENTEST.md) - API güvenlik testleri
- [docs/ANNOUNCEMENTS_SYSTEM.md](docs/ANNOUNCEMENTS_SYSTEM.md) - Duyuru sistemi

## 🤝 Katkıda Bulunma

1. Repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📝 Commit İlkeleri

- `feat:` - Yeni özellik
- `fix:` - Hata düzeltme
- `docs:` - Dokümantasyon
- `style:` - Kod stili
- `refactor:` - Kod yeniden yapılandırma
- `test:` - Test ekleme/güncellemesi
- `chore:` - Proje konfigürasyonu

## 📄 Lisans

**MIT License** - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

```
Copyright (c) 2024-2026 i358

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## 🔗 Linkler

- [GitHub Repository](https://github.com/i358/mit-lts)
- [Issues](https://github.com/i358/mit-lts/issues)
- [Discussions](https://github.com/i358/mit-lts/discussions)

## 📧 İletişim

**Geliştirici**: [i358](https://github.com/i358)  
**GitHub**: [@i358](https://github.com/i358)  
**Daha fazla bilgi**: GitHub repository'deki Issues ve Discussions kanallarını kullanın

---

**Proje**: MIT-LTS Management System  
**Versiyon**: 1.0.0  
**Son Güncelleme**: Nisan 2026  
**Durumu**: 🟢 Active Development

⭐ Eğer projeyi beğendiyseniz, lütfen bir yıldız verin!
