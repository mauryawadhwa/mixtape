/* ============================================================
   MIXTAPE WEBSITE — APP.JS
   All logic: config, player, typewriter, transitions, gallery
   ============================================================ */

(function () {
  'use strict';

  // ── State ──
  let config = null;
  let currentTrackIndex = 0;
  let isPlaying = false;
  let hasStartedOnce = false;
  let typewriterTimeout = null;
  let typeOutTimeout = null;
  let isTypingIn = false;
  let isTypingOut = false;
  let typeOutTriggered = false;
  let cassetteFrames = [];

  // ── DOM Elements ──
  const $ = (id) => document.getElementById(id);

  const introScreen = $('intro-screen');
  const introLetterText = $('intro-letter-text');
  const introBtn = $('intro-btn');
  const headerTitleIntro = $('header-title-intro');
  const headerSubtitleIntro = $('header-subtitle-intro');
  const headerTitleMain = $('header-title-main');
  const headerSubtitleMain = $('header-subtitle-main');
  const galleryBtnIntro = $('gallery-btn-intro');
  const galleryBtnMain = $('gallery-btn-main');

  const cassetteOverlay = $('cassette-animation');
  const cassetteFrame = $('cassette-frame');

  const mainPlayer = $('main-player');
  const letterHeading = $('letter-heading');
  const letterBody = $('letter-body');
  const letterText = $('letter-text');
  const typewriterCursor = $('typewriter-cursor');

  const mixtapeImage = $('mixtape-image');

  const trackNumber = $('track-number');
  const trackName = $('track-name');
  const progressBar = $('progress-bar');
  const progressFill = $('progress-fill');
  const timeElapsed = $('time-elapsed');
  const timeTotal = $('time-total');
  const prevBtn = $('prev-btn');
  const playPauseBtn = $('play-pause-btn');
  const nextBtn = $('next-btn');

  const pressToPlay = $('press-to-play');

  const galleryModal = $('gallery-modal');
  const galleryBackdrop = $('gallery-backdrop');
  const galleryCloseBtn = $('gallery-close-btn');
  const galleryGrid = $('gallery-grid');

  const lightbox = $('gallery-lightbox');
  const lightboxImage = $('lightbox-image');

  const audio = $('audio-player');

  // ════════════════════════════════════════════
  // CONFIG LOADER
  // ════════════════════════════════════════════
  async function loadConfig() {
    try {
      const response = await fetch('config.json');
      config = await response.json();
      initializeApp();
    } catch (err) {
      console.error('Failed to load config.json:', err);
      introLetterText.textContent = 'Could not load config. Please check config.json.';
    }
  }

  function initializeApp() {
    // Set header text on both screens
    headerTitleIntro.textContent = config.header.title;
    headerSubtitleIntro.textContent = config.header.subtitle;
    headerTitleMain.textContent = config.header.title;
    headerSubtitleMain.textContent = config.header.subtitle;

    // Set intro letter
    introLetterText.textContent = config.introLetter;

    // Set intro button text
    introBtn.textContent = config.introButtonText || 'PLAY';

    // Set letter heading
    letterHeading.textContent = 'dear ' + config.recipientName + ',';

    // Load first track info
    loadTrack(0);

    // Build gallery
    buildGallery();

    // Preload cassette animation frames
    preloadCassetteFrames();

    // Bind all events
    bindEvents();
  }

  // ════════════════════════════════════════════
  // AUDIO PLAYER ENGINE
  // ════════════════════════════════════════════
  function loadTrack(index) {
    if (!config || !config.songs || config.songs.length === 0) return;

    currentTrackIndex = index;
    const song = config.songs[currentTrackIndex];

    audio.src = song.file;
    audio.load();

    trackName.textContent = song.title;
    trackNumber.textContent = (currentTrackIndex + 1) + ' / ' + config.songs.length;

    progressFill.style.width = '0%';
    timeElapsed.textContent = '00:00';
    timeTotal.textContent = '00:00';

    // Reset type-out trigger
    typeOutTriggered = false;
  }

  function playSong() {
    if (!config || !config.songs || config.songs.length === 0) return;

    audio.play().then(() => {
      isPlaying = true;
      playPauseBtn.textContent = '▮▮';
      playPauseBtn.setAttribute('aria-label', 'Pause');
      mixtapeImage.classList.add('playing');

      if (!hasStartedOnce) {
        hasStartedOnce = true;
        // Start typewriter for first song
        startTypewriterForCurrentSong();
      }
    }).catch((err) => {
      console.warn('Playback failed:', err);
    });
  }

  function pauseSong() {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
    playPauseBtn.setAttribute('aria-label', 'Play');
    mixtapeImage.classList.remove('playing');
  }

  function togglePlayPause() {
    if (isPlaying) {
      pauseSong();
    } else {
      playSong();
    }
  }

  function nextTrack() {
    if (!config || !config.songs) return;
    const wasPlaying = isPlaying;
    pauseSong();

    // Cancel any ongoing typewriter
    cancelTypewriter();

    // Fade out current letter, then type in new one
    const nextIndex = (currentTrackIndex + 1) % config.songs.length;
    fadeOutLetterThenAdvance(nextIndex, wasPlaying);
  }

  function prevTrack() {
    if (!config || !config.songs) return;
    const wasPlaying = isPlaying;
    pauseSong();

    // Cancel any ongoing typewriter
    cancelTypewriter();

    // Fade out current letter, then type in new one
    const prevIndex = (currentTrackIndex - 1 + config.songs.length) % config.songs.length;
    fadeOutLetterThenAdvance(prevIndex, wasPlaying);
  }

  function fadeOutLetterThenAdvance(newIndex, shouldPlay) {
    letterBody.classList.add('fade-out');

    setTimeout(() => {
      letterBody.classList.remove('fade-out');
      letterText.textContent = '';
      typewriterCursor.style.display = 'inline-block';

      loadTrack(newIndex);

      if (shouldPlay) {
        audio.addEventListener('canplay', function onCanPlay() {
          audio.removeEventListener('canplay', onCanPlay);
          playSong();
          startTypewriterForCurrentSong();
        });
      } else {
        startTypewriterForCurrentSong();
      }
    }, 420);
  }

  function autoAdvance() {
    if (!config || !config.songs) return;
    if (currentTrackIndex < config.songs.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      loadTrack(nextIndex);

      audio.addEventListener('canplay', function onCanPlay() {
        audio.removeEventListener('canplay', onCanPlay);
        playSong();
        startTypewriterForCurrentSong();
      });
    } else {
      // Last song ended — stop
      pauseSong();
      typewriterCursor.style.display = 'none';
    }
  }

  function seekTo(e) {
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = clickX / rect.width;
    if (audio.duration && isFinite(audio.duration)) {
      audio.currentTime = fraction * audio.duration;
    }
  }

  function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  // ════════════════════════════════════════════
  // TYPEWRITER ENGINE
  // ════════════════════════════════════════════
  function startTypewriterForCurrentSong() {
    if (!config || !config.songs) return;
    const song = config.songs[currentTrackIndex];
    const text = song.letter || '';
    typeIn(text);
  }

  function typeIn(text) {
    cancelTypewriter();
    isTypingIn = true;
    letterText.textContent = '';
    typewriterCursor.style.display = 'inline-block';
    let i = 0;

    function typeNext() {
      if (i < text.length) {
        letterText.textContent += text.charAt(i);
        i++;
        const delay = 30 + Math.random() * 50; // 30-80ms variation
        typewriterTimeout = setTimeout(typeNext, delay);
      } else {
        isTypingIn = false;
        // Keep cursor blinking at end
      }
    }

    typeNext();
  }

  function typeOut(callback) {
    cancelTypewriter();
    isTypingOut = true;
    const text = letterText.textContent;
    let i = text.length;

    function removeNext() {
      if (i > 0) {
        i--;
        letterText.textContent = text.substring(0, i);
        const delay = 15 + Math.random() * 25; // faster removal: 15-40ms
        typeOutTimeout = setTimeout(removeNext, delay);
      } else {
        isTypingOut = false;
        if (callback) callback();
      }
    }

    removeNext();
  }

  function cancelTypewriter() {
    if (typewriterTimeout) {
      clearTimeout(typewriterTimeout);
      typewriterTimeout = null;
    }
    if (typeOutTimeout) {
      clearTimeout(typeOutTimeout);
      typeOutTimeout = null;
    }
    isTypingIn = false;
    isTypingOut = false;
  }

  // ════════════════════════════════════════════
  // CASSETTE INSERTION ANIMATION
  // ════════════════════════════════════════════
  function preloadCassetteFrames() {
    if (!config || !config.animation) return;

    const anim = config.animation;
    cassetteFrames = [];

    for (let i = 1; i <= anim.frameCount; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(4, '0');
      img.src = 'assets/' + anim.frames + frameNum + anim.frameExtension;
      cassetteFrames.push(img);
    }
  }

  function playCassetteAnimation(callback) {
    if (!cassetteFrames.length) {
      // No animation frames provided — skip directly
      if (callback) callback();
      return;
    }

    cassetteOverlay.classList.remove('hidden');
    let frameIndex = 0;
    const frameRate = config.animation.frameRate || 24;
    const frameInterval = 1000 / frameRate;

    cassetteFrame.src = cassetteFrames[0].src;

    const interval = setInterval(() => {
      frameIndex++;
      if (frameIndex < cassetteFrames.length) {
        cassetteFrame.src = cassetteFrames[frameIndex].src;
      } else {
        clearInterval(interval);
        // Fade out the overlay
        cassetteOverlay.classList.add('fade-out');
        setTimeout(() => {
          cassetteOverlay.classList.add('hidden');
          cassetteOverlay.classList.remove('fade-out');
          if (callback) callback();
        }, 600);
      }
    }, frameInterval);
  }

  // ════════════════════════════════════════════
  // INTRO SCREEN CONTROLLER
  // ════════════════════════════════════════════
  function startTransition() {
    // Slide up the intro screen
    introScreen.classList.add('slide-up');

    // Show the main player underneath
    mainPlayer.classList.add('visible');

    // After slide-up completes, play cassette animation
    setTimeout(() => {
      introScreen.classList.add('hidden');

      playCassetteAnimation(() => {
        // Show press-to-play overlay
        showPressToPlay();
      });
    }, 850);
  }

  // ════════════════════════════════════════════
  // PRESS TO PLAY OVERLAY
  // ════════════════════════════════════════════
  function showPressToPlay() {
    pressToPlay.classList.remove('hidden');

    // Check if user provided a press-to-play image
    if (config.pressToPlayImage) {
      const content = $('press-to-play-content');
      content.innerHTML = '';
      const img = document.createElement('img');
      img.src = config.pressToPlayImage;
      img.alt = 'Press to play';
      content.appendChild(img);
    }
  }

  function dismissPressToPlay() {
    pressToPlay.classList.add('hidden');
    // Start playing
    playSong();
  }

  // ════════════════════════════════════════════
  // GALLERY CONTROLLER
  // ════════════════════════════════════════════
  function buildGallery() {
    if (!config || !config.gallery || config.gallery.length === 0) return;
    galleryGrid.innerHTML = '';

    config.gallery.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = 'assets/' + src;
      img.alt = 'Gallery photo ' + (index + 1);
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox('assets/' + src));
      galleryGrid.appendChild(img);
    });
  }

  function openGallery() {
    galleryModal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeGallery() {
    galleryModal.classList.remove('visible');
    document.body.style.overflow = '';
  }

  function openLightbox(src) {
    lightboxImage.src = src;
    lightbox.classList.add('visible');
  }

  function closeLightbox() {
    lightbox.classList.remove('visible');
    lightboxImage.src = '';
  }

  // ════════════════════════════════════════════
  // EVENT BINDING
  // ════════════════════════════════════════════
  function bindEvents() {
    // Intro
    introBtn.addEventListener('click', startTransition);

    // Press to play
    pressToPlay.addEventListener('click', dismissPressToPlay);

    // Transport controls
    playPauseBtn.addEventListener('click', () => {
      if (!hasStartedOnce) {
        hasStartedOnce = true;
        playSong();
        startTypewriterForCurrentSong();
      } else {
        togglePlayPause();
      }
    });
    nextBtn.addEventListener('click', nextTrack);
    prevBtn.addEventListener('click', prevTrack);

    // Progress bar seek
    progressBar.addEventListener('click', seekTo);

    // Audio events
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', () => {
      timeTotal.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('ended', onTrackEnded);

    // Gallery
    galleryBtnIntro.addEventListener('click', openGallery);
    galleryBtnMain.addEventListener('click', openGallery);
    galleryCloseBtn.addEventListener('click', closeGallery);
    galleryBackdrop.addEventListener('click', closeGallery);

    // Lightbox
    lightbox.addEventListener('click', closeLightbox);

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (lightbox.classList.contains('visible')) {
          closeLightbox();
        } else if (galleryModal.classList.contains('visible')) {
          closeGallery();
        }
      }
      // Space to toggle play/pause (when not typing)
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        if (mainPlayer.classList.contains('visible') && hasStartedOnce) {
          togglePlayPause();
        }
      }
    });
  }

  // ════════════════════════════════════════════
  // TIME UPDATE & TRACK END HANDLERS
  // ════════════════════════════════════════════
  function onTimeUpdate() {
    if (!audio.duration || !isFinite(audio.duration)) return;

    const progress = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = progress + '%';
    timeElapsed.textContent = formatTime(audio.currentTime);

    // Check for type-out trigger at ~20 seconds remaining
    const remaining = audio.duration - audio.currentTime;
    if (remaining <= 20 && !typeOutTriggered && !isTypingOut && isPlaying) {
      typeOutTriggered = true;
      typeOut(() => {
        // Type-out complete, ready for next song
      });
    }
  }

  function onTrackEnded() {
    // Cancel any ongoing typewriter activity
    cancelTypewriter();
    letterText.textContent = '';

    // Auto-advance
    autoAdvance();
  }

  // ════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', loadConfig);

})();
