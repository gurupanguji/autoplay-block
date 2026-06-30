// Function to neutralize a video element
function blockVideo(video) {
  if (!video) return;

  // 1. Force pause right away
  video.pause();

  // 2. Prevent the site's own scripts from triggering .play()
  const originalPlay = video.play;
  video.play = function () {
    // Only allow play if the user actually clicked the video
    if (navigator.userActivation && navigator.userActivation.isActive) {
      return originalPlay.apply(this, arguments);
    }
    // Block automated play attempts
    return Promise.reject(
      new DOMException("Autoplay blocked by extension.", "NotAllowedError"),
    );
  };

  // 3. Listen for unwanted play events and stop them
  video.addEventListener(
    "play",
    (e) => {
      if (!(navigator.userActivation && navigator.userActivation.isActive)) {
        video.pause();
      }
    },
    { capture: true },
  );
}

// Watch the webpage for any newly added video elements
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.tagName === "VIDEO") {
        blockVideo(node);
      } else if (node.querySelectorAll) {
        const videos = node.querySelectorAll("video");
        videos.forEach(blockVideo);
      }
    }
  }
});

// Start tracking immediately
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Catch any videos that loaded before the tracker started
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("video").forEach(blockVideo);
});
