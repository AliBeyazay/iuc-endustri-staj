import Image from 'next/image'

type UniversityLogoProps = {
  size?: number
  className?: string
}

export default function UniversityLogo({
  size = 44,
  className = '',
}: UniversityLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt={'\u0130stanbul \u00dcniversitesi - Cerrahpa\u015fa End\u00fcstri M\u00fchendisli\u011fi logosu'}
      width={size}
      height={size}
      className={className}
      priority
    />
  )
}
