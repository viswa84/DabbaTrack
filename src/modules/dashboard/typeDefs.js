const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type DashboardSummary {
    date: String!
    totalCustomers: Int!
    activePlans: Int!
    scheduledCount: Int!
    skippedCount: Int!
    deliveredCount: Int!
    unpaidCount: Int!
    pausedCount: Int!
    optOuts: [Attendance!]!
    alerts: [String!]!
  }

  type BillingSummary {
    customer: Customer!
    plan: TiffinPlan!
    balanceDue: Float
    nextBillingDate: String
  }

  type CustomerUsage {
    customer: Customer!
    month: String!
    boxesTaken: Int!
    skipped: Int!
    paused: Int!
  }

  type MonthlyCustomerLedger {
    customer: Customer!
    month: String!
    lunchCount: Int!
    dinnerCount: Int!
    totalTaken: Int!
    ratePerTiffin: Float!
    totalAmount: Float!
  }

  extend type Query {
    dashboard(date: String!): DashboardSummary!
    billingSummary: [BillingSummary!]!
    monthlyUsage(month: String!): [CustomerUsage!]!
    monthlyCustomerLedger(month: String!): [MonthlyCustomerLedger!]!
  }
`;

module.exports = typeDefs;
