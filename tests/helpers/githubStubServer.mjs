import http from 'node:http';

export function createGithubStubServer() {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/repos/octocat/Hello-World') {
      res.end(JSON.stringify({ full_name: 'octocat/Hello-World' }));
      return;
    }

    if (req.url === '/repos/octocat/Hello-World/releases/latest') {
      res.end(JSON.stringify({ tag_name: 'v1.0.0' }));
      return;
    }

    if (req.url === '/repos/missing/repo' || req.url === '/repos/missing/repo/releases/latest') {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
      return;
    }

    res.statusCode = 500;
    res.end(JSON.stringify({ message: `Unexpected GitHub stub path: ${req.url}` }));
  });
}

export async function listen(server, port = 0) {
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server.address().port;
}

export async function close(server) {
  if (!server?.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
