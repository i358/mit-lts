import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';

// GraphQL Client Configuration
const httpLink = new HttpLink({
  uri: 'https://api.habbojoh.com.tr/graphql',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

// GraphQL Queries
export const GET_ACTIVE_USERS = gql`
  query ExampleQuery($limit: Int = 50, $offset: Int = 0) {
    activeUsers(limit: $limit, offset: $offset) {
      avatar
      username
      motto
      time {
        storedTotal
        currentSessionTime
        realTimeTotal
        isActive
        lastSeen
        workTime
        requiredWorkTime
      }
      badgeInfo {
        badge
        rank
        badgeName
        rankName
      }
      extras
    }
  }
`;

export const GET_USER_DETAILS = gql`
  query GetUserDetails($username: String!) {
    user(username: $username) {
      id
      username
      avatar
      motto
      dailyTime
      figure
      look
      lastSeen
      time {
        storedTotal
        currentSessionTime
        realTimeTotal
        isActive
        lastSeen
      }
      badgeInfo {
        badge
        rank
        badgeName
        rankName
      }
      extras
    }
  }
`;

export const GET_CURRENT_USER = gql`
  query GetCurrentUser($username: String!) {
    user(username: $username) {
      id
      dailyTime
      username
      avatar
      motto
      time {
        storedTotal
        currentSessionTime
        realTimeTotal
        workTime
        requiredWorkTime
        isActive
        lastSeen
      }
      badgeInfo {
        badge
        rank
        badgeName
        rankName
        requiredTime
      }
      extras
    }
  }
`;


export default client;