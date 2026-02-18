const { createClient } = require('@supabase/supabase-js');

const url = 'https://csmjazzkfgnfgxgyiosa.supabase.co';
const key = 'sb_publishable_Qspz-Zhrtvxlf7p1GFxHrg_ri5wES01';

console.log('Testing Supabase connection with Key:', key);
const supabase = createClient(url, key);

async function test() {
    try {
        // Try a simple public request, checking health or just getSession
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Supabase Error:', error.message, error.code);
            if (error.message.includes('JWT')) {
                console.error('Likely Invalid Key Format (Not a JWT)');
            }
        } else {
            console.log('Connection successful. Count result:', data);
        }
    } catch (e) {
        console.error('Exception:', e.message);
    }
}

test();
