/**
 * Wordle kelime listesi: Türkçe 1000 kelime.
 * Türkçe liste için: node scripts/build-turkish-wordlist.js
 * Bu script Türkçe JSON'u kopyalar (build-turkish-wordlist.js zaten wordle-words.json üretir).
 */
const fs = require('fs');
const path = require('path');

// Türkçe liste build-turkish-wordlist.js ile üretildi; bu script sadece mevcut JSON'u korur veya Türkçe build'i çalıştırır
const dataDir = path.join(__dirname, '..', 'src', 'data');
const jsonPath = path.join(dataDir, 'wordle-words.json');
const trPath = path.join(dataDir, 'wordle-words-tr.txt');

if (fs.existsSync(trPath)) {
  const words = fs.readFileSync(trPath, 'utf-8').split(/\n/).map(w => w.trim()).filter(w => w.length === 5);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(words.slice(0, 1000), null, 0));
  console.error('Wrote', Math.min(words.length, 1000), 'Turkish words to', jsonPath);
} else {
  require('./build-turkish-wordlist.js');
}
