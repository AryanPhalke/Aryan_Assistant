// Left sidebar: "New chat" button, the user's conversation list and a profile
// row with a logout button at the bottom.
// Fills its parent's width; Home sets the width and adds the resize handle.
function SideBar({ conversations, activeId, onSelect, onNewChat, user, onLogout }) {
  return (
    <aside className='w-full h-full flex flex-col bg-[#0a0c10] border-r border-white/[0.06]'>
      <div className='p-3'>
        <button
          onClick={onNewChat}
          className='w-full h-10 flex items-center gap-2 px-3 rounded-xl border border-white/[0.08] text-[13px] font-medium text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer'
        >
          <span className='text-[16px] leading-none'>+</span>
          New chat
        </button>
      </div>

      <p className='px-5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-600'>Chats</p>

      {/* Conversation list (newest first, sorted by the chat service) */}
      <nav className='flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5'>
        {conversations.length === 0 && (
          <p className='px-3 py-2 text-[12px] text-slate-600'>No conversations yet</p>
        )}
        {conversations.map((c) => (
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
