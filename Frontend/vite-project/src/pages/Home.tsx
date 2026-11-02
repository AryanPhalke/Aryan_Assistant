import { useEffect, useState } from 'react'
import { signInWithPopup } from 'firebase/auth'

import { auth, googleProvider } from '../../utils/firebase'
import api from '../../utils/axios'
import { useDispatch, useSelector } from 'react-redux'
import {setUserdata} from '../../redux/userSlice.js'
import SideBar from '../components/SideBar.jsx'
import ChatArea from '../components/ChatArea'
import Artifact, { type ArtifactData } from '../components/Artifact'
import ResizeHandle from '../components/ResizeHandle'
import { ARTIFACT, MIN_CHAT, SIDEBAR, STRIP_WIDTH } from '../components/layout'
import { Button, IconButton } from '../components/ui/Button'
import { FilesIcon, PanelLeftIcon, PlusIcon } from '../components/ui/icons'
import { cn } from '../components/ui/cn'

type Conversation = { _id: string; title: string }

// Landing page. Shows a "Login with Google" popup until the user is logged in,
// then the chat layout: sidebar | chat | (optional) artifact panel.
function Home() {
  // userData lives in the Redux store: null = logged out, object = logged in.
  // It is filled by App.tsx when the page loads.
  const {userData} = useSelector(state=>state.user)
  const dispatch=useDispatch()
  console.log("[Home] Current user in Redux:", userData)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // Artifact panel: the content (null = nothing generated yet), whether the
  // panel is open, and its width (changed by dragging its left edge)
  const [artifact, setArtifact] = useState<ArtifactData | null>(null)
  const [artifactOpen, setArtifactOpen] = useState(false)
  const [artifactWidth, setArtifactWidth] = useState(ARTIFACT.default)

  // Sidebar: open/collapsed, width (changed by dragging its right edge), and
  // whether it's being dragged (to dim it near the collapse point).
  // Open/collapsed is remembered between visits.
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebarOpen') !== 'false')
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR.default)
  const [sidebarDragging, setSidebarDragging] = useState(false)

  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen))
  }, [sidebarOpen])

  // Each panel can only grow until the chat in the middle hits MIN_CHAT
  const sidebarSpace = sidebarOpen ? sidebarWidth : STRIP_WIDTH
  const artifactSpace = artifactOpen ? artifactWidth : STRIP_WIDTH
  const sidebarMax = Math.min(SIDEBAR.max, window.innerWidth - artifactSpace - MIN_CHAT)
  const artifactMax = window.innerWidth - sidebarSpace - MIN_CHAT

  // Called by ChatArea when a reply has code (or the user clicks "Open")
  const openArtifact = (data: ArtifactData) => {
    setArtifact(data)
    setArtifactOpen(true)
  }

  // Load the user's conversations once they are logged in
  useEffect(() => {
    if (!userData) return
    const loadConversations = async () => {
      try {
        const { data } = await api.get('/api/chat/get-conversation')
        setConversations(data)
      } catch (error) {
        console.error('[Home] Failed to load conversations:', error)
      }
    }
    loadConversations()
  }, [userData])

  // Called by ChatArea on the first message of a new chat: create the
  // conversation and name it after the first prompt
  const ensureConversation = async (firstPrompt: string) => {
    const { data } = await api.post('/api/chat/create-conversation')
    const title = firstPrompt.length > 40 ? `${firstPrompt.slice(0, 40)}...` : firstPrompt
    const { data: updated } = await api.post('/api/chat/update-conversation', { id: data._id, title })
    setConversations((prev) => [updated ?? data, ...prev])
    setActiveId(data._id)
    return data._id as string
  }

  const startNewChat = () => {
    setActiveId(null)
    setArtifact(null)
  }

  const selectConversation = (id: string) => {
    setActiveId(id)
    setArtifact(null)
  }

  // Deletes a chat (and its messages) on the server, then removes it from the
  // list. Deleting the open chat switches to a new empty chat.
  const deleteConversation = async (id: string) => {
    try {
      await api.delete(`/api/chat/delete-conversation/${id}`)
      setConversations((prev) => prev.filter((c) => c._id !== id))
      if (id === activeId) startNewChat()
    } catch (error) {
      console.error('[Home] Failed to delete conversation:', error)
    }
  }

  const logout = async () => {
    try {
      await api.get('/api/auth/logout')
    } catch (error) {
      console.error('[Home] Logout failed:', error)
    }
    dispatch(setUserdata(null))
    setConversations([])
    setActiveId(null)
    setArtifact(null)
  }

  // Step 2 of login: send the Firebase token to our backend, which verifies it
  // and sets the session cookie.
  const handleLogin=async(token: string)=>{
    try{
      const {data} = await api.post("/api/auth/login", {token})
      dispatch(setUserdata(data))
      console.log("[Home] Backend login successful:", data);
    }
    catch(error){
      console.error("[Home] Backend login failed:", error);
    }
  }

  // Step 1 of login: open the Google popup, then get a Firebase ID token
  // (proof that Google confirmed who this user is).
  const googleLogin = async () => {
    const data = await signInWithPopup(auth, googleProvider)
    const token =await data.user.getIdToken();
    console.log("[Home] Google sign-in successful for:", data.user.email);
    await handleLogin(token);
  }
  return (
    <div className='h-screen flex bg-app text-ink overflow-hidden'>
{!userData && <div className='fixed inset-0 z-50 flex items-center justify-center bg-app'>
        <div className='w-85 flex flex-col gap-6'>
          <div className='flex flex-col gap-1.5'>
            <h2 className='text-[24px] font-semibold text-ink tracking-tight'>Aryan&rsquo;s Assistant</h2>
            <p className='text-[14px] text-muted'>Sign in to pick up your conversations.</p>
          </div>

          <Button variant='outline' onClick={googleLogin} className='w-full h-11 gap-3 text-[14px] bg-panel'>
            <svg width='18' height='18' viewBox='0 0 48 48'>
              <path fill='#EA4335' d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'/>
              <path fill='#4285F4' d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'/>
              <path fill='#FBBC05' d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'/>
              <path fill='#34A853' d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'/>
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>}

      {userData && (
        <>
          {sidebarOpen ? (
            <div
              style={{ width: sidebarWidth }}
              className={cn('relative shrink-0 h-full', sidebarDragging && sidebarWidth < SIDEBAR.collapseAt && 'opacity-50')}
            >
              <SideBar
                conversations={conversations}
                activeId={activeId}
                onSelect={selectConversation}
                onNewChat={startNewChat}
                onDelete={deleteConversation}
                onCollapse={() => setSidebarOpen(false)}
                user={userData}
                onLogout={logout}
              />
              {/* Drag the right edge to resize; nearly shut collapses to the strip */}
              <ResizeHandle
                side='right'
                width={sidebarWidth}
                min={SIDEBAR.min}
                max={sidebarMax}
                collapseAt={SIDEBAR.collapseAt}
                defaultWidth={SIDEBAR.default}
                onResize={setSidebarWidth}
                onCollapse={() => setSidebarOpen(false)}
                dragging={sidebarDragging}
                onDraggingChange={setSidebarDragging}
              />
            </div>
          ) : (
            // Collapsed: a slim strip on the left edge with a button that opens
            // the sidebar again and "new chat"
            <div
              style={{ width: STRIP_WIDTH }}
              className='shrink-0 h-full flex flex-col items-center gap-1 pt-2 border-r border-line-soft bg-sidebar'
            >
              <IconButton onClick={() => setSidebarOpen(true)} title='Open chats'>
                <PanelLeftIcon />
              </IconButton>
              <IconButton onClick={startNewChat} title='New chat'>
                <PlusIcon />
              </IconButton>
            </div>
          )}
          <ChatArea
            conversationId={activeId}
            title={conversations.find((c) => c._id === activeId)?.title}
            userName={userData.name}
            ensureConversation={ensureConversation}
            onOpenArtifact={openArtifact}
          />
          {artifactOpen ? (
            <Artifact
              key={
                !artifact
                  ? 'empty'
                  : 'document' in artifact
                    ? artifact.document.path
                    : `${artifact.active}:${artifact.files.map((f) => `${f.fileName}:${f.code.length}`).join('|')}`
              }
              artifact={artifact}
              width={artifactWidth}
              maxWidth={artifactMax}
              onResize={setArtifactWidth}
              onClose={() => setArtifactOpen(false)}
            />
          ) : (
            // Collapsed: a slim strip on the right edge that opens the panel
            <button
              onClick={() => setArtifactOpen(true)}
              title='Open artifacts'
              style={{ width: STRIP_WIDTH }}
              className='group shrink-0 h-full flex flex-col items-center pt-2 border-l border-line-soft bg-sidebar text-muted hover:text-ink transition-colors cursor-pointer'
            >
              <span className='relative w-8 h-8 flex items-center justify-center rounded-md group-hover:bg-raised transition-colors'>
                <FilesIcon />
                {/* Dot = something is ready to view */}
                {artifact && <span className='absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent' />}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default Home
