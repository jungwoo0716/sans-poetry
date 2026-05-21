(() => {
  const FADE_DURATION = 1500;
  const POEM_LINE_INTERVAL = 2500; // ms between each line (흔들리며 피는 꽃)
  const POEM2_LINE_INTERVAL = 800; // ms between each line (어느 날)
  const pages = document.querySelectorAll('.page');
  const totalPages = pages.length;
  let currentPage = 1;
  let transitioning = false;
  let poemTimers = [];

  // === Audio ===
  const tracks = {};
  const trackFiles = {
    'radio-signal': 'assets/music/radio-signal.mp3',
    'swaying-flowers': 'assets/music/swaying-flowers.mp3',
    'good-day': 'assets/music/good-day.mp3',
  };
  let activeTrack = null;

  function loadTracks() {
    for (const [name, src] of Object.entries(trackFiles)) {
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = 0;
      audio.preload = 'auto';
      tracks[name] = audio;
    }
  }

  function fadeIn(audio, targetVol = 0.7, duration = FADE_DURATION) {
    audio.volume = 0;
    audio.play().catch(() => {});
    const steps = 30;
    const stepTime = duration / steps;
    const volStep = targetVol / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.min(volStep * step, targetVol);
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }

  function fadeOut(audio, duration = FADE_DURATION) {
    if (!audio || audio.paused) return Promise.resolve();
    const startVol = audio.volume;
    const steps = 30;
    const stepTime = duration / steps;
    const volStep = startVol / steps;
    let step = 0;
    return new Promise(resolve => {
      const interval = setInterval(() => {
        step++;
        audio.volume = Math.max(startVol - volStep * step, 0);
        if (step >= steps) {
          clearInterval(interval);
          audio.pause();
          audio.currentTime = 0;
          resolve();
        }
      }, stepTime);
    });
  }

  function handleMusic(page) {
    const trackName = page.dataset.music;
    const action = page.dataset.musicAction;
    const newTrack = tracks[trackName];
    if (!newTrack) return;

    switch (action) {
      case 'play':
        if (activeTrack && activeTrack !== newTrack) fadeOut(activeTrack);
        activeTrack = newTrack;
        fadeIn(newTrack);
        break;
      case 'continue':
        if (activeTrack !== newTrack) {
          if (activeTrack) fadeOut(activeTrack);
          activeTrack = newTrack;
          fadeIn(newTrack);
        }
        break;
      case 'crossfade':
        if (activeTrack && activeTrack !== newTrack) {
          fadeOut(activeTrack);
          activeTrack = newTrack;
          fadeIn(newTrack);
        } else if (!activeTrack || activeTrack.paused) {
          activeTrack = newTrack;
          fadeIn(newTrack);
        }
        break;
      case 'fadeout':
        if (activeTrack) {
          fadeOut(activeTrack).then(() => { activeTrack = null; });
        }
        break;
    }
  }

  // === Poem scroll animation ===
  function clearPoemTimers() {
    poemTimers.forEach(t => clearTimeout(t));
    poemTimers = [];
  }

  function startPoemScroll(page) {
    const poemBody = page.querySelector('[data-scroll-poem]');
    if (!poemBody) return;
    const lines = poemBody.querySelectorAll('p');
    lines.forEach(l => l.classList.remove('visible'));

    const pageNum = page.dataset.page;
    const interval = pageNum === '5' ? POEM2_LINE_INTERVAL : POEM_LINE_INTERVAL;

    lines.forEach((line, i) => {
      const timer = setTimeout(() => {
        line.classList.add('visible');

        requestAnimationFrame(() => {
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // 마지막 줄이 나타나면 음악 시작
        if (i === lines.length - 1) {
          const musicTimer = setTimeout(() => {
            handleMusic(page);
          }, 1500); // 마지막 줄 나온 후 1.5초 뒤 음악
          poemTimers.push(musicTimer);
        }
      }, 800 + i * interval);
      poemTimers.push(timer);
    });
  }

  function resetPoemScroll(page) {
    const poemBody = page.querySelector('[data-scroll-poem]');
    if (!poemBody) return;
    poemBody.querySelectorAll('p').forEach(l => l.classList.remove('visible'));
    // Scroll back to top
    page.scrollTop = 0;
  }

  // === Page indicator ===
  function buildPageIndicator() {
    const indicator = document.getElementById('page-indicator');
    for (let i = 1; i <= totalPages; i++) {
      const dot = document.createElement('div');
      dot.classList.add('dot');
      if (i === 1) dot.classList.add('active');
      indicator.appendChild(dot);
    }
  }

  function updateIndicator() {
    document.querySelectorAll('#page-indicator .dot').forEach((dot, i) => {
      dot.classList.toggle('active', i + 1 === currentPage);
    });
  }

  // === Navigation ===
  function goToPage(num) {
    if (num < 1 || num > totalPages || num === currentPage || transitioning) return;
    transitioning = true;
    clearPoemTimers();

    const current = document.querySelector(`.page[data-page="${currentPage}"]`);
    const next = document.querySelector(`.page[data-page="${num}"]`);

    resetPoemScroll(current);
    current.classList.remove('active');
    next.classList.add('active');
    currentPage = num;
    updateIndicator();

    // 시 페이지(3, 5)는 기존 음악 끄고, 시가 끝난 후 새 음악 시작
    const isPoemPage = next.classList.contains('poem-scroll-page');
    if (isPoemPage) {
      if (activeTrack) {
        fadeOut(activeTrack).then(() => { activeTrack = null; });
      }
    } else {
      handleMusic(next);
    }
    startPoemScroll(next);

    setTimeout(() => { transitioning = false; }, 1300);
  }

  function next() { if (currentPage < totalPages) goToPage(currentPage + 1); }
  function prev() { if (currentPage > 1) goToPage(currentPage - 1); }

  // Keyboard
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prev();
        break;
      case 'f':
      case 'F':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen();
          }
        }
        break;
    }
  });

  // Click (left half = prev, right half = next)
  document.getElementById('presentation').addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const x = e.clientX / window.innerWidth;
    if (x > 0.5) next();
    else prev();
  });

  // Start screen
  const startScreen = document.getElementById('start-screen');
  startScreen.addEventListener('click', () => {
    loadTracks();
    startScreen.classList.add('fade-out');
    document.getElementById('presentation').classList.remove('hidden');
    buildPageIndicator();

    setTimeout(() => {
      const firstPage = document.querySelector('.page.active');
      handleMusic(firstPage);
      startPoemScroll(firstPage);
      startScreen.remove();
    }, 800);
  });
})();
