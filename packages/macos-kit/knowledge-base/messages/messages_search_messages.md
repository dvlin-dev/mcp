---
id: messages_messages_search_messages
title: 搜索消息
description: 按条件搜索消息
keywords: [messages]
argumentsPrompt: 无
---

```applescript
set searchText to --MCP_INPUT:search_text
set senderFilter to --MCP_INPUT:sender
set maxCount to --MCP_INPUT:limit
set daysBack to --MCP_INPUT:days_back
set dbPath to POSIX path of ((path to home folder) as text) & "Library/Messages/chat.db"

set whereClause to "message.text LIKE '%" & searchText & "%'"
if senderFilter is not "" then
  set whereClause to whereClause & " AND handle.id LIKE '%" & senderFilter & "%'"
end if
set whereClause to whereClause & " AND message.date > (strftime('%s','now','-" & daysBack & " days') - strftime('%s','2001-01-01')) * 1000000000"

set querySql to "SELECT datetime(message.date/1000000000 + strftime('%s','2001-01-01'),'unixepoch','localtime'), ifnull(handle.id,''), ifnull(message.text,'') FROM message LEFT JOIN handle ON message.handle_id=handle.ROWID WHERE " & whereClause & " ORDER BY message.date DESC LIMIT " & maxCount
set shellCmd to "sqlite3 -separator ' | ' " & quoted form of dbPath & " " & quoted form of querySql
return do shell script shellCmd
```
