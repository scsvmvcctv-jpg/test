'use server'

import { cookies } from 'next/headers'

const getApiBaseUrl = () => (process.env.API_BASE_URL || '').replace(/\/$/, '') + '/api';

export async function fetchFilterOptions() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('external_token')?.value

        if (!token) {
            console.warn('No external_token found in cookies')
            // throwing error might block page load if this is critical, or we proceed and let API fail
        }

        const apiBase = getApiBaseUrl();
        console.log(`Fetching filter options from ${apiBase}/filter-options`)
        const response = await fetch(`${apiBase}/filter-options`, {
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })

        if (!response.ok) {
            console.error(`Filter options fetch failed with status: ${response.status}`)
            // Attempt to read text to see error
            const text = await response.text()
            console.error(`Response body: ${text.substring(0, 200)}`)
            throw new Error(`Failed to fetch filter options: ${response.status}`)
        }

        const data = await response.json()
        return { success: true, data }
    } catch (error: any) {
        console.error('Error in fetchFilterOptions:', error)
        return { success: false, error: error.message }
    }
}

export async function fetchStudentData(filters: { academicYear: string, course: string, semester: string }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('external_token')?.value

        const normalizedSemester = (() => {
            const s = filters.semester.toString().toUpperCase().replace(/SEM\s*/, '').replace(/SEMESTER\s*/, '').trim();
            const map: { [key: string]: string } = {
                '1': 'I', 'I': 'I',
                '2': 'II', 'II': 'II',
                '3': 'III', 'III': 'III',
                '4': 'IV', 'IV': 'IV',
                '5': 'V', 'V': 'V',
                '6': 'VI', 'VI': 'VI',
                '7': 'VII', 'VII': 'VII',
                '8': 'VIII', 'VIII': 'VIII'
            };
            return map[s] || filters.semester;
        })();

        const queryParams = new URLSearchParams({
            academicyearnow: filters.academicYear,
            CourseNameforTC: filters.course,
            sem_now: normalizedSemester
        })

        const url = `${getApiBaseUrl()}/admitted-students?${queryParams.toString()}`
        console.log(`Fetching students from ${url}`)

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            cache: 'no-store'
        })

        if (!response.ok) {
            console.error(`Student data fetch failed with status: ${response.status}`)
            const text = await response.text()
            console.error(`Response body: ${text.substring(0, 200)}`)
            throw new Error(`Failed to fetch student data: ${response.status}`)
        }

        const responseData = await response.json()
        const students = Array.isArray(responseData.data) ? responseData.data : responseData

        console.log(`API Success. Found ${students?.length || 0} students.`)
        if (!students || students.length === 0) {
            console.log('Zero students found. Full Response:', JSON.stringify(responseData, null, 2))
        }

        return { success: true, data: students }
    } catch (error: any) {
        console.error('Error in fetchStudentData:', error)
        return { success: false, error: error.message }
    }
}
