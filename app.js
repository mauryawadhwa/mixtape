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
  let maxZIndex = 5;
  let draggedPiece = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  const PUZZLE_STEPS = [
    { id: 'backcover', file: 'backcover.png', targetX: 0, targetY: 0, width: 50 },
    { id: 'cogwheel-1', file: 'cogwheel.png', targetX: 16.67, targetY: 22.25, width: 23 },
    { id: 'cogwheel-2', file: 'cogwheel.png', targetX: 56.67, targetY: 22.25, width: 23 },
    { id: 'tape', file: 'tape.png', targetX: 3.33, targetY: 2.25, width: 25 },
    { id: 'frontcover', file: 'frontcover.png', targetX: 0, targetY: 0, width: 50 }
  ];

  // ── DOM Elements ──
  const $ = (id) => document.getElementById(id);

  const introScreen = $('intro-screen');
  const introLetterText = $('intro-letter-text');
  const introBtn = $('intro-btn');
  const headerTitleMain = $('header-title-main');
  const headerSubtitleMain = $('header-subtitle-main');

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
    const surpriseBtnMain = $('surprise-btn-main');
    if (surpriseBtnMain) {
      surpriseBtnMain.addEventListener('click', () => {
        if (isPlaying) {
          pauseSong();
        }
        window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1', '_blank');
      });
    }
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

    // Generate random initial z-indexes so the user has to re-order them
    let initialZ = [1, 2, 3, 4, 5];
    initialZ.sort(() => Math.random() - 0.5);

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
      img.style.zIndex = initialZ[index]; // Apply randomized stacking

      // Append to puzzleOverlay so they can be anywhere on screen
      puzzleOverlay.appendChild(img);
    });

    bindPuzzleEvents();
  }

  function bindPuzzleEvents() {
    const startDrag = (e) => {
      if (e.target.classList.contains('puzzle-piece')) {
        draggedPiece = e.target;
        const rect = draggedPiece.getBoundingClientRect();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;

        // Bring piece to front when dragged
        maxZIndex++;
        draggedPiece.style.zIndex = maxZIndex;
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
      checkWinCondition();
      draggedPiece = null;
    };

    puzzleOverlay.addEventListener('mousedown', startDrag);
    puzzleOverlay.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);

    puzzleOverlay.addEventListener('touchstart', startDrag, { passive: false });
    puzzleOverlay.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);
  }

  function checkWinCondition() {
    const pieces = Array.from(document.querySelectorAll('.puzzle-piece'));

    // Sort pieces by their current z-index
    pieces.sort((a, b) => {
      return parseInt(a.style.zIndex, 10) - parseInt(b.style.zIndex, 10);
    });

    // Expected visual stacking from bottom to top
    const expectedIds = ['piece-backcover', 'piece-cogwheel', 'piece-cogwheel', 'piece-tape', 'piece-frontcover'];

    let isZOrderCorrect = true;
    for (let i = 0; i < pieces.length; i++) {
      const pieceId = pieces[i].id;
      if (i === 1 || i === 2) {
        if (!pieceId.startsWith('piece-cogwheel')) isZOrderCorrect = false;
      } else {
        if (pieceId !== expectedIds[i]) isZOrderCorrect = false;
      }
    }

    if (!isZOrderCorrect) return;

    // Check if they are piled together (all centers within backcover's bounding box)
    const backcover = document.getElementById('piece-backcover');
    const bgRect = backcover.getBoundingClientRect();

    let isPiled = true;
    for (const p of pieces) {
      if (p.id === 'piece-backcover') continue;

      const rect = p.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      if (centerX < bgRect.left || centerX > bgRect.right ||
        centerY < bgRect.top || centerY > bgRect.bottom) {
        isPiled = false;
        break;
      }
    }

    if (isPiled) {
      completePuzzle();
    }
  }

  function completePuzzle() {
    // Hide individual pieces
    const pieces = document.querySelectorAll('.puzzle-piece');
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

    document.addEventListener('keydown', (e) => {
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
      typeOut(() => { });
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
