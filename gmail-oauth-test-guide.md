# Gmail OAuth Test Guide

## Simple test for Gmail inbox sync using torarnehave@gmail.com

### Prerequisites

1. **Enable Gmail API in Google Cloud Console**:
   - Go to https://console.cloud.google.com/
   - Select project: "vegvisr-app" (the one with client ID `381557386599-0hsp75r9imkt1v2vt5rtgp9d9cpi5iv0.apps.googleusercontent.com`)
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

2. **Add Gmail scopes to OAuth consent screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Click "Edit App"
   - Under "Scopes", click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/gmail.labels`
   - Save and continue

3. **Verify redirect URI**:
   - Go to "APIs & Services" > "Credentials"
   - Click on your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", verify this exists:
     - `https://auth.vegvisr.org/gmail/callback`
   - If not, add it and save

## Test Steps

### 1. Start OAuth flow

Visit in your browser:
```
https://auth.vegvisr.org/gmail/auth
```

This will redirect you to Google OAuth consent screen.

### 2. Approve permissions

- Select the account: `torarnehave@gmail.com`
- Review the permissions (Gmail read, modify, labels)
- Click "Allow"

### 3. Verify redirect

After approval, you'll be redirected to:
```
https://www.vegvisr.org/?gmail_auth_success=true&user_email=torarnehave@gmail.com
```

If you see `gmail_auth_error` instead, check the error message.

### 4. Verify credentials stored in KV

Check if credentials are stored in KV:

```bash
cd /Users/torarnehave/Documents/GitHub/vegvisr-frontend/auth-worker
npx wrangler kv:key get "gmail:torarnehave@gmail.com" \
  --namespace-id=25ce32bfa2814b839389bb9e9c849642
```

Expected output (JSON with access_token and refresh_token):
```json
{
  "access_token": "ya29.a0Af...",
  "refresh_token": "1//0gw...",
  "expires_at": 1739123456789,
  "stored_at": 1739119856789,
  "user_email": "torarnehave@gmail.com",
  "scopes": ["gmail.readonly", "gmail.modify", "gmail.labels"]
}
```

### 5. Test fetching an email

Use the test endpoint to fetch your latest Gmail email:

```bash
curl -X POST https://auth.vegvisr.org/gmail/test-fetch \
  -H "Content-Type: application/json" \
  -d '{"user_email": "torarnehave@gmail.com"}'
```

Expected output:
```json
{
  "success": true,
  "message": "Successfully fetched latest Gmail email",
  "email": {
    "id": "...",
    "threadId": "...",
    "subject": "Your email subject",
    "from": "sender@example.com",
    "to": "torarnehave@gmail.com",
    "date": "Mon, 10 Feb 2025 12:34:56 +0000",
    "snippet": "First few lines of the email..."
  }
}
```

## Troubleshooting

### Error: "Gmail API has not been used in project before or it is disabled"

Solution: Enable Gmail API in Google Cloud Console (see Prerequisites step 1)

### Error: "Invalid scope"

Solution: Make sure all Gmail scopes are added to the OAuth consent screen (see Prerequisites step 2)

### Error: "redirect_uri_mismatch"

Solution: Add `https://auth.vegvisr.org/gmail/callback` to authorized redirect URIs (see Prerequisites step 3)

### Error: "Token expired"

Solution: Re-run the OAuth flow (visit `/gmail/auth` again). Token refresh is not yet implemented in this test version.

### Error: "No Gmail credentials found"

Solution: Complete the OAuth flow first by visiting `/gmail/auth`

## What happens behind the scenes

1. **OAuth flow**:
   - User visits `/gmail/auth`
   - Redirects to Google OAuth consent screen
   - User approves Gmail permissions
   - Google redirects to `/gmail/callback` with authorization code
   - Worker exchanges code for access_token + refresh_token
   - Worker stores credentials in KV with key `gmail:{email}`
   - Worker redirects user back to vegvisr.org

2. **Test fetch**:
   - Client calls `/gmail/test-fetch` with user_email
   - Worker retrieves credentials from KV
   - Worker calls Gmail API to list messages (maxResults=1)
   - Worker fetches full message details
   - Worker parses headers and returns email data

## Next steps (not in this test)

- Add token refresh logic (use refresh_token when access_token expires)
- Add scheduled worker to poll Gmail every 5 minutes
- Parse email body and store in store-worker
- Add Gmail OAuth button to vemail UI
- Handle multiple Gmail accounts per user
