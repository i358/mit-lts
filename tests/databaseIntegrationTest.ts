/**
 * Database Integration Test
 * PostgreSQL ve Redis'in birlikte çalışmasını test eder
 */

import { 
    initializeDatabases, 
    closeDatabases, 
    checkDatabaseHealth,
    getUser, 
    createUser,
    getUserIndex, 
    setUserIndex,
    getPostgresInstance,
    getRedisInstance
} from '../src/db_utilities';

async function testDatabaseIntegration() {
    console.log('🔗 Database Integration Test Starting...\n');

    try {
        // 1. Database bağlantılarını başlat ve durumu kontrol et
        console.log('1️⃣ Initializing and checking database health...');
        await initializeDatabases();
        
        const health = await checkDatabaseHealth();
        console.log('✅ Database health check:', health);
        
        if (!health.overall) {
            throw new Error('Database health check failed!');
        }
        console.log();

        // 2. PostgreSQL'de kullanıcı oluştur
        console.log('2️⃣ Creating user in PostgreSQL...');
        const userData = {
            username: 'integration_test_user_' + Date.now(),
            figure: 'integration_figure',
            motto: 'Integration test motto',
            look: 'integration_look',
            last_seen: new Date()
        };

        const userId = await createUser({ data: userData });
        console.log('✅ User created in PostgreSQL with ID:', userId);
        console.log();

        if (!userId) {
            throw new Error('User creation failed!');
        }

        // 3. Redis'te aynı kullanıcı için index kaydet
        console.log('3️⃣ Setting user index in Redis...');
        const userIndex = `room_12345_index_${Math.floor(Math.random() * 100)}`;
        const redisResult = await setUserIndex(userId.toString(), userIndex);
        console.log('✅ User index set in Redis:', userIndex, '- Result:', redisResult);
        console.log();

        // 4. Her iki veritabanından da veri çek
        console.log('4️⃣ Retrieving data from both databases...');
        
        // PostgreSQL'den kullanıcı bilgileri
        const userFromPG = await getUser({
            in: 'id',
            value: userId,
            out: 'all'
        });
        console.log('✅ User from PostgreSQL:', userFromPG);

        // Redis'ten index bilgisi
        const indexFromRedis = await getUserIndex(userId.toString());
        console.log('✅ Index from Redis:', indexFromRedis);
        console.log();

        // 5. Cross-database sorgu örneği
        console.log('5️⃣ Cross-database query example...');
        
        // PostgreSQL'den tüm aktif kullanıcıları al (örnek sorgu)
        const postgres = getPostgresInstance();
        const activeUsers = await postgres.query(
            'SELECT id, username FROM stack WHERE last_seen > $1 LIMIT 5',
            [new Date(Date.now() - 24 * 60 * 60 * 1000)] // Son 24 saat
        );
        
        console.log(`✅ Found ${activeUsers.rows.length} active users from PostgreSQL`);

        // Her kullanıcı için Redis'ten index bilgilerini al
        const redis = getRedisInstance();
        for (const user of activeUsers.rows) {
            const index = await redis.get(`user_index:${user.id}`);
            console.log(`   User ${user.username} (ID: ${user.id}) - Index: ${index || 'Not set'}`);
        }
        console.log();

        // 6. Transaction örneği (PostgreSQL + Redis)
        console.log('6️⃣ Testing transaction-like operations...');
        
        const transactionTestUser = {
            username: 'transaction_test_' + Date.now(),
            figure: 'transaction_figure'
        };

        try {
            // PostgreSQL transaction başlat
            const client = await postgres.connect();
            await client.query('BEGIN');

            // Kullanıcı ekle
            const insertResult = await client.query(
                'INSERT INTO stack (username, figure) VALUES ($1, $2) RETURNING id',
                [transactionTestUser.username, transactionTestUser.figure]
            );
            const newUserId = insertResult.rows[0]?.id;

            if (!newUserId) {
                throw new Error('User insertion failed');
            }

            // Redis'e index ekle
            const redisSet = await redis.set(`user_index:${newUserId}`, `transaction_index_${newUserId}`);
            
            if (redisSet !== 'OK') {
                throw new Error('Redis operation failed');
            }

            // Her şey başarılıysa commit
            await client.query('COMMIT');
            client.release();

            console.log('✅ Transaction completed successfully for user ID:', newUserId);

        } catch (transactionError) {
            console.error('❌ Transaction failed:', transactionError);
        }
        console.log();

        // 7. Performans karşılaştırması
        console.log('7️⃣ Performance comparison...');
        
        // PostgreSQL sorgu performansı
        const pgStartTime = Date.now();
        await postgres.query('SELECT COUNT(*) FROM stack');
        const pgTime = Date.now() - pgStartTime;

        // Redis sorgu performansı
        const redisStartTime = Date.now();
        await redis.dbsize();
        const redisTime = Date.now() - redisStartTime;

        console.log(`✅ PostgreSQL query time: ${pgTime}ms`);
        console.log(`✅ Redis query time: ${redisTime}ms`);
        console.log(`✅ Speed difference: ${pgTime > redisTime ? 'Redis' : 'PostgreSQL'} is faster`);

    } catch (error) {
        console.error('❌ Database integration test failed:', error);
    } finally {
        // 8. Bağlantıları kapat
        console.log('8️⃣ Closing database connections...');
        await closeDatabases();
        console.log('✅ Databases closed successfully');
    }
}

// Hata senaryoları testi
async function testErrorHandling() {
    console.log('⚠️ Error Handling Test Starting...\n');

    try {
        await initializeDatabases();

        // 1. Geçersiz PostgreSQL sorgusu
        console.log('1️⃣ Testing invalid PostgreSQL query...');
        try {
            await getUser({ in: 'invalid_field' as any, value: 'test', out: 'all' });
        } catch (error) {
            console.log('✅ PostgreSQL error handled correctly:', (error as Error).message.substring(0, 50) + '...');
        }

        // 2. Geçersiz Redis key
        console.log('2️⃣ Testing invalid Redis operations...');
        try {
            const redis = getRedisInstance();
            await redis.eval('invalid lua script', 0);
        } catch (error) {
            console.log('✅ Redis error handled correctly:', (error as Error).message.substring(0, 50) + '...');
        }

        console.log('✅ Error handling tests completed\n');

    } catch (error) {
        console.error('❌ Error handling test failed:', error);
    } finally {
        await closeDatabases();
    }
}

// Test senaryoları
async function runAllIntegrationTests() {
    console.log('🧪 Database Integration Test Suite\n');
    console.log('=' .repeat(60));

    await testDatabaseIntegration();
    
    console.log('=' .repeat(60));
    
    await testErrorHandling();

    console.log('=' .repeat(60));
    console.log('🎉 Integration tests completed!\n');
}

// Eğer bu dosya doğrudan çalıştırılıyorsa testleri başlat
if (require.main === module) {
    runAllIntegrationTests().catch(console.error);
}

export { testDatabaseIntegration, testErrorHandling, runAllIntegrationTests };
