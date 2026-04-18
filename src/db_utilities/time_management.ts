import { getAllUserTimes, getUserTime } from './index';
import { getAllUsers } from './postgres';
import { getUserWorkTime } from './work_time';

export async function getAllUserTimeData() {
    try {
        // Get both stack and time table users
        const [stackUsers, allTimeUsers] = await Promise.all([
            getAllUsers(),
            getAllUserTimes()
        ]);

        // Create a map for stack users for quick lookup
        const stackUsersMap = new Map();
        stackUsers.forEach((user: any) => {
            stackUsersMap.set(user.id, user);
        });

        // Calculate time data for all users
        const allUserTimes = [];

        for (const timeUser of allTimeUsers) {
            if (!timeUser.user_id) continue;

            try {
                const timeData = await getUserTime(timeUser.user_id);
                const workTime = await getUserWorkTime(timeUser.user_id);
                const stackUser = stackUsersMap.get(timeUser.user_id);
                const username = timeUser.username || stackUser?.username || 'Unknown';
                const avatar = username ? `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&direction=2&head_direction=2&gesture=nrm&size=l` : null;

                allUserTimes.push({
                    userId: timeUser.user_id,
                    username,
                    avatar,
                    time: {
                        ...timeData,
                        workTime,
                        lastUpdated: Date.now(),
                        isInStack: !!stackUser
                    }
                });
            } catch (error) {
                console.warn(`Error getting time for user ${timeUser.user_id}:`, error);
            }
        }

        return allUserTimes;
    } catch (error) {
        throw error;
    }
}