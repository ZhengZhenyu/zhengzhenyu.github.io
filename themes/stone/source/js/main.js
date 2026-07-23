/* ══════════════════════════════════════════════════════════════ */
/*  Stone Theme — Minimal Client-Side JavaScript                */
/*  Zero dependencies. Handles: nav, theme toggle, TOC, back-top */
/* ══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ── 1. Mobile Nav Toggle ────────────────────────────────────
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function() {
      nav.classList.toggle('open');
    });

    // Close nav when clicking a link
    nav.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function() {
        nav.classList.remove('open');
      });
    });
  }

  // ── 2. Theme Toggle (light / dark / auto) ──────────────────
  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme');
      var next;
      if (!current) {
        // No explicit theme → go dark
        next = 'dark';
      } else if (current === 'dark') {
        // Dark → light
        next = 'light';
      } else {
        // Light → remove (auto/system)
        next = null;
      }

      if (next) {
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('theme');
      }
    });

    // Listen for system preference changes
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        if (!localStorage.getItem('theme')) {
          // User hasn't set explicit preference, follow system
          document.documentElement.removeAttribute('data-theme');
        }
      });
    } catch(e) {}
  }

  // ── 3. TOC Active Section Tracking ─────────────────────────
  var tocNav = document.getElementById('toc-nav');
  if (tocNav) {
    // Build TOC from headings
    var headings = document.querySelectorAll('.post-body h2, .post-body h3');
    if (headings.length > 0) {
      var tocHtml = '';
      headings.forEach(function(h, i) {
        var id = h.getAttribute('id');
        if (!id) {
          id = 'heading-' + i;
          h.setAttribute('id', id);
        }
        var indent = h.tagName === 'H3' ? ' style="padding-left: 16px; font-size: 0.8rem;"' : '';
        tocHtml += '<a href="#' + id + '"' + indent + '>' + h.textContent + '</a>';
      });
      tocNav.innerHTML = tocHtml;

      // Scroll spy
      var tocLinks = tocNav.querySelectorAll('a');
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            tocLinks.forEach(function(a) {
              a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
            });
          }
        });
      }, { rootMargin: '-72px 0px -80% 0px' });

      headings.forEach(function(h) { observer.observe(h); });
    } else {
      // No headings, hide TOC sidebar
      var sidebar = document.querySelector('.post-sidebar');
      if (sidebar) { sidebar.style.display = 'none'; }
    }
  }

  // ── 4. Back to Top Button ──────────────────────────────────
  var backTop = document.createElement('button');
  backTop.className = 'back-top';
  backTop.innerHTML = '↑';
  backTop.setAttribute('aria-label', 'Back to top');
  backTop.title = '回到顶部';
  document.body.appendChild(backTop);

  var scrollTimer;
  window.addEventListener('scroll', function() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function() {
      scrollTimer = null;
      if (window.scrollY > 400) {
        backTop.classList.add('show');
      } else {
        backTop.classList.remove('show');
      }
    }, 100);
  }, { passive: true });

  backTop.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── 5. Table of Contents (TOC) ─────────────────────────────
  //   If the page contains <h2> or <h3> elements, render them
  //   into a sidebar nav with active-section tracking.
  //   Implementation in section 3 above.

})();
