// init_local_db.js - Reset and Seed Local D1 Database
const { execSync } = require('child_process');

const TABLES = ['Assets', 'Categories', 'Departments', 'Employees', 'Assignments', 'Maintenance', 'Settings', 'Users', 'ActivityLogs'];

function run(cmd, opts = {}) {
    execSync(cmd, { stdio: 'inherit', ...opts });
}

console.log('==============================================');
console.log('   Initializing Local D1 Database for Testing');
console.log('==============================================\n');

try {
    console.log('[1/3] Dropping old tables to ensure clean schema...');
    const drop = TABLES.map(t => `DROP TABLE IF EXISTS ${t};`).join(' ');
    run(`npx wrangler d1 execute asset-db --local --command="${drop}"`, { stdio: 'ignore' });

    console.log('[2/3] Applying schema.sql to local D1 (asset-db)...');
    run('npx wrangler d1 execute asset-db --local --file=schema.sql');

    console.log('\n[3/3] Seeding local test data (seed_local.sql)...');
    run('npx wrangler d1 execute asset-db --local --file=seed_local.sql');

    console.log('\n==============================================');
    console.log('   Local Database Initialized Successfully!   ');
    console.log('==============================================');
    console.log('Default test accounts (passwords are hashed automatically on first login):');
    console.log(' - Admin:   username = admin,    password = admin123');
    console.log(' - User 1:  employee_id = EMP001, password = pass1234 (สมชาย ใจดี — assets/categories/assignments)');
    console.log(' - User 2:  employee_id = EMP002, password = pass5678 (สมหญิง สุขใจ — assignments)');
    console.log(' - User 3:  employee_id = EMP003, password = pass1234 (กิตติศักดิ์ พัฒนา — maintenance)');
    console.log(' - User 4:  employee_id = EMP004, password = pass1234 (วิภาดา รุ่งเรือง — read-only)');
    console.log('\nStart the app with:  npm run dev   (or: npx wrangler pages dev .)');
    console.log('==============================================\n');
} catch (err) {
    console.error('Initialization failed:', err.message);
    process.exit(1);
}
