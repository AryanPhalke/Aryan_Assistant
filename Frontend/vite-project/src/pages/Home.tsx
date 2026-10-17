import { signInWithPopup } from 'firebase/auth'

import { auth, googleProvider } from '../../utils/firebase'
import api from '../../utils/axios'
import { useDispatch, useSelector } from 'react-redux'


function Home() {
  const {userData} = useSelector(state=>state.user)
  const dispatch=useDispatch()
  console.log("data fronm user: ",userData)
    const handleLogin=async(token: string)=>{
    try{
      const {data} = await api.post("/api/auth/login", {token})
      dispatch(setUserdata)
      console.log(data);
    }
    catch(error){
      console.log(error);
    }
  }
  const googleLogin = async () => {
    const data = await signInWithPopup(auth, googleProvider)
    const token =await data.user.getIdToken();
    console.log(token);
    await handleLogin(token);
    console.log(data)
  }
  return (
    <div className='h-screen flex bg-[#0d0f14] text-white overflow-hidden'>
{!userData && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur'>
        <div className='w-[340px] bg-[#13151c] border border-white/[0.08] rounded-2xl p-7 flex flex-col gap-5'>
          <div className='flex flex-col gap-1'>
            <h2 className='text-[17px] font-semibold text-slate-100 tracking-tight'>Welcome to CortexAI</h2>
            <p className='text-[13px] text-slate-500'>Please login to continue using the app.</p>
          </div>

          <button
            onClick={googleLogin}
            className='w-full h-11 flex items-center justify-center gap-3 rounded-xl bg-white text-[14px] font-medium text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer'
          >
            <svg width='18' height='18' viewBox='0 0 48 48'>
              <path fill='#EA4335' d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'/>
              <path fill='#4285F4' d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'/>
              <path fill='#FBBC05' d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'/>
              <path fill='#34A853' d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>}

      
    </div>
  )
}

export default Home
