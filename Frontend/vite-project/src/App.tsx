import { useEffect } from 'react'
import Home from './pages/Home'
import getCurrentUser from "./features/getCurrentUser"
import { useDispatch } from 'react-redux'
import {setUserdata} from '../redux/userSlice'

// Root component. On first load it checks whether the user already has a valid
// session (e.g. after a page refresh) and stores the result in Redux.
function App (){
  const dispatch = useDispatch();
useEffect (()=>{
  const getUser = async()=>{
    const data = await getCurrentUser() // user object, or null if logged out
    dispatch(setUserdata(data))
  }
  getUser()
},[])
  return (
    <>
      <Home/>
    </>
  )
}

export default App
