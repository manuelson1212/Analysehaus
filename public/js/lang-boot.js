// Runs before the page paints: picks the language (saved choice, else browser language) so English
// visitors do not see a flash of German text. i18n.js removes the "lang-pending" class once translated.
(function () {
  var lang = 'de';
  try { var saved = localStorage.getItem('awc-lang'); if (saved === 'de' || saved === 'en') lang = saved; else if (!/^de\b/i.test(navigator.language || 'de')) lang = 'en'; }
  catch (e) { if (!/^de\b/i.test(navigator.language || 'de')) lang = 'en'; }
  var root = document.documentElement;
  root.lang = lang;
  if (lang === 'en') { root.classList.add('lang-pending'); setTimeout(function () { root.classList.remove('lang-pending'); }, 1500); }
})();
