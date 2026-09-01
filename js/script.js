// Anno corrente nel footer
document.getElementById('year').textContent = new Date().getFullYear();

// Header: ombra dopo lo scroll
const header = document.getElementById('site-header');
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Menu mobile
const navToggle = document.getElementById('nav-toggle');
navToggle.addEventListener('click', () => {
  const isOpen = header.classList.toggle('nav-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('#main-nav a').forEach(link => {
  link.addEventListener('click', () => {
    header.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}

// ---------- Hero: video CGI con scrubbing deterministico legato allo scroll ----------
const heroScroll = document.querySelector('.hero-scroll');
const heroVideo = document.getElementById('hero-video');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (heroScroll && heroVideo) {
  // Il fade-in avviene solo a valle del warm-up qui sotto: niente flash nero e i
  // pre-seek di preparazione restano invisibili (video ancora a opacità 0).
  function onVideoReady() {
    heroVideo.classList.add('is-ready');
  }

  // Pre-seek invisibile su alcuni punti sparsi del file, video ancora a opacità 0:
  // forza il browser a scaricare in anticipo più regioni via richieste HTTP range,
  // invece delle sole prime frazioni di secondo che il preload sequenziale coprirebbe
  // da solo. Necessario perché il file è ad alto bitrate (~5 Mbps: ogni fotogramma è
  // un I-frame per rendere economico il decode di ogni seek, ma pesante da scaricare)
  // e su rete mobile, al primissimo scroll, spesso è arrivata solo una piccola
  // porzione iniziale: un salto oltre quella porzione forza un round-trip di rete per
  // ogni seek, causando gli scatti osservati solo al primo utilizzo. Budget di tempo
  // limitato per non ritardare troppo la comparsa su reti molto lente, e annullato
  // subito se l'utente inizia davvero a scrollare (vedi onHeroScroll più sotto).
  let warmupCancel = null;
  function warmupBuffer(done) {
    const d = heroVideo.duration;
    if (!d || !isFinite(d)) { done(); return; }
    const points = [d * 0.85, d * 0.45, d * 0.65, 0];
    let i = 0;
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      heroVideo.removeEventListener('seeked', step);
      clearTimeout(budget);
      warmupCancel = null;
      done();
    }
    function step() {
      if (finished) return;
      if (i >= points.length) { finish(); return; }
      heroVideo.currentTime = points[i++];
    }
    warmupCancel = () => { heroVideo.currentTime = 0; finish(); };
    heroVideo.addEventListener('seeked', step);
    const budget = setTimeout(warmupCancel, 700);
    step();
  }

  // Priming per iOS Safari / Android Chrome: un <video> mai avviato non decodifica
  // nuovi fotogrammi quando si assegna currentTime da JS (resta bloccato sul primo
  // frame). Avviare la riproduzione (muted + playsinline non richiede gesture utente)
  // e metterla subito in pausa "sblocca" il decoder; poi parte il warm-up sopra (o,
  // per chi preferisce ridurre il movimento, la rivelazione diretta).
  let primed = false;
  function primeVideoForScrub() {
    if (primed) return;
    primed = true;
    const afterPlay = () => {
      heroVideo.pause();
      if (reduceMotion) { onVideoReady(); } else { warmupBuffer(onVideoReady); }
    };
    const playPromise = heroVideo.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(afterPlay).catch(afterPlay);
    } else {
      afterPlay();
    }
  }
  if (heroVideo.readyState >= 1) {
    primeVideoForScrub();
  } else {
    heroVideo.addEventListener('loadedmetadata', primeVideoForScrub, { once: true });
  }

  if (reduceMotion) {
    // Nessun lungo scroll-scrub: composizione finale statica, testo subito leggibile
    heroScroll.style.setProperty('--p', '1');
    function showFinalFrame() {
      heroVideo.currentTime = Math.max(0, heroVideo.duration - 0.05);
    }
    if (heroVideo.readyState >= 1) showFinalFrame();
    heroVideo.addEventListener('loadedmetadata', showFinalFrame, { once: true });
  } else {
    let ticking = false;
    let lastTime = -1;

    // currentTime = f(scroll): mappatura diretta e deterministica, nessuna inerzia.
    // Se il video non è pronto (o fallisce), --p continua comunque ad aggiornarsi:
    // testo e CTA restano utilizzabili anche senza video.
    function updateScrub() {
      ticking = false;
      const rect = heroScroll.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      const p = Math.min(Math.max(raw, 0), 1);
      heroScroll.style.setProperty('--p', p.toFixed(4));

      const d = heroVideo.duration;
      if (!d || !isFinite(d)) return;
      const t = p * d;
      if (Math.abs(t - lastTime) > 0.008) {
        heroVideo.currentTime = t;
        lastTime = t;
      }
    }
    function onHeroScroll() {
      // Lo scroll reale dell'utente ha sempre la priorità sul warm-up in corso:
      // lo interrompe subito così i due non si contendono currentTime.
      if (warmupCancel) { const cancel = warmupCancel; warmupCancel = null; cancel(); }
      if (!ticking) { requestAnimationFrame(updateScrub); ticking = true; }
    }

    // Ascolta lo scroll solo mentre la hero è vicina al viewport: zero costo altrove
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          window.addEventListener('scroll', onHeroScroll, { passive: true });
          updateScrub();
        } else {
          window.removeEventListener('scroll', onHeroScroll);
        }
      });
    }, { rootMargin: '0px' });
    heroObserver.observe(heroScroll);

    window.addEventListener('resize', updateScrub, { passive: true });
  }
}

// ---------- Menu: tab su mobile ----------
const menuTabs = document.querySelectorAll('.menu-tab');
const menuPanels = document.querySelectorAll('.menu-card');
menuTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    menuTabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    const targetId = tab.getAttribute('aria-controls');
    menuPanels.forEach(p => p.classList.toggle('is-active', p.id === targetId));
  });
});
