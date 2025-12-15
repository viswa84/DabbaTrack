const { gql } = require('apollo-server-express');
const bcrypt = require('bcryptjs');
const { createToken } = require('./auth');
const {
  users,
  customers,
  attendanceRecords,
  pauseWindows,
  tiffinPlans,
  upsertAttendance,
  addPauseWindow,
  isPausedOnDate,
  createCustomer,
  upsertPlan,
  markPayment,
} = require('./data/store');

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
    balanceDue: Float!
    nextBillingDate: String!
  }

  type CustomerUsage {
    customer: Customer!
    month: String!
    boxesTaken: Int!
    skipped: Int!
    paused: Int!
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

  type Query {
    me: User
    customers(status: String): [Customer!]!
    customer(id: ID!): Customer
    attendance(date: String, slot: Slot, customerId: ID): [Attendance!]!
    optOuts(date: String!, slot: Slot): [Attendance!]!
    dashboard(date: String!): DashboardSummary!
    billingSummary: [BillingSummary!]!
    monthlyUsage(month: String!): [CustomerUsage!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
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

function attachPlan(customer) {
  return tiffinPlans.find((plan) => plan.customerId === customer.id) || null;
}

function findAttendance({ date, slot, customerId }) {
  const base = attendanceRecords.filter((record) => {
    if (date && record.date !== date) return false;
    if (slot && record.slot !== slot) return false;
    if (customerId && record.customerId !== customerId) return false;
    return true;
  });

  if (date) {
    const slotsToFill = slot ? [slot] : ['LUNCH', 'DINNER'];
    const relevantCustomers = customerId
      ? customers.filter((c) => c.id === customerId)
      : customers.filter((c) => c.status === 'ACTIVE' || isPausedOnDate(c.id, date));

    relevantCustomers.forEach((cust) => {
      if (!isPausedOnDate(cust.id, date)) return;
      slotsToFill.forEach((slotName) => {
        const already = base.some(
          (record) => record.customerId === cust.id && record.date === date && record.slot === slotName,
        );
        if (!already) {
          base.push({
            id: `auto-pause-${cust.id}-${date}-${slotName}`,
            customerId: cust.id,
            date,
            slot: slotName,
            status: 'SKIPPED',
            note: 'Paused window',
            recordedBy: null,
          });
        }
      });
    });
  }

  return base;
}

function calculateDashboard(date) {
  const optOuts = findAttendance({ date }).filter((record) => record.status === 'SKIPPED');
  const delivered = findAttendance({ date }).filter((record) => record.status === 'PRESENT');
  const activeCustomers = customers.filter((c) => c.status === 'ACTIVE');
  const activePlans = tiffinPlans.filter((plan) => plan.status === 'ACTIVE');
  const pausedToday = customers.filter((c) => isPausedOnDate(c.id, date));

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
    scheduledCount: Math.max(activeCustomers.length - optOuts.length - pausedToday.length, 0),
    skippedCount: optOuts.length,
    deliveredCount: delivered.length,
    unpaidCount,
    pausedCount: pausedToday.length,
    optOuts,
    alerts,
  };
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

function calculateMonthlyUsage(month) {
  // month format: YYYY-MM
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) {
    throw new Error('Invalid month format. Use YYYY-MM.');
  }

  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  return customers.map((customer) => {
    const attendance = attendanceRecords.filter(
      (record) => record.customerId === customer.id && record.date.startsWith(month),
    );
    const boxesTaken = attendance.filter((record) => record.status === 'PRESENT').length;
    const skipped = attendance.filter((record) => record.status === 'SKIPPED').length;

    const pausedSlots = pauseWindows
      .filter((window) => window.customerId === customer.id)
      .reduce((total, window) => {
        const windowStart = Math.max(new Date(window.startDate).getTime(), new Date(startDate).getTime());
        const windowEnd = Math.min(new Date(window.endDate).getTime(), new Date(endDate).getTime());
        if (windowEnd < windowStart) return total;
        const days = Math.floor((windowEnd - windowStart) / (1000 * 60 * 60 * 24)) + 1;
        return total + days * 2; // two slots per day
      }, 0);

    return {
      customer,
      month,
      boxesTaken,
      skipped,
      paused: pausedSlots,
    };
  });
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
    monthlyUsage: (_parent, args) => calculateMonthlyUsage(args.month),
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
      enforceCutoff(args.input.date);
      return upsertAttendance({
        customerId: args.input.customerId,
        date: args.input.date,
        slot: args.input.slot,
        status: 'SKIPPED',
        note: args.input.reason || 'Customer opted out',
        recordedBy: context.user.id,
      });
    },
    setPauseWindow: (_parent, args, context) => {
      requireAuth(context.user);
      return addPauseWindow({
        customerId: args.input.customerId,
        startDate: args.input.startDate,
        endDate: args.input.endDate,
        reason: args.input.reason,
        createdBy: context.user.id,
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
    pauseWindows: (customer) => pauseWindows.filter((w) => w.customerId === customer.id),
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
