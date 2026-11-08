<!-- nexora-delivery:example-delivery-123 -->
## 🤖 Nexora analysis

**Agent:** `aem-dev-agent`  ·  **Confidence:** medium  ·  **Likely module:** `core`

### Summary
The hero is blank on publish after deployment; author appears unaffected.

### Likely root cause
The **mock AEM log** shows a Sling Models injection failure for `HeroModel.assetPath`. This suggests missing content data or required-injection mismatch, but the log is synthetic and does not establish the actual production cause.

### Suggested fix
Inspect `HeroModel`'s `@ValueMapValue` injection and the hero component's resource/property in `ui.apps`. Handle absent asset paths safely if appropriate; confirm content-package deployment and compare author/publish content. Validate locally with Maven before any PR.

### Context reviewed
- `core/src/main/java/com/acme/aem/core/models/HeroModel.java` (illustrative)
- **Mocked AEM error log only** (not evidence from your environment)

### Questions / missing context
- Does the publish hero content node contain `assetPath` after deployment?
- What do the actual publish error logs show for the matching request ID?

> Demo only: AI-generated hypothesis. No code changes, merge, deploy, or live Splunk queries were performed.
