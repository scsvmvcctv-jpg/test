// Native fetch (Node 18+)
// Actually, earlier we removed require. Let's stick to native fetch pattern.

// Native fetch (Node 18+)
const apiUrl = 'http://14.139.187.54:443/api/forgot-username-password';

async function probeApi() {
    console.log('Probing API:', apiUrl);

    try {
        console.log('Test: POST with UserID 12345...');
        const res1 = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ UserID: '12345' })
        });
        const text1 = await res1.text();
        console.log('Status:', res1.status);
        console.log('Response:', text1.substring(0, 300));
    } catch (e) {
        console.log('Test failed:', e.message);
    }
}

if (!globalThis.fetch) {
    console.log('Native fetch not found');
} else {
    probeApi();
}
