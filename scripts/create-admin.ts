// scripts/create-admin.ts
//
// Membuat (atau mempromosikan) satu akun admin yang terverifikasi.
// Jalankan di environment yang BISA mengakses database (mis. lokal/Railway shell):
//
//   npm run create-admin
//
// Kredensial bisa di-override lewat env var:
//   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
//
// Idempotent: jika email sudah ada, password/role/verifikasi-nya diperbarui.

import bcrypt from 'bcrypt';
import { pool } from '../src/config/database';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yusuffirmansyamh@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123#';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';

async function main() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const result = await pool.query(
    `INSERT INTO users (name, email, password, role, is_verified)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password    = EXCLUDED.password,
           role        = 'admin',
           is_verified = TRUE,
           name        = EXCLUDED.name
     RETURNING id, name, email, role, is_verified`,
    [ADMIN_NAME, ADMIN_EMAIL, hashedPassword]
  );

  const user = result.rows[0];
  console.log('✅ Akun admin siap:');
  console.log(`   id          : ${user.id}`);
  console.log(`   name        : ${user.name}`);
  console.log(`   email       : ${user.email}`);
  console.log(`   role        : ${user.role}`);
  console.log(`   is_verified : ${user.is_verified}`);
  console.log(`\n   Login dengan password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('❌ Gagal membuat akun admin:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
