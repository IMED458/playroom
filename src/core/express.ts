/**
 * მინიმალური Express-თავსებადი Router ბრაუზერისთვის.
 * იძლევა საშუალებას, სერვერული როუტების ლოგიკა უცვლელად იმუშაოს კლიენტში
 * (GitHub Pages-ზე დაჰოსტვისთვის სერვერი აღარ არსებობს).
 */

export interface AppRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  ip?: string;
  user?: any;
}

export interface AppResponse {
  statusCode: number;
  body: any;
  finished: boolean;
  status(code: number): AppResponse;
  json(payload: any): void;
  send(payload: any): void;
}

export type NextFn = (err?: any) => void;
export type Handler = (req: AppRequest, res: AppResponse, next: NextFn) => void;

interface Route {
  method: string;
  segments: string[];
  handlers: Handler[];
}

export interface Router {
  (req: AppRequest, res: AppResponse, next: NextFn): void;
  get(path: string, ...handlers: Handler[]): void;
  post(path: string, ...handlers: Handler[]): void;
  put(path: string, ...handlers: Handler[]): void;
  patch(path: string, ...handlers: Handler[]): void;
  delete(path: string, ...handlers: Handler[]): void;
  routes: Route[];
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function matchRoute(route: Route, method: string, segments: string[]): Record<string, string> | null {
  if (route.method !== method) return null;
  if (route.segments.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i++) {
    const rs = route.segments[i];
    if (rs.startsWith(':')) {
      params[rs.substring(1)] = decodeURIComponent(segments[i]);
    } else if (rs !== segments[i]) {
      return null;
    }
  }
  return params;
}

export function Router(): Router {
  const routes: Route[] = [];

  const router = ((req: AppRequest, res: AppResponse, next: NextFn): void => {
    const segments = splitPath(req.path);

    for (const route of routes) {
      const params = matchRoute(route, req.method, segments);
      if (!params) continue;

      req.params = { ...req.params, ...params };

      // მიდლვეარების ჯაჭვის თანმიმდევრული გაშვება
      let index = 0;
      const runNext: NextFn = (err?: any) => {
        if (err) {
          if (!res.finished) res.status(500).json({ error: String(err?.message || err) });
          return;
        }
        if (res.finished) return;
        const handler = route.handlers[index++];
        if (!handler) return;
        try {
          handler(req, res, runNext);
        } catch (e: any) {
          if (!res.finished) res.status(400).json({ error: e?.message || 'შიდა შეცდომა.' });
        }
      };

      runNext();
      return;
    }

    next();
  }) as Router;

  router.routes = routes;

  const register = (method: string) => (path: string, ...handlers: Handler[]) => {
    routes.push({ method, segments: splitPath(path), handlers });
  };

  router.get = register('GET');
  router.post = register('POST');
  router.put = register('PUT');
  router.patch = register('PATCH');
  router.delete = register('DELETE');

  return router;
}

export function createResponse(): AppResponse {
  const res: AppResponse = {
    statusCode: 200,
    body: undefined,
    finished: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      res.finished = true;
    },
    send(payload: any) {
      res.body = payload;
      res.finished = true;
    }
  };
  return res;
}

// Express-ის ტიპებთან თავსებადობისთვის
export type Response = AppResponse;
export type Request = AppRequest;
