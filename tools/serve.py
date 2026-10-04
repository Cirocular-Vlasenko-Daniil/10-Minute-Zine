#!/usr/bin/env python3
"""Dev-сервер без кэша: иначе браузер держит старые ES-модули после правок.
Запуск: python3 tools/serve.py [порт]"""
import http.server, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(root), **kw)

    # PUT /__debug/<имя> — сохранить файл в tools/debug/ (проверка PDF при разработке)
    def do_PUT(self):
        if not self.path.startswith("/__debug/"):
            return self.send_error(404)
        name = pathlib.Path(self.path).name
        out = root / "tools" / "debug"
        out.mkdir(exist_ok=True)
        (out / name).write_bytes(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
