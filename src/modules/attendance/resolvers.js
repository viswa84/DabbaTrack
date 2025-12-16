const { requireAuth, vendorScope } = require('../../utils/permissions');
const customersRepo = require('../customers/repository');
const attendanceRepo = require('./repository');

const CUTOFF_HOUR_IST = 10; // 10:00 AM local time cutoff for same-day skips

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
  },
  Mutation: {
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
};

module.exports = resolvers;
