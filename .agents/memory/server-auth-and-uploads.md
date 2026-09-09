---
name: Server authentication and uploads
description: Security and storage boundary for the messaging app.
---

Credentials must be verified on the server and responses must contain only a sanitized user profile; binary message content should be uploaded separately and messages should store a URL plus metadata instead of Base64 payloads.

**Why:** Client-side user enumeration exposed password records and repeated Base64 media exhausted browser storage, causing the chat to render blank.

**How to apply:** Keep Firebase user reads out of login UI code, never persist passwords in browser state, and route new media types through the upload endpoint.