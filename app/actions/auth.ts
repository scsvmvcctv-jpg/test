'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { findUserCredentials, sendCredentialsEmail } from '@/lib/auth-service'

function getBaseUrl() {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
}

export async function loginAction(prevState: any, formData: FormData) {
    const userId = formData.get('email') as string // Reusing the email field for UserID
    const password = formData.get('password') as string
    const userType = formData.get('userType') as string || 'Staff'

    if (!userId || !password) {
        return { error: 'Missing UserID or Password' }
    }

    // --- MOCK MODE HANDLING ---
    // If using the mock password (provided by forgot-password in mock mode),
    // bypass external API and Supabase auth.
    if (password === 'mock-password-123') {
        console.log('MOCK MODE: Logging in with mock credentials');
        const cookieStore = await cookies()
        cookieStore.set('external_token', 'mock-token-123', {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'strict',
            path: '/',
            maxAge: 3600 // 1 hour
        })
        return { success: true, role: userType }
    }

    try {
        let apiUrl = 'http://14.139.187.54:443/api/auth';
        if (userType === 'Supervisor') {
            // Use local API for Supervisor to ensure updated logic is used
            apiUrl = 'http://14.139.187.54:443/api/admin-login';
        }
        console.log('Using API URL:', apiUrl);

        // 1. Call External API
        let payload: any = { UserID: userId, Password: password };

        if (userType === 'Supervisor') {
            payload = {
                UserId: userId,
                password: password,
                UserType: 'Supervisor'
            };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        console.log('External API Status:', response.status);

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse JSON response:', responseText);
            return { error: `External API returned invalid response: ${responseText.substring(0, 100)}...` };
        }

        if (!response.ok) {
            console.error('External API failed with error:', data.error);
            return { error: data.error || 'Invalid UserID or Password (External)' }
        }

        // If Supervisor, return token/data directly (no Supabase sync)
        if (userType === 'Supervisor') {
            // Sync with Supabase 'admins' table
            const supabase = await createClient()
            const adminData = data.admin

            // 1. Upsert Admin Details
            const { error: upsertError } = await supabase
                .from('admins')
                .upsert({
                    user_id: adminData.UserId.trim(),
                    dept_id: adminData.DeptId,
                    user_type: adminData.UserType.trim(),
                    dept_mail_id: adminData.Deptmailid,
                    department_name: adminData.DepartmentName,
                    dept_alias_name: adminData.Deptaliasname?.trim(),
                    last_login: new Date().toISOString()
                })

            if (upsertError) {
                console.error('Error syncing admin to Supabase:', upsertError)
            }

            // 2. Log Login Event
            const { error: logError } = await supabase
                .from('admin_logs')
                .insert({
                    user_id: adminData.UserId.trim(),
                    action: 'LOGIN'
                })

            if (logError) {
                console.error('Error logging admin login:', logError)
            }

            return { success: true, token: data.token, admin: data.admin, role: 'Supervisor' }
        }

        // --- Staff Logic (Supabase Sync) ---
        const user = data.user
        const token = data.token

        if (!user) {
            return { error: 'Login successful but no user data returned' }
        }

        // Store external token in cookie immediately (accessible for API proxy)
        const cookieStore = await cookies()
        console.log("LOGIN SUCCESS: Setting external_token cookie...", token ? "Token exists" : "No token");
        cookieStore.set('external_token', token, {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'strict',
            path: '/',
            maxAge: 3600 // 1 hour
        })

        // 2. Sync with Supabase
        const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        console.log('DEBUG: Supabase URL:', dbUrl);
        if (!dbUrl || dbUrl.includes('localhost')) {
            console.error('CRITICAL: Supabase URL looks wrong:', dbUrl);
        }

        const supabase = await createClient()
        const email = user.emailid || `${user.UserID}@kanchiuniv.ac.in` // Fallback email

        // Supabase requires minimum 6 characters for password
        // If password is shorter, pad it to meet the requirement
        // We pad consistently so sign-in and sign-up use the same password
        const supabasePassword = password.length < 6 ? password + '0' : password

        // Try to sign in with Supabase
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: supabasePassword,
        })

        console.log('Supabase signIn result:', { error: signInError ? signInError.message : 'Success' });

        if (signInError) {
            // If sign in fails, try to sign up (auto-register)
            // Note: This assumes the password is the same. 
            // If the user exists but password changed in external system, this might fail.
            // Ideally we use Admin API to update user, but we might not have Service Key.

            console.log('Supabase signin failed, trying signup:', signInError.message)

            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password: supabasePassword,
                options: {
                    data: {
                        full_name: user.Name,
                        emp_id: user.EmpID,
                        user_id_external: user.UserID,
                        department: user.DepartmentName,
                        designation: user.DesignationName,
                    },
                },
            })

            if (signUpError) {
                // DEBUG: Try raw fetch to see what Supabase returns
                try {
                    const rawResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                        },
                        body: JSON.stringify({ email, password: supabasePassword })
                    });
                    const rawText = await rawResp.text();
                    console.log('DEBUG: Raw Supabase SignUp Response:', rawText.substring(0, 500));
                } catch (rawErr) {
                    console.error('DEBUG: Raw fetch failed:', rawErr);
                }

                console.error('Supabase SignUp Error Details:', signUpError);
                return { error: `Supabase Auth Error: ${signUpError.message}` }
            }

            if (signUpData.session) {
                // SignUp successful and session created (email confirmation off)
                // Update profile with extra details
                await updateProfile(supabase, signUpData.user?.id, user)
                return { success: true, role: 'Staff' }
            } else if (signUpData.user && !signUpData.session) {
                return { error: 'Account created in Supabase. Please confirm your email if required, or ask Admin to disable email confirmation.' }
            }
        } else {
            // Sign in successful
            // Update profile to keep it in sync
            const { data: { user: sbUser } } = await supabase.auth.getUser()
            if (sbUser) {
                await updateProfile(supabase, sbUser.id, user)
            }
            return { success: true, role: 'Staff' }
        }

        return { success: true, role: 'Staff' }

    } catch (err: any) {
        console.error('Login error:', err)
        return { error: `Internal server error: ${err.message}` }
    }
}

export async function logoutAction(userId: string) {
    if (!userId) return

    const supabase = await createClient()

    try {
        await supabase
            .from('admin_logs')
            .insert({
                user_id: userId,
                action: 'LOGOUT'
            })
    } catch (err) {
        console.error('Error logging logout:', err)
    }
}

async function updateProfile(supabase: any, id: string | undefined, user: any) {
    if (!id) return

    const updates = {
        full_name: user.Name,
        emp_id: user.EmpID,
        user_id_external: user.UserID,
        father_name: user.FatherName,
        gender: user.Gender,
        dob: user.dob,
        doj: user.doj,
        mobile_no: user.MobileNo,
        department_no: user.Departmentno,
        department_name: user.DepartmentName,
        designation_no: user.DesignationNo,
        designation_name: user.DesignationName,
        status_external: user.Status,
        updated_at: new Date().toISOString(),
    }

    await supabase.from('profiles').update(updates).eq('id', id)
}

export async function forgotPasswordAction(prevState: any, formData: FormData) {
    const email = formData.get('email') as string
    const userType = formData.get('userType') as string || 'Staff'

    if (!email) {
        return { error: 'Please enter your User ID or Email' }
    }

    try {
        // 1. Get Credentials
        const userCredentials = await findUserCredentials(email, userType);

        if (!userCredentials || !userCredentials.success) {
            return { error: 'User not found' };
        }

        // 2. Send Email
        await sendCredentialsEmail({
            to: userCredentials.email,
            userId: userCredentials.userId,
            password: userCredentials.password,
            name: userCredentials.name,
            userType: userCredentials.userType
        });

        return { success: true, message: 'Credentials have been sent to your email address', email: userCredentials.email }
    } catch (error: any) {
        console.error('Forgot password error:', error)
        return { error: error.message || 'An unexpected error occurred' }
    }
}
