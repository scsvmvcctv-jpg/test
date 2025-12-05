
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// 1. Manually load .env.local
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        console.log('Found .env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        const lines = envConfig.split(/\r?\n/);
        console.log('Total lines in .env.local:', lines.length);
        lines.forEach(line => {
            const match = line.match(/^\s*([\w_]+)\s*=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = value;
                console.log('Loaded key:', key);
            } else if (line.trim() && !line.trim().startsWith('#')) {
                console.log('Skipped line (format mismatch):', line.substring(0, 10) + '...');
            }
        });
    } else {
        console.log('No .env.local found');
    }
} catch (e) {
    console.error('Error loading .env.local:', e);
}

// 2. Define Config
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || '14.139.187.54',
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

console.log('Attempting connection with config:', {
    user: dbConfig.user ? '***' : 'MISSING',
    password: dbConfig.password ? '***' : 'MISSING',
    server: dbConfig.server,
    database: dbConfig.database,
    options: dbConfig.options
});

// 3. Connect
async function testConnection() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('✅ Connection Successful!');

        // Optional: Run a simple query
        const result = await pool.request().query('SELECT 1 as val');
        console.log('Query Result:', result.recordset);

        await pool.close();
    } catch (err) {
        console.error('❌ Connection Failed:', err);
    }
}

testConnection();
