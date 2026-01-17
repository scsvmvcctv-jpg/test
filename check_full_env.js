const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Checking .env.local at:', envPath);

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');

    const vars = {
        DB_USER: false,
        DB_PASSWORD: false,
        DB_SERVER: false,
        DB_DATABASE: false,
        SMTP_USER: false,
        SMTP_PASSWORD: false,
        SMTP_HOST: false
    };

    for (const line of lines) {
        const [key] = line.split('=');
        if (key && vars.hasOwnProperty(key.trim())) {
            vars[key.trim()] = true;
        }
    }

    console.table(vars);
} else {
    console.log('.env.local not found');
}
