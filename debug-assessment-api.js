// Removed require('node-fetch') to use native fetch

async function testAPIs() {
    const baseUrl = 'http://14.139.187.54:443/api';

    console.log('--- Testing Filter Options ---');
    try {
        const res = await fetch(`${baseUrl}/filter-options`);
        console.log('Status:', res.status);
        if (res.ok) {
            const text = await res.text();
            // Try identify if it returns HTML or JSON (sometimes 404 returns HTML)
            if (text.trim().startsWith('<')) {
                console.log('Response is HTML (unexpected):', text.substring(0, 100));
            } else {
                try {
                    const data = JSON.parse(text);
                    console.log('Filter Options Data Keys:', Object.keys(data));
                    // Log to see how to populate dropdowns
                    if (data.AcademicYear) console.log('Sample Academic Year:', data.AcademicYear[0]); // Guessing keys
                    if (data.academicYears) console.log('Sample Academic Year (camel):', data.academicYears[0]);

                    console.log('Full Filter Data Sample:', text.substring(0, 500));
                } catch (e) {
                    console.log('Failed to parse JSON:', e.message, text.substring(0, 200));
                }
            }
        } else {
            console.log('Failed to fetch filter options');
        }
    } catch (e) {
        console.error('Error fetching filter options:', e.message);
    }

    console.log('\n--- Testing Admitted Students ---');
    const payload = {
        "academicyearnow": "2024-2025",
        "CourseNameforTC": "BE [CSE]",
        "sem_now": "6"
    };
    try {
        const res = await fetch(`${baseUrl}/admitted-students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('Status:', res.status);
        if (res.ok) {
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (Array.isArray(data)) {
                    console.log('Student Data Length:', data.length);
                    console.log('Sample Student:', data[0]);
                } else {
                    console.log('Student Response (Not Array):', data);
                }
            } catch (e) {
                console.log('Failed to parse Student JSON:', text.substring(0, 200));
            }
        } else {
            const text = await res.text();
            console.log('Failed to fetch students:', text);
        }
    } catch (e) {
        console.error('Error fetching students:', e.message);
    }
}

testAPIs();
