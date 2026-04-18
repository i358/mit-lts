import { FastifyInstance } from 'fastify';
import { apiLogger } from '../../logger';

// Statik olarak REST route dosyalarını yükler
export async function loadRoutes(fastify: FastifyInstance) {
  try {
    // /api/v1 prefix'i altında tüm route'ları register et
    await fastify.register(async (instance) => {
      // Sadece REST route dosyalarını ekle (graphql hariç)
      const restRoutes = [
        require('../routes/v1/health').default,
        require('../routes/v1/users').default,
        require('../routes/v1/badge').default,
        require('../routes/v1/verify').default,
        require('../routes/v1/management').default,
        require('../routes/v1/archive').default,
        require('../routes/v1/demotion').default,
        require('../routes/v1/user').default,
        require('../routes/v1/bulk-promotion').default,
        require('../routes/v1/training').default,
        require('../routes/v1/auth').default,
        require('../routes/v1/bug-report').default,
        require('../routes/v1/announcements').default,
        require('../routes/v1/wordle').default,
        require('../routes/v1/krediner').default
      ];

      for (const route of restRoutes) {
        if (typeof route === 'function') {
          await route(instance);
          apiLogger.info('Route loaded:', { route: route.name });
        } else {
          apiLogger.warn('Route is not a function:', { route });
        }
      }
    }, { prefix: '/v1' });

    apiLogger.info('All REST routes loaded under /v1');
  } catch (error) {
    apiLogger.error('Error loading REST routes:', error);
    throw error;
  }
}
