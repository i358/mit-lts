import { FastifyInstance } from 'fastify';
import { apiLogger as logger } from '../../../logger';
import { authenticateRequest } from '../../utils/authMiddleware';
import {
    getWordleGameDate,
    getWordleWeekStart,
    getKredinerRandomQuestionIds,
    getKredinerQuestionById,
    hasKredinerPlayedToday,
    getKredinerTodayScore,
    createKredinerSession,
    getKredinerSession,
    validateKredinerAnswer,
    advanceKredinerSession,
    getKredinerLeaderboard,
    getKredinerUserWeekPoints
} from '../../../db_utilities/postgres';

const TIME_LIMIT_SECONDS = 30;

export default async function kredinerRoute(fastify: FastifyInstance) {
    /**
     * GET /krediner/status
     * Bugün oynanabilir mi, bugünkü skor (oynadıysa).
     */
    fastify.get('/krediner/status', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const gameDate = getWordleGameDate(new Date());
            const played = await hasKredinerPlayedToday(userId, gameDate);
            const todayScore = played ? await getKredinerTodayScore(userId, gameDate) : null;
            return reply.send({
                success: 1,
                canPlay: !played,
                ...(todayScore != null ? { todayScore } : {}),
                gameDate
            });
        } catch (error) {
            logger.error('Error in GET /krediner/status:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * POST /krediner/start
     * Bugün oynanmışsa 400. Yeni session, 10 soru, ilk soru + session_id + time_limit_seconds.
     */
    fastify.post('/krediner/start', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const gameDate = getWordleGameDate(new Date());
            if (await hasKredinerPlayedToday(userId, gameDate)) {
                return reply.status(400).send({ success: 0, error: 'Bugün zaten oynadınız.' });
            }
            const questionIds = await getKredinerRandomQuestionIds(10);
            if (questionIds.length < 10) {
                return reply.status(503).send({ success: 0, error: 'Yeterli soru yok.' });
            }
            const sessionId = await createKredinerSession(userId, gameDate, questionIds);
            const first = await getKredinerQuestionById(questionIds[0]);
            if (!first) {
                return reply.status(500).send({ success: 0, error: 'Soru yüklenemedi.' });
            }
            return reply.send({
                success: 1,
                session_id: sessionId,
                question: {
                    id: first.id,
                    question_text: first.question_text,
                    option_a: first.option_a,
                    option_b: first.option_b,
                    option_c: first.option_c,
                    option_d: first.option_d
                },
                time_limit_seconds: TIME_LIMIT_SECONDS
            });
        } catch (error) {
            logger.error('Error in POST /krediner/start:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * POST /krediner/answer
     * session_id, question_id, selected_letter (A|B|C|D), timed_out? (optional).
     */
    fastify.post('/krediner/answer', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const body = request.body as {
                session_id?: string;
                question_id?: number;
                selected_letter?: string;
                timed_out?: boolean;
            };
            const sessionId = body?.session_id;
            const questionId = body?.question_id;
            const selectedLetter = body?.selected_letter;
            const timedOut = !!body?.timed_out;
            if (!sessionId || questionId == null) {
                return reply.status(400).send({ success: 0, error: 'session_id ve question_id gerekli' });
            }
            const session = await getKredinerSession(sessionId);
            if (!session || session.user_id !== userId) {
                return reply.status(404).send({ success: 0, error: 'Oturum bulunamadı.' });
            }
            const currentQuestionId = session.question_ids[session.current_index];
            if (currentQuestionId !== questionId) {
                return reply.status(400).send({ success: 0, error: 'Sıradaki soru ile eşleşmiyor.' });
            }
            if (timedOut) {
                const { game_over, score } = await advanceKredinerSession(sessionId, false);
                return reply.send({
                    success: 1,
                    correct: false,
                    game_over: true,
                    score
                });
            }
            const letter = (selectedLetter || '').toUpperCase();
            if (!['A', 'B', 'C', 'D'].includes(letter)) {
                return reply.status(400).send({ success: 0, error: 'selected_letter A, B, C veya D olmalı' });
            }
            const correct = await validateKredinerAnswer(questionId, letter);
            const { game_over, score } = await advanceKredinerSession(sessionId, correct);
            if (!correct) {
                return reply.send({
                    success: 1,
                    correct: false,
                    game_over: true,
                    score
                });
            }
            if (game_over) {
                return reply.send({
                    success: 1,
                    correct: true,
                    game_over: true,
                    score: 10
                });
            }
            const nextId = session.question_ids[session.current_index + 1];
            const nextQuestion = await getKredinerQuestionById(nextId);
            if (!nextQuestion) {
                return reply.status(500).send({ success: 0, error: 'Sonraki soru yüklenemedi.' });
            }
            return reply.send({
                success: 1,
                correct: true,
                game_over: false,
                next_question: {
                    id: nextQuestion.id,
                    question_text: nextQuestion.question_text,
                    option_a: nextQuestion.option_a,
                    option_b: nextQuestion.option_b,
                    option_c: nextQuestion.option_c,
                    option_d: nextQuestion.option_d
                },
                time_limit_seconds: TIME_LIMIT_SECONDS
            });
        } catch (error) {
            logger.error('Error in POST /krediner/answer:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * GET /krediner/leaderboard
     * Query: ?week=YYYY-MM-DD (opsiyonel; yoksa cari hafta).
     */
    fastify.get('/krediner/leaderboard', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const query = request.query as { week?: string };
            const weekStart = query.week ?? getWordleWeekStart(new Date());
            const rankings = await getKredinerLeaderboard(weekStart, 50);
            return reply.send({
                success: 1,
                weekStart,
                rankings: rankings.map(({ rank, username, points }) => ({ rank, username, points }))
            });
        } catch (error) {
            logger.error('Error in GET /krediner/leaderboard:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });

    /**
     * GET /krediner/me
     * Bu haftaki toplam puan, bugün oynadıysa bugünkü skor.
     */
    fastify.get('/krediner/me', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request, { requireUserFlagsNonZero: false });
            if (!authResult?.user) {
                return reply.status(401).send({ success: 0, error: 'Yetkilendirme gerekli' });
            }
            const userId = String(authResult.user.id);
            const gameDate = getWordleGameDate(new Date());
            const weekStart = getWordleWeekStart(new Date());
            const [todayScore, weekPoints] = await Promise.all([
                getKredinerTodayScore(userId, gameDate),
                getKredinerUserWeekPoints(userId, weekStart)
            ]);
            return reply.send({
                success: 1,
                weekPoints,
                ...(todayScore != null ? { todayScore } : {})
            });
        } catch (error) {
            logger.error('Error in GET /krediner/me:', error);
            return reply.status(500).send({ success: 0, error: 'Sunucu hatası' });
        }
    });
}
