# BookMyVilla production deployment

The [GitHub Actions workflow](../.github/workflows/deploy-bookmyvilla.yml) builds the guest, admin, owner, caretaker, data entry and villa manager apps, starts the Docker stack on the VPS, uploads production builds for the five public sites, configures host Nginx and TLS, and checks the public HTTPS responses. Data Entry and Villa Manager use static Nginx builds at their public domains and need no separate Vite server in production. The caretaker pages are served by the guest site; the separate caretaker container is checked on its local port.

## VPS and DNS setup

1. Use a Debian/Ubuntu VPS at `31.97.61.172` with root SSH access, Docker Compose, and host Nginx using `/etc/nginx/sites-enabled`. Nginx must own ports 80 and 443. If a Docker container owns those ports, first migrate or configure that existing proxy; the workflow stops with a diagnostic instead of replacing an unknown container.
2. Point A records for `bookmyvilla.online`, `api.bookmyvilla.online`, and `admin.bookmyvilla.online` to `31.97.61.172`. Also add `owner.bookmyvilla.online` for the owner portal. Remove stale AAAA records and allow inbound TCP 80, 443, and the SSH port. The workflow issues a certificate for the first three names and adds `owner.bookmyvilla.online` when its A record points to the VPS. Rerun deployment after adding that record.
3. Set these repository secrets under **Settings → Secrets and variables → Actions**:

   | Name | Value |
   | --- | --- |
   | `VPS_HOST` | `31.97.61.172` |
   | `VPS_PORT` | VPS SSH port |
   | `VPS_USER` | `root` |
   | `VPS_SSH_KEY` | Complete private SSH key |
   | `VPS_KNOWN_HOSTS` | Verified SSH host-key line |
   | `BACKEND_ENV` | Complete production `backend/.env` contents |
   | `CERTBOT_EMAIL` | Recommended email address for certificate notices |

   Obtain the host-key line with `ssh-keyscan -p YOUR_SSH_PORT -H 31.97.61.172` and verify its fingerprint independently before saving it.

4. Set `MONGODB_URI`, `JWT_SECRET`, and `PORT=5000` in `BACKEND_ENV` (`docker-compose.yaml` maps VPS port 5001 to container port 5000). Add payment secrets when live payments are enabled. Preserve or migrate production database data and `backend/uploads` separately. The workflow excludes uploads from `rsync --delete` and writes the backend environment with mode `600`.
5. Push to `main` or run **Actions → Deploy BookMyVilla → Run workflow**. A green run now includes the public HTTPS site and API checks. A green Docker-only run from an older workflow did not verify the domains.

## Public checks

- `https://bookmyvilla.online/` serves the guest production build.
- `https://admin.bookmyvilla.online/` serves the admin production build.
- `https://owner.bookmyvilla.online/` serves the owner production build once its DNS record exists.
- `https://dataentry.bookmyvilla.online/` serves the Data Entry build.
- `https://villamanage.bookmyvilla.online/` serves the Villa Manager build.
- `https://api.bookmyvilla.online/api/health` returns `{"status":"ok"}`.

Point the `dataentry` and `villamanage` A records to `31.97.61.172`. Deployment adds these names to the TLS certificate when their records point to this VPS. Admin creates their accounts under **Team & Access** and assigns properties under **Properties**.

If public checks fail, inspect the **Configure public Nginx and TLS** step. A 403 from Nginx while local Docker checks pass means the web server is still serving an unrelated or empty directory. Confirm which process owns ports 80 and 443 with `ss -ltnp '( sport = :80 or sport = :443 )'` and inspect the active Nginx configuration with `nginx -T` on the VPS.
