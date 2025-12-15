const { query } = require('../../db/client');
const { requireValidIndianMobile } = require('../../utils/validators');

const CUSTOMER_COLUMNS = `
  c.id,
  c.name,
  c.email,
  c.phone,
  c.address,
  c.dietary_notes AS "dietaryNotes",
  c.status,
  c.created_at AS "createdAt",
  c.vendor_user_id AS "vendorUserId"
`;

// Returns customers optionally filtered by status and vendor scope.
// language=SQL
const LIST_CUSTOMERS = `
  SELECT ${CUSTOMER_COLUMNS}
  FROM customers c
  WHERE ($1::text IS NULL OR c.status = $1)
    AND ($2::uuid IS NULL OR c.vendor_user_id = $2)
  ORDER BY c.created_at DESC
`;

// Retrieves a single customer with optional vendor scoping.
// language=SQL
const GET_CUSTOMER = `
  SELECT ${CUSTOMER_COLUMNS}
  FROM customers c
  WHERE c.id = $1
    AND ($2::uuid IS NULL OR c.vendor_user_id = $2)
`;

// Inserts a new customer tied to a vendor/staff user.
// language=SQL
const INSERT_CUSTOMER = `
  INSERT INTO customers (name, email, phone, address, dietary_notes, status, vendor_user_id)
  VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
  RETURNING ${CUSTOMER_COLUMNS}
`;

async function listCustomers({ status, vendorUserId }) {
  const { rows } = await query(LIST_CUSTOMERS, [status || null, vendorUserId || null]);
  return rows;
}

async function getCustomer({ id, vendorUserId }) {
  const { rows } = await query(GET_CUSTOMER, [id, vendorUserId || null]);
  return rows[0];
}

async function createCustomer({ name, email, phone, address, dietaryNotes, vendorUserId }) {
  if (!vendorUserId) {
    throw new Error('vendorUserId is required to create a customer');
  }
  const normalizedPhone = requireValidIndianMobile(phone, 'Customer phone');
  const { rows } = await query(INSERT_CUSTOMER, [
    name,
    email || null,
    normalizedPhone,
    address || null,
    dietaryNotes || null,
    vendorUserId,
  ]);
  return rows[0];
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
};
