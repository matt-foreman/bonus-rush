import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function PrimaryButton({ children, className = '', ...props }: BaseButtonProps) {
  return (
    <button type="button" className={`btn btn-primary ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className = '', ...props }: BaseButtonProps) {
  return (
    <button type="button" className={`btn btn-secondary ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
