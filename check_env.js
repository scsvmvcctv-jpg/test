const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
    console.log('.env.local exists.');
    const content = fs.readFileSync(envPath, 'utf8');

    // Simple parsing logic matching dotenv behavior roughly
    const lines = content.split('\n');
    let hasUrl = false;
    let hasKey = false;
    let hasServiceKey = false;
    let hasJwtSecret = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) continue;
        if (!trimmed.includes('=')) continue;

        const [key, val] = trimmed.split('=');
        const k = key.trim();
        const v = val ? val.trim() : '';

        if (k === 'NEXT_PUBLIC_SUPABASE_URL') hasUrl = (v.length > 0);
        if (k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') hasKey = (v.length > 0);
        if (k === 'SUPABASE_SERVICE_ROLE_KEY') hasServiceKey = (v.length > 0);
        if (k === 'JWT_SECRET') hasJwtSecret = (v.length > 0);
    }

    if (hasUrl) console.log('NEXT_PUBLIC_SUPABASE_URL is set.');
    else console.log('NEXT_PUBLIC_SUPABASE_URL is MISSING or empty.');

    if (hasKey) console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY is set.');
    else console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY is MISSING or empty.');

    if (hasServiceKey) console.log('SUPABASE_SERVICE_ROLE_KEY is set.');
    else console.log('SUPABASE_SERVICE_ROLE_KEY is MISSING or empty.');

    if (hasJwtSecret) console.log('JWT_SECRET is set.');
    else console.log('JWT_SECRET is MISSING or empty.');

} else {
    console.log('.env.local DOES NOT exist.');
}
