import { Navigate, Route, Routes } from 'react-router-dom'
import Launcher from './pages/Launcher'
import TooDooOverlay from './pages/Tools/TooDoo/Overlay'
import QuickAdd from './pages/Tools/TooDoo/QuickAdd'
import Transly from './pages/Tools/Transly'
import TranslateOptions from './pages/Tools/Transly/TranslateOptions'

const App = () => (
  <Routes>
    <Route path="/" element={<Launcher />} />
    <Route path="/toodoo" element={<TooDooOverlay />} />
    <Route path="/quick-add" element={<QuickAdd />} />
    <Route path="/transly" element={<Transly />} />
    <Route path="/translate-options" element={<TranslateOptions />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export default App
