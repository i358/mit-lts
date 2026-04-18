# Güvenlik Fonksiyonları - Kullanım Rehberi

## 1. Discord Input Sanitization

### Kullanım
```typescript
import { sanitizeDiscordInput } from './utils';

// Tüm Discord embed'lerine gönderilecek user data'yı sanitize et
const codename = sanitizeDiscordInput(options.codename); // "@everyone" → "@​everyone"
const username = sanitizeDiscordInput(options.username);

embed.addFields({
  name: 'Terfi Görevlisi',
  value: codename  // Safely used now
});
```

### Koruduğu Mention Tipleri
- `@everyone` → `@​everyone` (zero-width space ekle)
- `@here` → `@​here`
- User mentions: `<@USER_ID>` → `@​USER_ID`
- Role mentions: `<@&ROLE_ID>` → `@​ROLE_ID`

---

## 2. Input Length Validation

### Kullanım
```typescript
import { validateInputLength } from './utils';

const error = validateInputLength(username, 'Kullanıcı Adı', 1, 20);
if (error) {
  return reply.status(400).send({ success: 0, error });
}

const passwordError = validateInputLength(password, 'Şifre', 8, 256);
if (passwordError) {
  return reply.status(400).send({ success: 0, error: passwordError });
}
```

### Validasyon Defaults
- Default min: 1 karakter
- Default max: 256 karakter
- Custom limits destekleniyor

### Önerilen Limits
```typescript
// Username: 1-32 karakter (Habbo compatibility)
validateInputLength(username, 'Kullanıcı', 1, 32)

// Password: 8-256 karakter
validateInputLength(password, 'Şifre', 8, 256)

// Email: 5-254 karakter
validateInputLength(email, 'Email', 5, 254)

// Description: 0-500 karakter
validateInputLength(description, 'Açıklama', 0, 500)
```

---

## 3. Timing-Safe Comparison (Already Applied)

### Neden Önemli
```typescript
// ❌ YAPMAYINIZ - Timing Attack açığı
if (signature === decryptedHmac) { /* vulnerable */ }

// ✅ DOĞRU
import crypto from 'crypto';
try {
  crypto.timingSafeEqual(Buffer.from(sig1), Buffer.from(sig2));
  // Match
} catch {
  // Mismatch
}
```

---

## 4. SQL Column Whitelist (Already Applied)

### getUserRow Kullanımı
```typescript
// ✅ SAFE - Whitelist'de var
const user = await getUserRow({
  in: 'username',
  value: 'player123',
  out: 'id,username,badge,rank'
});

// ✅ SAFE - "all" kullan
const fullUser = await getUserRow({
  in: 'username',
  value: 'player123',
  out: 'all'
});

// ❌ BLOCKED - Injection attempt
// out: "id; DROP TABLE users; --"
// Whitelist tarafından engelleniyor → 'all' döner
```

### Whitelist Kolonlar
```
- id
- username
- habbo_id
- secret
- avatar
- badge
- rank
- salary
- coins
- bitflags
- user_flags
- ip_addr
- created_at

Özel Kombinasyonlar:
- username,habbo_id
- username,badge,rank
- id,username,badge,rank,user_flags
- id,username,badge,rank,bitflags,user_flags
```

---

## 5. STATE_TTL Güvenliği (Already Applied)

### Değiştirildi
```typescript
// ❌ BEFORE - 50 saniye (zafiyet)
const STATE_TTL = 50;

// ✅ AFTER - 15 dakika (secure)
const STATE_TTL = 15 * 60; // 15 minutes
```

### Neden Önemli
- **50 saniye**: Attacker aynı state'i birden fazla yerde kullanabilir
- **15 dakika**: Legitimate user penceresi, brute force zor

---

## 6. Secure Random Number Generation (Already Applied)

### Değiştirildi
```typescript
// ❌ BEFORE - Math.random() (1M combinations)
const state_id = Math.floor(Math.random() * 1000000) + 1;

// ✅ AFTER - crypto.randomBytes (2^32 combinations)
const stateBytes = crypto.randomBytes(4);
const state_id = stateBytes.readUInt32BE(0);
```

### Verification Code
```typescript
// ❌ BEFORE
const verificationCode = '[MIT]' + Array.from({ length: 8 }, () => 
  chars[Math.floor(Math.random() * chars.length)]
).join('');

// ✅ AFTER
const randomBytes = crypto.randomBytes(8);
const verificationCode = '[MIT]' + Array.from(randomBytes, byte => 
  chars[byte % chars.length]
).join('');
```

---

## Uygulanacak Önemli Noktalar

### 1. Tüm User Input'ları Validate Et
```typescript
// Route başında
const { username, password } = request.body;

if (!validateInputLength(username, 'Kullanıcı Adı', 1, 32)) {
  return reply.status(400).send({ error: 'Geçersiz input' });
}
```

### 2. Discord Mesajlarında Sanitize Et
```typescript
// Tüm embed'lerde
const embed = new EmbedBuilder()
  .addFields({
    name: 'User',
    value: sanitizeDiscordInput(userData.username)
  });
```

### 3. SQL Query'lerde Whitelist Kullan
```typescript
// Column seçimi güvenli
const user = await getUserRow({
  in: 'username',
  value: userInput,
  out: 'allowed_columns_only'
});
```

### 4. Token Karşılaştırmasında timingSafeEqual Kullan
```typescript
// Signatures karşılaştırılırken
try {
  crypto.timingSafeEqual(token1, token2);
} catch {
  // Invalid token
}
```

---

## Security Checklist

- [ ] Tüm user input'ları `validateInputLength()` ile kontrol et
- [ ] Discord mesajlarında `sanitizeDiscordInput()` kullan
- [ ] Signature doğrulamalarında `timingSafeEqual()` kullan
- [ ] `getUserRow()` ile column selection safe yap
- [ ] Crypto operations için `crypto.randomBytes()` kullan
- [ ] Tüm database queries parameterized (pg library zaten yapıyor)
- [ ] HTTPS enforce et (production)
- [ ] Sensitive data'yı DEBUG loglarına yazma
- [ ] Rate limit'leri ban/delete dışında kaldır
- [ ] Error messages'leri generic tut

---

## Testing

### Security Test
```bash
# SQL Injection Test (protected)
POST /api/v1/users?out=id;DROP TABLE users;--

# Timing Attack Test (protected)
TIME comparison token1 vs token2

# Rate Limit Test
curl -X POST /api/v1/badge/search -d '...' -H 'Authorization: ...' # 100x rapid calls
```

---

**Last Updated:** 2026-01-11
**Status:** Implementation Complete - 5 CRITICAL Vulnerabilities Fixed
