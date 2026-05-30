import { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

export async function fetchAllRows<T extends Record<string, unknown>>(
    supabase: SupabaseClient,
    table: string,
    orderBy?: { column: string; ascending?: boolean }
): Promise<T[]> {
    const all: T[] = []
    let from = 0

    while (true) {
        let query = supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1)
        if (orderBy) {
            query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
        }

        const { data, error } = await query
        if (error) throw error
        if (!data?.length) break

        all.push(...(data as T[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
    }

    return all
}
