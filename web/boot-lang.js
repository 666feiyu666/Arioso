// First-paint language for every page.
//
// The server stamps the reader's language on <html lang=".." data-ari-lang="..">,
// but the markup itself is written in the default language (zh-CN) and is
// translated by the page script once it runs. When the reader chose English,
// hold the translatable text back until that script has applied the dictionary,
// so switching pages never shows one language and then the other.
(function () {
  var root = document.documentElement;
  var language = root.getAttribute("data-ari-lang");
  if (language !== "en" && language !== "zh-CN") return;
  root.lang = language;
  if (language === "zh-CN") return;

  var style = document.createElement("style");
  style.textContent =
    "html[data-ari-lang-pending] [data-i18n]," +
    "html[data-ari-lang-pending] [data-i18n-aria-label]{visibility:hidden}";
  document.head.appendChild(style);
  root.setAttribute("data-ari-lang-pending", "");

  var ready = function () {
    root.removeAttribute("data-ari-lang-pending");
  };
  // A page script that never runs must not leave the text hidden.
  setTimeout(ready, 1500);
  window.ariosoLanguageReady = ready;
})();
