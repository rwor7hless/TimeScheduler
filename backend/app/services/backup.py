import asyncio
import os
from datetime import datetime

from app.config import settings


async def run_backup():
    os.makedirs(settings.backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(settings.backup_dir, f"backup_{timestamp}.sql")

    # Extract connection info from DATABASE_URL
    db_url = settings.database_url.replace("postgresql+asyncpg://", "")
    user_pass, host_db = db_url.split("@")
    user, password = user_pass.split(":")
    host_port, dbname = host_db.split("/")
    host = host_port.split(":")[0]
    port = host_port.split(":")[1] if ":" in host_port else "5432"

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    process = await asyncio.create_subprocess_exec(
        "pg_dump",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", dbname,
        "-f", filename,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()

    if process.returncode != 0:
        raise RuntimeError(f"Backup failed: {stderr.decode()}")

    return filename


def list_backups() -> list[dict]:
    os.makedirs(settings.backup_dir, exist_ok=True)
    backups = []
    for f in sorted(os.listdir(settings.backup_dir), reverse=True):
        if f.endswith(".sql"):
            path = os.path.join(settings.backup_dir, f)
            stat = os.stat(path)
            backups.append({
                "filename": f,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return backups
