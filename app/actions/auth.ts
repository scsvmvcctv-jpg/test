'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function loginAction(prevState: any, formData: FormData) {
    const userId = formData.get('email') as string // Reusing the email field for UserID
    const password = formData.get('password') as string

    if (!userId || !password) {
        return { error: 'Missing UserID or Password' }
    }

    try {
        // 1. Call External API
        const response = await fetch('http://14.139.187.54:443/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ UserID: userId, Password: password }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.error || 'Invalid UserID or Password (External)' }
        }

        const data = await response.json()
        const user = data.user

        if (!user) {
            return { error: 'Login successful but no user data returned' }
        }

        // 2. Sync with Supabase
        const supabase = await createClient()
        const email = user.emailid || `${user.UserID}@kanchiuniv.ac.in` // Fallback email

        // Try to sign in with Supabase
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (signInError) {
            // If sign in fails, try to sign up (auto-register)
            // Note: This assumes the password is the same. 
            // If the user exists but password changed in external system, this might fail.
            // Ideally we use Admin API to update user, but we might not have Service Key.

            console.log('Supabase signin failed, trying signup:', signInError.message)

            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
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
                return { error: `Supabase Auth Error: ${signUpError.message}` }
            }

            if (signUpData.session) {
                // SignUp successful and session created (email confirmation off)
                // Update profile with extra details
                await updateProfile(supabase, signUpData.user?.id, user)
                return { success: true }
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
            return { success: true }
        }

        return { success: true }

    } catch (err: any) {
        console.error('Login error:', err)
        return { error: 'Internal server error' }
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
