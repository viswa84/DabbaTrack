const { requireAuth, vendorScope } = require('../../utils/permissions');
const dashboardRepo = require('./repository');

const resolvers = {
  Query: {
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

module.exports = resolvers;
