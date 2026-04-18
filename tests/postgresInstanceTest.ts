/**
 * PostgreSQL Database Instance Test
 * Bu dosya PostgreSQL fonksiyonlarının kullanım örneklerini gösterir
 */

import { 
    initializeDatabases, 
    closeDatabases, 
    getUser, 
    updateUser, 
    createUser,
    createOrGetUser,
    getPostgresInstance
} from '../src/db_utilities';

async function testPostgresOperations() {
    console.log('🐘 PostgreSQL Test Operations Starting...\n');

    try {
        // 1. Database bağlantılarını başlat
        console.log('1️⃣ Initializing databases...');
        await initializeDatabases();
        console.log('✅ Databases initialized successfully\n');

        // 2. Yeni kullanıcı oluştur
        console.log('2️⃣ Creating new user...');
        const newUserId = await createUser({
            data: {
                username: 'test_user_' + Date.now(),
                figure: 'test_figure',
                motto: 'Test motto',
                look: 'test_look',
                last_seen: new Date()
            }
        });
        console.log('✅ User created with ID:', newUserId, '\n');

        // 3. Kullanıcıyı ID ile getir
        if (newUserId) {
            console.log('3️⃣ Getting user by ID...');
            const userById = await getUser({
                in: 'id',
                value: newUserId,
                out: 'all'
            });
            console.log('✅ User found by ID:', userById, '\n');

            // 4. Kullanıcıyı username ile getir
            console.log('4️⃣ Getting user by username...');
            const userByUsername = await getUser({
                in: 'username',
                value: userById?.username || 'test_user',
                out: 'id'
            });
            console.log('✅ User ID found by username:', userByUsername, '\n');

            // 5. Kullanıcı bilgilerini güncelle
            console.log('5️⃣ Updating user...');
            const updateResult = await updateUser({
                where: { id: newUserId },
                data: {
                    motto: 'Updated motto',
                    last_seen: new Date()
                }
            });
            console.log('✅ User update result:', updateResult, '\n');

            // 6. Güncellenmiş kullanıcıyı kontrol et
            console.log('6️⃣ Verifying updated user...');
            const updatedUser = await getUser({
                in: 'id',
                value: newUserId,
                out: 'all'
            });
            console.log('✅ Updated user:', updatedUser, '\n');
        }

        // 7. Raw SQL sorgusu örneği
        console.log('7️⃣ Running raw SQL query...');
        const pool = getPostgresInstance();
        const result = await pool.query('SELECT NOW() as current_time');
        console.log('✅ Current database time:', result.rows[0].current_time, '\n');

        // 8. createOrGetUser fonksiyonu testi
        console.log('8️⃣ Testing createOrGetUser function...');
        
        // Aynı username ile tekrar kullanıcı oluşturmaya çalış
        const testUsername = 'duplicate_test_' + Date.now();
        
        const firstResult = await createOrGetUser({
            data: {
                username: testUsername,
                figure: 'first_figure',
                motto: 'First creation'
            },
            searchBy: 'username'
        });
        console.log('✅ First createOrGetUser result:', firstResult);
        
        const secondResult = await createOrGetUser({
            data: {
                username: testUsername,
                figure: 'second_figure', // Farklı veri ama aynı username
                motto: 'Second attempt'
            },
            searchBy: 'username'
        });
        console.log('✅ Second createOrGetUser result (should not create):', secondResult);
        console.log(`✅ Same ID returned: ${firstResult.id === secondResult.id}`);
        console.log();

    } catch (error) {
        console.error('❌ PostgreSQL test failed:', error);
    } finally {
        // 9. Bağlantıları kapat
        console.log('9️⃣ Closing database connections...');
        await closeDatabases();
        console.log('✅ Databases closed successfully');
    }
}

// Test senaryoları
async function runAllPostgresTests() {
    console.log('🧪 PostgreSQL Test Suite\n');
    console.log('=' .repeat(50));

    await testPostgresOperations();

    console.log('=' .repeat(50));
    console.log('🎉 PostgreSQL tests completed!\n');
}

// Eğer bu dosya doğrudan çalıştırılıyorsa testleri başlat
if (require.main === module) {
    runAllPostgresTests().catch(console.error);
}

export { testPostgresOperations, runAllPostgresTests };
