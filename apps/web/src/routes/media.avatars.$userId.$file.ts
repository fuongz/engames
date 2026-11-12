import { createFileRoute } from "@tanstack/react-router";

// Player avatars from R2 (docs/standards/avatars.md). A key is unique per upload,
// so a hit is cacheable forever; a changed avatar is a new URL. Server modules are
// reached by dynamic import() inside the handler (layout Rule D), never statically.
const NOT_FOUND = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

export const Route = createFileRoute("/media/avatars/$userId/$file")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { parseAvatarKey } = await import("#/lib/avatar");
        const key = `avatars/${params.userId}/${params.file}`;
        const parts = parseAvatarKey(key);
        if (!parts) return NOT_FOUND();

        const [{ getAvatarBucket }, { getAvatar }] = await Promise.all([
          import("#/server/media"),
          import("#/server/media/avatars"),
        ]);
        const object = await getAvatar(getAvatarBucket(), key);
        if (!object) return NOT_FOUND();

        const headers = new Headers({
          "Content-Type": object.httpMetadata?.contentType ?? parts.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: object.httpEtag,
          "X-Content-Type-Options": "nosniff",
          // User-supplied bytes on our origin: never let them run as a document
          "Content-Security-Policy": "default-src 'none'; sandbox",
        });
        if (request.headers.get("If-None-Match") === object.httpEtag) {
          object.body.cancel();
          return new Response(null, { status: 304, headers });
        }
        headers.set("Content-Length", String(object.size));
        return new Response(object.body, { headers });
      },
    },
  },
});
