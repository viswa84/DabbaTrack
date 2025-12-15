const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

const users = [
  {
    id: 'user-admin',
    name: 'Dabba Boss',
    email: 'boss@dabbatrack.in',
    phone: '+91-90000-00000',
    role: 'ADMIN',
    passwordHash: bcrypt.hashSync('admin123', 10),
  },
  {
    id: 'user-runner',
    name: 'Runner Rita',
    email: 'runner@dabbatrack.in',
    phone: '+91-98888-00000',
    role: 'DISPATCH',
    passwordHash: bcrypt.hashSync('runfast', 10),
  },
];

const customers = [
  {
    id: 'cust-100',
    name: 'Aman Rao',
    email: 'aman@example.com',
    phone: '+91-98765-11111',
    address: 'Powai, Mumbai',
    dietaryNotes: 'No onion/garlic on Monday',
    status: 'ACTIVE',
    createdAt: '2025-01-01T09:00:00.000Z',
  },
  {
    id: 'cust-200',
    name: 'Priya Shah',
    email: 'priya@example.com',
    phone: '+91-91234-22222',
    address: 'Bandra West, Mumbai',
    dietaryNotes: 'Jain on Fridays',
    status: 'ACTIVE',
    createdAt: '2025-01-03T09:00:00.000Z',
  },
  {
    id: 'cust-300',
    name: 'Rohan Kulkarni',
    email: 'rohan@example.com',
    phone: '+91-92345-33333',
    address: 'Thane',
    dietaryNotes: 'Extra phulka with lunch',
    status: 'PAUSED',
    createdAt: '2025-01-05T09:00:00.000Z',
  },
];

const attendanceRecords = [
  {
    id: 'att-1',
    customerId: 'cust-100',
    date: '2025-01-15',
    slot: 'LUNCH',
    status: 'PRESENT',
    note: 'Delivered by Rita',
    recordedBy: 'user-runner',
  },
  {
    id: 'att-2',
    customerId: 'cust-200',
    date: '2025-01-15',
    slot: 'LUNCH',
    status: 'SKIPPED',
    note: 'Customer opted out (doctor visit)',
    recordedBy: 'user-admin',
  },
  {
    id: 'att-3',
    customerId: 'cust-200',
    date: '2025-01-16',
    slot: 'DINNER',
    status: 'PRESENT',
    note: 'Left at reception',
    recordedBy: 'user-runner',
  },
];

const tiffinPlans = [
  {
    id: 'plan-100',
    customerId: 'cust-100',
    monthlyRate: 2800,
    billingCycle: 'MONTHLY',
    startDate: '2024-12-15',
    status: 'ACTIVE',
    lastPaymentStatus: 'PAID',
    lastPaymentAt: '2025-01-01',
  },
  {
    id: 'plan-200',
    customerId: 'cust-200',
    monthlyRate: 3200,
    billingCycle: 'MONTHLY',
    startDate: '2024-12-20',
    status: 'ACTIVE',
    lastPaymentStatus: 'DUE',
    lastPaymentAt: '2024-12-20',
  },
];

function generateId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function upsertAttendance({ customerId, date, slot, status, note, recordedBy }) {
  const existingIndex = attendanceRecords.findIndex(
    (record) => record.customerId === customerId && record.date === date && record.slot === slot,
  );

  const record = {
    id: existingIndex >= 0 ? attendanceRecords[existingIndex].id : generateId('att'),
    customerId,
    date,
    slot,
    status,
    note: note || '',
    recordedBy,
  };

  if (existingIndex >= 0) {
    attendanceRecords[existingIndex] = record;
  } else {
    attendanceRecords.push(record);
  }
  return record;
}

function createCustomer(payload) {
  const customer = {
    id: generateId('cust'),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    ...payload,
  };
  customers.push(customer);
  return customer;
}

function upsertPlan({ customerId, monthlyRate, billingCycle, startDate }) {
  const existingIndex = tiffinPlans.findIndex((plan) => plan.customerId === customerId);
  const plan = {
    id: existingIndex >= 0 ? tiffinPlans[existingIndex].id : generateId('plan'),
    customerId,
    monthlyRate,
    billingCycle,
    startDate,
    status: 'ACTIVE',
    lastPaymentStatus: existingIndex >= 0 ? tiffinPlans[existingIndex].lastPaymentStatus : 'DUE',
    lastPaymentAt: existingIndex >= 0 ? tiffinPlans[existingIndex].lastPaymentAt : null,
  };

  if (existingIndex >= 0) {
    tiffinPlans[existingIndex] = plan;
  } else {
    tiffinPlans.push(plan);
  }
  return plan;
}

function markPayment({ customerId, status, paidAt }) {
  const index = tiffinPlans.findIndex((plan) => plan.customerId === customerId);
  if (index < 0) {
    throw new Error('No billing plan found for customer');
  }
  tiffinPlans[index] = {
    ...tiffinPlans[index],
    lastPaymentStatus: status,
    lastPaymentAt: paidAt || new Date().toISOString(),
  };
  return tiffinPlans[index];
}

module.exports = {
  users,
  customers,
  attendanceRecords,
  tiffinPlans,
  upsertAttendance,
  createCustomer,
  upsertPlan,
  markPayment,
};
