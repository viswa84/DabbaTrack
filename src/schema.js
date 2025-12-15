const { gql } = require('apollo-server-express');
const { createToken } = require('./auth');
const usersRepo = require('./modules/users/repository');
const customersRepo = require('./modules/customers/repository');
const attendanceRepo = require('./modules/attendance/repository');
const plansRepo = require('./modules/plans/repository');
const pausesRepo = require('./modules/pauses/repository');
const dashboardRepo = require('./modules/dashboard/repository');

const CUSTOMER_OTP = process.env.CUSTOMER_OTP || '1234';
const VENDOR_OTP = process.env.VENDOR_OTP || '2345';
const CUTOFF_HOUR_IST = 10; // 10:00 AM local time cutoff for same-day skips

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
    description: String
    handlesLunch: Boolean!
    handlesDinner: Boolean!
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
    vendorUserId: ID
    vendor: User
    plan: TiffinPlan
    pauseWindows: [PauseWindow!]!
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

  type PauseWindow {
    id: ID!
    customerId: ID!
    startDate: String!
    endDate: String!
    reason: String
    createdBy: ID!
  }

  type AuthPayload {
    token: String!
    user: User!
    message: String!
  }

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

  input CustomerInput {
    name: String!
    email: String
    phone: String!
    address: String
    dietaryNotes: String
    vendorUserId: ID
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

  input PauseInput {
    customerId: ID!
    startDate: String!
    endDate: String!
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

  input CreateUserInput {
    name: String!
    email: String!
    phone: String!
    description: String
    role: Role
    handlesLunch: Boolean!
    handlesDinner: Boolean!
  }

  input UpdateUserInput {
    name: String
    email: String
    phone: String
    description: String
    role: Role
    handlesLunch: Boolean
    handlesDinner: Boolean
  }

  type Query {
    me: User
    customers(status: String): [Customer!]!
    customer(id: ID!): Customer
    attendance(date: String, slot: Slot, customerId: ID): [Attendance!]!
    optOuts(date: String!, slot: Slot): [Attendance!]!
    dashboard(date: String!): DashboardSummary!
    billingSummary: [BillingSummary!]!
    monthlyUsage(month: String!): [CustomerUsage!]!
    monthlyCustomerLedger(month: String!): [MonthlyCustomerLedger!]!
  }

  type Mutation {
    login(email: String!, otp: String!): AuthPayload!
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    createCustomer(input: CustomerInput!): Customer!
    recordAttendance(input: AttendanceInput!): Attendance!
    setOptOut(input: OptOutInput!): Attendance!
    setPauseWindow(input: PauseInput!): PauseWindow!
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

function vendorScope(user) {
  return user.role === 'ADMIN' ? null : user.id;
}

function enforceCutoff(date) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (date !== todayIso) return;

  const cutoff = new Date(`${date}T${String(CUTOFF_HOUR_IST).padStart(2, '0')}:00:00`);
  const now = new Date();
  if (now > cutoff) {
    throw new Error(`Cutoff passed for ${date}. Please contact support to skip manually.`);
  }
}

const resolvers = {
  Query: {
    me: (_parent, _args, context) => {
      requireAuth(context.user);
      return context.user;
    },
    customers: async (_parent, args, context) => {
      requireAuth(context.user);
      return customersRepo.listCustomers({
        status: args.status,
        vendorUserId: vendorScope(context.user),
      });
    },
    customer: async (_parent, args, context) => {
      requireAuth(context.user);
      return customersRepo.getCustomer({
        id: args.id,
        vendorUserId: vendorScope(context.user),
      });
    },
    attendance: async (_parent, args, context) => {
      requireAuth(context.user);
      return attendanceRepo.listAttendance(args);
    },
    optOuts: async (_parent, args, context) => {
      requireAuth(context.user);
      return (await attendanceRepo.listAttendance({ date: args.date, slot: args.slot })).filter(
        (record) => record.status === 'SKIPPED',
      );
    },
    dashboard: async (_parent, args, context) => {
      requireAuth(context.user);
      return dashboardRepo.dashboardSummary(args.date);
    },
    billingSummary: async (_parent, _args, context) => {
      requireAuth(context.user);
      return dashboardRepo.billingSummary();
    },
    monthlyUsage: async (_parent, args, context) => {
      requireAuth(context.user);
      return dashboardRepo.monthlyUsage(args.month);
    },
    monthlyCustomerLedger: async (_parent, args, context) => {
      requireAuth(context.user);
      return dashboardRepo.monthlyCustomerLedger({
        month: args.month,
        vendorUserId: vendorScope(context.user),
      });
    },
  },
  Mutation: {
    login: async (_parent, args) => {
      const user = await usersRepo.findByEmail(args.email);
      if (!user) {
        throw new Error('User not found');
      }
      const expectedOtp = user.role === 'CUSTOMER' ? CUSTOMER_OTP : VENDOR_OTP;
      if (args.otp !== expectedOtp) {
        throw new Error('Invalid OTP');
      }
      const token = createToken(user);
      return { token, user, message: 'User authenticated successfully' };
    },
    createUser: async (_parent, args, context) => {
      requireAdmin(context.user);
      return usersRepo.createUser({
        ...args.input,
        role: args.input.role || 'DISPATCH',
      });
    },
    updateUser: async (_parent, args, context) => {
      requireAdmin(context.user);
      return usersRepo.updateUser(args.id, args.input);
    },
    createCustomer: async (_parent, args, context) => {
      requireAuth(context.user);
      if (context.user.role === 'CUSTOMER') {
        throw new Error('Customers are not permitted to create customer records');
      }
      const { vendorUserId: requestedVendorId, ...payload } = args.input;
      const vendorUserId =
        context.user.role === 'ADMIN' ? requestedVendorId : context.user.id;
      if (!vendorUserId) {
        throw new Error('vendorUserId is required to create a customer');
      }
      return customersRepo.createCustomer({
        ...payload,
        vendorUserId,
      });
    },
    recordAttendance: async (_parent, args, context) => {
      requireAuth(context.user);
      return attendanceRepo.upsertAttendance({ ...args.input, recordedBy: context.user.id });
    },
    setOptOut: async (_parent, args, context) => {
      requireAuth(context.user);
      enforceCutoff(args.input.date);
      return attendanceRepo.upsertAttendance({
        customerId: args.input.customerId,
        date: args.input.date,
        slot: args.input.slot,
        status: 'SKIPPED',
        note: args.input.reason || 'Customer opted out',
        recordedBy: context.user.id,
      });
    },
    setPauseWindow: async (_parent, args, context) => {
      requireAuth(context.user);
      return pausesRepo.createPauseWindow({
        customerId: args.input.customerId,
        startDate: args.input.startDate,
        endDate: args.input.endDate,
        reason: args.input.reason,
        createdBy: context.user.id,
      });
    },
    upsertPlan: async (_parent, args, context) => {
      requireAdmin(context.user);
      return plansRepo.upsertPlan(args.input);
    },
    markPayment: async (_parent, args, context) => {
      requireAdmin(context.user);
      return plansRepo.markPayment(args.input);
    },
  },
  Customer: {
    vendor: (customer) => (customer.vendorUserId ? usersRepo.findById(customer.vendorUserId) : null),
    plan: (customer) => plansRepo.getPlanForCustomer(customer.id),
    pauseWindows: (customer) => pausesRepo.listByCustomer(customer.id),
    latestAttendance: (customer) => attendanceRepo.latestForCustomer(customer.id),
  },
  Attendance: {
    customer: (attendance, _args, context) => {
      requireAuth(context.user);
      return customersRepo.getCustomer({
        id: attendance.customerId,
        vendorUserId: vendorScope(context.user),
      });
    },
  },
  BillingSummary: {
    customer: (summary) => summary.customer,
    plan: (summary) => summary.plan,
  },
  CustomerUsage: {
    customer: (usage) => usage.customer,
  },
  MonthlyCustomerLedger: {
    customer: (ledger) => ledger.customer,
  },
};

module.exports = { typeDefs, resolvers };
