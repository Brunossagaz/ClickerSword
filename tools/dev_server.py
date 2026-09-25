"""Servidor local do jogo + rota pro Compêndio salvar os valores customizados.

Uso:  python tools/dev_server.py [porta]      (padrão 8123)
  Jogo:      http://localhost:8123/
  Compêndio: http://localhost:8123/tools/compendio.html

- Serve a raiz do projeto sem cache (sempre a versão atual dos arquivos).
- POST /api/overrides grava js/overrides-data.js (ver js/overrides.js).
  Só aceita Content-Type application/json vindo da própria página
  (Origin obrigatório e igual ao host), pra outro site aberto no navegador
  não conseguir alterar o arquivo.
- Só responde a Host localhost/127.0.0.1 (bloqueia DNS rebinding: um site
  externo apontando o próprio domínio pra 127.0.0.1 e lendo/gravando aqui).
- Não serve arquivos/pastas ocultos (.git, .claude, ...).
"""
import functools
import http.server
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, 'js', 'overrides-data.js')
MAX_BYTES = 2 * 1024 * 1024
HEADER = ('// Gerado pelo Compêndio (tools/compendio.html) — valores customizados por\n'
          '// cima de js/config.js (ver js/overrides.js). Vazio = jogo original.\n')


ALLOWED_HOSTNAMES = {'localhost', '127.0.0.1'}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def _host_ok(self):
        host = (self.headers.get('Host') or '').rsplit(':', 1)[0].lower()
        return host in ALLOWED_HOSTNAMES

    def _hidden_path(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0].replace('\\', '/')
        return any(part.startswith('.') for part in path.split('/') if part)

    def do_GET(self):
        if not self._host_ok():
            return self._reply(403, {'error': 'host não permitido'})
        if self._hidden_path():
            return self._reply(404, {'error': 'não encontrado'})
        return super().do_GET()

    def do_HEAD(self):
        if not self._host_ok() or self._hidden_path():
            self.send_response(404)
            self.end_headers()
            return
        return super().do_HEAD()

    def _reply(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/api/overrides':
            return self._reply(404, {'error': 'rota desconhecida'})
        if not self._host_ok():
            return self._reply(403, {'error': 'host não permitido'})
        origin = self.headers.get('Origin') or ''
        if origin.split('://', 1)[-1] != self.headers.get('Host'):
            return self._reply(403, {'error': 'origem não permitida'})
        if not (self.headers.get('Content-Type') or '').startswith('application/json'):
            return self._reply(415, {'error': 'esperado application/json'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            return self._reply(400, {'error': 'Content-Length inválido'})
        if length <= 0 or length > MAX_BYTES:
            return self._reply(413, {'error': 'tamanho inválido'})
        try:
            data = json.loads(self.rfile.read(length).decode('utf-8'))
        except ValueError:
            return self._reply(400, {'error': 'JSON inválido'})
        if not isinstance(data, dict):
            return self._reply(400, {'error': 'esperado um objeto'})
        text = HEADER + 'window.CONFIG_OVERRIDES = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
        tmp = OUT_PATH + '.tmp'
        with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
        os.replace(tmp, OUT_PATH)
        self._reply(200, {'ok': True})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    handler = functools.partial(Handler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    print(f'Jogo:      http://localhost:{port}/')
    print(f'Compêndio: http://localhost:{port}/tools/compendio.html')
    server.serve_forever()


if __name__ == '__main__':
    main()
