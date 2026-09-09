# External Control API

Create an event-scoped credential under **Settings → External API**. The token is shown once. Send it in an `Authorization: Bearer` header and store it in your Companion connection configuration, not in a URL.

Base URL: `/api/v1/events/{eventId}`

| Request | Purpose |
| --- | --- |
| `GET /state` | Current live state, active session, current and next program |
| `POST /actions/start` | Start the active session |
| `POST /actions/hold` | Put the live timer on hold |
| `POST /actions/resume` | Resume the live timer |
| `POST /actions/next` | Advance to the next program item |

All requests require `Authorization: Bearer <token>`. A missing, revoked, malformed, wrongly-scoped, or wrong-event token receives `401`. Each action is recorded as `Integration: <credential label>` in the event activity log.

The API calls the same live-action handler as Console and Remote. It cannot bypass an active controller lease: a competing request receives `423`. Simultaneous actions retain the existing version guard and receive `409` rather than overwrite live state.

For Bitfocus Companion, create one HTTP request button per action: set the URL to the matching `POST` endpoint, add the Authorization header, and treat 200 as success. Use `GET /state` for polling feedback. Do not put the bearer token in a button URL, share link, or browser bookmark.
