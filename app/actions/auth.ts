'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
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
        const base = (process.env.API_BASE_URL || '').replace(/\/$/, '');
        let apiUrl = `${base}/api/auth`;
        if (userType === 'Supervisor') {
            // Use local API for Supervisor to ensure updated logic is used
            apiUrl = `${base}/api/admin-login`;
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
            console.error('External API failed:', response.status, data?.error || data?.details || responseText?.substring(0, 200));
            const msg = data?.error || data?.details || (response.status === 500 ? 'Authentication service is temporarily unavailable. Please try again later.' : 'Invalid UserID or Password');
            return { error: msg }
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

        // Supabase requires minimum 6 characters; we pad so we never hit weak_password (no client-side length check)
        const minLen = 6
        const supabasePassword = password.length >= minLen ? password : password + '0'.repeat(minLen - password.length)

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
                console.error('Supabase SignUp Error Details:', signUpError);
                const code = (signUpError as { code?: string }).code
                const msg = signUpError.message ?? ''
                const isAlreadyRegistered = code === 'user_already_exists' || /already registered|user already exists|email.*exists/i.test(msg) || msg.includes('already registered')

                if (isAlreadyRegistered && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
                    // User exists but password may have changed externally: update Supabase password and retry sign-in
                    try {
                        const admin = createSupabaseAdmin(
                            process.env.NEXT_PUBLIC_SUPABASE_URL,
                            process.env.SUPABASE_SERVICE_ROLE_KEY
                        )
                        const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
                        const users = listData?.users ?? []
                        // Find by email first, then by external user id (in case Supabase email differs)
                        let existingUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
                        if (!existingUser?.id && user?.UserID) {
                            existingUser = users.find((u) => (u.user_metadata?.user_id_external ?? u.user_metadata?.user_id) === user.UserID) ?? undefined
                        }
                        if (existingUser?.id) {
                            const { error: updateErr } = await admin.auth.admin.updateUserById(existingUser.id, { password: supabasePassword })
                            if (!updateErr) {
                                const signInEmail = existingUser.email ?? email
                                const { error: retrySignInErr } = await supabase.auth.signInWithPassword({ email: signInEmail, password: supabasePassword })
                                if (!retrySignInErr) {
                                    const { data: { user: sbUser } } = await supabase.auth.getUser()
                                    if (sbUser) await updateProfile(supabase, sbUser.id, user)
                                    return { success: true, role: 'Staff' }
                                }
                                console.error('Retry sign-in after password update failed:', retrySignInErr.message)
                            } else {
                                console.error('Admin updateUserById failed:', updateErr.message)
                            }
                        } else {
                            console.error('User already registered but not found in listUsers. Email used:', email, 'UserID:', user?.UserID)
                        }
                    } catch (adminErr) {
                        console.error('Admin password update failed:', adminErr)
                    }
                } else if (isAlreadyRegistered && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    console.error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env to fix login for existing users.')
                }

                if (isAlreadyRegistered) {
                    return { error: 'Invalid login credentials. Please check your User ID and password.' }
                }
                return { error: `Supabase Auth Error: ${msg}` }
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
        console.error('Login error:', err?.message || err, err?.stack)
        const msg = err?.message || String(err)
        return { error: msg ? `Login failed: ${msg}` : 'An unexpected error occurred. Please try again.' }
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
