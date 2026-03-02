import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolRuntimeContext } from '../server.js'
import { registerDiscoveryTools } from './discovery.js'
import { registerExecuteTools } from './execute.js'
import { registerPermissionTools } from './permissions.js'
import { registerAccessibilityTools } from './accessibility.js'
import { registerSystemTools } from './system.js'
import { registerClipboardTools } from './clipboard.js'
import { registerFinderTools } from './finder.js'
import { registerNotificationTools } from './notifications.js'
import { registerShortcutsTools } from './shortcuts.js'
import { registerCalendarTools } from './calendar.js'
import { registerItermTools } from './iterm.js'
import { registerPagesTools } from './pages.js'
import { registerNotesTools } from './notes.js'
import { registerMailTools } from './mail.js'
import { registerMessagesTools } from './messages.js'

export function registerAllTools(server: McpServer, context: ToolRuntimeContext) {
  registerDiscoveryTools(server, context)
  registerExecuteTools(server, context)
  registerPermissionTools(server)
  registerAccessibilityTools(server, context)
  registerSystemTools(server, context)
  registerClipboardTools(server, context)
  registerFinderTools(server, context)
  registerNotificationTools(server, context)
  registerShortcutsTools(server, context)
  registerCalendarTools(server, context)
  registerItermTools(server, context)
  registerPagesTools(server, context)
  registerNotesTools(server, context)
  registerMailTools(server, context)
  registerMessagesTools(server, context)
}
