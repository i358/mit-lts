//@ts-nocheck
import { createLogger, LogLevel } from '../logger';
import { globalStore } from '../utils/globalStore';
import { createTimeTable, updateUserTime, resetAllUserTimes, getUserTime, updateDailyUserTime, resetAllDailyUserTimes, incrementWeeklyTime } from '../db_utilities';
import { updateUserWorkTime } from '../db_utilities/work_time';
import util from 'util';

const timerLogger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/timer.log',
    module: "TIMER_WORKER"
});

interface TimerUser {
    id: number;
    username: string;
    enter_time: number; // Kullanıcının odaya girdiği zaman
    current_session: number; // Anlık session süresi (ms)
    total_time: number; // Veritabanından gelen toplam süre
    last_db_save: number; // Son database kaydetme zamanı
}

interface ActiveTimeData {
    userId: number;
    username: string;
    currentSession: number; // Bu session'da geçen süre (ms)
    totalTime: number; // Database'den gelen toplam süre
    enterTime: number;
    lastUpdated: number;
}


class TimerWorker {
    private isActive: boolean = false;
    private nextResetTime: number = 0;
    private secondlyUpdateInterval: NodeJS.Timeout | null = null; // Her saniye güncelleme
    private minutelyDbSaveInterval: NodeJS.Timeout | null = null; // Her dakika DB kaydetme
    private checkInterval: NodeJS.Timeout | null = null;
    private activeUsers: Map<number, TimerUser> = new Map(); // Aktif kullanıcılar
    private globalCache = globalStore.collection('globalCache');
    private activeTimeCollection = globalStore.collection('activeTimeData'); // Real-time süre verileri
    private timeCollection = globalStore.collection('timeCollection');

    constructor() {
        timerLogger.info('Timer Worker initialized');
    }

    /**
     * Timer worker'ını başlat
     */
    public async start(): Promise<void> {
        try {
            timerLogger.info('Starting Timer Worker...');
            
            // Time tablosunu oluştur
            await createTimeTable();
            
            // Active time collection'ını başlat
            await this.initializeActiveTimeCollection();
            
            // İlk timer hesaplamasını yap
            this.calculateNextResetTime();
            
            // Ana timer loop'unu başlat
            this.startTimerLoop();
            
            // Kullanıcı değişikliklerini dinle
            this.setupUserListeners();
            
            timerLogger.info('Timer Worker started successfully', {
                nextResetTime: new Date(this.nextResetTime).toISOString(),
                isActive: this.isActive
            });
            
        } catch (error) {
            timerLogger.error('Failed to start Timer Worker:', error);
            throw error;
        }
    }

    /**
     * Global active time collection'ını başlat
     */
    private async initializeActiveTimeCollection(): Promise<void> {
        try {
            timerLogger.info('Initializing active time collection...');
            
            // Active time collection'ını temizle
            this.activeTimeCollection.clear();
            
            timerLogger.info('Active time collection initialized (empty - will be populated when users enter)');
            
        } catch (error) {
            timerLogger.error('Error initializing active time collection:', error);
        }
    }

    /**
     * Global time collection'ını güncelle (DISABLED - Real-time sistem kullanıldığından gerekli değil)
     */
    private async updateTimeCollection(userId: number, username?: string): Promise<void> {
        // Bu metod artık kullanılmıyor çünkü real-time active time collection kullanıyoruz
        // getUserTime fonksiyonu zaten active collection'dan veri alıyor
        timerLogger.debug(`updateTimeCollection called for user ${userId} - but real-time system is active, skipping`);
        return;
        
        // Eski kod disabled:
        /*
        try {
            const timeData = await getUserTime(userId);
            this.timeCollection.set(userId.toString(), {
                userId,
                username: username || this.timeCollection.get(userId.toString())?.username,
                ...timeData,
                lastUpdated: Date.now()
            });
            
            timerLogger.debug(`Updated time collection for user ${userId}`);
            
        } catch (error) {
            timerLogger.error(`Error updating time collection for user ${userId}:`, {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                } : error,
                userId,
                username
            });
        }
        */
    }

    /**
     * Bir sonraki sabah 9:00 reset zamanını hesapla
     */
    private calculateNextResetTime(): void {
        const now = new Date();

        // Sabah 9'da tüm süre tablolarını sıfırla
        if (now.getHours() === 9 && now.getMinutes() === 0) {
            Promise.all([
                resetAllUserTimes(),
                resetAllDailyUserTimes(),
                // Work time'ları koşulsuz sıfırla
                (async () => {
                    try {
                        const { resetAllWorkTimes } = await import('../db_utilities/work_time');
                        await resetAllWorkTimes();
                        timerLogger.info('All work times reset at 9:00 AM');
                    } catch (error) {
                        timerLogger.error('Error resetting work times:', error);
                    }
                })()
            ]).then(() => {
                timerLogger.info('All time tables reset at 9:00 AM');
                this.sendDiscordNotification('🔄 **Tüm süre tabloları sıfırlandı**\nYeni gün başlangıcı: ' + now.toLocaleString('tr-TR'));
            }).catch(error => {
                timerLogger.error('Error resetting daily and work times:', error);
            });
        }

        // Günlük süre hesaplamasını güncelle
        const dayStart = new Date(now);
        dayStart.setHours(9, 0, 0, 0);
        
        // Eğer şu an 9:00'dan önceyse, önceki günün 9:00'ını al
        if (now.getHours() < 9) {
            dayStart.setDate(dayStart.getDate() - 1);
        }

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        let nextReset = new Date(now);
        nextReset.setHours(9, 0, 0, 0); // Sabah 9:00
        
        // Eğer şu an saat 9:00'u geçmişse, yarın 9:00'a ayarla
        if (currentHour > 9 || (currentHour === 9 && currentMinute >= 0)) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        this.nextResetTime = nextReset.getTime();
        this.isActive = true;
        
        const timeUntilReset = this.nextResetTime - Date.now();
        const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
        const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
        
        timerLogger.info('Next reset time calculated', {
            currentTime: now.toISOString(),
            nextResetTime: nextReset.toISOString(),
            hoursUntilReset,
            minutesUntilReset,
            currentHour,
            currentMinute
        });
    }

    /**
     * Ana timer loop'unu başlat
     */
    private startTimerLoop(): void {
        // Her 30 saniyede bir timer durumunu kontrol et
        this.checkInterval = setInterval(() => {
            this.checkTimerStatus();
        }, 30000);

        // Her saniye aktif kullanıcıların sürelerini güncelle
        this.secondlyUpdateInterval = setInterval(async () => {
            if (this.isActive) {
                await this.updateActiveUserTimes();
            }
        }, 1000); // 1 saniye

        // Her dakika collection'ı database'e kaydet
        this.minutelyDbSaveInterval = setInterval(async () => {
            if (this.isActive) {
                await this.saveActiveTimesToDatabase();
            }
        }, 60000); // 60 saniye

        timerLogger.debug('Timer loops started (1s time updates, 1min DB saves, 30s status checks)');
    }

    /**
     * Her saniye aktif kullanıcıların sürelerini güncelle
     */
    private async updateActiveUserTimes(): Promise<void> {
        try {
            const cachedUsers = this.globalCache.get("users");
            
            if (!cachedUsers || !(cachedUsers instanceof Map)) {
                return;
            }

            const currentUsers: Map<number, any> = cachedUsers;
            const currentTime = Date.now();
            
            // Aktif kullanıcıları sync et
            await this.syncActiveUsers(currentUsers, currentTime);
            
            // Her aktif kullanıcının süresini 1 saniye artır
            let updatedCount = 0;
            this.activeUsers.forEach((timerUser, userId) => {
                // 1 saniye (1000ms) ekle
                timerUser.current_session += 1000;
                
                // Collection'ı güncelle
                const activeTimeData: ActiveTimeData = {
                    userId: timerUser.id,
                    username: timerUser.username,
                    currentSession: timerUser.current_session,
                    totalTime: timerUser.total_time,
                    enterTime: timerUser.enter_time,
                    lastUpdated: currentTime
                };
                
                this.activeTimeCollection.set(userId.toString(), activeTimeData);
                updatedCount++;
            });
            
            if (updatedCount > 0) {
                timerLogger.verbose(`Updated ${updatedCount} active users (+1s each)`);
            }
            
        } catch (error) {
            timerLogger.error('Error updating active user times:', error);
        }
    }

    /**
     * Aktif kullanıcıları sync et (giren/çıkan kullanıcıları handle et)
     */
    private async syncActiveUsers(currentUsers: Map<number, any>, currentTime: number): Promise<void> {
        try {
            // Yeni kullanıcıları ekle
            for (const [userId, userData] of currentUsers) {
                if (!this.activeUsers.has(userId)) {
                    await this.addNewActiveUser(userId, userData, currentTime);
                }
            }
            
            // Çıkan kullanıcıları handle et
            const usersToRemove: number[] = [];
            this.activeUsers.forEach((timerUser, userId) => {
                if (!currentUsers.has(userId)) {
                    usersToRemove.push(userId);
                }
            });
            
            for (const userId of usersToRemove) {
                await this.removeActiveUser(userId);
            }
            
        } catch (error) {
            timerLogger.error('Error syncing active users:', error);
        }
    }

    /**
     * Yeni aktif kullanıcı ekle
     */
    private async addNewActiveUser(userId: number, userData: any, currentTime: number): Promise<void> {
        try {
            // Database'den mevcut toplam süreyi al
            const dbTimeData = await getUserTime(userId);
            
            const timerUser: TimerUser = {
                id: userId,
                username: userData.username || 'Unknown',
                enter_time: currentTime,
                current_session: 0, // Yeni session başlangıcı
                total_time: dbTimeData.storedTotal || 0,
                last_db_save: currentTime
            };
            
            this.activeUsers.set(userId, timerUser);
            
            // Collection'a da ekle
            const activeTimeData: ActiveTimeData = {
                userId,
                username: userData.username || 'Unknown',
                currentSession: 0,
                totalTime: dbTimeData.storedTotal || 0,
                enterTime: currentTime,
                lastUpdated: currentTime
            };
            
            this.activeTimeCollection.set(userId.toString(), activeTimeData);
            
            timerLogger.info('User entered and added to active tracking', {
                userId,
                username: userData.username,
                totalTimeFromDb: dbTimeData.storedTotal
            });
            
        } catch (error) {
            timerLogger.error(`Error adding new active user ${userId}:`, error);
        }
    }

    /**
     * Aktif kullanıcıyı kaldır ve database'e kaydet
     */
    private async removeActiveUser(userId: number): Promise<void> {
        try {
            const timerUser = this.activeUsers.get(userId);
            if (!timerUser) {
                timerLogger.debug(`User ${userId} not found in activeUsers, skipping removal`);
                return;
            }
            
            timerLogger.debug(`Removing active user ${userId} (${timerUser.username}), session: ${Math.round(timerUser.current_session / 1000)}s`);
            
            // Session süresini database'e kaydet
            if (timerUser.current_session > 0) {
                try {
                    // Önce mevcut toplam süreyi al ve session'ı ekle
                    const { getUserTime } = await import('../db_utilities/postgres');
                    const currentTimeData = await getUserTime(userId);
                    const storedTotal = currentTimeData.storedTotal || 0;
                    const newTotalTime = storedTotal + timerUser.current_session;
                    
                    await updateUserTime(userId, newTotalTime, timerUser.username);
                    timerLogger.debug(`Updated permanent time for user ${userId}: ${storedTotal}ms -> ${newTotalTime}ms (+${timerUser.current_session}ms)`);
                } catch (dbError) {
                    timerLogger.error(`Error updating permanent time for user ${userId}:`, dbError);
                }
                
                try {
                    await updateDailyUserTime(userId, timerUser.current_session, timerUser.username);
                    timerLogger.debug(`Updated daily time for user ${userId}`);
                } catch (dbError) {
                    timerLogger.error(`Error updating daily time for user ${userId}:`, dbError);
                }

                // Haftalık süreyi delta kadar arttır (time resetlense bile haftalık birikim devam eder)
                try {
                    await incrementWeeklyTime({
                        userId,
                        username: timerUser.username,
                        deltaTotalMs: timerUser.current_session,
                        deltaWorkMs: timerUser.current_session
                    });
                } catch (weeklyErr) {
                    timerLogger.error(`Error incrementing weekly time for user ${userId}:`, weeklyErr);
                }
            }
            
            // Collection'lardan kaldır
            this.activeUsers.delete(userId);
            this.activeTimeCollection.delete(userId.toString());
            
            timerLogger.info('User left and session saved', {
                userId,
                username: timerUser.username,
                sessionDuration: Math.round(timerUser.current_session / 1000), // saniye
                enterTime: new Date(timerUser.enter_time).toISOString()
            });
            
            // Discord bildirimi
            try {
                await this.sendDiscordNotification(`👋 **${timerUser.username}** çıktı - Session: ${Math.round(timerUser.current_session / 1000)}s`);
            } catch (discordError) {
                timerLogger.error(`Error sending Discord notification for user ${userId}:`, {
                    error: discordError instanceof Error ? {
                        name: discordError.name,
                        message: discordError.message,
                        stack: discordError.stack
                    } : {
                        inspected: util.inspect(discordError, { depth: 5 })
                    }
                });
            }
            
        } catch (error) {
            timerLogger.error(`Error removing active user ${userId}:`, {
                error: error.message || error,
                stack: error.stack,
                userId,
                activeUsersSize: this.activeUsers.size
            });
        }
    }

    /**
     * Collection'daki tüm süreleri database'e kaydet (her dakika)
     */
    private async saveActiveTimesToDatabase(): Promise<void> {
        try {
            if (this.activeUsers.size === 0) {
                return;
            }
            
            let savedCount = 0;
            const currentTime = Date.now();
            
            for (const [userId, timerUser] of this.activeUsers) {
                try {
                    // Son kaydetmeden bu yana geçen süreyi hesapla
                    const timeSinceLastSave = currentTime - timerUser.last_db_save;
                    
                    // En az 50 saniye geçmişse kaydet (dakika threshold)
                    if (timeSinceLastSave >= 50000) {
                        // Son kaydetmeden bu yana birikmiş session süresini al
                        const sessionToSave = timerUser.current_session;
                        
                        if (sessionToSave > 0) {
                            // Önce kullanıcının mevcut toplam süresini al
                            const { getUserRow, getUserTime } = await import('../db_utilities/postgres');
                            const userRow = await getUserRow({
                                in: 'id',
                                value: userId,
                                out: 'all'
                            });

                            // Veritabanındaki toplam süreyi al
                            const currentTimeData = await getUserTime(userId);
                            const storedTotal = currentTimeData.storedTotal || 0;
                            
                            // Yeni toplam süreyi hesapla (mevcut toplam + session)
                            const newTotalTime = storedTotal + sessionToSave;

                            // DÜZELTME: updateUserTime fonksiyonu newTotalTime'ı değil, sadece eklenen süreyi almalı
                            // Ama fonksiyon total süreyi set ediyor, bu yüzden newTotalTime gönderiyoruz
                            await updateUserTime(userId, newTotalTime, timerUser.username);
                            await updateDailyUserTime(userId, sessionToSave, timerUser.username);

                            // Her kullanıcı için work time'ı güncelle
                            await updateUserWorkTime(userId, sessionToSave);

                            // Haftalık süreyi (delta) güncelle
                            try {
                                await incrementWeeklyTime({
                                    userId,
                                    username: timerUser.username,
                                    deltaTotalMs: sessionToSave,
                                    deltaWorkMs: sessionToSave
                                });
                            } catch (weeklyErr) {
                                timerLogger.error(`Error incrementing weekly time for user ${userId}:`, weeklyErr);
                            }
                            
                            // DÜZELTME: Memory'deki total time'ı güncelle ve session'ı sıfırla
                            timerUser.total_time = newTotalTime;
                            timerUser.current_session = 0; // Session'ı sıfırla!
                            timerUser.last_db_save = currentTime;
                            
                            // Collection'ı da güncelle
                            const activeTimeData = this.activeTimeCollection.get(userId.toString()) as ActiveTimeData;
                            if (activeTimeData) {
                                activeTimeData.totalTime = newTotalTime;
                                activeTimeData.currentSession = 0; // Session'ı sıfırla!
                                activeTimeData.lastUpdated = currentTime;
                                this.activeTimeCollection.set(userId.toString(), activeTimeData);
                            }
                            
                            savedCount++;
                            
                            timerLogger.debug(`Saved and reset session for user ${userId}: ${Math.round(sessionToSave / 1000)}s saved, session reset`);
                        }
                    }
                } catch (userError) {
                    timerLogger.error(`Error saving time for user ${userId}:`, userError);
                }
            }
            
            if (savedCount > 0) {
                timerLogger.info(`Minutely save completed: ${savedCount}/${this.activeUsers.size} users saved`);
            }
            
        } catch (error) {
            timerLogger.error('Error in minutely database save:', error);
        }
    }

    /**
     * Timer durumunu kontrol et
     */
    private checkTimerStatus(): void {
        const now = Date.now();
        
        if (now >= this.nextResetTime) {
            timerLogger.info('24-hour timer completed, resetting...');
            this.resetTimer();
        }
        
        // Spotter durumunu kontrol et
        const spotterInRoom = this.globalCache.get("spotterInRoom");
        if (!spotterInRoom && this.isActive) {
            timerLogger.warn('Spotter not in target room, pausing timer');
            this.pauseTimer();
        } else if (spotterInRoom && !this.isActive) {
            timerLogger.info('Spotter back in target room, resuming timer');
            this.resumeTimer();
        }
    }

    /**
     * Aktif kullanıcıları güncelle (Bu metod artık kullanılmıyor - real-time sistem aktif)
     */
    private updateActiveUsers(): void {
        // Real-time tracking sistemi kullanıldığından bu metod artık çalışmıyor
        // Tüm kullanıcı izleme updateActiveUserTimes() metodunda yapılıyor
        timerLogger.debug('updateActiveUsers called - but real-time system is active');
    }

    /**
     * Kullanıcı çıkışını işle
     */
    /**
     * Kullanıcı çıkışını işle (Artık kullanılmıyor - real-time sistem aktif)
     */
    private async handleUserExit(timerUser: TimerUser): Promise<void> {
        // Real-time tracking sistemi kullanıldığından bu metod artık çalışmıyor
        // Kullanıcı çıkışları updateActiveUserTimes() metodunda otomatik algılanıyor
        timerLogger.debug('handleUserExit called - but real-time system handles exits automatically');
    }

    /**
     * Kullanıcı değişiklik listener'larını ayarla
     */
    private setupUserListeners(): void {
        // Global cache'deki users değişikliklerini dinle
        this.globalCache.on('set', (key: string, newValue: any) => {
            if (key === 'users' && this.isActive) {
                timerLogger.debug('Users cache updated, will process in next cycle');
            }
        });

        timerLogger.debug('User listeners setup completed');
    }

    /**
     * Reset öncesi süre raporu oluştur ve JSON dosyası olarak kaydet
     */
    private async generateTimeReportBeforeReset(): Promise<void> {
        try {
            const reportTimestamp = new Date();
            const reportData = {
                reportDate: reportTimestamp.toISOString(),
                reportType: '24_hour_reset_report',
                users: [] as any[],
                summary: {
                    totalUsers: 0,
                    totalTimeSpent: 0,
                    averageTimePerUser: 0,
                    activeUsersAtReset: 0
                }
            };

            // Tüm kullanıcı sürelerini topla (database'den)
            const { getAllUserTimes } = await import('../db_utilities/postgres');
            const allUserTimes = await getAllUserTimes();

            // Active time collection'dan güncel session verilerini al
            const { globalStore } = await import('../utils/globalStore');
            const activeTimeCollection = globalStore.collection('activeTimeData');
            
            for (const userTime of allUserTimes) {
                const userId = userTime.user_id;
                let currentSession = 0;
                let isActive = false;

                // Active collection'da kullanıcı var mı kontrol et
                const activeData = activeTimeCollection.get(userId.toString());
                if (activeData) {
                    currentSession = activeData.currentSession || 0;
                    isActive = true;
                    reportData.summary.activeUsersAtReset++;
                }

                const totalTime = userTime.total + currentSession;
                
                reportData.users.push({
                    userId: userId,
                    username: userTime.username || `User_${userId}`,
                    storedTime: userTime.total,
                    currentSession: currentSession,
                    totalTime: totalTime,
                    isActiveAtReset: isActive,
                    timeInSeconds: Math.round(totalTime / 1000),
                    timeInMinutes: Math.round(totalTime / 60000),
                    timeInHours: Math.round(totalTime / 3600000 * 100) / 100
                });

                reportData.summary.totalTimeSpent += totalTime;
            }

            reportData.summary.totalUsers = reportData.users.length;
            reportData.summary.averageTimePerUser = reportData.summary.totalUsers > 0 
                ? Math.round(reportData.summary.totalTimeSpent / reportData.summary.totalUsers) 
                : 0;

            // En çok süre geçiren kullanıcıları sırala
            reportData.users.sort((a, b) => b.totalTime - a.totalTime);

            // JSON dosyası olarak kaydet
            const fs = await import('fs/promises');
            const path = await import('path');
            
            const fileName = `time_report_${reportTimestamp.getFullYear()}-${(reportTimestamp.getMonth() + 1).toString().padStart(2, '0')}-${reportTimestamp.getDate().toString().padStart(2, '0')}_${reportTimestamp.getHours().toString().padStart(2, '0')}-${reportTimestamp.getMinutes().toString().padStart(2, '0')}.json`;
            const filePath = path.join(process.cwd(), 'logs', fileName);

            await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf8');

            timerLogger.info('Time report generated before reset', {
                fileName,
                totalUsers: reportData.summary.totalUsers,
                activeUsers: reportData.summary.activeUsersAtReset,
                totalTimeSpent: Math.round(reportData.summary.totalTimeSpent / 1000) + ' seconds',
                filePath
            });

            // Discord'a JSON dosyasını yükle ve bildirim gönder
            await this.sendDiscordNotificationWithFile(
                `📊 **24 Saatlik Süre Raporu Oluşturuldu**\n` +
                `📁 Dosya: \`${fileName}\`\n` +
                `👥 Toplam Kullanıcı: ${reportData.summary.totalUsers}\n` +
                `🟢 Aktif Kullanıcı: ${reportData.summary.activeUsersAtReset}\n` +
                `⏰ Toplam Süre: ${Math.round(reportData.summary.totalTimeSpent / 3600000 * 100) / 100} saat`,
                filePath
            );

        } catch (error) {
            timerLogger.error('Error generating time report before reset:', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack
                } : error
            });
            await this.sendDiscordNotification(`❌ **Süre raporu oluşturulurken hata** - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Timer'ı duraklat
     */
    private pauseTimer(): void {
        this.isActive = false;
        timerLogger.info('Timer paused');
    }

    /**
     * Timer'ı devam ettir
     */
    private resumeTimer(): void {
        this.isActive = true;
        timerLogger.info('Timer resumed');
    }

    /**
     * 24 saatlik timer'ı resetle
     */
    private async resetTimer(): Promise<void> {
        try {
            timerLogger.info('Starting 24-hour timer reset...');
            
            // Reset öncesi süre raporu oluştur
            await this.generateTimeReportBeforeReset();
            
            // Aktif kullanıcıların son sürelerini kaydet
            try {
                const { globalStore } = await import('../utils/globalStore');
                const activeTimeCollection = globalStore.collection('activeTimeData');
                
                for (const [userIdStr, activeTimeData] of activeTimeCollection.entries()) {
                    const userId = parseInt(userIdStr);
                    const currentSession = activeTimeData.currentSession || 0;
                    
                    if (currentSession > 0) {
                        // Önce mevcut toplam süreyi al ve session'ı ekle
                        const { getUserTime } = await import('../db_utilities/postgres');
                        const currentTimeData = await getUserTime(userId);
                        const storedTotal = currentTimeData.storedTotal || 0;
                        const newTotalTime = storedTotal + currentSession;
                        
                        await updateUserTime(userId, newTotalTime, activeTimeData.username);

                        // Haftalık süreye de ekle (son dakika/son saniyeler kaybolmasın)
                        try {
                            await incrementWeeklyTime({
                                userId,
                                username: activeTimeData.username,
                                deltaTotalMs: currentSession,
                                deltaWorkMs: currentSession
                            });
                        } catch (weeklyErr) {
                            timerLogger.error(`Error incrementing weekly time for user ${userId} during reset:`, weeklyErr);
                        }
                        
                        timerLogger.debug('Final session saved for user during reset', {
                            userId,
                            username: activeTimeData.username,
                            sessionDuration: Math.round(currentSession / 1000),
                            storedTotal: Math.round(storedTotal / 1000),
                            newTotal: Math.round(newTotalTime / 1000)
                        });
                    }
                }
            } catch (error) {
                timerLogger.warn('Could not save final sessions during reset', {
                    error: error instanceof Error ? {
                        message: error.message,
                        stack: error.stack
                    } : error
                });
            }
            
            // Active time collection'ını temizle
            try {
                const { globalStore } = await import('../utils/globalStore');
                const activeTimeCollection = globalStore.collection('activeTimeData');
                activeTimeCollection.clear();
                timerLogger.debug('Active time collection cleared during reset');
            } catch (error) {
                timerLogger.warn('Could not clear active time collection during reset', {
                    error: error instanceof Error ? {
                        message: error.message,
                        stack: error.stack
                    } : error
                });
            }
            
            // Database'deki tüm süreleri sıfırla
            const resetCount = await resetAllUserTimes();
            
            // Günlük süreleri de sıfırla
            await resetAllDailyUserTimes();
            
            // Yeni timer hesapla
            this.calculateNextResetTime();
            
            timerLogger.info('24-hour timer reset completed', {
                resetUserCount: resetCount,
                nextResetTime: new Date(this.nextResetTime).toISOString()
            });
            
            // Discord'a bildirim gönder
            await this.sendDiscordNotification(`🔄 **24 Saatlik Timer Reset Edildi**\n- ${resetCount} kullanıcının süresi sıfırlandı\n- Yeni timer başlatıldı\n- Sonraki reset: ${new Date(this.nextResetTime).toLocaleString('tr-TR')}`);
            
        } catch (error) {
            timerLogger.error('Error resetting timer:', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                } : error
            });
        }
    }

    /**
     * Discord'a bildirim gönder
     */
    private async sendDiscordNotification(message: string): Promise<void> {
        try {
            const { config } = await import('../config');
            const { client } = await import('../bot/run');
            const { TextChannel } = await import('discord.js');

            const logsChannelId = config().app.DISCORD_BOT.CHANNELS.LOGS;
            const logsChannel = client.channels.cache.get(logsChannelId.toString());

            if (logsChannel && logsChannel.isTextBased()) {
                //@ts-ignore
                await (logsChannel as TextChannel).send(message);
            }
        } catch (error) {
            timerLogger.error('Error sending Discord notification:', error);
        }
    }

    /**
     * Discord'a dosya ile birlikte bildirim gönder
     */
    private async sendDiscordNotificationWithFile(message: string, filePath: string): Promise<void> {
        try {
            const { config } = await import('../config');
            const { client } = await import('../bot/run');
            const { TextChannel, AttachmentBuilder } = await import('discord.js');

            const logsChannelId = config().app.DISCORD_BOT.CHANNELS.LOGS;
            const logsChannel = client.channels.cache.get(logsChannelId.toString());

            if (logsChannel && logsChannel.isTextBased()) {
                const attachment = new AttachmentBuilder(filePath);
                //@ts-ignore
                await (logsChannel as TextChannel).send({
                    content: message,
                    files: [attachment]
                });
            }
        } catch (error) {
            timerLogger.error('Error sending Discord notification with file:', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack
                } : error,
                filePath
            });
        }
    }

    /**
     * Global time collection'ından kullanıcı verisi al
     */
    public getTimeData(userId: string): any {
        return this.timeCollection.get(userId);
    }

    /**
     * Tüm time verilerini al
     */
    public getAllTimeData(): any[] {
        return Array.from(this.timeCollection.values());
    }

    /**
     * Username ile time verisi ara
     */
    public getTimeDataByUsername(username: string): any {
        return this.timeCollection.find((data: any) => 
            data.username?.toLowerCase() === username.toLowerCase()
        );
    }

    /**
     * Manuel süre güncelleme
     */
    public async updateUserTimeManually(userId: number, newTime: number, username?: string): Promise<boolean> {
        try {
            const { getPostgresInstance } = await import('../db_utilities');
            const pool = getPostgresInstance();

            await pool.query(`
                INSERT INTO time (user_id, username, total, updated_at) 
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    total = EXCLUDED.total,
                    username = COALESCE(EXCLUDED.username, time.username),
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, username, newTime]);

            await pool.query(`
                INSERT INTO daily_time (user_id, username, daily_total, cycle_start, updated_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    daily_total = EXCLUDED.daily_total,
                    username = COALESCE(EXCLUDED.username, daily_time.username),
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, username, newTime]);

            const currentTime = Date.now();

            const activeUser = this.activeUsers.get(userId);
            if (activeUser) {
                activeUser.total_time = newTime;
                activeUser.current_session = 0;
                activeUser.last_db_save = currentTime;
                if (username) activeUser.username = username;
                this.activeUsers.set(userId, activeUser);
            }

            const activeTimeData = this.activeTimeCollection.get(userId.toString()) as ActiveTimeData;
            if (activeTimeData) {
                activeTimeData.totalTime = newTime;
                activeTimeData.currentSession = 0;
                activeTimeData.lastUpdated = currentTime;
                if (username) activeTimeData.username = username;
                this.activeTimeCollection.set(userId.toString(), activeTimeData);
            }

            await this.updateTimeCollection(userId, username);

            timerLogger.info(`Manually updated time and daily time for user ${userId}: ${newTime}ms`);
            return true;
        } catch (error) {
            timerLogger.error(`Error manually updating time for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Timer durumunu al
     */
    public getStatus(): {
        isActive: boolean;
        nextResetTime: number;
        activeUserCount: number;
        timeUntilReset: number;
    } {
        let activeUserCount = 0;
        try {
            activeUserCount = this.activeTimeCollection.size || 0;
        } catch (error) {
            timerLogger.warn('Could not get active user count', error);
            activeUserCount = 0;
        }

        return {
            isActive: this.isActive,
            nextResetTime: this.nextResetTime,
            activeUserCount: activeUserCount,
            timeUntilReset: Math.max(0, this.nextResetTime - Date.now())
        };
    }

    /**
     * Timer collection'ını temizle
     */
    public clearTimerCollection(): void {
        try {
            const activeTimeCollection = this.globalStore.collection('activeTimeData');
            const previousSize = activeTimeCollection.size || 0;
            activeTimeCollection.clear();
            
            timerLogger.info('Timer collection cleared', {
                previousSize,
                currentSize: activeTimeCollection.size || 0
            });
        } catch (error) {
            timerLogger.error('Error clearing timer collection', error);
        }
    }

    /**
     * Time tablosunu tamamen temizle
     */
    public async clearTimeTable(): Promise<number> {
        try {
            const deletedCount = await resetAllUserTimes();
            timerLogger.info('Time table cleared', { deletedCount });
            return deletedCount;
        } catch (error) {
            timerLogger.error('Error clearing time table:', error);
            throw error;
        }
    }

    /**
     * Hem collection'ı hem de time tablosunu temizle
     */
    public async clearAll(): Promise<{ collectionSize: number; tableRecords: number }> {
        try {
            let collectionSize = 0;
            try {
                const activeTimeCollection = this.globalStore.collection('activeTimeData');
                collectionSize = activeTimeCollection.size || 0;
            } catch (error) {
                timerLogger.warn('Could not get collection size', error);
            }
            
            // Collection'ı temizle
            this.clearTimerCollection();
            
            // Time tablosunu temizle
            const tableRecords = await this.clearTimeTable();
            
            timerLogger.info('Timer worker completely cleared', {
                collectionSize,
                tableRecords
            });
            
            return { collectionSize, tableRecords };
        } catch (error) {
            timerLogger.error('Error clearing timer worker:', error);
            throw error;
        }
    }

    /**
     * Timer worker'ını durdur
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.secondlyUpdateInterval) {
            clearInterval(this.secondlyUpdateInterval);
            this.secondlyUpdateInterval = null;
        }

        if (this.minutelyDbSaveInterval) {
            clearInterval(this.minutelyDbSaveInterval);
            this.minutelyDbSaveInterval = null;
        }
        
        this.isActive = false;
        timerLogger.info('Timer Worker stopped (all intervals cleared)');
    }

    /**
     * Timer durumunu logla
     */
    public inspect(): void {
        const status = this.getStatus();
        
        let activeUsers = [];
        try {
            const activeTimeCollection = this.globalStore.collection('activeTimeData');
            activeUsers = Array.from(activeTimeCollection.entries()).map(([userId, data]: [string, any]) => ({
                userId: parseInt(userId),
                username: data.username || 'Unknown',
                sessionDuration: Math.round((data.currentSession || 0) / 1000),
                totalTime: Math.round((data.totalTime || 0) / 1000)
            }));
        } catch (error) {
            timerLogger.warn('Could not get active users for inspect', error);
        }
        
        timerLogger.info('Timer Worker Status', {
            ...status,
            nextResetTimeFormatted: new Date(status.nextResetTime).toISOString(),
            timeUntilResetFormatted: `${Math.round(status.timeUntilReset / (1000 * 60 * 60))} hours`,
            activeUsers
        });
    }
}

// Singleton instance
export const timerWorker = new TimerWorker();

// Export class for testing
export { TimerWorker };