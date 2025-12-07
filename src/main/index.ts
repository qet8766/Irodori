import { app } from './electron'
import { bootstrap, handleActivate, handleAllWindowsClosed } from './app'

// App ready - bootstrap the application
app.whenReady().then(bootstrap)

// macOS: re-create window when dock icon clicked
app.on('activate', handleActivate)

// All windows closed - cleanup and quit
app.on('window-all-closed', handleAllWindowsClosed)
