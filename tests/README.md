# 🧪 Database Instance Tests

Bu klasör HabboTOH projesi için PostgreSQL ve Redis database instance'larının kullanım örneklerini ve test senaryolarını içerir.

## 📁 Test Dosyaları

### 1. `postgresInstanceTest.ts`
- PostgreSQL instance'ının tüm fonksiyonlarını test eder
- `getUser()`, `updateUser()`, `createUser()` fonksiyonlarının kullanım örnekleri
- Raw SQL sorguları örnekleri
- Connection pool yönetimi

### 2. `redisInstanceTest.ts`
- Redis instance'ının tüm fonksiyonlarını test eder
- `getUserIndex()`, `setUserIndex()`, `listAllIndexes()` fonksiyonlarının kullanım örnekleri
- Pipeline işlemleri ve performans testleri
- Raw Redis komutları örnekleri

### 3. `databaseIntegrationTest.ts`
- PostgreSQL ve Redis'in birlikte çalışmasını test eder
- Cross-database sorguları
- Transaction benzeri işlemler
- Hata yönetimi senaryoları

### 4. `runDatabaseTests.ts`
- Tüm test senaryolarını koordine eder
- CLI argümanları ile seçici test çalıştırma
- Test süreleri ve raporlama

## 🚀 Test Çalıştırma

### Tüm Testler
```bash
npm run test:db
# veya
npm run test
```

### Sadece PostgreSQL Testleri
```bash
npm run test:postgres
```

### Sadece Redis Testleri
```bash
npm run test:redis
```

### Sadece Entegrasyon Testleri
```bash
npm run test:integration
```

### Manual Test Çalıştırma
```bash
# Derle
npm run build

# Tek bir test dosyası çalıştır
node dist/tests/postgresInstanceTest.js
node dist/tests/redisInstanceTest.js
node dist/tests/databaseIntegrationTest.js
```

## ⚙️ Gereksinimler

### 1. Docker Containers
Database testleri çalıştırmadan önce Docker container'larının çalışıyor olması gerekir:

```bash
docker compose up -d
```

### 2. Environment Variables
`.env` dosyasında database credentials'ların tanımlı olması gerekir:

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=habbo_toh
POSTGRES_USERNAME=habbo_user
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DATABASE=0
```

### 3. Database Schema
PostgreSQL container'ında temel `users` tablosunun bulunması gerekir:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 Test Kapsamı

### PostgreSQL Tests
- ✅ Connection pool initialization
- ✅ User CRUD operations
- ✅ Parameterized queries
- ✅ Transaction handling
- ✅ Error handling
- ✅ Connection cleanup

### Redis Tests
- ✅ Client initialization
- ✅ Key-value operations
- ✅ Hash operations
- ✅ List operations
- ✅ Pipeline performance
- ✅ Pattern-based key search
- ✅ Memory usage info

### Integration Tests
- ✅ Cross-database operations
- ✅ Data consistency
- ✅ Performance comparison
- ✅ Error recovery
- ✅ Health monitoring

## 🐛 Troubleshooting

### Docker Connection Issues
```bash
# Container'ları restart et
docker compose down
docker compose up -d

# Logs kontrol et
docker compose logs postgres
docker compose logs rediss
```

### TypeScript Compilation Errors
```bash
# Clean build
npm run clean
npm run build
```

### Database Connection Errors
1. `.env` dosyasındaki credentials'ları kontrol et
2. Docker container'larının çalıştığını doğrula
3. Network bağlantısını test et

### Permission Errors
```bash
# PostgreSQL kullanıcı izinlerini kontrol et
docker exec -it postgres psql -U habbo_user -d habbo_toh
```

## 📈 Test Metrikleri

Testler şu metrikleri ölçer:
- Database connection time
- Query execution time
- Memory usage
- Error rates
- Transaction success rates

## 🔧 Özelleştirme

Test senaryolarını özelleştirmek için:

1. `tests/` klasöründeki ilgili dosyayı düzenle
2. Yeni test fonksiyonları ekle
3. `runDatabaseTests.ts` dosyasına yeni test suite'leri dahil et
4. Package.json'a yeni script'ler ekle

## 📝 Örnek Kullanım

```typescript
import { 
    initializeDatabases, 
    getUser, 
    setUserIndex 
} from '../src/db_utilities';

async function example() {
    await initializeDatabases();
    
    // PostgreSQL kullanımı
    const user = await getUser({
        in: 'username',
        value: 'john_doe',
        out: 'all'
    });
    
    // Redis kullanımı
    await setUserIndex(user.id, 'room_123_index_5');
    
    await closeDatabases();
}
```
