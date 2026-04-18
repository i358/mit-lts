import { PromotionData, PromotionResult } from '../types';
import { ranks, promotionTimes } from '../data/promotionData';

const userPromotionHistory: Record<string, {
  lastPromotionTime: number;
  currentRank: string;
  currentBadge: string;
}> = {};

export function calculatePromotion(data: PromotionData): PromotionResult {
  const { userName, workTime, badge, rank } = data;
  
  // Kullanıcı geçmişi yoksa oluştur
  if (!userPromotionHistory[userName]) {
    userPromotionHistory[userName] = {
      lastPromotionTime: 0,
      currentRank: rank,
      currentBadge: badge
    };
  }
  
  const user = userPromotionHistory[userName];
  const requiredTime = promotionTimes[badge as keyof typeof promotionTimes];
  const timeSinceLastPromotion = workTime - user.lastPromotionTime;
  
  // Eğer süre yeterli değilse
  if (timeSinceLastPromotion < requiredTime) {
    return {
      success: false,
      message: `Süre yetersiz! Gerekli süre: ${requiredTime} dk, Eksik süre: ${requiredTime - timeSinceLastPromotion} dk`,
      requiredTime,
      remainingTime: requiredTime - timeSinceLastPromotion
    };
  }
  
  // Bir sonraki rütbeyi bul
  const currentRanks = ranks[badge as keyof typeof ranks];
  const currentIndex = currentRanks.indexOf(rank);
  
  // Eğer mevcut rozetin son rütbesinde değilse
  if (currentIndex < currentRanks.length - 1) {
    const nextRank = currentRanks[currentIndex + 1];
    user.currentRank = nextRank;
    user.lastPromotionTime = workTime;
    return {
      success: true,
      message: `${userName} > ${nextRank}`,
      nextRank: nextRank,
      badge: badge
    };
  }
  
  // Son rütbeye ulaştıysa, bir sonraki rozete geç
  const badgeKeys = Object.keys(ranks);
  const badgeIndex = badgeKeys.indexOf(badge);
  
  if (badgeIndex < badgeKeys.length - 1) {
    const nextBadge = badgeKeys[badgeIndex + 1];
    const nextRank = ranks[nextBadge as keyof typeof ranks][0];
    
    user.currentBadge = nextBadge;
    user.currentRank = nextRank;
    user.lastPromotionTime = workTime;
    
    return {
      success: true,
      message: `${userName} > ${nextRank} (${nextBadge})`,
      nextRank: nextRank,
      badge: nextBadge
    };
  }
  
  // En son rozetin son rütbesine ulaştıysa
  return {
    success: false,
    message: "En son rütbeye ulaşıldı. Daha fazla terfi yok."
  };
}

export function calculateSalaryRating(workHours: number, extraWorkHours: number = 0, afkMinutes: number = 0): {
  rating: number;
  extraRating: number;
  totalRating: number;
  message: string;
} {
  const baseRating = Math.floor(workHours / 8); // Her 8 saatte 1 maaş rozeti
  const extraRating = Math.floor(extraWorkHours / 4); // Her 4 ek saatte 1 ek maaş rozeti
  const afkPenalty = Math.floor(afkMinutes / 30); // Her 30 dakika AFK'da 1 rozet kesinti
  
  const totalRating = Math.max(0, baseRating + extraRating - afkPenalty);
  
  return {
    rating: baseRating,
    extraRating,
    totalRating,
    message: `Maaş Rozeti: ${baseRating}, Ek Maaş Rozeti: ${extraRating}, Toplam: ${totalRating}`
  };
}