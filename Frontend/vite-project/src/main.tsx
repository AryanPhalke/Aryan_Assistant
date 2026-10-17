import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Provider } from 'react-redux'
import { store } from '../redux/store.js'

// Entry point: wraps the app in the Redux Provider so any component can read the store
createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>
)
