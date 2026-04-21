// config.js — classic script, sets the ONE permitted global.
// API URL/env detected at runtime from hostname so one committed file works for
// both localhost (dev backend) and gcoat.io (prod backend). deploy.sh no longer
// rewrites this file per stage.
(function () {
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  window.APP_CONFIG = {
    API_BASE_URL: isLocal
      ? "https://wfott2ih7j.execute-api.us-east-1.amazonaws.com/dev"
      : "https://oz8sqtiive.execute-api.us-east-1.amazonaws.com/prod",
    ENV: isLocal ? "dev" : "prod",
    FEATURES: {
      CONTACT_FORM: true,
      BLOG: true,
      MEDIA: true
    }
  };
})();
