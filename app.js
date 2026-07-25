/* ============================================================
   MIXTAPE WEBSITE — APP.JS
   All logic: config, player, typewriter, puzzle game, gallery
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

  // Puzzle Game State
  let currentPuzzleStep = 0;
  let draggedPiece = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  const PUZZLE_STEPS = [
    { id: 'backcover', file: 'backcover.png', targetX: 0, targetY: 0, width: 50 },
    { id: 'cogwheel-1', file: 'cogwheel.png', targetX: 16.67, targetY: 22.25, width: 26.66 },
    { id: 'cogwheel-2', file: 'cogwheel.png', targetX: 56.67, targetY: 22.25, width: 26.66 },
    { id: 'tape', file: 'tape.png', targetX: 3.33, targetY: 2.25, width: 53.33 },
    { id: 'frontcover', file: 'frontcover.png', targetX: 0, targetY: 0, width: 50 }
  ];

  // ── DOM Elements ──
  const $ = (id) => document.getElementById(id);

  const introScreen = $('intro-screen');
  const introLetterText = $('intro-letter-text');
  const introBtn = $('intro-btn');
  const headerTitleMain = $('header-title-main');
  const headerSubtitleMain = $('header-subtitle-main');
  const galleryBtnMain = $('gallery-btn-main');

  const puzzleOverlay = $('puzzle-game');
  const puzzleArea = $('puzzle-area');
  const puzzleSuccess = $('puzzle-success');

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

  const galleryModal = $('gallery-modal');
  const galleryBackdrop = $('gallery-backdrop');
  const galleryCloseBtn = $('gallery-close-btn');
  const galleryGrid = $('gallery-grid');

  const lightbox = $('gallery-lightbox');
  const lightboxImage = $('lightbox-image');

  const songCover = $('song-cover');

  const audio = $('audio-player');

  // ════════════════════════════════════════════
  // CONFIG LOADER
  // ════════════════════════════════════════════
  async function loadConfig() {
    try {
      const response = await fetch('config.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      config = await response.json();
      initializeApp();
    } catch (err) {
      console.error('Failed to load config.json:', err);
      introLetterText.textContent = 'Could not load config. Please check config.json.';
    }
  }

  function initializeApp() {
    headerTitleMain.textContent = config.header.title;
    headerSubtitleMain.textContent = config.header.subtitle;
    introLetterText.textContent = config.introLetter;
    introBtn.textContent = config.introButtonText || 'PLAY';
    letterHeading.textContent = 'dear ' + config.recipientName + ',';

    loadTrack(0);
    buildGallery();
    initPuzzleGame();
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

    if (song.coverImage) {
      songCover.src = song.coverImage;
      songCover.style.display = 'block';
    } else {
      songCover.style.display = 'none';
      songCover.src = '';
    }
    typeOutTriggered = false;
  }

  function playSong() {
    if (!config || !config.songs || config.songs.length === 0) return;

    audio.play().then(() => {
      isPlaying = true;
      playPauseBtn.textContent = '▮▮';
      playPauseBtn.setAttribute('aria-label', 'Pause');
      mixtapeImage.classList.add('playing');
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
    cancelTypewriter();
    const nextIndex = (currentTrackIndex + 1) % config.songs.length;
    fadeOutLetterThenAdvance(nextIndex, wasPlaying);
  }

  function prevTrack() {
    if (!config || !config.songs) return;
    const wasPlaying = isPlaying;
    pauseSong();
    cancelTypewriter();
    const prevIndex = (currentTrackIndex - 1 + config.songs.length) % config.songs.length;
    fadeOutLetterThenAdvance(prevIndex, wasPlaying);
  }

  function fadeOutLetterThenAdvance(newIndex, shouldPlay) {
    letterBody.classList.add('fade-out');
    if (songCover) songCover.classList.add('fade-out');

    setTimeout(() => {
      letterBody.classList.remove('fade-out');
      if (songCover) songCover.classList.remove('fade-out');
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
      fadeOutLetterThenAdvance(nextIndex, true);
    } else {
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
        const delay = 30 + Math.random() * 50; 
        typewriterTimeout = setTimeout(typeNext, delay);
      } else {
        isTypingIn = false;
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
        const delay = 15 + Math.random() * 25; 
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
  // PUZZLE GAME ENGINE
  // ════════════════════════════════════════════
  function initPuzzleGame() {
    if (!config || !config.puzzle) return;
    const puzzleConfig = config.puzzle;
    
    // Add completed image element
    const completedImg = document.createElement('img');
    completedImg.src = puzzleConfig.pieces + '../mixtape.PNG';
    // Actually config says completedImage is 'assets/mixtape.PNG', let's use that
    completedImg.src = puzzleConfig.completedImage;
    completedImg.className = 'puzzle-completed-img';
    completedImg.id = 'puzzle-completed';
    puzzleArea.appendChild(completedImg);

    // Create and scatter pieces
    PUZZLE_STEPS.forEach((step, index) => {
      const img = document.createElement('img');
      img.src = puzzleConfig.pieces + step.file;
      img.className = 'puzzle-piece';
      img.id = 'piece-' + step.id;
      img.dataset.stepIndex = index;
      
      // Keep pieces fully on screen based on their actual scaled width
      // puzzleArea is 50vw, so actual width in vw is step.width / 2
      const actualWidthVw = step.width / 2;
      
      const maxX = 95 - actualWidthVw;
      const x = 5 + Math.random() * (maxX - 5); 
      const y = 25 + Math.random() * 45; // 25vh to 70vh
      
      img.style.left = x + 'vw';
      img.style.top = y + 'vh';
      img.style.width = actualWidthVw + 'vw';
      img.style.zIndex = index + 1; // Ensure correct stacking order
      
      // Append to puzzleOverlay so they can be anywhere on screen
      puzzleOverlay.appendChild(img);
    });

    bindPuzzleEvents();
  }

  function bindPuzzleEvents() {
    const startDrag = (e) => {
      if (e.target.classList.contains('puzzle-piece') && !e.target.classList.contains('snapped')) {
        draggedPiece = e.target;
        const rect = draggedPiece.getBoundingClientRect();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
        
        draggedPiece.classList.add('dragging');
      }
    };

    const doDrag = (e) => {
      if (!draggedPiece) return;
      e.preventDefault();
      
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      
      let newLeft = clientX - dragOffsetX;
      let newTop = clientY - dragOffsetY;
      
      // Keep piece within viewport while dragging
      const rect = draggedPiece.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
      draggedPiece.style.left = newLeft + 'px';
      draggedPiece.style.top = newTop + 'px';
    };

    const stopDrag = () => {
      if (!draggedPiece) return;
      
      draggedPiece.classList.remove('dragging');
      
      // Check snap
      const pieceRect = draggedPiece.getBoundingClientRect();
      const areaRect = puzzleArea.getBoundingClientRect();
      const stepIndex = parseInt(draggedPiece.dataset.stepIndex, 10);
      const step = PUZZLE_STEPS[stepIndex];
      
      let matchedTarget = null;
      let minDistance = 100; // Snap threshold
      
      if (step.id.startsWith('cogwheel')) {
        // Cogwheels can snap to either left or right hole
        const possibleTargets = [
          { id: 'target-cogwheel-left', targetX: 16.67, targetY: 22.25, width: 26.66 },
          { id: 'target-cogwheel-right', targetX: 56.67, targetY: 22.25, width: 26.66 }
        ];
        
        // Exclude targets that are already occupied
        const snappedCogwheels = document.querySelectorAll('.puzzle-piece.snapped[id^="piece-cogwheel"]');
        const occupiedIds = Array.from(snappedCogwheels).map(c => c.dataset.snappedTargetId);
        
        for (const t of possibleTargets) {
          if (occupiedIds.includes(t.id)) continue;
          
          const targetLeft = areaRect.left + (areaRect.width * (t.targetX / 100));
          const targetTop = areaRect.top + (areaRect.height * (t.targetY / 100));
          const dist = Math.hypot(pieceRect.left - targetLeft, pieceRect.top - targetTop);
          
          if (dist < minDistance) {
            minDistance = dist;
            matchedTarget = t;
          }
        }
      } else {
        const targetLeft = areaRect.left + (areaRect.width * (step.targetX / 100));
        const targetTop = areaRect.top + (areaRect.height * (step.targetY / 100));
        const dist = Math.hypot(pieceRect.left - targetLeft, pieceRect.top - targetTop);
        if (dist < minDistance) {
          minDistance = dist;
          matchedTarget = step;
        }
      }
      
      if (matchedTarget) {
        // Append to puzzleArea first to ensure correct DOM placement
        puzzleArea.appendChild(draggedPiece);
        
        // Force reflow so the CSS animation isn't cancelled by the DOM append
        void draggedPiece.offsetWidth;
        
        // Snap! Add class to trigger animation and apply relative sizing/positioning
        draggedPiece.classList.add('snapped');
        if (step.id.startsWith('cogwheel')) {
          draggedPiece.dataset.snappedTargetId = matchedTarget.id;
        }
        
        draggedPiece.style.width = matchedTarget.width + '%';
        draggedPiece.style.left = matchedTarget.targetX + '%';
        draggedPiece.style.top = matchedTarget.targetY + '%';
        
        // Check if all pieces are snapped
        const snappedPieces = document.querySelectorAll('.puzzle-piece.snapped');
        if (snappedPieces.length === PUZZLE_STEPS.length) {
          completePuzzle();
        }
      }
      
      draggedPiece = null;
    };

    puzzleOverlay.addEventListener('mousedown', startDrag);
    puzzleOverlay.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
    
    puzzleOverlay.addEventListener('touchstart', startDrag, { passive: false });
    puzzleOverlay.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);
  }

  function completePuzzle() {
    // Hide individual pieces
    const pieces = puzzleArea.querySelectorAll('.puzzle-piece');
    pieces.forEach(p => p.style.opacity = 0);
    
    // Hide hint
    $('puzzle-hint').style.display = 'none';
    
    // Show completed image and success message
    const completedImg = $('puzzle-completed');
    completedImg.classList.add('visible');
    puzzleSuccess.classList.remove('hidden');
    
    setTimeout(() => {
      // Transition to main player
      puzzleOverlay.classList.add('fade-out');
      mainPlayer.classList.add('visible');
      
      setTimeout(() => {
        puzzleOverlay.classList.add('hidden');
        if (!hasStartedOnce) {
          hasStartedOnce = true;
          playSong();
          startTypewriterForCurrentSong();
        }
      }, 600);
    }, 3000); // show "good job" for 3s
  }

  // ════════════════════════════════════════════
  // INTRO SCREEN CONTROLLER
  // ════════════════════════════════════════════
  function startTransition() {
    introScreen.classList.add('slide-up');
    puzzleOverlay.classList.remove('hidden');
    
    setTimeout(() => {
      introScreen.classList.add('hidden');
    }, 850);
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
    introBtn.addEventListener('click', startTransition);

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

    progressBar.addEventListener('click', seekTo);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', () => {
      timeTotal.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('ended', onTrackEnded);

    galleryBtnMain.addEventListener('click', openGallery);
    galleryCloseBtn.addEventListener('click', closeGallery);
    galleryBackdrop.addEventListener('click', closeGallery);

    lightbox.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (lightbox.classList.contains('visible')) {
          closeLightbox();
        } else if (galleryModal.classList.contains('visible')) {
          closeGallery();
        }
      }
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

    const remaining = audio.duration - audio.currentTime;
    if (remaining <= 20 && !typeOutTriggered && !isTypingOut && isPlaying) {
      typeOutTriggered = true;
      typeOut(() => {});
    }
  }

  function onTrackEnded() {
    cancelTypewriter();
    letterText.textContent = '';
    autoAdvance();
  }

  // ════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', loadConfig);

})();
