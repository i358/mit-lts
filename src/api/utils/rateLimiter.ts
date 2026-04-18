import { FastifyReply, FastifyRequest } from 'fastify';
import { getRedisInstance } from '../../db_utilities/redis';
import { apiLogger } from '../../logger';
import { globalStore } from '../../utils';
import { APIConfig } from '../../types/api';

export class RateLimiter {
    private redis = getRedisInstance();
    private config: APIConfig;
    private maxRequests: number;
    private windowMs: number;
    private penaltyWindowMs: number = 24 * 60 * 60 * 1000; // 24 hours
    private maxViolations: number = 3;
    private baseBlockDuration: number = 60 * 1000; // 1 minute

    constructor() {
        const config = globalStore.collection("config");
        this.config = config.get("api") as APIConfig;
        this.maxRequests = this.config.RATE_LIMIT?.MAX || 1000;
        this.windowMs = this.parseTimeWindow(this.config.RATE_LIMIT?.TIME_WINDOW || '1 minute');
    }

    private parseTimeWindow(timeWindow: string): number {
        const [amount, unit] = timeWindow.split(' ');
        const amountNum = parseInt(amount);
        
        switch(unit.toLowerCase()) {
            case 'second':
            case 'seconds':
                return amountNum * 1000;
            case 'minute':
            case 'minutes':
                return amountNum * 60 * 1000;
            case 'hour':
            case 'hours':
                return amountNum * 60 * 60 * 1000;
            default:
                return 60000; // default 1 minute
        }
    }

    private getKey(ip: string): string {
        return `rate_limit:${ip}`;
    }

    private getViolationKey(ip: string): string {
        return `rate_limit_violations:${ip}`;
    }

    private getBlockKey(ip: string): string {
        return `rate_limit_block:${ip}`;
    }

    private calculateBlockDuration(violations: number): number {
        // Exponential backoff: 1min, 2min, 4min, 8min, etc.
        return this.baseBlockDuration * Math.pow(2, violations - 1);
    }

    public async middleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const ip = request.ip;
        const key = this.getKey(ip);
        const blockKey = this.getBlockKey(ip);
        const violationKey = this.getViolationKey(ip);

        try {
            // Check if IP is blocked
            const blockExpiry = await this.redis.get(blockKey);
            if (blockExpiry) {
                const remainingTime = Math.ceil((parseInt(blockExpiry) - Date.now()) / 1000);
                reply.status(429).send({
                    error: 'Too Many Requests',
                    message: `You are temporarily blocked. Please try again in ${remainingTime} seconds.`
                });
                return;
            }

            // Get current count
            const currentCount = await this.redis.get(key);
            const count = currentCount ? parseInt(currentCount) : 0;

            if (count >= this.maxRequests) {
                // Record violation
                const violations = await this.redis.incr(violationKey);
                await this.redis.expire(violationKey, Math.ceil(this.penaltyWindowMs / 1000));

                // If violations exceed threshold, apply block
                if (violations >= this.maxViolations) {
                    const blockDuration = this.calculateBlockDuration(violations);
                    const expiryTime = Date.now() + blockDuration;
                    await this.redis.setex(blockKey, Math.ceil(blockDuration / 1000), expiryTime.toString());
                    
                    reply.status(429).send({
                        error: 'Too Many Requests',
                        message: `Rate limit exceeded. You are blocked for ${blockDuration / 1000} seconds due to repeated violations.`
                    });
                    return;
                }

                throw new Error('Rate limit exceeded');
            }

            // Increment counter
            if (count === 0) {
                // First request, set initial count and expiry
                await this.redis.setex(key, Math.ceil(this.windowMs / 1000), '1');
            } else {
                // Increment existing counter
                await this.redis.incr(key);
            }

            // Set rate limit headers
            const remaining = this.maxRequests - (count + 1);
            reply.header('X-RateLimit-Limit', this.maxRequests);
            reply.header('X-RateLimit-Remaining', remaining);

        } catch (error) {
            apiLogger.error('Rate limit error:', error);
            if (error instanceof Error && error.message === 'Rate limit exceeded') {
                reply.status(429).send({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later.'
                });
            } else {
                // For other redis errors, allow the request but log the error
                apiLogger.error('Redis rate limit error:', error);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();