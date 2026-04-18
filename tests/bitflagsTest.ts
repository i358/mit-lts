import * as readline from 'readline';
import { bitflagsManager, DEFAULT_BITFLAGS } from '../src/utils/bitflagsManager';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function testBitflags() {
    console.log('\n=== Bitflags Tester ===\n');

    // Tüm permissionları göster
    const allPermissions = bitflagsManager.getAllPermissions();
    console.log('Mevcut Permissionlar:');
    allPermissions.forEach((perm, index) => {
        console.log(`${index + 1}. ${perm} (Değer: ${bitflagsManager.getPermissionValue(perm)})`);
    });

    // Badge indexini al
    const badgeIndex = await new Promise<number>((resolve) => {
        rl.question('\nTest edilecek badge indexini girin: ', (answer) => {
            resolve(parseInt(answer));
        });
    });

    // Badge'in permissionlarını göster
    const badgePermissions = bitflagsManager.getBadgePermissions(badgeIndex);
    console.log(`\nBadge #${badgeIndex} için permissionlar:`, badgePermissions);

    // Bitflags hesapla
    const calculatedBitflags = bitflagsManager.calculateBitflags(badgeIndex, DEFAULT_BITFLAGS);
    console.log(`\nHesaplanan bitflags: ${calculatedBitflags}`);
    console.log(`Binary format: ${calculatedBitflags.toString(2).padStart(32, '0')}`);

    // Her permission için kontrol et
    console.log('\nPermission Kontrolleri:');
    allPermissions.forEach(permission => {
        const hasPermission = bitflagsManager.hasPermission(calculatedBitflags, permission);
        console.log(`${permission}: ${hasPermission ? '✅ VAR' : '❌ YOK'}`);
    });

    // Özel permission gruplarını kontrol et
    console.log('\nÖzel Permission Grup Kontrolleri:');
    const extras = {
        administrator: 'Administrator',
        badge_manager: 'Badge Manager',
        salary_manager: 'Salary Manager'
    };

    for (const [key, title] of Object.entries(extras)) {
        const groupPerms = bitflagsManager.getExtraPermissions(key);
        const hasAllPerms = groupPerms.every(perm => 
            bitflagsManager.hasPermission(calculatedBitflags, perm)
        );
        console.log(`${title}: ${hasAllPerms ? '✅ Tüm yetkiler var' : '❌ Eksik yetkiler var'}`);
        
        if (!hasAllPerms && groupPerms.length > 0) {
            console.log('Eksik yetkiler:');
            groupPerms.forEach(perm => {
                if (!bitflagsManager.hasPermission(calculatedBitflags, perm)) {
                    console.log(`  - ${perm}`);
                }
            });
        }
    }

    rl.close();
}

// Testi çalıştır
testBitflags().catch(error => {
    console.error('Test sırasında hata oluştu:', error);
    process.exit(1);
});