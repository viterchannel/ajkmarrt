---
name: Admin route missing import pattern
description: How to detect and fix route files that exist but are never mounted in admin.ts
---

The admin router (`artifacts/api-server/src/routes/admin.ts`) manually imports and mounts every sub-router. Route files can exist in `src/routes/admin/` but never be imported, causing 404s.

**Rule:** Before finishing an API audit, diff `ls src/routes/admin/*.ts` against the import list in `admin.ts`.

**How to apply:**
```bash
diff <(ls extracted/12345678/artifacts/api-server/src/routes/admin/*.ts | xargs -I{} basename {} .ts | sort) \
     <(grep "^import " extracted/12345678/artifacts/api-server/src/routes/admin.ts | grep -oP "from \"./admin/\K[^\".]+" | sort)
```

Found: `revenue-analytics.ts` was complete and correct but missing from admin.ts imports and router.use() calls.

**Why:** The file was added but the two-step registration (import + router.use) was never completed.
