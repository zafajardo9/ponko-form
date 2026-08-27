/** PonkoForm popup loader — dependency-free host runtime. */
(function () {
  'use strict'

  var script = document.currentScript
  var popupId = script && script.getAttribute('data-popup')
  if (!popupId) return

  var ORIGIN
  try { ORIGIN = new URL(script.src).origin } catch (_) { ORIGIN = window.location.origin }
  var API = ORIGIN + '/api/popups/' + encodeURIComponent(popupId)
  var OWNER_PREVIEW = script.getAttribute('data-popup-owner-preview') === 'true'
  var IS_PREVIEW = Boolean(script.getAttribute('data-popup-preview'))
  var WORDPRESS_ADMIN_TEST = script.getAttribute('data-popup-wordpress-admin-test') === 'true'
  var SESSION_KEY = 'ponkoform:popup:' + popupId + ':session'
  var VIEW_KEY = 'ponkoform:popup:' + popupId + ':viewed'
  var LAST_SHOWN_KEY = 'ponkoform:popup:' + popupId + ':lastShown'
  var REGISTRY_KEY = '__ponkoformPopupInstances'
  var registry = window[REGISTRY_KEY] || (window[REGISTRY_KEY] = {})
  if (registry[popupId]) registry[popupId].destroy()

  var mobile = window.matchMedia('(max-width: 639px)')
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  var cfg = null
  var overlayEl = null
  var positionEl = null
  var boxEl = null
  var frameEl = null
  var visible = false
  var triggerFired = false
  var frameReady = false
  var destroyed = false
  var previousFocus = null
  var previousOverflow = ''
  var cleanups = []
  var timers = []

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options)
    cleanups.push(function () { target.removeEventListener(type, handler, options) })
  }

  function later(fn, delay) {
    var id = window.setTimeout(fn, delay)
    timers.push(id)
    return id
  }

  function storageGet(storage, key) {
    try { return storage.getItem(key) } catch (_) { return null }
  }

  function storageSet(storage, key, value) {
    try { storage.setItem(key, value) } catch (_) {}
  }

  function safeLink(value) {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
      var url = new URL(value.trim(), window.location.href)
      return /^(https?:|mailto:|tel:)$/.test(url.protocol) ? url.href : null
    } catch (_) { return null }
  }

  function isTestMode() {
    return IS_PREVIEW || Boolean(
      WORDPRESS_ADMIN_TEST &&
      document.body &&
      document.body.classList.contains('logged-in')
    )
  }

  function testModeLink(value) {
    if (!isTestMode()) return value
    try {
      var url = new URL(value)
      var isPonkoForm = url.origin === ORIGIN && /^\/forms\/(submit|embed)\//.test(url.pathname)
      if (!isPonkoForm) return value
      url.searchParams.set('ponkoTest', IS_PREVIEW ? 'popup-preview' : 'wordpress-admin')
      return url.href
    } catch (_) { return value }
  }

  var PLACEMENTS = {
    center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'top-left': { top: '24px', left: '24px' },
    'top-right': { top: '24px', right: '24px' },
    'bottom-left': { bottom: '24px', left: '24px' },
    'bottom-right': { bottom: '24px', right: '24px' },
    fullscreen: { top: '0', right: '0', bottom: '0', left: '0' },
  }

  function resetPositionStyles(style) {
    ;['top', 'right', 'bottom', 'left', 'width', 'height', 'transform'].forEach(function (name) { style[name] = '' })
  }

  function applyViewport() {
    if (!positionEl || !frameEl || !cfg) return
    var style = positionEl.style
    resetPositionStyles(style)
    if (mobile.matches && cfg.placement !== 'fullscreen') {
      var scale = Math.min(1, (window.innerWidth - 16) / cfg.width)
      Object.assign(style, { right: '0', bottom: '0', left: '0', width: '100%', height: Math.round(cfg.height * scale) + 'px' })
      Object.assign(frameEl.style, { width: cfg.width + 'px', height: cfg.height + 'px', transform: 'scale(' + scale + ')', transformOrigin: 'top left' })
      return
    }
    Object.assign(style, PLACEMENTS[cfg.placement] || PLACEMENTS.center)
    style.width = cfg.placement === 'fullscreen' ? '100vw' : cfg.width + 'px'
    style.height = cfg.placement === 'fullscreen' ? '100vh' : cfg.height + 'px'
    Object.assign(frameEl.style, { width: '100%', height: '100%', transform: 'none' })
  }

  function animationStart() {
    if (reducedMotion.matches) return 'none'
    var animation = cfg && cfg.style && cfg.style.animation
    if (animation === 'zoom') return 'scale(0.92)'
    if (animation === 'slide-up') return 'translateY(24px)'
    return 'none'
  }

  function sendShow() {
    if (!frameReady || !frameEl || !frameEl.contentWindow) return
    frameEl.contentWindow.postMessage({ type: 'ponkoform:popup:show', popupId: popupId }, ORIGIN)
  }

  function build() {
    var style = cfg.style || {}
    overlayEl = document.createElement('div')
    overlayEl.className = 'ponko-popup-overlay'
    Object.assign(overlayEl.style, { position: 'fixed', inset: '0', zIndex: '99998', display: 'none', opacity: '0', background: style.overlayColor || '#141413', transition: reducedMotion.matches ? 'none' : 'opacity 200ms ease' })

    positionEl = document.createElement('div')
    positionEl.className = 'ponko-popup-position'
    positionEl.setAttribute('role', 'dialog')
    positionEl.setAttribute('aria-modal', 'true')
    positionEl.setAttribute('aria-label', cfg.title || 'Popup')
    positionEl.setAttribute('tabindex', '-1')
    Object.assign(positionEl.style, { position: 'fixed', zIndex: '99999', display: 'none' })

    boxEl = document.createElement('div')
    boxEl.className = 'ponko-popup-box'
    Object.assign(boxEl.style, { width: '100%', height: '100%', opacity: '0', transform: animationStart(), transition: reducedMotion.matches ? 'none' : 'opacity 200ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' })

    frameEl = document.createElement('iframe')
    frameEl.src = ORIGIN + '/popups/' + encodeURIComponent(popupId) + '/embed' + (OWNER_PREVIEW ? '?preview=owner' : '')
    frameEl.title = cfg.title || 'PonkoForm popup'
    frameEl.setAttribute('loading', 'lazy')
    Object.assign(frameEl.style, { border: '0', display: 'block', borderRadius: String(style.borderRadius == null ? 16 : style.borderRadius) + 'px', background: style.backgroundColor || '#ffffff' })

    boxEl.appendChild(frameEl)
    positionEl.appendChild(boxEl)
    document.body.appendChild(overlayEl)
    document.body.appendChild(positionEl)
    applyViewport()
    if (style.closeOnOverlayClick !== false) listen(overlayEl, 'click', hide)
    if (mobile.addEventListener) listen(mobile, 'change', applyViewport)
    else {
      mobile.addListener(applyViewport)
      cleanups.push(function () { mobile.removeListener(applyViewport) })
    }
  }

  function show() {
    if (!cfg || visible || destroyed) return
    visible = true
    previousFocus = document.activeElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    overlayEl.style.display = 'block'
    positionEl.style.display = 'block'
    boxEl.style.transform = animationStart()
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!visible) return
        overlayEl.style.opacity = String(cfg.style && cfg.style.overlayOpacity != null ? cfg.style.overlayOpacity : 0.5)
        boxEl.style.opacity = '1'
        boxEl.style.transform = 'none'
        positionEl.focus({ preventScroll: true })
      })
    })
    sendShow()
    if (!isTestMode()) storageSet(localStorage, LAST_SHOWN_KEY, String(Date.now()))
    if (!isTestMode() && !storageGet(sessionStorage, VIEW_KEY)) {
      storageSet(sessionStorage, VIEW_KEY, '1')
      if (navigator.sendBeacon) navigator.sendBeacon(API + '/view')
    }
  }

  function hide() {
    if (!visible) return
    visible = false
    overlayEl.style.opacity = '0'
    boxEl.style.opacity = '0'
    boxEl.style.transform = reducedMotion.matches ? 'none' : 'scale(0.96)'
    later(function () {
      if (visible || destroyed) return
      overlayEl.style.display = 'none'
      positionEl.style.display = 'none'
      document.body.style.overflow = previousOverflow
      if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true })
    }, reducedMotion.matches ? 0 : 220)
  }

  function isAllowed() {
    if (isTestMode() || cfg.frequency === 'every-visit') return true
    if (cfg.frequency === 'once-per-session') return !storageGet(sessionStorage, SESSION_KEY)
    var last = Number(storageGet(localStorage, LAST_SHOWN_KEY) || 0)
    if (!last) return true
    var days = cfg.frequency === 'once-per-day' ? 1 : 7
    return Date.now() - last >= days * 86400000
  }

  function isScheduleAllowed() {
    if (isTestMode() || !cfg.schedule) return true
    var schedule = cfg.schedule
    var now = new Date()
    var timestamp = now.getTime()
    var starts = schedule.startAt ? Date.parse(schedule.startAt) : NaN
    var ends = schedule.endAt ? Date.parse(schedule.endAt) : NaN
    if (Number.isFinite(starts) && timestamp < starts) return false
    if (Number.isFinite(ends) && timestamp >= ends) return false
    if (!schedule.dailyStart || !schedule.dailyEnd) return true

    function toMinutes(value) {
      var parts = value.split(':')
      return Number(parts[0]) * 60 + Number(parts[1])
    }

    var current = now.getHours() * 60 + now.getMinutes()
    var start = toMinutes(schedule.dailyStart)
    var end = toMinutes(schedule.dailyEnd)
    if (start === end) return true
    return start < end
      ? current >= start && current < end
      : current >= start || current < end
  }

  function maybeShow(force) {
    // Scheduling is a campaign-level gate, so manual triggers cannot expose a
    // live popup outside its window. Builder previews intentionally bypass it.
    if (!isScheduleAllowed()) return
    if ((!force && triggerFired) || (!force && !isAllowed())) return
    triggerFired = true
    if (!isTestMode()) storageSet(sessionStorage, SESSION_KEY, '1')
    show()
  }

  function registerTrigger() {
    var trigger = cfg.trigger
    if (trigger.type === 'on-load') later(maybeShow, Math.max(0, Number(trigger.delayMs) || 0))
    else if (trigger.type === 'exit-intent') listen(document, 'mouseout', function (event) { if (event.relatedTarget === null && event.clientY <= 8) maybeShow() })
    else if (trigger.type === 'scroll-depth') {
      var onScroll = function () {
        var doc = document.documentElement
        var max = doc.scrollHeight - window.innerHeight
        var percent = Math.min(100, Math.max(1, Number(trigger.percent) || 50))
        if (max > 0 && (window.scrollY || doc.scrollTop) / max * 100 >= percent) maybeShow()
      }
      listen(window, 'scroll', onScroll, { passive: true })
      onScroll()
    } else if (trigger.type === 'click-element') {
      listen(document, 'click', function (event) {
        try { if (event.target && event.target.closest && event.target.closest(trigger.selector)) maybeShow() } catch (_) {}
      })
    }
    listen(document, 'ponkoform:popup:trigger', function (event) { if (!event.detail || event.detail.popupId === popupId) maybeShow(true) })
  }

  function onMessage(event) {
    if (!frameEl || event.origin !== ORIGIN || event.source !== frameEl.contentWindow) return
    var data = event.data
    if (!data || typeof data !== 'object' || data.popupId !== popupId) return
    if (data.type === 'ponkoform:popup:ready') {
      frameReady = true
      if (visible) sendShow()
    } else if (data.type === 'ponkoform:popup:click') {
      var link = safeLink(data.link)
      if (!link) return
      link = testModeLink(link)
      if (!isTestMode() && navigator.sendBeacon) navigator.sendBeacon(API + '/click')
      if (data.newTab) window.open(link, '_blank', 'noopener,noreferrer')
      else window.top.location.href = link
      hide()
    } else if (data.type === 'ponkoform:popup:close') hide()
    else if (data.type === 'ponkoform:resize' && Number(data.height) > 0) {
      var height = Math.min(4000, Math.round(Number(data.height)))
      if (cfg.placement !== 'fullscreen') {
        frameEl.style.height = height + 'px'
        if (!mobile.matches) positionEl.style.height = height + 'px'
      }
    }
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    timers.forEach(window.clearTimeout)
    cleanups.forEach(function (cleanup) { cleanup() })
    if (overlayEl) overlayEl.remove()
    if (positionEl) positionEl.remove()
    if (visible) document.body.style.overflow = previousOverflow
    if (registry[popupId] && registry[popupId].destroy === destroy) delete registry[popupId]
  }

  registry[popupId] = { destroy: destroy, show: function () { maybeShow(true) }, hide: hide }
  listen(window, 'message', onMessage)
  listen(document, 'keydown', function (event) { if (event.key === 'Escape') hide() })
  listen(window, 'pagehide', destroy)

  function fetchConfig(ownerPreview) {
    return fetch(API + '/config' + (ownerPreview ? '?preview=owner' : ''), { credentials: ownerPreview ? 'same-origin' : 'omit' })
      .then(function (response) { if (!response.ok) throw new Error('config ' + response.status); return response.json() })
  }

  fetchConfig(OWNER_PREVIEW)
    .catch(function (error) { return OWNER_PREVIEW ? fetchConfig(false) : Promise.reject(error) })
    .then(function (data) {
      cfg = data
      build()
      registerTrigger()
      document.dispatchEvent(new CustomEvent('ponkoform:popup:loader-ready', { detail: { popupId: popupId } }))
    })
    .catch(function () {
      document.dispatchEvent(new CustomEvent('ponkoform:popup:loader-error', { detail: { popupId: popupId } }))
      destroy()
    })
})()
