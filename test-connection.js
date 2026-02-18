const https = require('https');

const url = 'https://csmjazzkfgnfgxgyiosa.supabase.co/auth/v1/signup';
const apiKey = 'sb_publishable_Qspz-Zhrtvxlf7p1GFxHrg_ri5wES01';

console.log('Testing POST connection to:', url);

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': 'Bearer ' + apiKey
    }
};

const req = https.request(url, options, (res) => {
    console.log('StatusCode:', res.statusCode);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Body:', data);
    });

});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.write(JSON.stringify({
    email: 'test_signup@example.com',
    password: 'password123'
}));

req.end();
