const fetch = require('fs').existsSync('node_modules/node-fetch') ? require('node-fetch') : global.fetch;

async function probe() {
    const baseUrl = 'http://14.139.187.54:443/api';
    const payload = {
        "academicyearnow": "2024-2025",
        "CourseNameforTC": "BE [CSE]",
        "sem_now": "6"
    };

    const endpoints = [
        { url: `${baseUrl}/admitted-students`, method: 'POST' },
        { url: `${baseUrl}/admitted-students`, method: 'GET' }, // Maybe it's GET?
        { url: `${baseUrl}/admitted_students`, method: 'POST' }, // Underscore?
        { url: `${baseUrl}/AdmittedStudents`, method: 'POST' }, // PascalCase?
        { url: `${baseUrl}/student-details`, method: 'POST' }, // Guess
    ];

    console.log('--- Probing Endpoints ---');

    for (const ep of endpoints) {
        try {
            console.log(`Testing ${ep.method} ${ep.url}...`);
            const res = await fetch(ep.url, {
                method: ep.method,
                headers: { 'Content-Type': 'application/json' },
                body: ep.method === 'POST' ? JSON.stringify(payload) : undefined
            });

            console.log(`  Status: ${res.status} ${res.statusText}`);
            if (res.ok) {
                console.log('  SUCCESS! Found correct endpoint.');
                const text = await res.text();
                console.log('  Response preview:', text.substring(0, 100));
            }
        } catch (e) {
            console.log(`  Error: ${e.message}`);
        }
    }
}

probe();
