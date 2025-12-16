const { gql } = require('apollo-server-express');

const typeDefs = gql`
  enum Role {
    ADMIN
    DISPATCH
    CUSTOMER
  }

  enum AttendanceStatus {
    PRESENT
    ABSENT
    SKIPPED
  }

  enum Slot {
    LUNCH
    DINNER
  }

  enum BillingCycle {
    MONTHLY
    QUARTERLY
  }

  type Query {
    _empty: Boolean
  }

  type Mutation {
    _empty: Boolean
  }
`;

module.exports = typeDefs;
