const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = require('dotenv').parse(fs.readFileSync(envPath));

const secret = envConfig.JWT_SECRET;

if (!secret) {
    console.error('JWT_SECRET is missing in .env.local');
    process.exit(1);
}

console.log('Secret found:', secret.substring(0, 5) + '...');

const payload = {
    userId: 'test-user',
    role: 'Admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
};

try {
    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
    console.log('Token signed successfully.');

    const decoded = jwt.verify(token, secret);
    console.log('Token verified successfully.');
    console.log('Decoded:', decoded);
} catch (error) {
    console.error('JWT Operation Failed:', error.message);
}
