export function formatTime(milliseconds: number): string {
  if (milliseconds === 0) return '0 dk';
  
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours} sa ${remainingMinutes > 0 ? `${remainingMinutes} dk` : ''}`;
  }
  
  return `${minutes} dk`;
}