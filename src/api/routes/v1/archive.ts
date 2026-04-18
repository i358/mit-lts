import { FastifyInstance } from "fastify";
import { getArchiveRow } from "../../../db_utilities/postgres";
import { getArchiveRecordsWithCleanup } from "../../../db_utilities/archive";
import { apiLogger } from "../../../logger";
import { authenticateRequest } from '../../utils/authMiddleware';
import * as path from "path";

export default async function archiveRoute(fastify: FastifyInstance) {
  fastify.post("/archive", async (request, reply) => {
    try {
      const { date, type = 'all' } = request.body as { date?: string, type?: 'badge_up' | 'badge_down' | 'bulk-promotion' | 'mr' | 'warning' | 'all' };
      
      // Sadece token kontrolü - rozet gereksinimi yok
      const authResult = await authenticateRequest(request as any);
      if (!authResult?.user) {
        return reply.status(401).send({ success: 0, error: "Yetkisiz Erişim" });
      }

      // Tüm kayıtları veya belirli bir tipe ait kayıtları getir
      const archiveRecords = await getArchiveRecordsWithCleanup(type);

      if (!archiveRecords) {
        return reply.status(200).send({
          success: 1,
          data: [],
        });
      }

      
      let filteredRecords = archiveRecords;
      if (date) {
        const filterDate = new Date(date);
        filteredRecords = archiveRecords.filter((record: any) => {
          const recordDate = new Date(record.action_date);
          return recordDate.toDateString() === filterDate.toDateString();
        });
      }
      const badgesPath = path.join(__dirname, "../../../../cache/badges.json");
      if (!require("fs").existsSync(badgesPath)) {
        apiLogger.error("badges.json not found at path:", badgesPath);
        return reply
          .status(500)
          .send({ success: 0, error: "Badge configuration not found" });
      }

      const badgesData = require(badgesPath);
      
      const formattedRecords = filteredRecords.map((record: any) => {
        let oldBadgeIndex: number, newBadgeIndex: number, oldRankNum: number, newRankNum: number;

        try {
          oldBadgeIndex = parseInt(record.old_badge);
          newBadgeIndex = parseInt(record.new_badge);
          oldRankNum = parseInt(record.old_rank);
          newRankNum = parseInt(record.new_rank);

          apiLogger.debug('Badge and rank indices:', {
            username: record.username,
            oldBadgeIndex,
            newBadgeIndex,
            oldRankNum,
            newRankNum,
            badgesLength: Object.keys(badgesData).length
          });

          // Geçersiz değerler için kontrol
          if (isNaN(oldBadgeIndex) || isNaN(newBadgeIndex) || isNaN(oldRankNum) || isNaN(newRankNum)) {
            apiLogger.warn("Invalid badge or rank values:", { 
              old_badge: record.old_badge, 
              new_badge: record.new_badge,
              old_rank: record.old_rank,
              new_rank: record.new_rank 
            });
          }
        } catch (error) {
          apiLogger.error("Error parsing badge or rank values:", error);
          oldBadgeIndex = -1;
          newBadgeIndex = -1;
          oldRankNum = -1;
          newRankNum = -1;
        }

        const oldBadgeName = !isNaN(oldBadgeIndex) ? Object.keys(badgesData)[oldBadgeIndex - 1] : 'Bilinmeyen Rozet';
        const newBadgeName = !isNaN(newBadgeIndex) ? Object.keys(badgesData)[newBadgeIndex - 1] : 'Bilinmeyen Rozet';
        
        const oldRankName = !isNaN(oldRankNum) && oldBadgeName && badgesData[oldBadgeName]?.ranks 
          ? badgesData[oldBadgeName].ranks[oldRankNum - 1] || `Rank ${oldRankNum}`
          : 'Bilinmeyen Rank';
          
        const newRankName = !isNaN(newRankNum) && newBadgeName && badgesData[newBadgeName]?.ranks
          ? badgesData[newBadgeName].ranks[newRankNum - 1] || `Rank ${newRankNum}`
          : 'Bilinmeyen Rank';

        return {
          id: record.id,
          username: record.username,
          type: record.type,
          promoter: record.promoter,
          old_badge: oldBadgeName !== 'Bilinmeyen Rozet' ? oldBadgeName : `Rozet ${record.old_badge}`,
          old_rank: oldRankName,
          new_badge: newBadgeName !== 'Bilinmeyen Rozet' ? newBadgeName : `Rozet ${record.new_badge}`,
          new_rank: newRankName,
          codename: record.codename,
          action_timestamp: record.action_timestamp,
          action_date: record.action_date,
          action_time: record.action_time,
        };
      });

      return reply.status(200).send({
        success: 1,
        data: formattedRecords,
      });
    } catch (error) {
      apiLogger.error("Error in POST /archive:", error);
      return reply.status(500).send({
        success: 0,
        error: "Internal Server Error",
      });
    }
  });
}
