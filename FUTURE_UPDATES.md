# Future Updates

## Completed Features

### 1. Edit Response Feature [DONE]
- Users can now update their responses by entering the same name + PIN
- Same form handles both new submissions and updates

### 2. Simplify Date Selection [DONE]
- Calendar uses one-click-per-date selection (click to toggle)
- Clean, simple interaction

### 3. Remove Candidate Date Limit [DONE]
- Removed the 20-date limit from validation
- Polls can now have unlimited candidate dates

### 4. Live Availability Count [DONE]
- Shows `x/y` count on each date while selecting
- `y` = total number of responders, `x` = available on that date
- Only shows when there are existing responses

### 5. Simple Responder Authentication [DONE]
- Implemented **Name + 4-digit PIN** system
- PIN is hashed (SHA-256) before storage - never stored in plain text
- localStorage stores name for convenience on same device
- **Decision: Per-poll PIN** (simpler, more secure, matches architecture)

### Decisions Made:
- **PIN per-poll**: Each poll has separate PIN (not global per user)
- **Forgot PIN**: For MVP, admin can manually delete duplicates
- **Partial names**: Only admin can see full respondent names in admin dashboard

---

## Remaining / Future Ideas

- Auto-refresh availability counts while form is open
- Email notifications when poll is finalized
- Export results to CSV
