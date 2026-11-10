/* Site vitrine : comportements légers, sans dépendance.
   Thème clair/sombre (localStorage, sans cookie), menu mobile,
   apparitions au scroll, champ de recherche animé sur l'accueil.
   Tout mouvement est coupé si prefers-reduced-motion est actif. */
(function () {
  'use strict';
  window.__site = 1;

  var racine = document.documentElement;
  var sysSombre = window.matchMedia('(prefers-color-scheme: dark)');
  var sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Thème ---------- */
  function memoriser(valeur) {
    try {
      if (valeur) localStorage.setItem('theme', valeur);
      else localStorage.removeItem('theme');
    } catch (e) { /* stockage indisponible : le choix vaut pour la page */ }
  }

  function themeEffectif() {
    return racine.getAttribute('data-theme') || (sysSombre.matches ? 'dark' : 'light');
  }

  var boutonTheme = document.querySelector('.theme');

  function majBouton() {
    if (!boutonTheme) return;
    var sombre = themeEffectif() === 'dark';
    boutonTheme.classList.toggle('est-sombre', sombre);
    boutonTheme.setAttribute('aria-label', sombre ? 'Passer en thème clair' : 'Passer en thème sombre');
  }

  function appliquer(theme) {
    var systeme = sysSombre.matches ? 'dark' : 'light';
    // Si le choix rejoint le réglage du système, on revient au mode automatique.
    if (theme === systeme) {
      racine.removeAttribute('data-theme');
      memoriser(null);
    } else {
      racine.setAttribute('data-theme', theme);
      memoriser(theme);
    }
    majBouton();
  }

  if (boutonTheme) {
    majBouton();
    boutonTheme.addEventListener('click', function () {
      var suivant = themeEffectif() === 'dark' ? 'light' : 'dark';

      if (sansMouvement.matches) { appliquer(suivant); return; }

      // Le nouveau thème s'ouvre en cercle depuis le bouton.
      if (document.startViewTransition) {
        var r = boutonTheme.getBoundingClientRect();
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        var rayon = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        var transition = document.startViewTransition(function () { appliquer(suivant); });
        transition.ready.then(function () {
          racine.animate(
            { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rayon + 'px at ' + x + 'px ' + y + 'px)'] },
            { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(function () {});
        return;
      }

      // Repli : fondu des couleurs.
      racine.classList.add('theme-anim');
      appliquer(suivant);
      setTimeout(function () { racine.classList.remove('theme-anim'); }, 500);
    });

    var suivreSysteme = function () { majBouton(); };
    if (sysSombre.addEventListener) sysSombre.addEventListener('change', suivreSysteme);
    else if (sysSombre.addListener) sysSombre.addListener(suivreSysteme);
  }

  /* ---------- En-tête : filet discret une fois la page défilée ---------- */
  var entete = document.querySelector('.entete');
  if (entete) {
    var attente = false;
    var surDefilement = function () {
      if (attente) return;
      attente = true;
      requestAnimationFrame(function () {
        entete.classList.toggle('est-defile', window.scrollY > 4);
        attente = false;
      });
    };
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
  }

  /* ---------- Menu mobile ---------- */
  var boutonMenu = document.querySelector('.menu-btn');
  var nav = document.getElementById('menu');
  if (boutonMenu && nav) {
    var ouvrir = function (ouvert) {
      racine.classList.toggle('menu-ouvert', ouvert);
      boutonMenu.setAttribute('aria-expanded', String(ouvert));
      boutonMenu.textContent = ouvert ? 'Fermer' : 'Menu';
    };
    boutonMenu.addEventListener('click', function () {
      ouvrir(boutonMenu.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) ouvrir(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && racine.classList.contains('menu-ouvert')) {
        ouvrir(false);
        boutonMenu.focus();
      }
    });
    var large = window.matchMedia('(min-width: 48em)');
    var surLargeur = function () { if (large.matches) ouvrir(false); };
    if (large.addEventListener) large.addEventListener('change', surLargeur);
    else if (large.addListener) large.addListener(surLargeur);
  }

  /* ---------- Apparitions au scroll (une seule fois) ---------- */
  var aReveler = document.querySelectorAll('[data-reveal]');
  var poser = function (el) {
    el.classList.add('est-visible');
    // Après l'apparition, les cartes retrouvent un survol sans délai.
    setTimeout(function () { el.classList.add('est-posee'); }, 1200);
  };
  if (!('IntersectionObserver' in window) || sansMouvement.matches) {
    Array.prototype.forEach.call(aReveler, poser);
  } else {
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting) {
          poser(entree.target);
          observateur.unobserve(entree.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    Array.prototype.forEach.call(aReveler, function (el) { observateur.observe(el); });
  }

  /* ---------- Accueil : recherches qui s'écrivent ---------- */
  var champ = document.querySelector('.recherche__texte');
  if (champ && !sansMouvement.matches) {
    var requetes = [
      'plombier près de chez moi',
      'boulangerie ouverte dimanche',
      'quel comptable pour une TPE ?',
      'électricien disponible aujourd’hui',
      'coiffeur près de moi'
    ];
    var n = 0;
    var pos = requetes[0].length;
    var efface = true;
    var visible = true;
    var minuteur = null;

    var pas = function () {
      minuteur = null;
      if (!visible || document.hidden) return;
      var texte = requetes[n];
      var delai;
      if (efface) {
        pos -= 1;
        delai = 28;
        if (pos <= 0) { pos = 0; efface = false; n = (n + 1) % requetes.length; delai = 380; }
      } else {
        pos += 1;
        delai = 55 + Math.random() * 45;
        if (pos >= texte.length) { pos = texte.length; efface = true; delai = 2200; }
      }
      champ.textContent = requetes[n].slice(0, pos) || ' ';
      minuteur = setTimeout(pas, delai);
    };
    var relancer = function () { if (!minuteur && visible && !document.hidden) minuteur = setTimeout(pas, 400); };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        relancer();
      }).observe(champ);
    }
    document.addEventListener('visibilitychange', relancer);
    minuteur = setTimeout(pas, 2400);
  }
})();
