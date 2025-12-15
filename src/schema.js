const { gql } = require('apollo-server-express');
const bcrypt = require('bcryptjs');
const { createToken } = require('./auth');
const {
  users,
  customers,
  attendanceRecords,
  tiffinPlans,
  upsertAttendance,
  createCustomer,
  upsertPlan,
  markPayment,
} = require('./data/store');

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

  type User {
    id: ID!
    name: String!
    email: String!
    phone: String
    role: Role!
  }

  type Customer {
    id: ID!
    name: String!
    email: String
    phone: String
    address: String
    dietaryNotes: String
    status: String!
    createdAt: String!
    plan: TiffinPlan
    latestAttendance: [Attendance!]!
  }

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

  type TiffinPlan {
    id: ID!
    customerId: ID!
    startDate: String!
    billingCycle: BillingCycle!
    monthlyRate: Float!
    status: String!
    lastPaymentStatus: String
    lastPaymentAt: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type DashboardSummary {
    date: String!
    totalCustomers: Int!
    activePlans: Int!
    scheduledCount: Int!
    skippedCount: Int!
    deliveredCount: Int!
    unpaidCount: Int!
    optOuts: [Attendance!]!
    alerts: [String!]!
  }

  type BillingSummary {
    customer: Customer!
    plan: TiffinPlan!
    balanceDue: Float!
    nextBillingDate: String!
  }

  input CustomerInput {
    name: String!
    email: String
    phone: String
    address: String
    dietaryNotes: String
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

  input PlanInput {
    customerId: ID!
    monthlyRate: Float!
    billingCycle: BillingCycle!
    startDate: String!
  }

  input PaymentInput {
    customerId: ID!
    status: String!
    paidAt: String
  }

  type Query {
    me: User
    customers(status: String): [Customer!]!
    customer(id: ID!): Customer
    attendance(date: String, slot: Slot, customerId: ID): [Attendance!]!
    optOuts(date: String!, slot: Slot): [Attendance!]!
    dashboard(date: String!): DashboardSummary!
    billingSummary: [BillingSummary!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createCustomer(input: CustomerInput!): Customer!
    recordAttendance(input: AttendanceInput!): Attendance!
    setOptOut(input: OptOutInput!): Attendance!
    upsertPlan(input: PlanInput!): TiffinPlan!
    markPayment(input: PaymentInput!): TiffinPlan!
  }
`;

function requireAuth(user) {
  if (!user) {
    throw new Error('Authentication required');
  }
}

function requireAdmin(user) {
  requireAuth(user);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin permission required');
  }
}

function attachPlan(customer) {
  return tiffinPlans.find((plan) => plan.customerId === customer.id) || null;
}

function findAttendance({ date, slot, customerId }) {
  return attendanceRecords.filter((record) => {
    if (date && record.date !== date) return false;
    if (slot && record.slot !== slot) return false;
    if (customerId && record.customerId !== customerId) return false;
    return true;
  });
}

function calculateDashboard(date) {
  const optOuts = findAttendance({ date }).filter((record) => record.status === 'SKIPPED');
  const delivered = findAttendance({ date }).filter((record) => record.status === 'PRESENT');
  const activeCustomers = customers.filter((c) => c.status === 'ACTIVE');
  const activePlans = tiffinPlans.filter((plan) => plan.status === 'ACTIVE');

  const alerts = [];
  const unpaidCount = tiffinPlans.filter((plan) => plan.lastPaymentStatus !== 'PAID').length;
  if (unpaidCount > 0) {
    alerts.push(`${unpaidCount} customer(s) have dues pending`);
  }
  if (optOuts.length > 0) {
    alerts.push(`${optOuts.length} opted out for ${date}`);
  }

  return {
    date,
    totalCustomers: customers.length,
    activePlans: activePlans.length,
    scheduledCount: Math.max(activeCustomers.length - optOuts.length, 0),
    skippedCount: optOuts.length,
    deliveredCount: delivered.length,
    unpaidCount,
    optOuts,
    alerts,
  };
}

const resolvers = {
  Query: {
    me: (_parent, _args, context) => context.user || null,
    customers: (_parent, args) => {
      if (args.status) {
        return customers.filter((customer) => customer.status === args.status);
      }
      return customers;
    },
    customer: (_parent, args) => customers.find((customer) => customer.id === args.id) || null,
    attendance: (_parent, args) => findAttendance(args),
    optOuts: (_parent, args) => findAttendance({ date: args.date, slot: args.slot }).filter((item) => item.status === 'SKIPPED'),
    dashboard: (_parent, args) => calculateDashboard(args.date),
    billingSummary: () =>
      tiffinPlans.map((plan) => {
        const customer = customers.find((c) => c.id === plan.customerId);
        const balanceDue = plan.lastPaymentStatus === 'PAID' ? 0 : plan.monthlyRate;
        return {
          customer,
          plan,
          balanceDue,
          nextBillingDate: plan.startDate,
        };
      }),
  },
  Mutation: {
    login: (_parent, args) => {
      const user = users.find((candidate) => candidate.email === args.email);
      if (!user) {
        throw new Error('User not found');
      }
      const passwordOk = bcrypt.compareSync(args.password, user.passwordHash);
      if (!passwordOk) {
        throw new Error('Invalid credentials');
      }
      const token = createToken(user);
      return { token, user };
    },
    createCustomer: (_parent, args, context) => {
      requireAdmin(context.user);
      return createCustomer(args.input);
    },
    recordAttendance: (_parent, args, context) => {
      requireAuth(context.user);
      return upsertAttendance({ ...args.input, recordedBy: context.user.id });
    },
    setOptOut: (_parent, args, context) => {
      requireAuth(context.user);
      return upsertAttendance({
        customerId: args.input.customerId,
        date: args.input.date,
        slot: args.input.slot,
        status: 'SKIPPED',
        note: args.input.reason || 'Customer opted out',
        recordedBy: context.user.id,
      });
    },
    upsertPlan: (_parent, args, context) => {
      requireAdmin(context.user);
      return upsertPlan(args.input);
    },
    markPayment: (_parent, args, context) => {
      requireAdmin(context.user);
      return markPayment({
        customerId: args.input.customerId,
        status: args.input.status,
        paidAt: args.input.paidAt,
      });
    },
  },
  Customer: {
    plan: (customer) => attachPlan(customer),
    latestAttendance: (customer) => findAttendance({ customerId: customer.id }).slice(-5),
  },
  Attendance: {
    customer: (attendance) => customers.find((c) => c.id === attendance.customerId),
  },
};

module.exports = {
  typeDefs,
  resolvers,
};
