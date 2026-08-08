import { highlight } from 'sugar-high'

import { cn } from '#/lib/utils.ts'

export function CodeBlock({
  code,
  className,
  codeClassName,
}: {
  code: string
  className?: string
  codeClassName?: string
}) {
  const html = highlight(code)

  return (
    <pre
      className={cn(
        'code-block max-h-136 overflow-auto rounded-xl border border-[var(--line)] bg-[#102327] p-5 text-xs leading-6 text-[#d7ece8] shadow-inner',
        className,
      )}
    >
      <code
        className={cn('font-mono whitespace-pre', codeClassName)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  )
}
