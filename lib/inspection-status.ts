export type ApprovalDisplay = {
    label: string
    className: string
}

export function getHodApprovalDisplay(status?: string | null): ApprovalDisplay {
    const value = (status || 'Pending').trim()

    switch (value) {
        case 'HOD Approved':
        case 'Dean Approved':
            return { label: 'Verified', className: 'bg-blue-100 text-blue-800' }
        case 'Submitted':
            return { label: 'Awaiting HOD', className: 'bg-yellow-100 text-yellow-800' }
        case 'Returned':
            return { label: 'Query Raised', className: 'bg-red-100 text-red-800' }
        default:
            return { label: 'Pending', className: 'bg-slate-100 text-slate-700' }
    }
}

export function getDeanApprovalDisplay(status?: string | null): ApprovalDisplay {
    const value = (status || 'Pending').trim()

    switch (value) {
        case 'Dean Approved':
            return { label: 'Verified', className: 'bg-green-100 text-green-800' }
        case 'HOD Approved':
            return { label: 'Awaiting Dean', className: 'bg-indigo-100 text-indigo-800' }
        case 'Submitted':
            return { label: 'Pending', className: 'bg-slate-100 text-slate-700' }
        case 'Returned':
            return { label: 'Pending', className: 'bg-slate-100 text-slate-700' }
        default:
            return { label: 'Pending', className: 'bg-slate-100 text-slate-700' }
    }
}

export function getStaffInspectionStatusDisplay(status?: string | null): ApprovalDisplay {
    const value = (status || 'Pending').trim()

    switch (value) {
        case 'Submitted':
            return { label: 'Submitted', className: 'bg-yellow-100 text-yellow-800' }
        case 'HOD Approved':
            return { label: 'Pending Dean', className: 'bg-indigo-100 text-indigo-800' }
        case 'Dean Approved':
            return { label: 'Dean Approved', className: 'bg-green-100 text-green-800' }
        case 'Returned':
            return { label: 'Returned', className: 'bg-red-100 text-red-800' }
        default:
            return { label: 'Pending', className: 'bg-slate-100 text-slate-700' }
    }
}
