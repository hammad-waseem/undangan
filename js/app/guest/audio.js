import { progress } from "./progress.js";

export const audio = (() => {
  let music = null;
  let audioEl = null;
  let isPlay = false;

  const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
  const statePause = '<i class="fa-solid fa-circle-play"></i>';

  /**
   * @returns {Promise<void>}
   */
  const play = async () => {
    if (!navigator.onLine) return;

    music.disabled = true;
    try {
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
    isPlay = false;
    audioEl.pause();
    music.innerHTML = statePause;
  };

  /**
   * @returns {Promise<void>}
   */
  const init = async () => {
    music = document.getElementById("button-music");
    if (!music) return console.error("Music button not found!");

    let url = music.getAttribute("data-url");
    if (!url) return console.error("Audio URL not found!");

    audioEl = new Audio(url);
    audioEl.loop = true;
    audioEl.volume = 1;
    audioEl.muted = false;
    audioEl.autoplay = false;
    audioEl.controls = false;

    // Ensure audio is allowed to play on mobile
    music.addEventListener("click", async () => {
      if (isPlay) {
        pause();
      } else {
        await play();
      }
    });

    progress.complete("audio");
  };

  return { init, play };
})();
