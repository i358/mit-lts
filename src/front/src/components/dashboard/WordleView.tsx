import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { mitAPI } from '../../services/api';

const ROWS = 6;
const COLS = 5;

type FeedbackColor = 'green' | 'yellow' | 'gray';

interface TodayInfo {
  wordLength: number;
  hasPlayedToday: boolean;
  guessedToday: boolean;
  attempts?: number;
}

interface RowState {
  letters: string;
  feedback?: FeedbackColor[];
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
}

const bgFromFeedback: Record<FeedbackColor, string> = {
  green: 'bg-emerald-600 border-emerald-500',
  yellow: 'bg-amber-500/80 border-amber-400',
  gray: 'bg-gray-600 border-gray-500'
};

export function WordleView() {
  const [todayInfo, setTodayInfo] = useState<TodayInfo | null>(null);
  const [rows, setRows] = useState<RowState[]>(() => Array(ROWS).fill(null).map(() => ({ letters: '' })));
  const [currentGuess, setCurrentGuess] = useState('');
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ weekStart: string; rankings: LeaderboardEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gameOver, setGameOver] = useState<'won' | 'lost' | null>(null);

  const loadToday = useCallback(async () => {
    try {
      const data = await mitAPI.getWordleToday();
      setTodayInfo({
        wordLength: data.wordLength ?? 5,
        hasPlayedToday: data.hasPlayedToday ?? false,
        guessedToday: data.guessedToday ?? false,
        attempts: data.attempts
      });
      if (data.guessedToday) setGameOver('won');
      if (data.hasPlayedToday && !data.guessedToday) {
        const attempts = data.attempts ?? 0;
        if (attempts >= 6) setGameOver('lost');
        setAttemptIndex(attempts);
      }
    } catch (e) {
      toast.error('Wordle durumu yüklenemedi');
      setTodayInfo({ wordLength: 5, hasPlayedToday: false, guessedToday: false });
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await mitAPI.getWordleLeaderboard();
      setLeaderboard({ weekStart: data.weekStart, rankings: data.rankings ?? [] });
    } catch {
      setLeaderboard({ weekStart: '', rankings: [] });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadToday(), loadLeaderboard()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadToday, loadLeaderboard]);

  const handleSubmit = async () => {
    const guess = currentGuess.trim().toLowerCase();
    if (guess.length !== 5 || submitting || gameOver || todayInfo?.guessedToday) return;

    setSubmitting(true);
    try {
      const data = await mitAPI.submitWordleGuess(guess);
      const feedback = (data.feedback ?? []) as FeedbackColor[];
      setRows(prev => {
        const next = [...prev];
        next[attemptIndex] = { letters: guess, feedback };
        return next;
      });
      setCurrentGuess('');
      setAttemptIndex(i => i + 1);

      if (data.result === 'correct') {
        setGameOver('won');
        setTodayInfo(t => t ? { ...t, guessedToday: true, hasPlayedToday: true, attempts: data.attempts } : null);
        toast.success('Tebrikler! 1 puan kazandınız.');
      } else if ((data.attempts ?? attemptIndex + 1) >= 6) {
        setGameOver('lost');
        setTodayInfo(t => t ? { ...t, hasPlayedToday: true, attempts: 6 } : null);
        toast.error('Maalesef bugünkü kelimeyi bilemediniz.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Tahmin gönderilemedi';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Backspace') {
      setCurrentGuess(s => s.slice(0, -1));
    }
    // Harfleri sadece input'un onChange'i ile ekliyoruz; burada ekleme yapmayalım (çift karakter engeli)
  };

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
        <h1 className="text-2xl font-bold text-white mb-1">Wordle!</h1>
        <p className="text-gray-400 text-sm">Bugünkü kelimeyi 6 denemede bul. Her doğru tahmin 1 puan.</p>
      </div>

      {/* Grid */}
      <div className="space-y-2">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-5 gap-2">
            {Array.from({ length: COLS }, (_, colIdx) => {
              const isCurrentRow = rowIdx === attemptIndex;
              const letter = isCurrentRow ? currentGuess[colIdx] ?? '' : row.letters[colIdx] ?? '';
              const feedback = row.feedback?.[colIdx];
              const bg = feedback ? bgFromFeedback[feedback] : 'bg-gray-800 border-gray-600';
              return (
                <motion.div
                  key={colIdx}
                  initial={false}
                  className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 border-2 rounded-lg font-bold text-lg uppercase text-white ${bg}`}
                >
                  {letter}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex flex-col items-center gap-3">
        <input
          type="text"
          maxLength={5}
          value={currentGuess}
          onChange={e => setCurrentGuess(e.target.value.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, '').toLowerCase().slice(0, 5))}
          onKeyDown={handleKeyDown}
          disabled={!!gameOver || todayInfo?.guessedToday === true || submitting}
          placeholder="5 harf"
          className="w-48 px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-center font-mono text-lg uppercase tracking-widest placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={currentGuess.length !== 5 || !!gameOver || todayInfo?.guessedToday === true || submitting}
          className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
        >
          {submitting ? 'Gönderiliyor...' : 'Gönder'}
        </button>
      </div>

      {/* Messages */}
      {gameOver === 'won' && (
        <p className="text-center text-emerald-400 font-medium">Bugünkü kelimeyi bildiniz. 1 puan kazandınız!</p>
      )}
      {gameOver === 'lost' && (
        <p className="text-center text-gray-400">Maalesef bugünkü kelimeyi bilemediniz. Yarın tekrar deneyin.</p>
      )}

      {/* Leaderboard */}
      <div className="mt-10 pt-8 border-t border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Bu haftanın sıralaması</h2>
        {leaderboard && leaderboard.rankings.length > 0 ? (
          <ul className="space-y-2">
            {leaderboard.rankings.slice(0, 20).map(entry => (
              <li key={entry.rank} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50 text-gray-200">
                <span className="font-mono text-gray-400 w-8">#{entry.rank}</span>
                <span className="font-medium">{entry.username}</span>
                <span className="text-blue-400">{entry.points} puan</span>
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
