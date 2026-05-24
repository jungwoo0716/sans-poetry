(() => {
  const FADE_DURATION = 1500;
  const POEM_LINE_INTERVAL = 2500;
  const POEM2_LINE_INTERVAL = 800;
  const pages = document.querySelectorAll('.page');
  const totalPages = pages.length;
  let currentPage = 1;
  let transitioning = false;
  let poemTimers = [];
  let poemAnimating = false;  // 시 줄이 나오는 중
  let poemFinished = false;   // 시 전부 표시됨, 음악 대기
  let musicPlaying = false;   // 음악 재생 중

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

  function playPageMusic(page) {
    const trackName = page.dataset.music;
    const action = page.dataset.musicAction;
    const newTrack = tracks[trackName];
    if (!newTrack) return;

    // play-once: loop 끄기
    if (action === 'play-once') {
      newTrack.loop = false;
    } else {
      newTrack.loop = true;
    }

    if (activeTrack && activeTrack !== newTrack) {
      fadeOut(activeTrack);
    }
    activeTrack = newTrack;
    fadeIn(newTrack);
    musicPlaying = true;
  }

  // === Poem scroll animation ===
  function clearPoemTimers() {
    poemTimers.forEach(t => clearTimeout(t));
    poemTimers = [];
  }

  // 남은 줄 전부 즉시 표시
  function finishPoemImmediately(page) {
    clearPoemTimers();
    const poemBody = page.querySelector('[data-scroll-poem]');
    if (!poemBody) return;
    const lines = poemBody.querySelectorAll('p');
    lines.forEach(l => l.classList.add('visible'));
    // 마지막 줄로 스크롤
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      requestAnimationFrame(() => {
        lastLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    poemAnimating = false;
    poemFinished = true;
  }

  function startPoemScroll(page) {
    const poemBody = page.querySelector('[data-scroll-poem]');
    if (!poemBody) return;
    const lines = poemBody.querySelectorAll('p');
    lines.forEach(l => l.classList.remove('visible'));

    poemAnimating = true;
    poemFinished = false;

    const pageNum = page.dataset.page;
    const interval = pageNum === '5' ? POEM2_LINE_INTERVAL : POEM_LINE_INTERVAL;

    lines.forEach((line, i) => {
      const timer = setTimeout(() => {
        line.classList.add('visible');

        requestAnimationFrame(() => {
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // 마지막 줄
        if (i === lines.length - 1) {
          const readyTimer = setTimeout(() => {
            poemAnimating = false;
            poemFinished = true;
          }, 1000);
          poemTimers.push(readyTimer);
        }
      }, 800 + i * interval);
      poemTimers.push(timer);
    });
  }

  function resetPoemScroll(page) {
    const poemBody = page.querySelector('[data-scroll-poem]');
    if (!poemBody) return;
    poemBody.querySelectorAll('p').forEach(l => l.classList.remove('visible'));
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
    poemAnimating = false;
    poemFinished = false;
    musicPlaying = false;

    const current = document.querySelector(`.page[data-page="${currentPage}"]`);
    const next = document.querySelector(`.page[data-page="${num}"]`);

    resetPoemScroll(current);
    current.classList.remove('active');
    next.classList.add('active');
    currentPage = num;
    updateIndicator();

    const isPoemPage = next.classList.contains('poem-scroll-page');
    const isManual = next.dataset.musicAction === 'manual';

    if (isPoemPage || isManual) {
      // 시 페이지 or 수동 페이지: 기존 음악 끄기
      if (activeTrack) {
        fadeOut(activeTrack).then(() => { activeTrack = null; });
      }
      if (isManual) {
        // 클로징 등: 바로 음악 대기 상태
        poemFinished = true;
      }
    } else {
      // 일반 페이지: 자동 재생
      playPageMusic(next);
    }

    startPoemScroll(next);
    setTimeout(() => { transitioning = false; }, 1300);
  }

  function next() { if (currentPage < totalPages) goToPage(currentPage + 1); }
  function prev() { if (currentPage > 1) goToPage(currentPage - 1); }

  // === Keyboard ===
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (poemAnimating) {
          // 시 진행 중 → 남은 줄 전부 즉시 표시
          const curEl = document.querySelector(`.page[data-page="${currentPage}"]`);
          finishPoemImmediately(curEl);
        } else if (poemFinished) {
          // 시 전부 표시됨 → 음악 재생
          poemFinished = false;
          musicPlaying = true;
          const curEl = document.querySelector(`.page[data-page="${currentPage}"]`);
          playPageMusic(curEl);
        } else {
          // 그 외 → 다음 페이지
          next();
        }
        break;
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prev();
        break;
      case 'm':
      case 'M':
        // 백업: 현재 페이지 BGM 재생/재시작
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const curEl = document.querySelector(`.page[data-page="${currentPage}"]`);
          const tName = curEl.dataset.music;
          const t = tracks[tName];
          if (t) {
            t.pause();
            t.currentTime = 0;
            activeTrack = t;
            fadeIn(t);
            musicPlaying = true;
          }
        }
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
      playPageMusic(firstPage);
      startPoemScroll(firstPage);
      startScreen.remove();
    }, 800);
  });
})();
