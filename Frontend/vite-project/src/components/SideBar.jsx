import { useState } from 'react'

// Left sidebar: "New chat" button, a search box, the user's conversation list and a profile
// row with a logout button at the bottom.
// Fills its parent's width; Home sets the width and adds the resize handle.
function SideBar({ conversations, activeId, onSelect, onNewChat, user, onLogout }) {
  // Search box text; filters the list by title as you type
  const [query, setQuery] = useState('')

  const search = query.trim().toLowerCase()
  const filtered = search
    ? conversations.filter((c) => (c.title || 'New Chat').toLowerCase().includes(search))
    : conversations

  return (
    <aside className='w-full h-full flex flex-col bg-[#0a0c10] border-r border-white/[0.06]'>
      <div className='p-3 flex flex-col gap-2'>
        <button
          onClick={onNewChat}
          className='w-full h-10 flex items-center gap-2 px-3 rounded-xl border border-white/[0.08] text-[13px] font-medium text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer'
        >
          <span className='text-[16px] leading-none'>+</span>
          New chat
        </button>

        {/* Search */}
        <div className='relative'>
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Esc clears the search
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder='Search chats'
            className='w-full h-9 pl-8 pr-8 rounded-lg bg-white/[0.04] border border-transparent text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-white/[0.12] transition-colors'
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              title='Clear search'
              className='absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[11px] text-slate-500 hover:text-slate-200 cursor-pointer'
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <p className='px-5 pt-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-600'>
        {search ? `Results (${filtered.length})` : 'Chats'}
      </p>

      {/* Conversation list (newest first, sorted by the chat service) */}
      <nav className='flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5'>
        {conversations.length === 0 && (
          <p className='px-3 py-2 text-[12px] text-slate-600'>No conversations yet</p>
        )}
        {conversations.length > 0 && filtered.length === 0 && (
          <p className='px-3 py-2 text-[12px] text-slate-600'>No chats match &ldquo;{query.trim()}&rdquo;</p>
        )}
        {filtered.map((c) => (
          <button
            key={c._id}
            onClick={() => onSelect(c._id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-[13px] truncate transition-colors cursor-pointer ${
              c._id === activeId
                ? 'bg-white/[0.08] text-slate-100'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            {c.title || 'New Chat'}
          </button>
        ))}
      </nav>

      {/* Logged-in user */}
      {user && (
        <div className='p-3 border-t border-white/[0.06] flex items-center gap-3'>
          {user.avatar ? (
            <img src={user.avatar} alt='' referrerPolicy='no-referrer' className='w-8 h-8 rounded-full' />
          ) : (
            <div className='w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-[13px] font-medium'>
              {user.name?.[0] ?? '?'}
            </div>
          )}
          <div className='flex-1 min-w-0'>
            <p className='text-[13px] text-slate-200 truncate'>{user.name}</p>
            <p className='text-[11px] text-slate-500 truncate'>{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            title='Log out'
            className='text-[12px] text-slate-500 hover:text-slate-200 transition-colors cursor-pointer'
          >
            Log out
          </button>
        </div>
      )}
    </aside>
  )
}

export default SideBar
