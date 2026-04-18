/**
 * Redis Database Instance Test
 * Bu dosya Redis fonksiyonlarının kullanım örneklerini gösterir
 */

import { 
    initializeDatabases, 
    closeDatabases, 
    getUserIndex, 
    setUserIndex, 
    listAllIndexes,
    getRedisInstance,
    getKeysByPattern
} from '../src/db_utilities';

async function testRedisOperations() {
    console.log('🔴 Redis Test Operations Starting...\n');

    try {
        // 1. Database bağlantılarını başlat
        console.log('1️⃣ Initializing databases...');
        await initializeDatabases();
        console.log('✅ Databases initialized successfully\n');

        // 2. Test user ID'leri
        const testUsers = [
            { id: '12345', index: 'room_1_index_5' },
            { id: '67890', index: 'room_2_index_10' },
            { id: '11111', index: 'room_1_index_15' }
        ];

        // 3. Kullanıcı index'lerini ayarla
        console.log('2️⃣ Setting user indexes...');
        for (const user of testUsers) {
            const result = await setUserIndex(user.id, user.index);
            console.log(`✅ Set index for user ${user.id}: ${user.index} - Result: ${result}`);
        }
        console.log();

        // 4. Kullanıcı index'lerini getir
        console.log('3️⃣ Getting user indexes...');
        for (const user of testUsers) {
            const index = await getUserIndex(user.id);
            console.log(`✅ User ${user.id} index: ${index}`);
        }
        console.log();

        // 5. Tüm index'leri listele
        console.log('4️⃣ Listing all indexes...');
        const allIndexes = await listAllIndexes();
        console.log('✅ All user indexes:', allIndexes);
        console.log();

        // 6. Pattern ile key arama
        console.log('5️⃣ Searching keys by pattern...');
        const userKeys = await getKeysByPattern('user:*');
        console.log('✅ Keys matching "user:*":', userKeys);
        console.log();

        // 7. Raw Redis komutları örneği
        console.log('6️⃣ Running raw Redis commands...');
        const redis = getRedisInstance();
        
        // Set/Get örneği
        await redis.set('test:timestamp', Date.now().toString());
        const timestamp = await redis.get('test:timestamp');
        console.log('✅ Test timestamp:', timestamp);

        // Hash örneği
        await redis.hmset('user:profile:12345', {
            username: 'TestUser',
            level: '10',
            room_id: '12453277'
        });
        const profile = await redis.hgetall('user:profile:12345');
        console.log('✅ User profile:', profile);

        // List örneği
        await redis.lpush('room:events', 'user_joined', 'user_left', 'message_sent');
        const events = await redis.lrange('room:events', 0, -1);
        console.log('✅ Room events:', events);
        console.log();

        // 8. Redis bilgileri
        console.log('7️⃣ Redis server info...');
        const info = await redis.info('memory');
        console.log('✅ Redis memory info:', info.split('\n').slice(0, 5).join('\n'));

    } catch (error) {
        console.error('❌ Redis test failed:', error);
    } finally {
        // 9. Bağlantıları kapat
        console.log('8️⃣ Closing database connections...');
        await closeDatabases();
        console.log('✅ Databases closed successfully');
    }
}

// Performans testi
async function testRedisPerformance() {
    console.log('⚡ Redis Performance Test Starting...\n');

    try {
        await initializeDatabases();
        const redis = getRedisInstance();

        // Çoklu SET operasyonu
        console.log('📈 Testing bulk SET operations...');
        const startTime = Date.now();
        
        const pipeline = redis.pipeline();
        for (let i = 0; i < 1000; i++) {
            pipeline.set(`performance:test:${i}`, `value_${i}`);
        }
        await pipeline.exec();
        
        const setTime = Date.now() - startTime;
        console.log(`✅ 1000 SET operations completed in ${setTime}ms`);

        // Çoklu GET operasyonu
        console.log('📈 Testing bulk GET operations...');
        const getStartTime = Date.now();
        
        const getPipeline = redis.pipeline();
        for (let i = 0; i < 1000; i++) {
            getPipeline.get(`performance:test:${i}`);
        }
        const results = await getPipeline.exec();
        
        const getTime = Date.now() - getStartTime;
        console.log(`✅ 1000 GET operations completed in ${getTime}ms`);
        console.log(`✅ Retrieved ${results?.length} values`);

        // Cleanup
        await redis.del(...Array.from({length: 1000}, (_, i) => `performance:test:${i}`));
        console.log('✅ Cleanup completed\n');

    } catch (error) {
        console.error('❌ Redis performance test failed:', error);
    } finally {
        await closeDatabases();
    }
}

// Test senaryoları
async function runAllRedisTests() {
    console.log('🧪 Redis Test Suite\n');
    console.log('=' .repeat(50));

    await testRedisOperations();
    
    console.log('=' .repeat(50));
    
    await testRedisPerformance();

    console.log('=' .repeat(50));
    console.log('🎉 Redis tests completed!\n');
}

// Eğer bu dosya doğrudan çalıştırılıyorsa testleri başlat
if (require.main === module) {
    runAllRedisTests().catch(console.error);
}

export { testRedisOperations, testRedisPerformance, runAllRedisTests };
