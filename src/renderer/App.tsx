import { Navigate, Route, Routes } from 'react-router-dom'
import Launcher from './pages/Launcher'
import TooDooOverlay from './pages/Tools/TooDoo/Overlay'

const App = () => (
  <Routes>
    <Route path="/" element={<Launcher />} />
    <Route path="/toodoo" element={<TooDooOverlay />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export default App
