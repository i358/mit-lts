import { createCanvas, loadImage } from 'canvas';

interface TrainingImageOptions {
  traineeUsername: string;
  trainerUsername: string;
  timestamp: string;
  discordVerified: boolean;
}

export async function createTrainingImage(options: TrainingImageOptions): Promise<Buffer> {
  const { traineeUsername, trainerUsername, timestamp, discordVerified } = options;

  const width = 820;
  const height = 360;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0B1220');
  gradient.addColorStop(0.5, '#111827');
  gradient.addColorStop(1, '#0B1220');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const lineGradient = ctx.createLinearGradient(0, 0, 0, height);
  lineGradient.addColorStop(0, '#F59E0B');
  lineGradient.addColorStop(0.5, '#F97316');
  lineGradient.addColorStop(1, '#F59E0B');
  ctx.fillStyle = lineGradient;
  ctx.fillRect(0, 0, 6, height);

  ctx.textBaseline = 'top';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Inter';
  ctx.fillText('EĞİTİM KAYDI', 24, 20);

  ctx.font = '14px Inter';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(timestamp, 24, 56);

  const verifiedText = discordVerified ? 'DOĞRULANDI' : 'DOĞRULANMADI';
  ctx.font = 'bold 14px Inter';
  ctx.fillStyle = discordVerified ? '#34D399' : '#F87171';
  const verifiedTextWidth = ctx.measureText(verifiedText).width;
  ctx.fillText(verifiedText, width - verifiedTextWidth - 24, 28);

  const boxX = 18;
  const boxY = 95;
  const boxW = width - 36;
  const boxH = 170;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.font = 'bold 14px Inter';
  ctx.fillStyle = '#FDBA74';
  ctx.fillText('Eğitim Alan', 30, boxY + 18);
  ctx.fillText('Eğitmen', 30, boxY + 78);

  ctx.font = '18px Inter';
  ctx.fillStyle = '#E5E7EB';
  ctx.fillText(traineeUsername, 30, boxY + 40);

  ctx.fillStyle = '#D1FAE5';
  ctx.fillText(trainerUsername, 30, boxY + 100);

  try {
    const avatarSize = 110;
    const avatarY = height - avatarSize - 30;

    const traineeAvatarUrl = `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(traineeUsername)}&direction=2&head_direction=2&gesture=nrm&size=l`;
    const trainerAvatarUrl = `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(trainerUsername)}&direction=2&head_direction=2&gesture=nrm&size=l`;

    const [traineeAvatar, trainerAvatar] = await Promise.all([
      loadImage(traineeAvatarUrl),
      loadImage(trainerAvatarUrl)
    ]);

    const traineeX = width - (avatarSize * 2) - 55;
    const trainerX = width - avatarSize - 25;

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(traineeX, avatarY, avatarSize, avatarSize, 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(trainerX, avatarY, avatarSize, avatarSize, 10);
    ctx.stroke();

    ctx.drawImage(traineeAvatar, traineeX, avatarY, avatarSize, avatarSize);
    ctx.drawImage(trainerAvatar, trainerX, avatarY, avatarSize, avatarSize);

    ctx.font = '12px Inter';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('Trainee', traineeX, avatarY + avatarSize + 6);
    ctx.fillText('Trainer', trainerX, avatarY + avatarSize + 6);
  } catch {
    // ignore avatar load errors
  }

  ctx.font = '14px Inter';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Kayıt sisteme işlendi.', 24, height - 28);

  return canvas.toBuffer('image/png');
}
