import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function requireMarker(file, content, marker, label = marker) {
  if (!content.includes(marker)) {
    throw new Error(`${file} is missing hosted Auth marker: ${label}`);
  }
}

function requireBefore(file, content, first, second) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
    throw new Error(`${file} must keep ${first} before ${second}`);
  }
}

const callbackFile = "public/auth-callback.html";
const callback = read(callbackFile);
requireMarker(callbackFile, callback, "new URLSearchParams(rawFragment)", "fragment parser");
requireMarker(callbackFile, callback, "fragment.get(\"access_token\")", "access token fragment read");
requireMarker(callbackFile, callback, "fragment.get(\"state\")", "state fragment read");
requireMarker(callbackFile, callback, "marketing_auth_state", "state cookie");
requireMarker(callbackFile, callback, "returnedState !== expectedState", "state comparison");
requireMarker(callbackFile, callback, "window.history.replaceState(null, document.title, window.location.pathname + window.location.search)", "fragment stripping via replaceState");
requireMarker(callbackFile, callback, "document.cookie = cookieName + \"=\" + encodeURIComponent(accessToken)", "admin token cookie write");
requireMarker(callbackFile, callback, "window.location.replace(\"/admin\")", "admin redirect");
requireBefore(callbackFile, callback, "window.history.replaceState", "document.cookie = cookieName");
requireBefore(callbackFile, callback, "window.history.replaceState", "window.location.replace(\"/admin\")");

const mainFile = "src/main.ts";
const main = read(mainFile);
requireMarker(mainFile, main, "app.get(\"/auth/login\"", "login redirect route");
requireMarker(mainFile, main, "app.get(\"/auth/register\"", "register redirect route");
requireMarker(mainFile, main, "app.get(\"/auth/callback\"", "callback route");
requireMarker(mainFile, main, "url.searchParams.set(\"return_url\", `${marketingBaseUrl}/auth/callback`)", "callback return_url");
requireMarker(mainFile, main, "url.searchParams.set(\"client_id\", \"marketing-microservice\")", "client_id");
requireMarker(mainFile, main, "authStateCookie(state)", "state cookie issuance");

console.log("Hosted Auth static markers passed");
