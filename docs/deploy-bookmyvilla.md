# BookMyVilla production deployment

The [deployment workflow](../.github/workflows/deploy-bookmyvilla.yml) builds the guest, admin and owner apps on every push to `main`, uploads them to `31.97.61.172`, restarts the PM2 backend, and fails if any live health check fails. The separate caretaker app is not deployed; the guest app already serves its caretaker pages.

## One-time setup

1. Create these **A records** pointing to `31.97.61.172`: `bookmyvilla.online`, `api.bookmyvilla.online`, `admin.bookmyvilla.online`, and `owner.bookmyvilla.online`. Remove any stale AAAA records for those names. Open inbound TCP ports 80, 443, and the SSH port stored in `VPS_PORT`. The certificate step needs all four records to resolve before the first deployment.
2. Use a Debian/Ubuntu VPS with root SSH access. Add an SSH public key to `/root/.ssh/authorized_keys`. Keep its private key for the GitHub secret below. The workflow installs Nginx, Certbot, Node 22 and PM2.
3. Create `/var/www/bookmyvilla/backend/.env` on the VPS with permissions `600`. At minimum set `MONGODB_URI`, `JWT_SECRET`, and `PORT=5001`. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` if live payments are enabled. Use the existing production database or migrate its data before the first deploy, and allow the new VPS IP in its network access rules if required. The deployment does not move data from the old VPS. Preserve or migrate any `backend/uploads` files separately. Production does not create accounts with the old fixed demo passwords; change or remove any such accounts already present in the production database.
4. In GitHub repository **Settings → Secrets and variables → Actions → Repository secrets**, set:

   | Name | Value |
   | --- | --- |
   | `VPS_HOST` | `31.97.61.172` |
   | `VPS_PORT` | Your SSH port, usually `22` |
   | `VPS_USER` | `root` |
   | `VPS_SSH_KEY` | Complete private SSH key, including BEGIN and END lines |
   | `VPS_KNOWN_HOSTS` | Verified SSH host-key line for `31.97.61.172` |

   Obtain the host-key line with `ssh-keyscan -p YOUR_SSH_PORT -H 31.97.61.172`. Verify its fingerprint through your VPS provider or an independent SSH connection before saving it. For a non-default SSH port, keep the `[31.97.61.172]:PORT` host field produced by `ssh-keyscan`.
5. In **Repository variables**, set `CERTBOT_EMAIL` to an email address you control for certificate expiry notices.
6. Push the repository changes to `main`. The workflow then deploys automatically on each later `main` push. You can also run it from **Actions → Deploy BookMyVilla → Run workflow**.

The workflow checks that `VPS_HOST` is `31.97.61.172` before connecting.

The backend `.env` stays on the VPS. The workflow deliberately excludes it and uploaded files from `rsync --delete` and does not transfer application credentials through GitHub Actions.

## Checks

The workflow requires valid HTTPS responses from:

- `https://bookmyvilla.online/`
- `https://admin.bookmyvilla.online/`
- `https://owner.bookmyvilla.online/`
- `https://api.bookmyvilla.online/api/health` (returns 503 if MongoDB is disconnected)

The root website contains the caretaker application at `/caretaker-dashboard` and `/caretaker-apply`.
