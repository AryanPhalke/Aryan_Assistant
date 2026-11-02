import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

// Shared outline style for all icons. Decorative: the button around an icon
// provides the accessible name (see IconButton)
function Icon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      {...props}
    />
  )
}

export const PanelLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x='3' y='4' width='18' height='16' rx='2.5' />
    <path d='M9 4v16' />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='M12 5v14M5 12h14' />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx='11' cy='11' r='7' />
    <path d='m20 20-3.5-3.5' />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='M6 6l12 12M18 6 6 18' />
  </Icon>
)

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='M3 6h18' />
    <path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
    <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
  </Icon>
)

export const LogOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3' />
    <path d='m16 17 5-5-5-5M21 12H9' />
  </Icon>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='M12 19V5M6 11l6-6 6 6' />
  </Icon>
)

export const StopIcon = (props: IconProps) => (
  <Icon {...props} fill='currentColor' stroke='none'>
    <rect x='6' y='6' width='12' height='12' rx='2' />
  </Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='m6 9 6 6 6-6' />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='m5 12 5 5 9-10' />
  </Icon>
)

export const FilesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d='M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z' />
    <path d='M14 3v5h5' />
    <path d='m10 13-2 2 2 2M14 13l2 2-2 2' />
  </Icon>
)
