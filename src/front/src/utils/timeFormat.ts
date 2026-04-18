export function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}s ${minutes}d ${secs}sn`;
    } else if (minutes > 0) {
        return `${minutes}d ${secs}sn`;
    } else {
        return `${secs}sn`;
    }
}

export function timeToSeconds(hours: number, minutes: number, seconds: number): number {
    return (hours * 3600) + (minutes * 60) + seconds;
}

export function secondsToTime(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return { hours, minutes, seconds };
}