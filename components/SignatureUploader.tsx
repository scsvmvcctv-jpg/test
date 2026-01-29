'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload } from 'lucide-react'

interface SignatureUploaderProps {
    onUpload: (url: string) => void
    label: string
    initialUrl?: string
}

export function SignatureUploader({ onUpload, label, initialUrl }: SignatureUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const supabase = createClient()

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true)

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.')
            }

            const file = event.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('signatures')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage.from('signatures').getPublicUrl(filePath)
            onUpload(data.publicUrl)
        } catch (error) {
            alert('Error uploading signature!')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="signature">{label}</Label>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Input id="signature" type="file" onChange={handleUpload} disabled={uploading} />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {initialUrl && (
                    <div className="mt-2">
                        <img src={initialUrl} alt="Signature Preview" className="h-16 object-contain border rounded p-1" />
                    </div>
                )}
            </div>
        </div>
    )
}
