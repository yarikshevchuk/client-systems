# GCP infrastructure

Terraform for running the whole app (Postgres + FastAPI backend + React frontend) on GCP with two VMs.

```
Internet ──► LB VM (public subnet, nginx :80) ──► App VM (private subnet, :80)
                                                    ├─ nginx    – frontend static files, proxies /api and /ws
                                                    ├─ backend  – FastAPI (uvicorn :8000)
                                                    └─ postgres – data on /data/postgres
App VM ──► Cloud NAT ──► Internet (apt, Docker images, git clone)
```

## Layout

| Path | What it creates |
|---|---|
| `main.tf` | Root module that wires the modules together |
| `modules/network` | VPC, public subnet `10.0.1.0/24`, private subnet `10.0.2.0/24`, Cloud Router + NAT for the private subnet |
| `modules/firewall` | Firewall rules (below) |
| `modules/load_balancer` | Public VM with nginx reverse proxy to the app VM |
| `modules/app_server` | Private VM, data disk, startup script running the app in Docker |

## Instances

| | LB | App |
|---|---|---|
| Subnet | public (external IP) | private (no external IP) |
| Type | e2-small | e2-medium |
| Image | Debian 12 | Debian 12 |
| Root disk | 12 GB (image minimum is 10 GB) | 12 GB |
| Data disk | – | 25 GB `pd-balanced`, mounted at `/data` |

The data disk is a separate `google_compute_disk` managed by Terraform, so `terraform destroy` deletes it along with everything else.

## Firewall rules

| Rule | Source | Target | Ports |
|---|---|---|---|
| `allow-web` | `0.0.0.0/0` | tag `lb` | tcp 80, 443 |
| `allow-lb-to-app` | public subnet | tag `app` | tcp 80 |
| `allow-ssh-iap` | `35.235.240.0/20` (IAP) | all | tcp 22 |
| `allow-icmp-internal` | both subnets | all | icmp |

Everything else inbound is denied by GCP's implicit rule.

## Startup scripts

**LB** installs nginx and proxies all traffic (including WebSockets) to the app VM's private IP.

**App** (runs on every boot, safe to re-run):
1. Formats the data disk on first boot only, mounts it at `/data` and adds it to `/etc/fstab`.
2. Installs Docker, the compose plugin and git.
3. Clones the repo to `/data/app`.
4. Builds the frontend in a `node:22-alpine` container.
5. Starts `db`, `backend` and `frontend` with Docker Compose (`/data/compose.yml`).

Application data lives on the data disk:

| Path | Content |
|---|---|
| `/data/postgres` | Postgres data |
| `/data/uploads` | Uploaded files (backend `uploads/`) |
| `/data/app` | Source code and built frontend |

## Usage

Requirements: Terraform ≥ 1.5, `gcloud` logged in (`gcloud auth application-default login`), Compute Engine API enabled.

```bash
cp terraform.tfvars.example terraform.tfvars   # set project_id, db_password, app_secret (+ an AI key if wanted)
terraform init
terraform apply
```

Open `http://<lb_public_ip>` from the output. The first boot takes a few minutes (packages, images, frontend build).

SSH into the private VM through IAP:

```bash
gcloud compute ssh vns-app --zone europe-central2-a --tunnel-through-iap
```

Startup log: `sudo journalctl -u google-startup-scripts`.

Tear down (removes the data disk too):

```bash
terraform destroy
```

## Variables

| Name | Default | Description |
|---|---|---|
| `project_id` | – | GCP project ID |
| `region` / `zone` | `europe-central2` / `-a` | Location |
| `name` | `vns` | Resource name prefix |
| `machine_type` | `e2-medium` | App instance type |
| `lb_machine_type` | `e2-small` | Load balancer instance type |
| `root_disk_size` | `12` | Root disk, GB |
| `data_disk_size` | `25` | Data disk, GB |
| `repo_url` | this repo on GitHub | Code cloned onto the app VM |
| `db_password` | – | Postgres password |
| `app_secret` | – | Backend JWT secret |
| `anthropic_api_key` | `""` | Anthropic API key for AI features (optional) |
| `gemini_api_key` | `""` | Gemini API key, used if no Anthropic key (optional) |
