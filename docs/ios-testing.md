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
  <dict>
    <key>192.168.0.42</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
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

## 6. Debugging & Iteration

- Each time you rebuild the web assets, run `npx cap copy ios` and rebuild in Xcode.
- Use Safari (macOS) > **Develop** > *Your Device* > *App* to inspect the WKWebView console/network.
- Ensure the relay and dev server stay running so the device can connect.

## 7. Quick Checklist

- [ ] `npm run build` completed and `dist/` copied to Mac.
- [ ] Capacitor project created, `npx cap sync ios` run.
- [ ] `VITE_RELAY_URL` (and other hosts) point to a reachable IP/tunnel.
- [ ] ATS exceptions added if using HTTP.
- [ ] Xcode project signed with free developer account.
- [ ] Device connected and app deployed successfully.
