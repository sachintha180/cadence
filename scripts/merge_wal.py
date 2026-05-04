import base64
import os
import shutil
import sqlite3
import subprocess

PACKAGE = "com.siby18.cadence"
REMOTE_DB = "files/SQLite/cadence.db"
REMOTE_WAL = "files/SQLite/cadence.db-wal"
REMOTE_SHM = "files/SQLite/cadence.db-shm"

SOURCE_DB = "tmp/db/cadence_local.db"
OUTPUT_DB = "tmp/db/cadence_clean.db"

IO_PAIRS = [
    ("tmp/txt/cadence_b64.txt", "tmp/db/cadence_local.db"),
    ("tmp/txt/cadence_wal_b64.txt", "tmp/db/cadence_local.db-wal"),
    ("tmp/txt/cadence_shm_b64.txt", "tmp/db/cadence_local.db-shm"),
]

os.makedirs("tmp/txt", exist_ok=True)
os.makedirs("tmp/db", exist_ok=True)


def pull_as_base64(remote_path: str, local_txt_path: str) -> None:
    command = f'adb shell "run-as {PACKAGE} base64 {remote_path}"'
    print(f"Pulling {remote_path}")

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"ADB pull failed for {remote_path}:\n{result.stderr.decode()}"
        )

    with open(local_txt_path, "wb") as f:
        f.write(result.stdout)

    print(f"Saved to {local_txt_path} ({len(result.stdout)} bytes)")


def decode_base64_file(path: str) -> bytes:
    with open(path, "rb") as f:
        raw_bytes = f.read()

    raw = raw_bytes.decode("utf-8").strip()

    return base64.b64decode("".join(raw.split()))


# Step 1: Pull from device
pull_as_base64(REMOTE_DB, "tmp/txt/cadence_b64.txt")
pull_as_base64(REMOTE_WAL, "tmp/txt/cadence_wal_b64.txt")
pull_as_base64(REMOTE_SHM, "tmp/txt/cadence_shm_b64.txt")

# Step 2: Decode base64 to binary
for b64file, outfile in IO_PAIRS:
    data = decode_base64_file(b64file)
    with open(outfile, "wb") as f:
        f.write(data)
    print(f"Decoded {outfile} - {len(data)} bytes")

# Step 3: Copy and merge WAL into clean single-file database.
shutil.copy2(SOURCE_DB, OUTPUT_DB)

with sqlite3.connect(OUTPUT_DB) as conn:
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    conn.execute("PRAGMA journal_mode=DELETE;")
    conn.commit()

print(f"Done. Open {OUTPUT_DB} in DB Browser for SQLite.")
