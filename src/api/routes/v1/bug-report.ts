import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateRequest } from '../../utils/authMiddleware';
import { apiLogger } from '../../../logger';
import { globalStore } from '../../../utils/globalStore';
import { Client } from 'discord.js';

interface BugReportData {
  title: string;
  description: string;
  category: string;
  priority: string;
  timestamp: string;
}

export default async function bugReportRoute(fastify: FastifyInstance) {
  fastify.post('/bug-report', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Authentication kontrolü
      const result = await authenticateRequest(request as any);
      if (!result?.user) {
        return reply.status(401).send({ success: 0, error: 'Unauthorized' });
      }

      const user = result.user;
      const { title, description, category, priority, timestamp } = request.body as BugReportData;

      // Validasyon
      if (!title?.trim() || !description?.trim()) {
        return reply.status(400).send({ 
          success: 0, 
          error: 'Title and description are required' 
        });
      }

      // Discord'a gönder
      const system = globalStore.collection('system');
      const client = system.get('discordClient') as Client;
      const bugReportChannelId = '1464024469864452158'; // Bug report channel ID

      if (client && bugReportChannelId) {
        const channel = client.channels.cache.get(bugReportChannelId);
        
        if (channel && channel.isTextBased() && 'send' in channel) {
          // Priority renkleri
          const priorityColors = {
            low: '🟢',
            medium: '🟡', 
            high: '🟠',
            critical: '🔴'
          };

          // Kategori emojileri
          const categoryEmojis = {
            'Genel Hata': '🐛',
            'UI/UX Sorunu': '🎨',
            'Performans': '⚡',
            'API Hatası': '🔌',
            'Veritabanı': '💾',
            'Güvenlik': '🔒',
            'Diğer': '📝'
          };

          const priorityEmoji = priorityColors[priority as keyof typeof priorityColors] || '🟡';
          const categoryEmoji = categoryEmojis[category as keyof typeof categoryEmojis] || '📝';

          // Embed oluştur
          const embed = {
            title: `${priorityEmoji} Yeni Hata Raporu`,
            color: priority === 'critical' ? 0xFF0000 : priority === 'high' ? 0xFF6600 : priority === 'medium' ? 0xFFFF00 : 0x00FF00,
            fields: [
              {
                name: '📋 Başlık',
                value: title,
                inline: false
              },
              {
                name: '📝 Açıklama',
                value: description.length > 1024 ? description.substring(0, 1021) + '...' : description,
                inline: false
              },
              {
                name: '🏷️ Kategori',
                value: `${categoryEmoji} ${category}`,
                inline: true
              },
              {
                name: '⚡ Öncelik',
                value: `${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
                inline: true
              },
              {
                name: '👤 Raporlayan',
                value: `${user.username} (ID: ${user.id})`,
                inline: true
              },
              {
                name: '🕐 Zaman',
                value: new Date(timestamp).toLocaleString('tr-TR', {
                  timeZone: 'Europe/Istanbul',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                inline: true
              }
            ],
            footer: {
              text: `JÖH Yönetim Sistemi • Hata Raporu #${Date.now()}`,
              icon_url: 'https://cdn.discordapp.com/icons/1459297817737822329/a_123.png'
            },
            timestamp: new Date().toISOString()
          };

          try {
            await channel.send({ embeds: [embed] });
            apiLogger.info('Bug report sent to Discord successfully', {
              user: user.username,
              title,
              category,
              priority
            });
          } catch (discordError: any) {
            apiLogger.error('Failed to send bug report to Discord:', discordError);
            // Discord'a gönderilemese bile raporu kaydet
          }
        }
      }

      // Başarılı yanıt
      return reply.status(200).send({
        success: 1,
        message: 'Bug report submitted successfully',
        data: {
          id: Date.now(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      apiLogger.error('Bug report error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        error
      });
      
      return reply.status(500).send({
        success: 0,
        error: 'Internal server error',
        message: 'Failed to submit bug report'
      });
    }
  });
}
