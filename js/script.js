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
  // Solo per il fade-in (niente flash nero): non è usato per abilitare lo scrub,
  // che legge heroVideo.duration live a ogni frame per evitare race condition.
  function onVideoReady() {
    heroVideo.classList.add('is-ready');
  }
  heroVideo.addEventListener('loadeddata', onVideoReady, { once: true });
  if (heroVideo.readyState >= 2) onVideoReady();

  // Priming per iOS Safari / Android Chrome: un <video> mai avviato non decodifica
  // nuovi fotogrammi quando si assegna currentTime da JS (resta bloccato sul primo
  // frame). Avviare la riproduzione (muted + playsinline non richiede gesture utente)
  // e metterla subito in pausa "sblocca" il decoder, poi si riporta il video a frame 0
  // così lo stato iniziale resta identico a prima dello scroll.
  let primed = false;
  function primeVideoForScrub() {
    if (primed) return;
    primed = true;
    const resetFrame = () => { heroVideo.pause(); heroVideo.currentTime = 0; };
    const playPromise = heroVideo.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(resetFrame).catch(() => {});
    } else {
      resetFrame();
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
