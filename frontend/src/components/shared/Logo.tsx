import logo from '@/assets/logo.svg'

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return <img src={logo} alt="Migration Hub" className={className} />
}
