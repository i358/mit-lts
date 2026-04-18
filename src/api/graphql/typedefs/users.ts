const typeDefs = `#graphql
  type UserTime {
    storedTotal: Float!
    currentSessionTime: Float!
    realTimeTotal: Float!
    isActive: Boolean!
    lastSeen: Float
    workTime: Float!
    requiredWorkTime: Float!
  }

  type BadgeInfo {
    badge: Int!
    rank: Int!
    badgeName: String
    rankName: String
    requiredTime: Float!
  }

  type User {
    id: ID!
    username: String!
    figure: String
    motto: String
    look: String
    index: Int
    lastSeen: Float
    time: UserTime!
    avatar: String
    dailyTime: Float!
    badgeInfo: BadgeInfo!
    extras: [String]
  }

  type Query {
    user(id: ID, username: String, index: Int): User
    users(limit: Int = 50, offset: Int = 0): [User]!
    activeUsers(limit: Int = 50, offset: Int = 0): [User]!
    topUsers(limit: Int = 10, offset: Int = 0): [User]!
  }
`;

export default typeDefs;