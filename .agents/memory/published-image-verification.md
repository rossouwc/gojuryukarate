---
name: Published image verification
description: Distinguish correct uploaded files, correct published files, and stale images shown in an existing browser.
---

Check published image bytes before claiming that production uses the latest uploads. A local build matching the ZIP does not establish what the published site serves.

**Why:** The user supplied a production screenshot showing an older Mawashi zuki image despite all 34 fresh production image requests matching the latest uploads. Replacing images at unchanged URLs can leave existing browsers displaying older copies.

**How to apply:** Compare the uploaded, local, and freshly fetched published assets separately. Keep image URLs content-versioned so future replacements request new resources. Distinguish a development fix ready to publish from a fix already live; do not tell the user their browser display has been verified through a fresh server request alone.
