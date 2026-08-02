import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from './ui/button'

interface CopyButtonProps {
  value: string
  label?: string
}

export function CopyButton({ value, label = '复制' }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    window.setTimeout(() => setStatus('idle'), 1600)
  }

  return (
    <Button type='button' variant='outline' size='sm' onClick={copy}>
      {status === 'copied' ? (
        <Check className='size-4' aria-hidden='true' />
      ) : (
        <Copy className='size-4' aria-hidden='true' />
      )}
      {status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : label}
    </Button>
  )
}
