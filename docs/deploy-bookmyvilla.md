# BookMyVilla production deployment

The [GitHub Actions workflow](../.github/workflows/deploy-bookmyvilla.yml) builds the guest, admin, owner, caretaker, data entry and villa manager apps, starts the Docker stack on the VPS, uploads production builds for the five public sites, configures host Nginx and TLS, and checks the public HTTPS responses. Data Entry and Villa Manager use static Nginx builds at their public domains and need no separate Vite server in production. The caretaker pages are served by the guest site. Production uses `docker-compose.production.yaml` to keep all six Vite development containers out of the deployment, so the VPS builds only the single backend image shared by the gateway and services. Local development can still use the base Compose file.

## VPS and DNS setup

1. Use a Debian/Ubuntu VPS at `31.97.61.172` with root SSH access, Docker Compose, and host Nginx using `/etc/nginx/sites-enabled`. Ports 80 and 443 belong to a shared gateway Nginx container from another project (currently `carhub-nginx`). Deployment does not edit that project's files. It adds only `conf.d/bookmyvilla.conf` and the BookMyVilla certificate inside that container, from [nginx/gateway.conf](../nginx/gateway.conf), and removes them again if `nginx -t` fails. Host Nginx serves BookMyVilla on the private port 8090 behind it. Recreating the gateway container drops the BookMyVilla routing until the next deployment. Do not run `scripts/prepare-vps.sh` on this VPS; it expects host Nginx on port 80.
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
   | `ATLAS_MONGODB_URI` | Atlas connection string; overrides only the database URI in `BACKEND_ENV` |
   | `CERTBOT_EMAIL` | Recommended email address for certificate notices |

   Obtain the host-key line with `ssh-keyscan -p YOUR_SSH_PORT -H 31.97.61.172` and verify its fingerprint independently before saving it.

4. Set `MONGODB_URI` and `JWT_SECRET` in `BACKEND_ENV`. The MongoDB URI must start with `mongodb://` or `mongodb+srv://`; keep the intended production database connection. Deployment validates this secret before uploading or restarting the application. `docker-compose.yaml` forces `PORT=2001` and maps only `127.0.0.1:2001` to backend port 2001; Nginx serves the public HTTPS API. Add payment secrets when live payments are enabled. Preserve or migrate production database data and `backend/uploads` separately. The workflow excludes uploads from `rsync --delete` and writes the backend environment with mode `600`.
5. Push to `main` or run **Actions → Deploy BookMyVilla → Run workflow**. A green run now includes the public HTTPS site and API checks. A green Docker-only run from an older workflow did not verify the domains.

## Public checks

Property device uploads are saved under `backend/uploads/properties` and served
through `/api/properties/media/`. The existing Docker uploads mount and deployment
exclusion preserve these files. Keep this directory in production backups alongside
MongoDB. `PUBLIC_API_URL` may override the production media origin (default:
`https://api.bookmyvilla.online`). Each file is limited to 30 MB and each JSON
submission to 50 MB, including base64 overhead. Add further media through Edit Listing.

- `https://bookmyvilla.online/` serves the guest production build.
- `https://admin.bookmyvilla.online/` serves the admin production build.
- `https://owner.bookmyvilla.online/` serves the owner production build once its DNS record exists.
- `https://dataentry.bookmyvilla.online/` serves the Data Entry build.
- `https://villamanage.bookmyvilla.online/` serves the Villa Manager build.
- `https://api.bookmyvilla.online/api/health` returns `{"status":"ok"}`.

Point the `dataentry` and `villamanage` A records to `31.97.61.172`. Deployment adds these names to the TLS certificate when their records point to this VPS. Admin creates their accounts under **Team & Access** and assigns properties under **Properties**.

If public checks fail, inspect the **Configure public Nginx and TLS** step. A 403 from Nginx while local Docker checks pass means the web server is still serving an unrelated or empty directory. Inspect the gateway routing with `docker exec carhub-nginx cat /etc/nginx/conf.d/bookmyvilla.conf` and the host side with `curl -H 'Host: bookmyvilla.online' http://127.0.0.1:8090/` on the VPS.
