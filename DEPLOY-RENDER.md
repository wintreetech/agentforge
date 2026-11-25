# Deploying the client demo to Render

This deploys a **demo** build: test checkout (no real money), sign-ups auto-verified,
AI products in clearly labelled "Simulated" mode unless an AI key is added.

## 1. Put the code on GitHub
Create an empty private repo, then from this folder:

    git init && git add . && git commit -m "AgentForge AI demo"
    git branch -M main
    git remote add origin https://github.com/<you>/agentforge-ai.git
    git push -u origin main

## 2. Create the service from the Blueprint
Render dashboard → **New → Blueprint** → pick the repo. Render reads `render.yaml` and
asks for the values marked `sync: false`:

| Variable | What to enter |
|---|---|
| `APP_URL` | `https://agentforge-ai.onrender.com` (the URL Render shows; change later if you add a domain) |
| `DEMO_LOGIN_EMAIL` | the login you give the client, e.g. `client@yourcompany.com` |
| `DEMO_LOGIN_PASSWORD` | its password (min 10 chars, letters + a number/symbol) |
| `ADMIN_EMAILS` | same email as `DEMO_LOGIN_EMAIL` if the client should see `/admin`; otherwise your own email |
| `OPENAI_API_KEY` | optional: leave blank for Simulated mode |

All signing secrets are generated automatically. First build takes ~3-5 minutes.

## 3. After it is live
1. Open the site and sign in with `DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_PASSWORD`.
2. Check `/status`: everything should be "up" or "not configured".
3. Send the client the URL plus that login. Test purchase: add a product → checkout → "Simulate successful payment".

## Notes
- Plan is **Free**. There is no persistent disk, so purchases, sign-ups and settings are **reset whenever
  the service sleeps (after 15 min with no visitors) or redeploys**. The demo login is recreated automatically
  on every start, so it always works, but anything bought or created in an earlier session will be gone.
- Free services sleep when idle: the first visit after a break takes ~30-60 s to load. Open the site yourself
  a minute before showing it to the client.
- To keep data: switch to `plan: starter` (~$7/mo), add a disk at `/var/data` and set `DATA_DIR=/var/data`.
- If `APP_URL` is wrong, links in the app (downloads, invoices) point to the wrong host. Fix it in Environment and redeploy.

## Going from demo to real launch
Set `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (webhook URL `https://<host>/api/webhooks/payments`),
delete `ALLOW_SANDBOX_PAYMENTS` and `AUTO_VERIFY_EMAIL`, add `RESEND_API_KEY` + `MAIL_FROM`, add AI keys,
then work through the checklist in PROGRESS.md (Supabase, legal review, etc.).
