---
id: messages_messages_compose_message
title: 发送或预填消息
description: 在 Messages 中发送或预填消息
keywords: [messages]
argumentsPrompt: 无
---

```applescript
set targetRecipient to --MCP_INPUT:recipient
set messageBody to --MCP_INPUT:body
set autoSend to --MCP_INPUT:auto

if autoSend then
  tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy targetRecipient of targetService
    send messageBody to targetBuddy
  end tell
  return "Message sent"
else
  do shell script "open " & quoted form of ("sms:" & targetRecipient)
  return "Messages opened"
end if
```
