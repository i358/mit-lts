export interface PromotionResponse {
  success: number;
  message: string;
  current_badge: number;
  current_badge_name: string;
  current_rank: number;
  current_rank_name: string;
  next_badge: number;
  next_badge_name: string;
  next_rank: number;
  next_rank_name: string;
  promotion_type: 'badge_up' | 'rank_up';
  current_time: number;
  required_time: number;
  remaining_time?: number;
}

export interface PromotionResult {
  success: number;
  message: string;
  old_badge?: number;
  old_badge_name?: string;
  old_rank?: number;
  old_rank_name?: string;
  new_badge?: number;
  new_badge_name?: string;
  new_rank?: number;
  new_rank_name?: string;
  codename?: string;
  promotion_type?: 'badge_up' | 'rank_up';
  time?: number;
}