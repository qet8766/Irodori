import { Navigate, Route, Routes } from 'react-router-dom'
import Launcher from './pages/Launcher'
import TooDooOverlay from './pages/Tools/TooDoo/Overlay'
import QuickAdd from './pages/Tools/TooDoo/QuickAdd'
import Transly from './pages/Tools/Transly'
import TranslateOptions from './pages/Tools/Transly/TranslateOptions'
import NoteTankOverlay from './pages/Tools/NoteTank/Overlay'
import NoteEditor from './pages/Tools/NoteTank/NoteEditor'
import NoteTank from './pages/Tools/NoteTank'
import AiruPopup from './pages/Tools/Airu/AiruPopup'
import PromptEditor from './pages/Tools/Airu/PromptEditor'
import AiruDebug from './pages/Tools/Airu'

const App = () => (
  <Routes>
    <Route path="/" element={<Launcher />} />
    <Route path="/toodoo" element={<TooDooOverlay />} />
    <Route path="/quick-add" element={<QuickAdd />} />
    <Route path="/transly" element={<Transly />} />
    <Route path="/translate-options" element={<TranslateOptions />} />
    <Route path="/notetank" element={<NoteTankOverlay />} />
    <Route path="/note-editor" element={<NoteEditor />} />
    <Route path="/notetank-debug" element={<NoteTank />} />
    <Route path="/airu-popup" element={<AiruPopup />} />
    <Route path="/airu-prompt-editor" element={<PromptEditor />} />
    <Route path="/airu" element={<AiruDebug />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

export default App
