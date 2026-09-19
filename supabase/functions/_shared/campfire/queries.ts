const EVENT_FIELDS=`
  id
  name
  clubId
  address
  location
  eventTime
  eventEndTime
  createdByCommunityAmbassador
  checkedInMembersCount
  members(first: 1) { totalCount }
  campfireLiveEvent { eventName }
`;

export const CLUB_QUERY=`query CA_Clover_Club($clubId: ID!) {
  club(id: $clubId) {
    id
    name
    address
    location
    createdByCommunityAmbassador
    members { totalCount }
  }
}`;

export const ACTIVE_FEED_QUERY=`query CA_Clover_ActiveFeed($clubId: ID!, $first: Int!, $after: String) {
  club(id: $clubId) {
    id
    name
    members { totalCount }
    activeFeed(first: $first, after: $after) {
      totalCount
      edges {
        node {
          __typename
          ... on Event {
            ${EVENT_FIELDS}
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const ARCHIVED_FEED_QUERY=`query CA_Clover_ArchivedFeed($clubId: ID!, $first: Int!, $after: String) {
  club(id: $clubId) {
    id
    name
    members { totalCount }
    archivedFeed(first: $first, after: $after) {
      totalCount
      edges {
        node {
          __typename
          ... on Event {
            ${EVENT_FIELDS}
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const EVENT_QUERY=`query CA_Clover_Event($id: ID!) {
  event(id: $id) {
    ${EVENT_FIELDS}
  }
}`;

export const PUBLIC_EVENTS_QUERY=`query CA_Clover_PublicEvents($ids: [ID!]!) {
  publicMapObjectsById(ids: $ids) {
    id
    event {
      id
      name
      clubId
      clubName
      address
      eventTime
      eventEndTime
      place {
        location
        name
        formattedAddress
      }
      mapObjectLocation {
        latitude
        longitude
      }
    }
  }
}`;

export const TOKEN_CHECK_QUERY=`query CA_Clover_Token_Check {
  me { id }
}`;
