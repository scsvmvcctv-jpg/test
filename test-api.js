
// using global fetch (Node 18+)

async function test() {
    console.log("Testing URL...");
    try {
        // Try strict provided URL
        const url = 'http://14.139.187.54:443/api/facultyworkload?EmpId=10021&Dept=1';
        console.log(`Fetching: ${url}`);
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Body: ${text.substring(0, 500)}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
