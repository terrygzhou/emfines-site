# EMF-5 admin API — contract summary (OpenAPI-style)
Base: origin-only. All routes require the signed session cookie (AC-1).
- POST /api/admin/login   {passcode} -> 200 Set-Cookie | 401
- POST /api/admin/logout  {}          -> 200 Clear-Cookie
- GET  /api/admin/briefs?status=new|handled&cursor=&limit= -> 200 {items, cursor} | 401
- GET  /api/admin/briefs/:id -> 200 {id, kind, ...fields, photos[], status} | 401 | 404
- POST /api/admin/briefs/:id {status:new|handled} -> 200 {id,status} | 400 | 401 | 404
Errors: {error: string}. PII never returned without a valid session.
