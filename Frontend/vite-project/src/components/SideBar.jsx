import { useState } from 'react'
import { Button, IconButton } from './ui/Button'
import { CloseIcon, LogOutIcon, PanelLeftIcon, PlusIcon, SearchIcon, TrashIcon } from './ui/icons'
import { cn } from './ui/cn'

// Left sidebar: app name with a collapse button, "New chat", a search box, the user's
// conversation list and a profile row with a logout button at the bottom.
// Fills its parent's width; Home sets the width and adds the resize handle.
function SideBar({ conversations, activeId, onSelect, onNewChat, onDelete, onCollapse, user, onLogout }) {
  // Search box text; filters the list by title as you type
  const [query, setQuery] = useState('')
  // Chat whose delete button was clicked once and is waiting for confirmation
  const [confirmId, setConfirmId] = useState(null)

  const search = query.trim().toLowerCase()
  const filtered = search
    ? conversations.filter((c) => (c.title || 'New Chat').toLowerCase().includes(search))
    : conversations

  return (
    <aside className='w-full h-full flex flex-col bg-sidebar border-r border-line-soft'>
      <div className='shrink-0 h-12 flex items-center justify-between pl-4 pr-2'>
        <span className='text-[14px] font-semibold text-ink truncate'>Aryan&rsquo;s Assistant</span>
        <IconButton onClick={onCollapse} title='Collapse chats'>
          <PanelLeftIcon />
        </IconButton>
      </div>

      <div className='px-2 pb-2 flex flex-col gap-1.5'>
        <Button variant='outline' onClick={onNewChat} className='w-full justify-start pl-2.5'>
          <PlusIcon size={15} className='text-muted' />
          New chat
        </Button>

        {/* Search */}
        <div className='relative'>
          <SearchIcon size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none' />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Esc clears the search
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder='Search chats'
            className='w-full h-9 pl-8 pr-8 rounded-lg bg-transparent border border-transparent text-[13px] text-ink placeholder:text-faint outline-none hover:bg-panel focus:bg-panel focus:border-line transition-colors'
          />
          {query && (
            <IconButton
              onClick={() => setQuery('')}
              title='Clear search'
              className='absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded hover:bg-transparent'
            >
              <CloseIcon size={12} />
            </IconButton>
          )}
        </div>
      </div>

      <p className='px-4 pt-2 pb-1 text-[12px] text-muted'>
        {search ? `Results (${filtered.length})` : 'Chats'}
      </p>

      {/* Conversation list (newest first, sorted by the chat service) */}
      <nav className='flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-px'>
        {conversations.length === 0 && (
          <p className='px-2 py-2 text-[13px] text-muted'>No conversations yet</p>
        )}
        {conversations.length > 0 && filtered.length === 0 && (
          <p className='px-2 py-2 text-[13px] text-muted'>No chats match &ldquo;{query.trim()}&rdquo;</p>
        )}
        {filtered.map((c) => {
          const confirming = confirmId === c._id
          return (
            <div
              key={c._id}
              // Leaving the row cancels a pending "Delete?" confirmation
              onMouseLeave={() => confirming && setConfirmId(null)}
              className={cn(
                'group flex items-center rounded-md transition-colors',
                c._id === activeId ? 'bg-raised text-ink' : 'text-ink-soft hover:bg-panel hover:text-ink',
              )}
            >
              <button
                onClick={() => onSelect(c._id)}
                className='flex-1 min-w-0 text-left pl-2.5 py-1.5 text-[13px] truncate cursor-pointer rounded-md'
              >
                {c.title || 'New Chat'}
              </button>

              {/* Delete: first click asks "Delete?", second click deletes */}
              {confirming ? (
                <button
                  onClick={() => {
                    setConfirmId(null)
                    onDelete(c._id)
                  }}
                  className='shrink-0 mr-1 px-2 h-6 rounded bg-danger/15 text-[11px] font-medium text-danger hover:bg-danger/25 cursor-pointer'
                >
                  Delete?
                </button>
              ) : (
                <IconButton
                  onClick={() => setConfirmId(c._id)}
                  title='Delete chat'
                  className={cn(
                    'mr-1 w-6 h-6 rounded hover:bg-transparent hover:text-danger transition-opacity',
                    c._id === activeId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
                  )}
                >
                  <TrashIcon size={14} />
                </IconButton>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logged-in user */}
      {user && (
        <div className='p-2 pl-3 border-t border-line-soft flex items-center gap-2.5'>
          {user.avatar ? (
            <img src={user.avatar} alt='' referrerPolicy='no-referrer' className='w-7 h-7 rounded-full' />
          ) : (
            <div className='w-7 h-7 rounded-full bg-raised flex items-center justify-center text-[12px] font-medium text-ink'>
              {user.name?.[0] ?? '?'}
            </div>
          )}
          <div className='flex-1 min-w-0'>
            <p className='text-[13px] leading-tight text-ink truncate'>{user.name}</p>
            <p className='text-[11px] leading-tight text-muted truncate'>{user.email}</p>
          </div>
          <IconButton onClick={onLogout} title='Log out'>
            <LogOutIcon />
          </IconButton>
        </div>
      )}
    </aside>
  )
}

export default SideBar
