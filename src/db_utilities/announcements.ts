import { createLogger, LogLevel } from '../logger';
import {
    AnnouncementRow,
    createAnnouncement,
    getAnnouncement,
    getAllAnnouncements,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementActive
} from './postgres';

const logger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: '../logs/announcements.log',
    module: "Announcements"
});

/**
 * Announcement türleri ve alt kategorileri
 */
export const ANNOUNCEMENT_TYPES = {
    UPDATE_NOTES: {
        name: 'Güncelleme Notları',
        subtypes: {
            SECURITY_UPDATE: 'Güvenlik Güncellemesi',
            DESIGN_UPDATE: 'Tasarım Güncellemesi',
            FEATURE_UPDATE: 'Özellik Güncellemesi',
            BUG_FIX: 'Hata Düzeltmesi',
            PERFORMANCE: 'Performans İyileştirmesi',
            OTHER: 'Diğer'
        }
    },
    ANNOUNCEMENT: {
        name: 'Duyurular',
        subtypes: {
            SERVER_ANNOUNCEMENT: 'Sunucu Duyurusu',
            EVENT_ANNOUNCEMENT: 'Etkinlik Duyurusu',
            GENERAL_ANNOUNCEMENT: 'Genel Duyuru',
            MAINTENANCE_NOTICE: 'Bakım Bildirimi',
            SECURITY_ALERT: 'Güvenlik Uyarısı',
            OTHER: 'Diğer'
        }
    },
    PLANS: {
        name: 'Planlar',
        subtypes: {
            MAINTENANCE: 'Bakım Kesintisi',
            TECHNICAL_ISSUE: 'Teknik Arıza',
            REPAIR: 'Onarım',
            RESET: 'Sıfırlama',
            UPGRADE: 'Yükseltme',
            OTHER: 'Diğer'
        }
    }
} as const;

/**
 * Yeni duyuru yayınla
 */
export async function publishAnnouncement(data: {
    type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type: string;
    title: string;
    description: string;
    published_by: string;
}): Promise<AnnouncementRow | null> {
    try {
        // Validate type and sub_type
        if (!ANNOUNCEMENT_TYPES[data.type]) {
            throw new Error(`Invalid announcement type: ${data.type}`);
        }

        const subtypeConfig = ANNOUNCEMENT_TYPES[data.type];
        if (!subtypeConfig.subtypes[data.sub_type as keyof typeof subtypeConfig.subtypes]) {
            throw new Error(`Invalid sub_type for ${data.type}: ${data.sub_type}`);
        }

        const announcement = await createAnnouncement({
            type: data.type,
            sub_type: data.sub_type,
            title: data.title,
            description: data.description,
            published_by: data.published_by,
            published_at: new Date(),
            is_active: true
        });

        logger.info(`Announcement published: ${data.title} by ${data.published_by}`);
        return announcement;
    } catch (error) {
        logger.error('Error publishing announcement:', error);
        throw error;
    }
}

/**
 * Aktif duyuruları getir
 */
export async function getActiveAnnouncements(filters?: {
    type?: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type?: string;
    limit?: number;
    offset?: number;
}): Promise<AnnouncementRow[]> {
    try {
        const announcements = await getAllAnnouncements({
            ...filters,
            is_active: true
        });

        return announcements;
    } catch (error) {
        logger.error('Error getting active announcements:', error);
        throw error;
    }
}

/**
 * Duyuruyu deaktif et (soft delete)
 */
export async function deactivateAnnouncement(id: number): Promise<AnnouncementRow | null> {
    try {
        return await toggleAnnouncementActive(id, false);
    } catch (error) {
        logger.error('Error deactivating announcement:', error);
        throw error;
    }
}

/**
 * Duyuruyu sil (hard delete)
 */
export async function removeAnnouncement(id: number): Promise<boolean> {
    try {
        const result = await deleteAnnouncement(id);
        if (result) {
            logger.info(`Announcement deleted: ${id}`);
        }
        return result;
    } catch (error) {
        logger.error('Error removing announcement:', error);
        throw error;
    }
}

/**
 * Duyuruyu güncelle
 */
export async function editAnnouncement(id: number, data: Partial<Omit<AnnouncementRow, 'id' | 'created_at'>>): Promise<AnnouncementRow | null> {
    try {
        const announcement = await updateAnnouncement(id, data);
        if (announcement) {
            logger.info(`Announcement updated: ${announcement.title}`);
        }
        return announcement;
    } catch (error) {
        logger.error('Error editing announcement:', error);
        throw error;
    }
}

/**
 * Açıklamayı kısalt (description truncate)
 */
export function truncateDescription(description: string, maxLength: number = 150): string {
    if (description.length <= maxLength) {
        return description;
    }
    return description.substring(0, maxLength) + '...';
}

/**
 * Announcement type display name getir
 */
export function getTypeName(type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS'): string {
    return ANNOUNCEMENT_TYPES[type].name;
}

/**
 * Announcement sub_type display name getir
 */
export function getSubTypeName(type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS', sub_type: string): string {
    const config = ANNOUNCEMENT_TYPES[type];
    return config.subtypes[sub_type as keyof typeof config.subtypes] || sub_type;
}

/**
 * Tüm subtypes'ları belirli bir type için getir
 */
export function getSubtypesForType(type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS'): Record<string, string> {
    return ANNOUNCEMENT_TYPES[type].subtypes;
}

/**
 * En son duyuruları getir (public view için)
 */
export async function getLatestAnnouncements(limit: number = 10): Promise<AnnouncementRow[]> {
    try {
        const announcements = await getActiveAnnouncements({
            limit,
            offset: 0
        });

        return announcements;
    } catch (error) {
        logger.error('Error getting latest announcements:', error);
        throw error;
    }
}

/**
 * Type'a göre duyuruları getir (public view için)
 */
export async function getAnnouncementsByType(
    type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS',
    limit: number = 10,
    offset: number = 0
): Promise<AnnouncementRow[]> {
    try {
        return await getActiveAnnouncements({
            type,
            limit,
            offset
        });
    } catch (error) {
        logger.error(`Error getting announcements by type ${type}:`, error);
        throw error;
    }
}

/**
 * Detailed announcement getir (ID'ye göre)
 */
export async function getAnnouncementDetails(id: number): Promise<AnnouncementRow | null> {
    try {
        return await getAnnouncement(id);
    } catch (error) {
        logger.error(`Error getting announcement details for ID ${id}:`, error);
        throw error;
    }
}
