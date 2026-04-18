import { FastifyReply, FastifyRequest } from 'fastify';
import { getRedisInstance } from '../../db_utilities/redis';
import { apiLogger } from '../../logger';

export interface ActionRateLimitConfig {
    actionKey: string;      // Eylemi tanımlayan benzersiz anahtar
    maxActions: number;     // Maximum izin verilen eylem sayısı
    windowSeconds: number;  // Rate limit penceresi (saniye)
}

export class ActionRateLimiter {
    private redis = getRedisInstance();
    private static PENALTY_THRESHOLD = 3; // Kaç kez limit aşımı olursa ceza uygulansın
    private static PENALTY_DURATION = 300; // Ceza süresi (saniye)

    constructor(private config: ActionRateLimitConfig) {}

    private getKey(ip: string): string {
        return `action_rate_limit:${this.config.actionKey}:${ip}`;
    }

    private getCountKey(ip: string): string {
        return `action_count:${this.config.actionKey}:${ip}`;
    }

    private getLastActionKey(ip: string): string {
        return `last_action:${this.config.actionKey}:${ip}`;
    }

    private getPenaltyKey(ip: string): string {
        return `rate_limit_penalty:${ip}`;
    }

    private getViolationCountKey(ip: string): string {
        return `rate_limit_violations:${this.config.actionKey}:${ip}`;
    }

    private async checkPenalty(ip: string): Promise<number> {
        const penaltyKey = this.getPenaltyKey(ip);
        const penalty = await this.redis.get(penaltyKey);
        return penalty ? parseInt(penalty) : 0;
    }

    private async incrementViolations(ip: string): Promise<number> {
        const violationKey = this.getViolationCountKey(ip);
        const count = await this.redis.incr(violationKey);
        // Violation sayısı 24 saat sonra sıfırlansın
        await this.redis.expire(violationKey, 24 * 60 * 60);
        return count;
    }

    private async applyPenalty(ip: string, violations: number): Promise<void> {
        const penaltyKey = this.getPenaltyKey(ip);
        const penaltyDuration = Math.min(
            ActionRateLimiter.PENALTY_DURATION * Math.pow(2, violations - ActionRateLimiter.PENALTY_THRESHOLD),
            3600 // Maximum 1 saat ceza
        );
        await this.redis.setex(penaltyKey, penaltyDuration, penaltyDuration.toString());
    }

    private async resetLimits(ip: string): Promise<void> {
        const countKey = this.getCountKey(ip);
        const lastActionKey = this.getLastActionKey(ip);
        const violationKey = this.getViolationCountKey(ip);
        
        await Promise.all([
            this.redis.del(countKey),
            this.redis.del(lastActionKey),
            this.redis.del(violationKey)
        ]);
    }

    public async checkRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
        const ip = request.ip;
        const countKey = this.getCountKey(ip);
        const lastActionKey = this.getLastActionKey(ip);

        try {
            // Ceza kontrolü
            const penaltyTime = await this.checkPenalty(ip);
            if (penaltyTime > 0) {
                reply.status(429).send({
                    error: 'Rate Limit Penalty',
                    message: `You are temporarily blocked due to excessive requests. Please wait ${penaltyTime} seconds.`,
                    remainingSeconds: penaltyTime,
                    isPenalty: true
                });
                return false;
            }

            // Son eylemin zamanını kontrol et
            const lastActionTime = await this.redis.get(lastActionKey);
            if (lastActionTime) {
                const lastActionTimestamp = parseInt(lastActionTime);
                const timeSinceLastAction = Date.now() - lastActionTimestamp;
                
                // Süre penceresi dolmuşsa limitleri sıfırla
                if (timeSinceLastAction >= this.config.windowSeconds * 1000) {
                    await this.resetLimits(ip);
                    await this.redis.setex(countKey, this.config.windowSeconds, '1');
                    return true;
                }
                
                if (timeSinceLastAction < this.config.windowSeconds * 1000) {
                    const remainingTime = Math.ceil((this.config.windowSeconds * 1000 - timeSinceLastAction) / 1000);
                    
                    // İhlal sayısını artır
                    const violations = await this.incrementViolations(ip);
                    
                    // Eğer ihlal sayısı eşiği geçtiyse ceza uygula
                    if (violations >= ActionRateLimiter.PENALTY_THRESHOLD) {
                        await this.applyPenalty(ip, violations);
                        const penaltyTime = await this.checkPenalty(ip);
                        
                        reply.status(429).send({
                            error: 'Rate Limit Penalty',
                            message: `You are temporarily blocked due to excessive requests. Please wait ${penaltyTime} seconds.`,
                            remainingSeconds: penaltyTime,
                            isPenalty: true
                        });
                        return false;
                    }
                    
                    reply.status(429).send({
                        error: 'Rate Limit Exceeded',
                        message: `Please wait ${remainingTime} seconds before performing this action again.`,
                        remainingSeconds: remainingTime,
                        isPenalty: false
                    });
                    return false;
                }
            }

            // Mevcut sayıyı kontrol et
            const currentCount = await this.redis.get(countKey);
            const count = currentCount ? parseInt(currentCount) : 0;

            if (count >= this.config.maxActions) {
                // Eylem limitine ulaşıldı, son eylemin zamanını kaydet
                await this.redis.setex(lastActionKey, this.config.windowSeconds, Date.now().toString());
                // Tüm limitleri sıfırla
                await this.resetLimits(ip);
                
                // İhlal sayısını artır
                const violations = await this.incrementViolations(ip);
                
                // Eğer ihlal sayısı eşiği geçtiyse ceza uygula
                if (violations >= ActionRateLimiter.PENALTY_THRESHOLD) {
                    await this.applyPenalty(ip, violations);
                    const penaltyTime = await this.checkPenalty(ip);
                    
                    reply.status(429).send({
                        error: 'Rate Limit Penalty',
                        message: `You are temporarily blocked due to excessive requests. Please wait ${penaltyTime} seconds.`,
                        remainingSeconds: penaltyTime,
                        isPenalty: true
                    });
                    return false;
                }
                
                reply.status(429).send({
                    error: 'Rate Limit Exceeded',
                    message: `Action limit reached. Please wait ${this.config.windowSeconds} seconds.`,
                    remainingSeconds: this.config.windowSeconds,
                    isPenalty: false
                });
                return false;
            }

            // Sayacı artır
            if (count === 0) {
                await this.redis.setex(countKey, this.config.windowSeconds, '1');
            } else {
                await this.redis.incr(countKey);
            }

            return true;
        } catch (error) {
            apiLogger.error('Action rate limit error:', error);
            // Redis hatası durumunda isteğe izin ver
            return true;
        }
    }
}

// Route'lar için rate limit konfigürasyonları
export const routeRateLimits = {
    ban: new ActionRateLimiter({
        actionKey: 'user_ban',
        maxActions: 2,          // 2 ban işleminden sonra
        windowSeconds: 30       // 30 saniye bekle
    }),
    delete: new ActionRateLimiter({
        actionKey: 'user_delete',
        maxActions: 1,          // Her silme işleminden sonra
        windowSeconds: 50       // 50 saniye bekle
    })
};