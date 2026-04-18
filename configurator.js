const { Extension, HDirection, HPacket } = require("gnode-api");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const cachePath = path.join(__dirname, "cache");
const badgesPath = path.join(cachePath, "badges.json");
const salaryPath = path.join(cachePath, "salary.json");
const extrasPath = path.join(cachePath, "extras.json");
const bitflagsPath = path.join(cachePath, "bitflags.json");

// Cache klasörünü oluştur
if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath);
}

// Boş JSON dosyalarını oluştur
if (!fs.existsSync(badgesPath)) {
    fs.writeFileSync(badgesPath, "{}");
}

if (!fs.existsSync(salaryPath)) {
    const initialSalaryData = {
        groups: {},
        Main: [],
        Plus: [],
        License: []
    };
    fs.writeFileSync(salaryPath, JSON.stringify(initialSalaryData, null, 2));
}

if (!fs.existsSync(extrasPath)) {
    const initialExtrasData = {
        groups: {}
    };
    fs.writeFileSync(extrasPath, JSON.stringify(initialExtrasData, null, 2));
}

if (!fs.existsSync(bitflagsPath)) {
    const initialBitflagsData = {
        permissions: [],
        badges: {}
    };
    fs.writeFileSync(bitflagsPath, JSON.stringify(initialBitflagsData, null, 2));
}

const ext = new Extension({
    name: "TOH Configurator",
    description: "TOH Badge and Salary Configuration Tool",
    version: "1.0.0",
    author: "i358"
});

let currentMode = null;
let isListening = true;

// Grup detaylarını dinle
ext.interceptByNameOrHash(HDirection.TOCLIENT, "HabboGroupDetails", async (hMessage) => {
    console.log("=== HabboGroupDetails paketi alındı ===");
    console.log("Mevcut mod:", currentMode);
    console.log("Dinleme aktif mi?", isListening);
    
    if (!isListening || !currentMode) {
        console.log("❌ Dinleme durdu veya mod seçili değil");
        return;
    }

    try {
        const packet = hMessage.getPacket();
        console.log("[DEBUG] Paket raw data:", packet);
        
        let [groupId, ,, groupName] = packet.read("ibiS");
        
        console.log(`[DEBUG] Ham bilgi - groupId: ${groupId}, groupName: "${groupName}"`);
        
        // Latin1'den UTF-8'e çevir
        if (typeof groupName === 'string') {
            groupName = Buffer.from(groupName, 'latin1').toString('utf8');
        }
        
        console.log(`✅ Grup bilgisi: "${groupName}" (ID: ${groupId})`);

        if (currentMode === "badge") {
            console.log("[INFO] Badge mode - handleBadgeGroup çağrılıyor...");
            handleBadgeGroup(groupId, groupName);
        } else if (currentMode === "salary") {
            console.log("[INFO] Salary mode - handleSalaryGroup çağrılıyor...");
            handleSalaryGroup(groupId, groupName);
        } else if (currentMode === "extras") {
            console.log("[INFO] Extras mode - handleExtrasGroup çağrılıyor...");
            handleExtrasGroup(groupId, groupName);
        }
    } catch (error) {
        console.error("❌ HabboGroupDetails paketini işlemede hata:", error);
        console.error("Stack:", error.stack);
    }
});

// Chat mesajlarını dinle
ext.interceptByNameOrHash(HDirection.TOSERVER, "Chat", async (hMessage) => {
    if (!isListening || !currentMode) return;

    const packet = hMessage.getPacket();
    const [message] = packet.read("S");

    if (message === ".") {
        isListening = false;
        console.log("\nDinleme durduruldu. Yapılandırma başlatılıyor...");
        
        if (currentMode === "badge") {
            await configureBadges();
        } else if (currentMode === "salary") {
            await configureSalary();
        } else if (currentMode === "extras") {
            await configureExtras();
        }
        
        console.log("Yapılandırma tamamlandı. Programdan çıkılıyor...");
        process.exit(0);
    }
});

function handleBadgeGroup(groupId, groupName) {
    try {
        console.log(`[DEBUG] handleBadgeGroup çalışıyor - groupName: "${groupName}", groupId: ${groupId}`);
        
        let badges = {};
        try {
            const fileContent = fs.readFileSync(badgesPath, "utf8");
            console.log(`[DEBUG] badges.json içeriği:`, fileContent);
            badges = JSON.parse(fileContent);
        } catch (readError) {
            console.error(`[DEBUG] badges.json okunurken hata:`, readError);
            badges = {};
        }
        
        console.log(`[DEBUG] Mevcut badges objesi:`, Object.keys(badges));
        console.log(`[DEBUG] "${groupName}" badges içinde var mı?`, groupName in badges);
        
        if (!badges[groupName]) {
            badges[groupName] = {
                id: groupId,
                ranks: [],
                duration: 0
            };
            
            console.log(`[DEBUG] Yeni badge ekleniyor:`, badges[groupName]);
            
            const jsonContent = JSON.stringify(badges, null, 2);
            console.log(`[DEBUG] Yazılacak JSON:`, jsonContent);
            
            fs.writeFileSync(badgesPath, jsonContent, "utf8");
            console.log(`✅ Yeni rozet grubu eklendi: ${groupName} (ID: ${groupId})`);
        } else {
            console.log(`⚠️  Rozet grubu zaten var: ${groupName}`);
        }
    } catch (error) {
        console.error(`❌ Rozet grubu kaydedilirken hata:`, error);
        console.error("Hata detayları:", {
            message: error.message,
            stack: error.stack,
            groupName: groupName,
            groupId: groupId
        });
    }
}

function handleSalaryGroup(groupId, groupName) {
    try {
        let salaryData;
        
        try {
            salaryData = JSON.parse(fs.readFileSync(salaryPath, "utf8"));
        } catch (error) {
            // JSON dosyası bozuksa veya okunamazsa yeni bir tane oluştur
            salaryData = {
                groups: {},
                Main: [],
                Plus: [],
                License: []
            };
        }

        // groups özelliği yoksa ekle
        if (!salaryData.groups) {
            salaryData.groups = {};
        }
        
        // Eğer bu grup daha önce kaydedilmemişse
        if (!salaryData.groups[groupName]) {
            salaryData.groups[groupName] = {
                id: groupId,
                type: null, // Bu alan configure aşamasında doldurulacak
                duration: 0,
                count: 0
            };
            
            fs.writeFileSync(salaryPath, JSON.stringify(salaryData, null, 2));
            console.log(`Yeni maaş grubu kaydedildi: ${groupName} (ID: ${groupId})`);
        }
    } catch (error) {
        console.error("Maaş grubu kaydedilirken hata:", error);
        // Hata detaylarını göster
        console.error("Hata detayları:", {
            message: error.message,
            groupName: groupName,
            groupId: groupId
        });
    }
}

async function configureBadges() {
    const badges = JSON.parse(fs.readFileSync(badgesPath, "utf8"));

    for (const [groupName, data] of Object.entries(badges)) {
        if (!data.ranks || data.ranks.length === 0) {
            console.log(`\n${groupName} rozeti için yapılandırma:`);
            console.log("Formatı şu şekilde girin:");
            console.log("[süre(dakika)]");
            console.log("rütbe1");
            console.log("rütbe2");
            console.log("(Bitirmek için boş satır girin)\n");

            const ranks = [];
            let duration = 0;

            const input = await new Promise(resolve => {
                let allInput = "";
                const onLine = (line) => {
                    if (line.trim() === "") {
                        rl.removeListener("line", onLine);
                        resolve(allInput);
                    } else {
                        allInput += line + "\n";
                    }
                };
                rl.on("line", onLine);
            });

            const lines = input.trim().split("\n");
            for (const line of lines) {
                if (line.startsWith("[") && line.endsWith("]")) {
                    duration = parseInt(line.slice(1, -1));
                } else {
                    ranks.push(line.trim());
                }
            }

            badges[groupName].duration = duration;
            badges[groupName].ranks = ranks;
            fs.writeFileSync(badgesPath, JSON.stringify(badges, null, 2));
            console.log(`${groupName} rozeti yapılandırıldı.`);
        }
    }
}

async function configureSalary() {
    const salaryData = JSON.parse(fs.readFileSync(salaryPath, "utf8"));
    
    // Gerekli alanları kontrol et ve oluştur
    if (!salaryData.groups) salaryData.groups = {};
    if (!salaryData.Main) salaryData.Main = [];
    if (!salaryData.Plus) salaryData.Plus = [];
    if (!salaryData.License) salaryData.License = [];

    const groups = Object.entries(salaryData.groups);

    console.log("\nKaydedilen maaş grupları için tür ve süre yapılandırması:");
    
    for (const [groupName, data] of groups) {
        if (!data.type) {
            console.log(`\n${groupName} için tür seçin:`);
            console.log("1. Ana Maaş (Main)");
            console.log("2. Ek Maaş (Plus)");
            console.log("3. Lisans (License)");

            const typeChoice = await new Promise(resolve => {
                rl.question("Seçiminiz (1-3): ", resolve);
            });

            let type;
            switch(typeChoice) {
                case "1": type = "Main"; break;
                case "2": type = "Plus"; break;
                case "3": type = "License"; break;
                default: 
                    console.log("Geçersiz seçim, varsayılan olarak Main atandı.");
                    type = "Main";
            }

            console.log(`\n${groupName} için süre ve sayı yapılandırması:`);
            console.log("Formatı şu şekilde girin:");
            console.log("süre.sayı (örnek: 250.20)\n");

            const input = await new Promise(resolve => {
                rl.question("", resolve);
            });

            const match = input.match(/^(\d+)\.(\d+)$/);
            if (match) {
                const duration = parseInt(match[1]);
                const count = parseInt(match[2]);
                data.type = type;
                data.duration = duration;
                data.count = count;

                // Seçilen türe göre grubun referansını ekle
                if (!salaryData[type].includes(groupName)) {
                    salaryData[type].push(groupName);
                }

                console.log(`${groupName} yapılandırıldı: ${type}, ${duration} dakika, ${count} kişi`);
            }
        }
    }

    fs.writeFileSync(salaryPath, JSON.stringify(salaryData, null, 2));
}


// Mod seçimi ve extension başlatma fonksiyonu
function startConfigurator() {
    console.log("\nHangi modu başlatmak istiyorsunuz?");
    console.log("1. Badge Configure Mode");
    console.log("2. Salary Configure Mode");
    console.log("3. Extras Configure Mode");
    console.log("4. Bitflags Configure Mode");

    rl.question("Seçiminiz (1, 2, 3 veya 4): ", (answer) => {
        if (answer === "1") {
            currentMode = "badge";
            console.log("\nBadge dinleme modu başlatıldı. Tamamlandığında '.' yazın.");
            ext.run();
        } else if (answer === "2") {
            currentMode = "salary";
            console.log("\nSalary dinleme modu başlatıldı. Tamamlandığında '.' yazın.");
            ext.run();
        } else if (answer === "3") {
            currentMode = "extras";
            console.log("\nExtras dinleme modu başlatıldı. Tamamlandığında '.' yazın.");
            ext.run();
        } else if (answer === "4") {
            configureBitflags();
        } else {
            console.log("Geçersiz seçim. Programdan çıkılıyor...");
            process.exit(1);
        }
    });
}

function handleExtrasGroup(groupId, groupName) {
    try {
        let extrasData;
        
        try {
            extrasData = JSON.parse(fs.readFileSync(extrasPath, "utf8"));
        } catch (error) {
            extrasData = {
                groups: {}
            };
        }

        if (!extrasData.groups) {
            extrasData.groups = {};
        }
        
        if (!extrasData.groups[groupName]) {
            extrasData.groups[groupName] = {
                id: groupId,
                type: null // Bu alan configure aşamasında doldurulacak
            };
            
            fs.writeFileSync(extrasPath, JSON.stringify(extrasData, null, 2));
            console.log(`Yeni extra grup kaydedildi: ${groupName} (ID: ${groupId})`);
        }
    } catch (error) {
        console.error("Extra grup kaydedilirken hata:", error);
    }
}

async function configureBitflags() {
    console.log("\nBitflags Configurator başlatılıyor...");
    
    // Permission listesini al
    console.log("\nPermission listesini girin (her satıra bir permission, bitirmek için boş satır):");
    const permissions = [];
    
    while (true) {
        const permission = await new Promise(resolve => {
            rl.question("", resolve);
        });
        
        if (permission.trim() === "") break;
        permissions.push(permission.trim());
    }

    // Rozetleri oku
    const badges = JSON.parse(fs.readFileSync(badgesPath, "utf8"));
    const extras = JSON.parse(fs.readFileSync(extrasPath, "utf8"));
    const bitflags = JSON.parse(fs.readFileSync(bitflagsPath, "utf8"));

    // Permission listesini kaydet
    bitflags.permissions = permissions;
    bitflags.badges = {};

    console.log("\nHer rozet için gerekli permissionları ve koşulları belirleyin.");
    
    // Rozet listelerini array'e çevir
    const badgesList = Object.keys(badges);
    const extrasList = Object.keys(extras.groups);

    // badges.json için yapılandırma
    for (const [index, groupName] of badgesList.entries()) {
        const badgeIndex = index + 1; // 1-tabanlı index
        console.log(`\n${groupName} (index: ${badgeIndex}) rozeti için:`);
        console.log("Permission seçin (sayı1+sayı2+... şeklinde girin):");
        permissions.forEach((perm, index) => {
            console.log(`${index + 1}. ${perm}`);
        });

        const permInput = await new Promise(resolve => {
            rl.question("Seçiminiz: ", resolve);
        });

        // Permission indekslerini parse et
        const selectedPerms = permInput.split('+')
            .map(p => parseInt(p.trim()) - 1)
            .filter(index => index >= 0 && index < permissions.length)
            .map(index => permissions[index]);

        if (selectedPerms.length > 0) {
            console.log("\nKoşul türünü seçin:");
            console.log("1. Eşittir (=)");
            console.log("2. Büyük veya eşittir (>=)");

            const conditionType = await new Promise(resolve => {
                rl.question("Seçiminiz (1 veya 2): ", resolve);
            });

            bitflags.badges[badgeIndex] = {
                name: groupName,
                permissions: selectedPerms,
                condition: conditionType === "1" ? "=" : ">=",
                source: "badges"
            };
        }
    }

    // extras.json için yapılandırma
    for (const [index, groupName] of extrasList.entries()) {
        const extraIndex = badgesList.length + index + 1; // badges sonrasından devam et
        console.log(`\n${groupName} (index: ${extraIndex}) (extras) için:`);
        console.log("Permission seçin (sayı1+sayı2+... şeklinde girin):");
        permissions.forEach((perm, index) => {
            console.log(`${index + 1}. ${perm}`);
        });

        const permInput = await new Promise(resolve => {
            rl.question("Seçiminiz: ", resolve);
        });

        // Permission indekslerini parse et
        const selectedPerms = permInput.split('+')
            .map(p => parseInt(p.trim()) - 1)
            .filter(index => index >= 0 && index < permissions.length)
            .map(index => permissions[index]);

        if (selectedPerms.length > 0) {
            bitflags.badges[extraIndex] = {
                name: groupName,
                permissions: selectedPerms,
                condition: "=", // extras için sadece eşittir koşulu
                source: "extras"
            };
        }
    }
    /*
MANAGE_TRAININGS
GIVE_BADGES
VIEW_BADGES
MANAGE_TRANSFERS
MANAGE_WARNS
MANAGE_BADGES
DOWN_BADGES
GIVE_MULTIBADGES
GIVE_SALARY
MANAGE_SALARY
GIVE_AFK_WARN
*/

    // Sonuçları kaydet
    fs.writeFileSync(bitflagsPath, JSON.stringify(bitflags, null, 2));
    console.log("\nBitflags yapılandırması tamamlandı ve kaydedildi.");
    process.exit(0);
}

async function configureExtras() {
    const extrasData = JSON.parse(fs.readFileSync(extrasPath, "utf8"));
    const groups = Object.entries(extrasData.groups);

    console.log("\nKaydedilen extra gruplar için tür yapılandırması:");
    
    for (const [groupName, data] of groups) {
        if (!data.type) {
            console.log(`\n${groupName} için tür seçin:`);
            console.log("1. Salary Personal");
            console.log("2. AFK Personal");
            console.log("3. Founder");
            console.log("4. Authoritative");
            console.log("5. Special Members");
            console.log("6. VIP Lounge");

            const typeChoice = await new Promise(resolve => {
                rl.question("Seçiminiz (1-6): ", resolve);
            });

            let type;
            switch(typeChoice) {
                case "1": type = "salary_personal"; break;
                case "2": type = "afk_personal"; break;
                case "3": type = "founder"; break;
                case "4": type = "authoritative"; break;
                case "5": type = "special_members"; break;
                case "6": type = "vip_lounge"; break;
                default: 
                    console.log("Geçersiz seçim. İşlem iptal ediliyor.");
                    continue;
            }

            data.type = type;
            fs.writeFileSync(extrasPath, JSON.stringify(extrasData, null, 2));
            console.log(`${groupName} yapılandırıldı: ${type}`);
        }
    }
}

// Configurator'ı başlat
startConfigurator();