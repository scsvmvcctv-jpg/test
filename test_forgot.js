// Using native fetch (Node 18+)
const apiBase = 'http://localhost:3000/api';

async function testForgot() {
    console.log('Testing Forgot Password for User: 12345...');
    try {
        const res = await fetch(`${apiBase}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: '12345', userType: 'Staff' })
        });

        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testForgot();
