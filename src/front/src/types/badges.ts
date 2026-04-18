export interface Badge {
  id: number;
  ranks: string[];
  duration: number;
}

export interface BadgesData {
  [key: string]: Badge;
}