# 07 - ML Droplet Setup

This document explains how to prepare a second DigitalOcean droplet that runs the Python/FastAPI inference API used by the mobile screening flow (`/check-quality`, `/predict`, `/predict-phlegm`).

The ML droplet is a separate machine from the backend droplet. Both droplets are reached from the mobile app through Cloudflare Tunnels — see `08-cloudflare-tunnels.md`.

## 1. Create The Droplet

In DigitalOcean:

1. Go to **Droplets** -> **Create Droplet**.
2. Image: **Ubuntu 22.04 LTS** (or 24.04).
3. Size: **at least 2 vCPU / 4 GB RAM**. PyTorch will not fit in 1 GB plans.
4. Region: same region as the backend droplet.
5. Add SSH access or a root password.
6. Name it `tbhon-ml`.

After creation, note the public IP. Used in early testing only — production traffic goes through the Cloudflare tunnel.

## 2. Open The Droplet Console

Use either:

- DigitalOcean web console: Droplet -> **Access** -> **Launch Droplet Console**
- SSH from your PC if you have a key registered

You should see:

```text
root@tbhon-Ml:~#
```

## 3. (Optional) Set Up SSH Key Auth From Your PC

If you plan to upload files with `scp` from Windows, set up key auth so you do not type the password every time.

On your **PC** (PowerShell):

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519 -N '""'
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@<ml-droplet-ip> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Then verify no more password prompt:

```powershell
ssh root@<ml-droplet-ip> "hostname"
```

## 4. Install System Dependencies On The Droplet

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip ffmpeg
```

`ffmpeg` is required because `pydub` uses it to decode the audio formats the mobile app uploads (`.m4a`, `.wav`, `.webm`, etc.).

## 5. Clone The Mobile Repo (Which Contains The ML Code)

The ML inference code lives inside the main app repo, not `Tbhon-Backend`.

```bash
cd ~
git clone https://github.com/Beanlon/Tbhon.git
```

If the folder already exists (for example because you uploaded models before cloning), see Section 7 for the recovery path.

## 6. Create The Python Virtual Environment

```bash
cd ~/Tbhon
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r ml/requirements.txt
```

This downloads `torch`, `torchaudio`, `fastapi`, `uvicorn`, etc. Expect 3-5 minutes and several hundred MB.

Verify:

```bash
python -c "import torch, torchaudio, fastapi; print('torch', torch.__version__); print('torchaudio', torchaudio.__version__); print('fastapi', fastapi.__version__)"
```

You should see three version lines.

## 7. Upload The Trained Model Files

The `*.pt` model weights are large and not stored in Git. You must copy them from your PC.

The droplet expects them at these paths:

| Local file on PC | Droplet destination |
| --- | --- |
| `ml\runs\20260504_011457\model.pt` | `/root/Tbhon/ml/runs/20260504_011457/model.pt` |
| `ml (phlegm)\runs\phlegm_afb_20260504_052747\model_best.pt` | `/root/Tbhon/ml_phlegm/runs/phlegm_afb_20260504_052747/model_best.pt` |

Note the phlegm folder is renamed from `ml (phlegm)` to `ml_phlegm` on the droplet. The space and parentheses cause quoting headaches with `scp` from Windows PowerShell. The Python code reads the location from `TB_PHLEGM_MODEL_PATH` env var, so the folder name does not need to match the local one.

### 7.1. Create The Destination Folders First

From your **PC** (PowerShell):

```powershell
ssh root@<ml-droplet-ip> "mkdir -p /root/Tbhon/ml/runs/20260504_011457 /root/Tbhon/ml_phlegm/runs/phlegm_afb_20260504_052747"
```

### 7.2. Copy The Cough Model

```powershell
cd "C:\Project VSC\Tbhon"
scp "ml\runs\20260504_011457\model.pt" root@<ml-droplet-ip>:/root/Tbhon/ml/runs/20260504_011457/model.pt
```

### 7.3. Copy The Phlegm Model

```powershell
scp "ml (phlegm)\runs\phlegm_afb_20260504_052747\model_best.pt" root@<ml-droplet-ip>:/root/Tbhon/ml_phlegm/runs/phlegm_afb_20260504_052747/model_best.pt
```

### 7.4. Verify Both Files Landed

```powershell
ssh root@<ml-droplet-ip> "ls -lh /root/Tbhon/ml/runs/20260504_011457/model.pt /root/Tbhon/ml_phlegm/runs/phlegm_afb_20260504_052747/model_best.pt"
```

Expected sizes: cough model `~4.0M`, phlegm model `~1.3M`.

## 8. Smoke-Test The API In The Foreground

Still on the droplet, in `~/Tbhon`:

```bash
export TB_MODEL_PATH="/root/Tbhon/ml/runs/20260504_011457/model.pt"
export TB_PHLEGM_MODEL_PATH="/root/Tbhon/ml_phlegm/runs/phlegm_afb_20260504_052747/model_best.pt"

python -m uvicorn ml.infer_api:app --host 0.0.0.0 --port 8000
```

Expected:

```text
INFO:     Started server process [...]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

From a second terminal:

```bash
curl http://127.0.0.1:8000/healthz
```

Expected:

```json
{"ok":true}
```

Stop with `Ctrl + C`. Next step makes it persistent.

## 9. Run The API Permanently With `systemd`

Create the service file on the droplet:

```bash
sudo nano /etc/systemd/system/tbhon-ml.service
```

Paste:

```ini
[Unit]
Description=TBhon ML inference API
After=network.target

[Service]
User=root
WorkingDirectory=/root/Tbhon
Environment="TB_MODEL_PATH=/root/Tbhon/ml/runs/20260504_011457/model.pt"
Environment="TB_PHLEGM_MODEL_PATH=/root/Tbhon/ml_phlegm/runs/phlegm_afb_20260504_052747/model_best.pt"
ExecStart=/root/Tbhon/.venv/bin/python -m uvicorn ml.infer_api:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tbhon-ml
sudo systemctl start tbhon-ml
sudo systemctl status tbhon-ml --no-pager
```

Expected:

- `Loaded: loaded (... enabled; ...)`
- `Active: active (running)`

## 10. Open Firewall Port 8000 (Optional)

If you want to test the API directly from your PC during setup, open port `8000` on the DigitalOcean firewall.

1. **Networking -> Firewalls** -> attach a firewall to the `tbhon-ml` droplet.
2. Inbound rule: TCP `8000`, source All IPv4 / All IPv6.

Once the Cloudflare tunnel is in place, you can close port `8000` again — production traffic goes through the tunnel, not the public IP.

## 11. Add A Cloudflare Tunnel

The mobile app cannot reach `http://<ip>:8000` reliably from iOS over cellular. Set up the tunnel before testing from the phone. See `08-cloudflare-tunnels.md`, Section 2.

## 12. Test From PC

After the tunnel is running:

```powershell
curl.exe -s https://<ml-tunnel-url>/healthz
curl.exe -s -X POST -F "file=@C:\path\to\test.wav" https://<ml-tunnel-url>/check-quality
curl.exe -s -X POST -F "file=@C:\path\to\test.wav" https://<ml-tunnel-url>/predict
```

The `/predict` response should include `model_path` matching the path in the systemd unit, plus either `prob_tb` / `prob_no_tb` or `spoof: true` depending on the audio.

## 13. Endpoints Exposed To The Mobile App

| Method | Route | Used by |
| --- | --- | --- |
| `GET` | `/healthz` | Health probe |
| `POST` | `/check-quality` | Cough quality gate (per-clip, before showing badge) |
| `POST` | `/predict` | TB cough prediction |
| `POST` | `/predict-phlegm` | Sputum image AFB-load |
| `GET` | `/docs` | Swagger UI |

All POST endpoints expect multipart form field named `file`.

## 14. Model File Update Workflow

When you retrain a model on your PC:

1. Identify the new run folder, for example `ml/runs/20260601_120000`.
2. Create the matching folder on the droplet:

```powershell
ssh root@<ml-droplet-ip> "mkdir -p /root/Tbhon/ml/runs/20260601_120000"
```

3. Copy the new `model.pt`:

```powershell
scp "ml\runs\20260601_120000\model.pt" root@<ml-droplet-ip>:/root/Tbhon/ml/runs/20260601_120000/model.pt
```

4. Update the `Environment="TB_MODEL_PATH=..."` line in `/etc/systemd/system/tbhon-ml.service` to point at the new file.
5. Reload systemd and restart the service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart tbhon-ml
sudo systemctl status tbhon-ml --no-pager
```

The phlegm model uses the same flow with `TB_PHLEGM_MODEL_PATH` instead.

## 15. Common Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Permission denied (publickey,password)` on scp | Typo'd password or 3 failed attempts | Wait, retype slowly, or do Section 3 SSH key setup |
| scp creates a path with `/(` and `/)` | PowerShell turned `\(` into `/(` | Use the renamed `ml_phlegm` path from Section 7 |
| `dest open ... No such file or directory` | Target folder does not exist on the droplet | Run the `mkdir -p` from Section 7.1 first |
| `RuntimeError: No model found` in systemd logs | Env var path wrong or model not uploaded | Recheck Section 7.4, then Section 9 env var lines |
| Mobile app sees `check-quality timed out` | Plain HTTP `http://ip:8000` does not work from iOS cellular | Move the mobile app to the Cloudflare tunnel URL — see `08-cloudflare-tunnels.md` |
