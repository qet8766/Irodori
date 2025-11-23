import { Navigate, Route, Routes } from 'react-router-dom'
import Launcher from './pages/Launcher'
import TooDooOverlay from './pages/Tools/TooDoo/Overlay'
import QuickAdd from './pages/Tools/TooDoo/QuickAdd'
import Translater from './pages/Tools/Translater'

const App = () => (
  <Routes>
    <Route path="/" element={<Launcher />} />
    <Route path="/toodoo" element={<TooDooOverlay />} />
    <Route path="/quick-add" element={<QuickAdd />} />
    <Route path="/translater" element={<Translater />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export default App
