# Nginx

The live host configuration stays in the repository root `nginx/` folder (used by the deploy workflow):
`bookmyvilla.online.conf` serves the static panels and proxies `api.bookmyvilla.online` to the API Gateway on 127.0.0.1:2001.
In Kubernetes the same routing is done by `infrastructure/kubernetes/ingress/ingress.yaml`.
