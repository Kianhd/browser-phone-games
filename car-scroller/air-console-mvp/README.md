# Air-Console MVP (Pong Remix)

## Quick local run
1. Install:
   ```bash
   npm install
   ```

2. Start:
   ```bash
   npm start
   ```

3. Open http://localhost:3000/ in your desktop browser (this is the TV).
   Open http://localhost:3000/controller.html on your phone(s), enter the room code shown on TV and join.

## Deploy to Render (public URL)
1. Create a GitHub repo and push this project into it:
   ```bash
   git init
   git add .
   git commit -m "Initial AirConsole MVP"
   # create new repo on GitHub, then:
   git remote add origin https://github.com/YOURUSER/YOURREPO.git
   git push -u origin main
   ```

2. Go to https://render.com -> New -> Web Service.
3. Connect your GitHub repo, pick the branch main.
4. Build command: (leave blank)
5. Start command: `node server.js`
6. Region: pick nearest region. Click Create Web Service.
7. After deploy finishes, Render gives you a public URL (example: https://your-repo.onrender.com).

Open that URL on desktop (TV) and /controller.html on your phone(s).

## How to test (once deployed)
1. Open TV: https://your-deploy.onrender.com/ → Click Create Room.
2. TV shows a 6-char code (e.g., ABC123). On your phone open https://your-deploy.onrender.com/controller.html.
3. Enter that code, click Join. Repeat from a second phone or another browser tab.
4. When both players show as connected on the TV, click Start Game.
5. Use left/right/boost on phones to control paddles in the TV pong game.

## Next steps I can do for you (pick one)
- Build the other 4 games and integrate game selection UI (I'll deliver them in the same repo).
- Improve visuals: add glass UI, particle FX, shaders and fancy transitions.
- Add matchmaking + persistent leaderboards.
- Make a one-click deploy script for Render + GitHub (automates repo creation via GitHub CLI).