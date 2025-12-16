const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type Attendance {
    id: ID!
    customerId: ID!
    date: String!
    slot: Slot!
    status: AttendanceStatus!
    note: String
    recordedBy: ID
    customer: Customer!
  }

  input AttendanceInput {
    customerId: ID!
    date: String!
    slot: Slot!
    status: AttendanceStatus!
    note: String
  }

  input OptOutInput {
    customerId: ID!
    date: String!
    slot: Slot!
    reason: String
  }

  extend type Query {
    attendance(date: String, slot: Slot, customerId: ID): [Attendance!]!
    optOuts(date: String!, slot: Slot): [Attendance!]!
  }

  extend type Mutation {
    recordAttendance(input: AttendanceInput!): Attendance!
    setOptOut(input: OptOutInput!): Attendance!
  }
`;

module.exports = typeDefs;
