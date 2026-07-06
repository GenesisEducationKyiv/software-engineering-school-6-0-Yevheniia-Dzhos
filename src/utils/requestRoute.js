export function getRequestRoute(req) {
  if (req.route?.path) {
    const routePath = Array.isArray(req.route.path) ? req.route.path[0] : req.route.path;
    const originalPath = req.originalUrl?.split('?')[0] || '';
    const routeSegments = routePath.split('/').filter(Boolean);
    const originalSegments = originalPath.split('/').filter(Boolean);

    for (let index = 0; index <= originalSegments.length - routeSegments.length; index += 1) {
      const matches = routeSegments.every((segment, offset) => {
        return segment.startsWith(':') || segment === originalSegments[index + offset];
      });

      if (matches) {
        return `/${[
          ...originalSegments.slice(0, index),
          ...routeSegments
        ].join('/')}`;
      }
    }

    return `${req.baseUrl || ''}${routePath}`;
  }

  return 'unknown';
}
