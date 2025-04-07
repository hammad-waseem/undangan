import { progress } from "./progress.js";
import { util } from "../../common/util.js";
import { request, HTTP_GET } from "../../connection/request.js";

export const image = (() => {
  let uniqUrl = null;
  let images = null;
  let hasSrc = false;
  let ttl = 1000 * 60 * 60 * 6; // 6 hour TTL
  const cacheName = "images";

  const getByFetch = async (el) => {
    const url = el.getAttribute("data-src");
    const exp = "x-expiration-time";
    const type = "image/webp";
    const img = new Image();

    img.onload = () => {
      el.src = img.src;
      el.width = img.width;
      el.height = img.height;
      img.remove();
      progress.complete("image");
    };

    if (uniqUrl.has(url)) {
      img.src = uniqUrl.get(url);
      return;
    }

    const toWebp = (i) =>
      new Promise((res, rej) => {
        const c = document.createElement("canvas");
        c.width = i.width;
        c.height = i.height;
        c.getContext("2d").drawImage(i, 0, 0);
        c.toBlob(
          (b) => {
            c.remove();
            b ? res(b) : rej(new Error("Failed to convert image to WebP"));
          },
          type,
          0.8
        );
      });

    const fetchPut = (c, retries = 3, delay = 1000) =>
      request(HTTP_GET, url)
        .default()
        .then((r) => r.blob())
        .then((b) => window.createImageBitmap(b))
        .then((i) => toWebp(i))
        .then((b) => {
          const headers = new Headers();
          headers.set("Content-Type", type);
          headers.set("Content-Length", String(b.size));
          headers.set(exp, String(Date.now() + ttl));

          return c.put(url, new Response(b, { headers })).then(() => b);
        })
        .catch((err) => {
          if (retries <= 0) throw err;
          console.warn("Retrying fetch:", url);
          return new Promise((res) =>
            util.timeOut(
              () => res(fetchPut(c, retries - 1, delay + 1000)),
              delay
            )
          );
        });

    const imageCache = (c) =>
      c.match(url).then((res) => {
        if (!res) return fetchPut(c);
        if (Date.now() <= parseInt(res.headers.get(exp))) return res.blob();
        return c.delete(url).then((s) => (s ? fetchPut(c) : res.blob()));
      });

    let blob;
    if (!("caches" in window)) {
      console.warn("Cache API not supported. Fetching image directly:", url);
      try {
        const originalBlob = await request(HTTP_GET, url)
          .default()
          .then((r) => r.blob());
        const imageBitmap = await window.createImageBitmap(originalBlob);
        blob = await toWebp(imageBitmap);
      } catch (err) {
        console.error("Image fetch failed:", err);
        return progress.invalid("image");
      }
    } else {
      try {
        const c = await caches.open(cacheName);
        blob = await imageCache(c);
      } catch (err) {
        console.error("Image cache failed:", err);
        return progress.invalid("image");
      }
    }

    img.src = URL.createObjectURL(blob);
    uniqUrl.set(url, img.src);
  };

  const getByDefault = (el) => {
    el.onerror = () => progress.invalid("image");
    el.onload = () => {
      el.width = el.naturalWidth;
      el.height = el.naturalHeight;
      progress.complete("image");
    };

    if (el.complete && el.naturalWidth !== 0 && el.naturalHeight !== 0) {
      progress.complete("image");
    } else if (el.complete) {
      progress.invalid("image");
    }
  };

  const hasDataSrc = () => hasSrc;

  const setTtl = (v) => {
    ttl = Number(v);
  };

  const load = () => {
    (async () => {
      for (const el of images) {
        if (el.hasAttribute("data-src")) {
          await getByFetch(el);
        } else {
          getByDefault(el);
        }
      }
    })();
  };

  const init = () => {
    uniqUrl = new Map();
    images = document.querySelectorAll("img");

    images.forEach(progress.add);
    hasSrc = Array.from(images).some((i) => i.hasAttribute("data-src"));

    return {
      load,
      setTtl,
      hasDataSrc,
    };
  };

  return {
    init,
  };
})();
