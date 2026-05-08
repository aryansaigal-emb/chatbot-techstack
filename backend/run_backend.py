from pathlib import Path
import os
import socket
import sys

import uvicorn


BASE_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.getenv("BACKEND_PORT", "8001"))
RELOAD = "--reload" in sys.argv
os.chdir(BASE_DIR)


def is_port_in_use(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex((host, port)) == 0


if __name__ == "__main__":
    if is_port_in_use(HOST, PORT):
        print(f"Backend is already running at http://{HOST}:{PORT}")
        print("Open http://127.0.0.1:5173 for the frontend.")
        raise SystemExit(0)

    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=RELOAD,
        reload_dirs=[str(BASE_DIR)],
    )
