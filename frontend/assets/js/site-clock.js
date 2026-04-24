// site-clock.js — classic script, loaded on every page with a footer.
// Self-mounts onto #site-clock-time and updates the displayed time on
// each minute boundary (so the minute flips right as the clock ticks
// over, not a minute late). Reads the IANA timezone from the element's
// data-timezone attribute; America/St_Thomas is AST year-round (no DST).
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function mount() {
    var el = document.getElementById("site-clock-time");
    if (!el) return;

    var tz = el.dataset.timezone || "America/St_Thomas";
    var formatter;
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
      });
    } catch (e) {
      el.textContent = "-- AST";
      return;
    }

    function render() {
      try {
        var parts = formatter.formatToParts(new Date());
        var lookup = {};
        for (var i = 0; i < parts.length; i++) {
          lookup[parts[i].type] = parts[i].value;
        }
        var hh = lookup.hour || "--";
        var mm = lookup.minute || "--";
        var tzName = lookup.timeZoneName || "AST";
        el.textContent = hh + ":" + mm + " " + tzName;
      } catch (e) {
        el.textContent = "-- AST";
      }
    }

    function scheduleNext() {
      var now = new Date();
      var msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      setTimeout(function () {
        render();
        scheduleNext();
      }, msToNextMinute);
    }

    render();
    scheduleNext();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
