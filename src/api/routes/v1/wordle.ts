import { FastifyInstance } from 'fastify';
import { apiLogger as logger } from '../../../logger';
import { authenticateRequest } from '../../utils/authMiddleware';
import {
    getWordleGameDate,
    getWordleWeekStart,
    getWordOfTheDay,
    getWordleDailyGuess,
    getWordleLeaderboard,
    getWordleUserWeekPoints,
    recordWordleCorrectGuess,
    recordWordleAttempt
} from '../../../db_utilities/postgres';

type FeedbackColor = 'green' | 'yellow' | 'gray';

/**
 * Wordle feedback: her pozisyon için green (doğru yerde), yellow (kelimede var yanlış yerde), gray (yok).
 */
function computeFeedback(guess: string, solution: string): FeedbackColor[] {
    const g = guess.toLowerCase().split('');
    const s = solution.toLowerCase().split('');
    const feedback: FeedbackColor[] = new Array(5).fill('gray');

    const remaining = new Map<string, number>();
    for (const c of s) remaining.set(c, (remaining.get(c) ?? 0) + 1);

    for (let i = 0; i < 5; i++) {
        if (g[i] === s[i]) {
            feedback[i] = 'green';
            remaining.set(g[i], (remaining.get(g[i]) ?? 1) - 1);
        }
    }
    for (let i = 0; i < 5; i++) {
        if (feedback[i] === 'green') continue;
        const count = remaining.get(g[i]) ?? 0;
        if (count > 0) {
            feedback[i] = 'yellow';
            remaining.set(g[i], count - 1);
        }
    }
    return feedback;
}

export default async function wordleRoute(fastify: FastifyInstance) {
    /**
     * GET /wordle/today
     * Bugünün kelime durumu (kelime gönderilmez).
     */
    fastify.get('/wordle/today', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const gameDate = getWordleGameDate(new Date());
            const daily = await getWordleDailyGuess(userId, gameDate);
            const hasPlayedToday = daily != null;
            const guessedToday = daily?.guessed_correctly ?? false;
            const attempts = daily?.attempts ?? 0;

            return reply.send({
                success: 1,
                wordLength: 5,
                hasPlayedToday,
                guessedToday,
                ...(hasPlayedToday ? { attempts } : {})
            });
        } catch (error) {
            logger.error('Error in GET /wordle/today:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * POST /wordle/guess
     * 5 harfli tahmin gönder; feedback döner. Doğruysa puan yazılır.
     */
    fastify.post('/wordle/guess', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const gameDate = getWordleGameDate(new Date());
            const daily = await getWordleDailyGuess(userId, gameDate);
            if (daily?.guessed_correctly) {
                return reply.status(400).send({ success: 0, error: 'Bugünkü kelimeyi zaten bildiniz.' });
            }

            const body = request.body as { guess?: string };
            const raw = body?.guess;
            if (typeof raw !== 'string') {
                return reply.status(400).send({ success: 0, error: 'guess (5 harf) gerekli' });
            }
            const guess = raw.trim().toLowerCase();
            if (guess.length !== 5) {
                return reply.status(400).send({ success: 0, error: 'Tahmin 5 harf olmalı' });
            }

            // Sözlük kontrolü opsiyonel; her 5 harfli tahmin kabul edilir, geri bildirim günün kelimesine göre verilir.
            const dayWord = await getWordOfTheDay(gameDate);
            if (!dayWord) {
                return reply.status(503).send({ success: 0, error: 'Günün kelimesi yüklenemedi' });
            }

            const feedback = computeFeedback(guess, dayWord.word);
            const correct = guess === dayWord.word;
            const attempts = (daily?.attempts ?? 0) + 1;

            if (correct) {
                await recordWordleCorrectGuess(userId, gameDate, attempts);
                return reply.send({
                    success: 1,
                    result: 'correct',
                    feedback,
                    attempts
                });
            }

            await recordWordleAttempt(userId, gameDate);
            return reply.send({
                success: 1,
                result: 'wrong',
                feedback,
                attempts
            });
        } catch (error) {
            logger.error('Error in POST /wordle/guess:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * GET /wordle/leaderboard
     * Query: ?week=YYYY-MM-DD (opsiyonel; yoksa cari hafta).
     */
    fastify.get('/wordle/leaderboard', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const query = request.query as { week?: string };
            const weekStart = query.week
                ? query.week
                : getWordleWeekStart(new Date());
            const rankings = await getWordleLeaderboard(weekStart, 50);
            return reply.send({
                success: 1,
                weekStart,
                rankings: rankings.map(({ rank, username, points }) => ({ rank, username, points }))
            });
        } catch (error) {
            logger.error('Error in GET /wordle/leaderboard:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * GET /wordle/me
     * Bu haftaki puan ve bugün bilindi mi.
     */
    fastify.get('/wordle/me', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const gameDate = getWordleGameDate(new Date());
            const weekStart = getWordleWeekStart(new Date());
            const [daily, weekPoints] = await Promise.all([
                getWordleDailyGuess(userId, gameDate),
                getWordleUserWeekPoints(userId, weekStart)
            ]);
            return reply.send({
                success: 1,
                weekPoints,
                guessedToday: daily?.guessed_correctly ?? false
            });
        } catch (error) {
            logger.error('Error in GET /wordle/me:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });
}
