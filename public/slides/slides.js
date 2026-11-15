// FieldShift presentation deck — navigation helpers.
// Scroll-spy for the dot rail, plus arrow / page keys to move between slides.

(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.dots a'));
  if (!slides.length) return;

  function activate(index) {
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === index);
    });
  }

  // Scroll spy — the slide whose top is closest to the viewport top wins.
  function spy() {
    var best = 0;
    var bestDistance = Infinity;
    slides.forEach(function (slide, i) {
      var distance = Math.abs(slide.getBoundingClientRect().top);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    activate(best);
  }

  var ticking = false;
  window.addEventListener(
    'scroll',
    function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        spy();
        ticking = false;
      });
    },
    { passive: true }
  );

  // Keyboard navigation
  function currentIndex() {
    var best = 0;
    var bestDistance = Infinity;
    slides.forEach(function (slide, i) {
      var distance = Math.abs(slide.getBoundingClientRect().top);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  document.addEventListener('keydown', function (event) {
    var index = currentIndex();
    var next = null;

    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === 'ArrowRight') {
      next = Math.min(slides.length - 1, index + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'ArrowLeft') {
      next = Math.max(0, index - 1);
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = slides.length - 1;
    }

    if (next !== null) {
      event.preventDefault();
      slides[next].scrollIntoView({ behavior: 'smooth' });
    }
  });

  spy();
})();
