import { createCanvas, loadImage } from 'canvas';

interface PromotionImageOptions {
    username: string;
    oldBadge: string;
    oldRank: string;
    newBadge: string;
    newRank: string;
    codename: string;
    timestamp: string;
    type?: 'promotion' | 'demotion';
    workTime?: {
        hours: number;
        minutes: number;
    };
}

export async function createPromotionImage(options: PromotionImageOptions): Promise<Buffer> {
    const {
        username,
        oldBadge,
        oldRank,
        newBadge,
        newRank,
        codename,
        timestamp,
        type = 'promotion',
        workTime
    } = options;

    const isDemotion = type === 'demotion';
    const primary = isDemotion ? '#EF4444' : '#3B82F6';
    const secondary = isDemotion ? '#F97316' : '#8B5CF6';
    const accentText = isDemotion ? '#F87171' : '#60A5FA';
    const arrow = isDemotion ? '<<' : '>>';

    // Canvas boyutlarını ayarla
    const width = 700;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Arkaplan gradient'i
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0F172A');  // slate-900
    gradient.addColorStop(0.5, '#1E293B');  // slate-800
    gradient.addColorStop(1, '#0F172A');  // slate-900
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Hafif doku efekti ekle
    for (let i = 0; i < width; i += 4) {
        for (let j = 0; j < height; j += 4) {
            if (Math.random() > 0.5) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
                ctx.fillRect(i, j, 2, 2);
            }
        }
    }

    // Sol taraftaki gradient çizgi
    const lineGradient = ctx.createLinearGradient(0, 0, 0, height);
    lineGradient.addColorStop(0, primary);
    lineGradient.addColorStop(0.5, secondary);
    lineGradient.addColorStop(1, primary);
    ctx.fillStyle = lineGradient;
    ctx.fillRect(0, 0, 6, height);

    // Üst kısımda ince bir highlight çizgisi
    const highlightGradient = ctx.createLinearGradient(0, 0, width, 0);
    highlightGradient.addColorStop(0, isDemotion ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.1)');
    highlightGradient.addColorStop(0.5, isDemotion ? 'rgba(249, 115, 22, 0.12)' : 'rgba(139, 92, 246, 0.1)');
    highlightGradient.addColorStop(1, isDemotion ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.1)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(0, 0, width, 2);

    // Başlık kısmı için arka plan efekti
    const headerGradient = ctx.createLinearGradient(0, 0, width, 60);
    headerGradient.addColorStop(0, isDemotion ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.1)');
    headerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, width, 60);

    // Font ayarları
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Inter';

    // Kullanıcı adı (gölgeli)
    ctx.shadowColor = isDemotion ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText(username, 24, 20);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 16px Inter';
    ctx.fillStyle = isDemotion ? '#FCA5A5' : '#BFDBFE';
    const actionText = isDemotion ? 'TENZİL' : 'TERFİ';
    const actionTextWidth = ctx.measureText(actionText).width;
    ctx.fillText(actionText, width - actionTextWidth - 24, 26);

    // Timestamp
    ctx.font = '14px Inter';
    ctx.fillStyle = '#94A3B8';  // slate-400
    ctx.fillText(timestamp, 24, 54);

    // Rozet ve Rütbe bilgileri
    ctx.font = '16px Inter';
    const y = 100;

    const badgeChange = `${oldBadge} ${arrow} ${newBadge}`;
    // Rozet
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Rozet:', 24, y);
    ctx.fillText(badgeChange, 24, y + 24);

    // Rütbe
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Rütbe:', 24, y + 84);
    ctx.fillStyle = accentText;
    ctx.font = 'bold 16px Inter';
    
    // Rütbe değişimi gösterimi
    const rankChange = `${oldRank} ${arrow} ${newRank}`;
    ctx.fillText(rankChange, 24, y + 108);

    // Terfi Görevlisi
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(isDemotion ? 'Tenzil Görevlisi:' : 'Terfi Görevlisi:', 24, y + 168);
    ctx.fillStyle = accentText;
    ctx.fillText(codename, 24, y + 192);

    // Çalışma süresi (eğer varsa)
    if (workTime) {
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText('Terfi Süresi:', width - 200, y);
        ctx.fillStyle = '#D1D5DB';
        ctx.fillText(`${workTime.hours} saat ${workTime.minutes} dakika`, width - 200, y + 24);
    }

    // Kullanıcı avatarını yükle ve çiz
    try {
        const avatarUrl = `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${username}&direction=2&head_direction=2&gesture=nrm&size=l`;
        const avatarImage = await loadImage(avatarUrl);
        
        // Avatar için pozisyon hesapla
        const avatarSize = 120;
        const avatarY = height - avatarSize - 20;  // Alttan 20 piksel yukarıda
        const avatarX = width - avatarSize - 20;   // Sağdan 20 piksel içeride
        
        // Avatar için arka plan efekti
        const glowRadius = avatarSize * 0.8;
        const avatarGradient = ctx.createRadialGradient(
            avatarX + avatarSize/2, avatarY + avatarSize/2, 0,
            avatarX + avatarSize/2, avatarY + avatarSize/2, glowRadius
        );
        avatarGradient.addColorStop(0, isDemotion ? 'rgba(239, 68, 68, 0.18)' : 'rgba(59, 130, 246, 0.15)');
        avatarGradient.addColorStop(0.5, isDemotion ? 'rgba(249, 115, 22, 0.12)' : 'rgba(139, 92, 246, 0.1)');
        avatarGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        // Gradient arka planı çiz
        ctx.fillStyle = avatarGradient;
        ctx.fillRect(
            avatarX - glowRadius/2, 
            avatarY - glowRadius/2, 
            avatarSize + glowRadius, 
            avatarSize + glowRadius
        );
        
        // Avatar için hafif bir border efekti
        ctx.strokeStyle = isDemotion ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 10);
        ctx.stroke();
        
        // Avatarı orijinal aspect ratio'sunu koruyarak çiz
        const aspectRatio = avatarImage.width / avatarImage.height;
        let drawWidth = avatarSize;
        let drawHeight = avatarSize;
        let drawX = avatarX;
        let drawY = avatarY;
        
        if (aspectRatio > 1) {
            drawHeight = avatarSize / aspectRatio;
            drawY = avatarY + (avatarSize - drawHeight) / 2;
        } else {
            drawWidth = avatarSize * aspectRatio;
            drawX = avatarX + (avatarSize - drawWidth) / 2;
        }
        
        ctx.drawImage(avatarImage, drawX, drawY, drawWidth, drawHeight);
    } catch (error) {
        console.error('Avatar yükleme hatası:', error);
    }

    // Canvas'ı buffer'a dönüştür
    return canvas.toBuffer('image/png');
}

interface BulkPromotionImageOptions {
    promoter: string;
    timestamp: string;
    multiplier: number;
    total: number;
    users: Array<{
        username: string;
        newRank: string;
        action?: string;
        error?: string;
    }>;
}

export async function createBulkPromotionImage(options: BulkPromotionImageOptions): Promise<Buffer> {
    const { promoter, timestamp, multiplier, total, users } = options;

    const width = 900;
    const rowHeight = 44;
    const headerHeight = 120;
    const footerHeight = 50;
    const rows = Math.max(1, Math.min(users.length, 5));
    const height = headerHeight + rows * rowHeight + footerHeight;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0B1220');
    gradient.addColorStop(0.5, '#111827');
    gradient.addColorStop(1, '#0B1220');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const lineGradient = ctx.createLinearGradient(0, 0, 0, height);
    lineGradient.addColorStop(0, '#22C55E');
    lineGradient.addColorStop(0.5, '#10B981');
    lineGradient.addColorStop(1, '#22C55E');
    ctx.fillStyle = lineGradient;
    ctx.fillRect(0, 0, 6, height);

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Inter';
    ctx.fillText('TOPLU TERFİ', 24, 20);

    ctx.font = '14px Inter';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(timestamp, 24, 56);

    ctx.font = '16px Inter';
    ctx.fillStyle = '#D1D5DB';
    ctx.fillText(`Terfi Görevlisi:`, 24, 80);
    ctx.fillStyle = '#86EFAC';
    ctx.fillText(promoter, 160, 80);

    ctx.fillStyle = '#D1D5DB';
    ctx.fillText(`Terfi Değeri:`, width - 260, 56);
    ctx.fillStyle = '#86EFAC';
    ctx.fillText(`${multiplier}x`, width - 150, 56);

    ctx.fillStyle = '#D1D5DB';
    ctx.fillText(`Toplam:`, width - 260, 80);
    ctx.fillStyle = '#86EFAC';
    ctx.fillText(`${total}`, width - 150, 80);

    const tableTop = headerHeight;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(18, tableTop - 10, width - 36, rows * rowHeight + 20);

    ctx.font = 'bold 14px Inter';
    ctx.fillStyle = '#A7F3D0';
    ctx.fillText('Kullanıcı', 30, tableTop);
    ctx.fillText('Sonuç', 420, tableTop);
    ctx.fillText('Durum', 780, tableTop);

    ctx.font = '14px Inter';
    for (let i = 0; i < rows; i++) {
        const u = users[i];
        const y = tableTop + 24 + i * rowHeight;

        ctx.fillStyle = 'rgba(148,163,184,0.25)';
        ctx.fillRect(24, y + rowHeight - 8, width - 48, 1);

        ctx.fillStyle = '#E5E7EB';
        ctx.fillText(`${i + 1}. ${u.username}`, 30, y);

        const resultText = u.error ? u.error : (u.newRank || '-');
        ctx.fillStyle = u.error ? '#FCA5A5' : '#D1FAE5';
        ctx.fillText(resultText.length > 44 ? `${resultText.slice(0, 44)}...` : resultText, 420, y);

        const statusText = u.error ? 'HATA' : (u.action === 'registered' ? 'KAYIT' : 'TERFİ');
        ctx.fillStyle = u.error ? '#F87171' : (u.action === 'registered' ? '#60A5FA' : '#34D399');
        ctx.fillText(statusText, 780, y);
    }

    ctx.font = '14px Inter';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Devamı için sitedeki arşive bakın.', 24, height - 30);

    return canvas.toBuffer('image/png');
}