// The root URL ("/") renders the login page DIRECTLY — no redirect hop.
// Previously this did redirect('/login'), which meant the browser had to make
// a second request to actually see the login UI. Rendering it inline means the
// very first request to "/" returns the login page HTML.
// (Authenticated users are bounced to /dashboard by proxy.ts before this renders.)
export { default } from "./(auth)/login/page";
