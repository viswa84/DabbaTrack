const { query } = require('../../db/client');
const { requireValidIndianMobile } = require('../../utils/validators');

const USER_COLUMNS = `
  id,
  name,
  email,
  phone,
  role,
  description,
  serves_lunch AS "handlesLunch",
  serves_dinner AS "handlesDinner"
`;

// Finds a user by phone for login and profile hydration.
// language=SQL
const FIND_USER_BY_PHONE = `
  SELECT ${USER_COLUMNS}
  FROM users
  WHERE phone = $1
`;

// Creates a new user with a salted password hash.
// language=SQL
const INSERT_USER = `
  INSERT INTO users (name, email, phone, role, password_hash, description, serves_lunch, serves_dinner)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING ${USER_COLUMNS}
`;

// Fetches a user by id for JWT hydration.
// language=SQL
const FIND_USER_BY_ID = `
  SELECT ${USER_COLUMNS}
  FROM users
  WHERE id = $1
`;

async function findByPhone(phone) {
  const normalizedPhone = requireValidIndianMobile(phone, 'User phone');
  const { rows } = await query(FIND_USER_BY_PHONE, [normalizedPhone]);
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(FIND_USER_BY_ID, [id]);
  return rows[0];
}

async function createUser({
  name,
  email,
  phone,
  role = 'DISPATCH',
  description,
  handlesLunch = false,
  handlesDinner = false,
}) {
  const normalizedPhone = requireValidIndianMobile(phone, 'User phone');
  const params = [
    name,
    email,
    normalizedPhone,
    role,
    null,
    description || null,
    handlesLunch,
    handlesDinner,
  ];
  const { rows } = await query(INSERT_USER, params);
  return rows[0];
}

async function updateUser(id, fields) {
  const updates = [];
  const values = [];
  let index = 1;

  const setField = (column, value) => {
    updates.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (fields.name !== undefined) setField('name', fields.name);
  if (fields.email !== undefined) setField('email', fields.email);
  if (fields.phone !== undefined) {
    const normalizedPhone = requireValidIndianMobile(fields.phone, 'User phone');
    setField('phone', normalizedPhone);
  }
  if (fields.role !== undefined) setField('role', fields.role);
  if (fields.description !== undefined) setField('description', fields.description);
  if (fields.handlesLunch !== undefined) setField('serves_lunch', fields.handlesLunch);
  if (fields.handlesDinner !== undefined) setField('serves_dinner', fields.handlesDinner);

  if (updates.length === 0) {
    throw new Error('No fields provided for update');
  }

  const sql = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = $${index}
    RETURNING ${USER_COLUMNS}
  `;
  values.push(id);
  const { rows } = await query(sql, values);
  return rows[0];
}

module.exports = {
  findByPhone,
  findById,
  createUser,
  updateUser,
};
