// Sideways text for the collapsed panel strips ("Chats", "Artifacts")
export function VerticalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className='text-[11px] font-medium tracking-wider uppercase [writing-mode:vertical-rl] rotate-180'>
      {children}
    </span>
  )
}
