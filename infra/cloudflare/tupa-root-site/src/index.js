const HTML = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>тупа</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#000;color:#fff}</style>тупа';

export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/favicon.ico") return new Response(null, { status: 204 });
    if (pathname !== "/") return new Response("Not found", { status: 404 });
    return new Response(HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  },
};
