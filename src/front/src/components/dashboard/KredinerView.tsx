import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';
import { Trophy } from 'lucide-react';

interface KredinerQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
}

type GamePhase = 'idle' | 'playing' | 'correct_feedback' | 'game_over';

export function KredinerView() {
  const [canPlay, setCanPlay] = useState(true);
  const [todayScore, setTodayScore] = useState<number | null>(null);
  const [gameDate, setGameDate] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<{ weekStart: string; rankings: LeaderboardEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<KredinerQuestion | null>(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timedOutTrigger, setTimedOutTrigger] = useState(false);
  const sessionIdRef = useRef(sessionId);
  const currentQuestionRef = useRef(currentQuestion);
  sessionIdRef.current = sessionId;
  currentQuestionRef.current = currentQuestion;

  const loadStatus = useCallback(async () => {
    try {
      const data = await mitAPI.getKredinerStatus();
      setCanPlay(!!data.canPlay);
      setTodayScore(data.todayScore ?? null);
      setGameDate(data.gameDate ?? '');
    } catch {
      setCanPlay(false);
      setTodayScore(null);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await mitAPI.getKredinerLeaderboard();
      setLeaderboard({ weekStart: data.weekStart, rankings: data.rankings ?? [] });
    } catch {
      setLeaderboard({ weekStart: '', rankings: [] });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadStatus(), loadLeaderboard()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStatus, loadLeaderboard]);

  // Timer for current question
  useEffect(() => {
    if (phase !== 'playing' || !currentQuestion || submitting) return;
    setSecondsLeft(timeLimitSeconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setTimedOutTrigger(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentQuestion?.id, timeLimitSeconds]);

  useEffect(() => {
    if (!timedOutTrigger) return;
    setTimedOutTrigger(false);
    const sid = sessionIdRef.current;
    const q = currentQuestionRef.current;
    if (!sid || !q) return;
    setSubmitting(true);
    mitAPI
      .submitKredinerAnswer({
        session_id: sid,
        question_id: q.id,
        selected_letter: 'A',
        timed_out: true
      })
      .then((data) => {
        setPhase('game_over');
        setFinalScore(data.score ?? 0);
        setCurrentQuestion(null);
        setSessionId(null);
        loadStatus();
        loadLeaderboard();
        toast.error('Süre doldu. Oyun bitti.');
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.error || 'Cevap gönderilemedi');
      })
      .finally(() => setSubmitting(false));
  }, [timedOutTrigger, loadStatus, loadLeaderboard]);

  const handleStart = async () => {
    if (!canPlay || submitting) return;
    setSubmitting(true);
    try {
      const data = await mitAPI.startKredinerGame();
      setSessionId(data.session_id);
      setCurrentQuestion(data.question);
      setTimeLimitSeconds(data.time_limit_seconds ?? 30);
      setSecondsLeft(data.time_limit_seconds ?? 30);
      setPhase('playing');
      setFinalScore(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Oyun başlatılamadı');
      await loadStatus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = async (letter: 'A' | 'B' | 'C' | 'D') => {
    if (!sessionId || !currentQuestion || submitting || phase !== 'playing') return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSubmitting(true);
    try {
      const data = await mitAPI.submitKredinerAnswer({
        session_id: sessionId,
        question_id: currentQuestion.id,
        selected_letter: letter
      });
      if (data.correct === false && data.game_over) {
        setPhase('game_over');
        setFinalScore(data.score ?? 0);
        setCurrentQuestion(null);
        setSessionId(null);
        await Promise.all([loadStatus(), loadLeaderboard()]);
        toast.error('Yanlış cevap. Oyun bitti.');
        return;
      }
      if (data.correct && data.game_over) {
        setPhase('game_over');
        setFinalScore(data.score ?? 10);
        setCurrentQuestion(null);
        setSessionId(null);
        await Promise.all([loadStatus(), loadLeaderboard()]);
        toast.success('Tebrikler, 10 puan!');
        return;
      }
      if (data.correct && data.next_question) {
        setPhase('correct_feedback');
        toast.success('Doğru!');
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => {
          setCurrentQuestion(data.next_question);
          setTimeLimitSeconds(data.time_limit_seconds ?? 30);
          setSecondsLeft(data.time_limit_seconds ?? 30);
          setPhase('playing');
        }, 800);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Cevap gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <p className="text-gray-400">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-400" />
          Kim Krediner Olmak İster?
        </h1>
        <p className="text-gray-400 text-sm">
          Günde bir kez, 10 soru, soru başı süre sınırı, doğru başı 1 puan. Yanlışta oyun biter. Haftalık sıralama.
        </p>
      </div>

      {/* Already played today */}
      {!canPlay && phase === 'idle' && (
        <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4">
          <p className="text-gray-200">
            Bugün oynadınız. Skorunuz: <span className="font-semibold text-amber-400">{todayScore ?? 0}</span>
          </p>
          {gameDate && <p className="text-xs text-gray-500 mt-1">Tarih: {gameDate}</p>}
        </div>
      )}

      {/* Start button */}
      {canPlay && phase === 'idle' && !currentQuestion && (
        <button
          type="button"
          onClick={handleStart}
          disabled={submitting}
          className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium transition"
        >
          {submitting ? 'Başlatılıyor...' : 'Oyna'}
        </button>
      )}

      {/* Game: question + options + timer */}
      {(phase === 'playing' || phase === 'correct_feedback') && currentQuestion && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Süre</span>
            <span
              className={`font-mono text-lg font-bold ${secondsLeft <= 5 ? 'text-red-400' : 'text-amber-400'}`}
            >
              {secondsLeft} sn
            </span>
          </div>
          <p className="text-lg text-white font-medium">{currentQuestion.question_text}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const option =
                letter === 'A'
                  ? currentQuestion.option_a
                  : letter === 'B'
                    ? currentQuestion.option_b
                    : letter === 'C'
                      ? currentQuestion.option_c
                      : currentQuestion.option_d;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleAnswer(letter)}
                  disabled={submitting || phase === 'correct_feedback'}
                  className="text-left px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 text-white hover:border-amber-500 hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  <span className="font-semibold text-amber-400 mr-2">{letter}.</span>
                  {option}
                </button>
              );
            })}
          </div>
          {phase === 'correct_feedback' && (
            <p className="text-center text-emerald-400 font-medium">Doğru! Sonraki soruya geçiliyor...</p>
          )}
        </div>
      )}

      {/* Game over */}
      {phase === 'game_over' && finalScore !== null && (
        <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4">
          <p className="text-gray-200">
            Oyun bitti. Skorunuz: <span className="font-semibold text-amber-400">{finalScore}</span>
          </p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="mt-10 pt-8 border-t border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          Bu haftanın sıralaması
        </h2>
        {leaderboard && leaderboard.rankings.length > 0 ? (
          <ul className="space-y-2">
            {leaderboard.rankings.slice(0, 20).map((entry) => (
              <li
                key={entry.rank}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50 text-gray-200"
              >
                <span className="font-mono text-gray-400 w-8">#{entry.rank}</span>
                <span className="font-medium">{entry.username}</span>
                <span className="text-amber-400">{entry.points} puan</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Henüz sıralama yok.</p>
        )}
        {leaderboard?.weekStart && (
          <p className="text-xs text-gray-500 mt-2">Hafta: {leaderboard.weekStart}</p>
        )}
      </div>
    </div>
  );
}
