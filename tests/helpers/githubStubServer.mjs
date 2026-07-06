import http from 'node:http';

export function createGithubStubServer() {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/repos/missing/repo' || req.url === '/repos/missing/repo/releases/latest') {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
      return;
    }

    const latestReleaseMatch = req.url.match(/^\/repos\/([^/]+)\/([^/]+)\/releases\/latest$/);
    if (latestReleaseMatch) {
      res.end(JSON.stringify({ tag_name: 'v1.0.0' }));
      return;
    }

    const repositoryMatch = req.url.match(/^\/repos\/([^/]+)\/([^/]+)$/);
    if (repositoryMatch) {
      const [, owner, name] = repositoryMatch;
      res.end(JSON.stringify({ full_name: `${owner}/${name}` }));
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
