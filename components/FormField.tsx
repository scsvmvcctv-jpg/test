'use client'

import {
    FormControl,
    FormField as ShadcnFormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Control } from 'react-hook-form'

interface FormFieldProps {
    control: Control<any>
    name: string
    label: string
    placeholder?: string
    type?: string
    description?: string
}

export function FormField({
    control,
    name,
    label,
    placeholder,
    type = 'text',
}: FormFieldProps) {
    return (
        <ShadcnFormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Input placeholder={placeholder} type={type} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
