import * as fs from 'fs';
import * as path from 'path';

export interface BadgeData {
    [key: string]: {
        ranks: string[];
        duration?: number;
        description?: string;
    }
}

export function getBadgeDetails(badge: number, rank: number): { badgeName: string | null; rankName: string | null } {
    try {
        const badgesPath = path.join(__dirname, '../../cache/badges.json');
        if (!fs.existsSync(badgesPath)) {
            return { badgeName: null, rankName: null };
        }

        const badgesData: BadgeData = JSON.parse(fs.readFileSync(badgesPath, 'utf8'));

        if (badge === 0) {
            return { badgeName: "No Badge", rankName: "No Rank" };
        }

        // Get badge name (1-based index)
        const badgeName = Object.keys(badgesData)[badge - 1] || null;
        
        // If we have a valid badge name, get the rank name
        let rankName = null;
        if (badgeName && badgesData[badgeName]?.ranks) {
            rankName = badgesData[badgeName].ranks[rank - 1] || null;
        }

        return { badgeName, rankName };
    } catch (error) {
        console.error('Error getting badge details:', error);
        return { badgeName: null, rankName: null };
    }
}