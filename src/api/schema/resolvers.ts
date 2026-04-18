import { getUserRow } from '../../db_utilities/postgres';
import extrasJson from '../../../cache/extras.json';

const resolvers = {
  Query: {
    hello: () => "Hello from Apollo Server!",
    user: async (_: any, { username }: { username: string }) => {
      const user = await getUserRow({ in: 'username', value: username, out: 'all' });
      return user;
    }
  },
  User: {
    extrasMap: (parent: any) => {
      if (!parent.extras || !parent.extras.length) return [];
      
      return parent.extras.map((type: string) => {
        const badge = Object.entries(extrasJson.groups).find(([_, info]) => info.type === type);
        return {
          type,
          badgeName: badge ? badge[0] : type
        };
      });
    }
  }
};

export default resolvers;