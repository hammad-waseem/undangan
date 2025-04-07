import { progress } from "./progress.js";
import { util } from "../../common/util.js";
import { request, HTTP_GET } from "../../connection/request.js";

export const audio = (() => {
  let music = null;
  let audioEl = null;
  let url = null;
  let canPlay = null;
  let isPlay = false;

  let ttl = 1000 * 60 * 60 * 6; // 6 hours cache
  const cacheName = "audio";
  const type = "audio/mpeg";
  const exp = "x-expiration-time";

  const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
  const statePause = '<i class="fa-solid fa-circle-play"></i>';

  /**
   * @returns {Promise<void>}
   */
  const play = async () => {
    if (!navigator.onLine || !audioEl) return;

    music.disabled = true;
    try {
      await canPlay;
      await audioEl.play();
      isPlay = true;
      music.innerHTML = statePlay;
    } catch (err) {
      console.error("Play error:", err);
      alert("Audio cannot play automatically. Tap to start.");
    } finally {
      music.disabled = false;
    }
  };

  /**
   * @returns {void}
   */
  const pause = () => {
    if (!audioEl) return;
    isPlay = false;
    audioEl.pause();
    music.innerHTML = statePause;
  };

  /**
   * @param {Cache} c
   * @returns {Promise<Blob>}
   */
  const fetchPut = async (c) => {
    try {
      const response = await request(HTTP_GET, url).default();
      const blob = await response.blob();

      const headers = new Headers();
      headers.set("Content-Type", type);
      headers.set("Content-Length", String(blob.size));
      headers.set(exp, String(Date.now() + ttl));

      await c.put(url, new Response(blob, { headers }));
      return blob;
    } catch (err) {
      console.error("Audio fetch error:", err);
      throw err;
    }
  };

  /**
   * @returns {Promise<string>}
   */
  const getUrl = async () => {
    let blob;

    try {
      if (typeof caches === "undefined") {
        console.warn("Cache API not supported. Fetching directly.");
        return URL.createObjectURL(await fetchPut({ put: async () => {} }));
      }

      const c = await caches.open(cacheName);
      const cachedRes = await c.match(url);

      if (!cachedRes) {
        blob = await fetchPut(c);
      } else {
        const expiry = parseInt(cachedRes.headers.get(exp), 10);
        if (Date.now() > expiry) {
          await c.delete(url);
          blob = await fetchPut(c);
        } else {
          blob = await cachedRes.blob();
        }
      }

      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Fallback: could not cache audio. Fetching directly.", err);
      blob = await fetchPut({ put: async () => {} });
      return URL.createObjectURL(blob);
    }
  };

  /**
   * @param {number} num
   * @returns {void}
   */
  const setTtl = (num) => {
    ttl = Number(num);
  };

  /**
   * @returns {Promise<void>}
   */
  const init = async () => {
    music = document.getElementById("button-music");
    if (!music) return console.error("Music button not found!");

    url = music.getAttribute("data-url");
    if (!url) return console.error("Audio URL not found!");

    document.addEventListener("undangan.open", () => {
      music.style.display = "block";
    });

    try {
      audioEl = new Audio(await getUrl());
      audioEl.volume = 1;
      audioEl.loop = true;
      audioEl.muted = false;
      audioEl.currentTime = 0;
      audioEl.autoplay = false;
      audioEl.controls = false;

      canPlay = new Promise((res) => audioEl.addEventListener("canplay", res));
      progress.complete("audio");

      // Ensure interaction on mobile
      music.addEventListener("click", async () => {
        if (isPlay) {
          pause();
        } else {
          await play();
        }
      });

      // Pause when offline
      window.addEventListener("offline", pause);
    } catch (err) {
      console.error("Audio initialization errorR:", err);
      progress.invalid("audio");
    }
  };

  return { init, play, pause, setTtl };
})();
