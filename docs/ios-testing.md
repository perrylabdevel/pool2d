# iOS Testing Instructions for RailRush

This guide covers how to run the RailRush web build on a physical iOS device using a free Apple developer account and a Mac.

## 1. Build the Web Bundle

1. On your primary dev machine run `npm run build` to produce the production bundle in `dist/`.
2. Copy the entire `dist/` folder to your MacBook Air (AirDrop, git, or shared drive).

## 2. Create the iOS Wrapper (Capacitor)

1. On the Mac, initialize a Capacitor project:
   ```sh
   npm create @capacitor/app@latest
   ```
   Choose any starter (Vanilla works).
2. Replace the generated `www/` contents with the copied `dist/` files.
3. Sync Capacitor so it generates the iOS workspace:
   ```sh
   npx cap sync ios
   ```

## 3. Configure WebSocket/HTTP Hosts

### Default behavior
The app currently points RemoteBridge and asset fetches to `http://localhost` / `ws://localhost:8080`. On a device, "localhost" refers to the device itself, so the connection fails.

### Update the host
Pick one of these options and set it **before** `npm run build`:

| Option | What to do | Pros | Cons |
| --- | --- | --- | --- |
| **Same Wi‑Fi LAN** | Find your dev PC's LAN IP (e.g. `192.168.0.42`). Update any `localhost` URLs in config/env to use `http://192.168.0.42:5173` and `ws://192.168.0.42:8080`. | No extra services, lowest latency. | Only works on the same network; must allow ATS exceptions for the IP.|
| **Tunnels (ngrok, Cloudflare, etc.)** | Run a tunnel for the dev server and relay (`ngrok http 5173`, `ngrok http 8080`). Use the HTTPS/WSS URLs in config. | Works off-network; HTTPS avoids ATS changes. | Extra latency, must keep tunnel running.|
| **Embedded relay (future)** | Build a Swift relay that proxies internally. | Works offline. | Requires native coding; not planned yet.|

### How to pass the host into the build
1. Create a   env variable (e.g. `VITE_RELAY_URL`).
2. Update `RemoteBridge.ts` to use `import.meta.env.VITE_RELAY_URL` with a fallback.
3. Before each production build, set `.env.production` with the reachable host.
4. After `npm run build`, continue with Capacitor sync.

## 4. Allow the network URLs (ATS)
If you are using raw HTTP (LAN IP), add an App Transport Security exception in `ios/App/App/Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
  <key>NSExceptionDomains</key>
    <!-- Your IP here -->
  </dict>
</dict>
```

For tunnels with HTTPS/WSS, ATS changes are usually not needed.

## 5. Build & Run in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode.
2. In the target settings, pick your personal (free) Apple ID under **Signing & Capabilities**.
3. Set a unique Bundle Identifier (e.g. `com.yourname.railrushdev`).
4. Plug in the iPhone/iPad and trust the computer.
5. Select the device in Xcode's run scheme and press **▶︎ Run**.

Xcode will build, sign (free provisioning lasts seven days), and install the app on the device.

## 6. Sideloading via IPA (Free Account)

If you cannot use Xcode directly (e.g. debugging from a different machine), you can create an IPA manually:

1.  Run `npm run build:ios`.
2.  Open `ios/App` in Finder.
3.  Create a folder named `Payload`.
4.  Move `App.app` (from DerivedData or build output) into `Payload`.
    *   *Note: Finding `App.app` without archiving can be tricky. It's usually in `~/Library/Developer/Xcode/DerivedData/...`*
    *   **Better method:** Just select "Any iOS Device" in Xcode, Build (Cmd+B), then look in the `Products` folder in Xcode's sidebar, right-click `App.app` -> Show in Finder.
5.  Compress `Payload` into `Payload.zip`.
6.  Rename `Payload.zip` to `RailRush.ipa`.
7.  Sideload using AltStore or similar tools.

## 7. Troubleshooting Common iOS Issues

### App Crashes Immediately on Launch
1.  **Missing Permissions:** Even for `ws://localhost`, iOS 14+ may require Local Network permission if it detects scanning.
    *   **Fix:** Add `NSLocalNetworkUsageDescription` and `NSBonjourServices` (`_http._tcp`) to `Info.plist`.
2.  **RemoteBridge Failure:** Connecting to `ws://localhost` on a real device fails (connection refused). If strict error handling is missing, this crashes the app.
    *   **Fix:** Disable RemoteBridge on iOS using `Capacitor.getPlatform() !== 'ios'`.

### App Loops/Restarts During Loading
*   **Cause:** Writing large files (e.g. 16MB FBX models) to `IndexedDB` can cause Jetsam (iOS memory manager) to kill the WebContent process.
*   **Fix:** Disable asset caching on iOS in `AssetCache.ts`. Use direct `fetch` instead.

### Touch Input Not Working
*   **Cause:** Calling `e.preventDefault()` on `touchstart` or `touchend` global listeners blocks standard click entry on iOS.
*   **Fix:** Ensure `InputManager` only prevents default when in `UIState.IN_GAME`.

### Debugging on Device (Red Screen of Death)
Since you can't see the console without Safari Web Inspector (which requires a Mac cable connection), use an on-screen error handler:
```html
<script>
window.onerror = function(msg, url, line) {
  document.body.innerHTML = '<div style="color:red;background:black;padding:20px;">' + msg + '</div>';
}
</script>
```

## 8. Quick Checklist

- [ ] `npm run build` completed and `dist/` copied to Mac.
- [ ] Capacitor project created, `npx cap sync ios` run.
- [ ] `VITE_RELAY_URL` (and other hosts) point to a reachable IP/tunnel.
- [ ] ATS exceptions added if using HTTP.
- [ ] `NSLocalNetworkUsageDescription` added to `Info.plist`.
- [ ] Xcode project signed with free developer account.
- [ ] Device connected and app deployed successfully.

## 9. Mobile (Phone) Layout Optimization Plan

While iPad layouts are generally "good enough", phone screens (iPhone SE, 14, 15 Max) suffer from cramped headers, overlapping buttons, and small touch targets.

### Objective
Create a dedicated mobile experience that feels native, not just "shrunk down".

### Phase 1: Audit & Analysis
1.  **Identify Broken Areas:**
    *   **HUD:** Header too wide? Text too small (`8px`)? Buttons hard to tap?
    *   **Lobby:** 2-column grid might be too tight on narrow screens (`375px`).
    *   **Menus:** Close buttons overlap with Dynamic Island/Notch?
    *   **Game Area:** Table margins too small for "edge swipes"?
2.  **Test Devices:**
    *   iPhone SE (375x667) - Critical constraint.
    *   iPhone 15 Pro (393x852) - Dynamic Island awareness.
    *   iPhone 15 Pro Max (430x932) - "Tablet-lite".

### Phase 2: Implementation Strategy

#### A. Global Styles (`base.css` / `responsive.css`)
*   [ ] **Safe Area Variables:** Ensure `--sat`, `--sab`, `--sal`, `--sar` are correctly populated by Capacitor and applied to `body` padding.
*   [ ] **Font Scaling:** Use `clamp()` for font sizes or define specific `--font-size-base` for mobile.

#### B. Component Overrides

**1. HUD (`hud.css`)**
*   [ ] **Compact Layout:** Switch Player Cards to stack vertically or hide non-essential stats (e.g. "Winning Streak") on phone.
*   [ ] **Touch Targets:** Ensure Menu button is at least `44x44px`.
*   [ ] **Status Bars:** Hide "FPS/UPS" on mobile production builds.

**2. Lobby (`LobbyScene.ts`)**
*   [ ] **Single Column Mode:** For width < 400px, force 1-column layout for Cards.
*   [ ] **Card Height:** Increase height slightly to accommodate larger touch interactions.
*   [ ] **Thumbnails:** Ensure icons/thumbnails are legible at small sizes.

**3. Game Controls**
*   [ ] **Cue Control:** Ensure the "drag to aim" area is not obstructed by the browser bottom bar (if noticeable) or Home indicator.
*   [ ] **Fine Tuner:** Make the fine-tuning wheel larger or move it to a more thumb-accessible corner.

### Phase 3: Testing Protocol
1.  Run on Simulator: iPhone SE (3rd gen).
2.  Run on Simulator: iPhone 15 Pro.
3.  Check layout against safe areas (Notch/Island).
4.  Verify no buttons are "cut off" by rounded corners.
