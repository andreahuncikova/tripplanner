// The start-up animation, only when the app is opened from the phone's home screen (installed PWA), not in a browser
// tab. It shows at once from index.html, before React has loaded, and fades out when both are true: the app is
// ready (main.tsx sends 'app-ready') and the animation has played. It never stays longer than MAX_MS.
// In its own file, because the Content-Security-Policy in vercel.json allows no inline scripts.
(function () {
  var installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  var splash = document.getElementById('splash')
  if (!splash) return
  if (!installed) { splash.remove(); return }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var MIN_MS = still ? 400 : 1100   // the animation's length
  var MAX_MS = 3000                 // a slow network never keeps the logo on screen longer than this
  var start = Date.now()
  var ready = false
  var gone = false

  document.documentElement.classList.add('splash-on')

  function hide() {
    if (gone) return
    gone = true
    splash.classList.add('splash-out')
    setTimeout(function () {
      splash.remove()
      document.documentElement.classList.remove('splash-on')
    }, 400)
  }
  function maybeHide() {
    if (ready) setTimeout(hide, Math.max(0, MIN_MS - (Date.now() - start)))
  }

  window.addEventListener('app-ready', function () { ready = true; maybeHide() }, { once: true })
  setTimeout(hide, MAX_MS)
})()
