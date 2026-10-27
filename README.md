#  TripPlanner v3

**Node.js + Socket.IO + MongoDB Atlas + JWT Authentication**

---

##  About the Project

TripPlanner is a web application that helps groups of people plan trips together. Users can create groups, suggest destinations, vote on travel dates, chat in real time, and organize activities for their trip.

---

## 🎮 Application Flow

```text
Register / Login
        ↓
Dashboard - Create a Group or Join with an Invite Code
        ↓
Invite Friends
        ↓
━━━ PHASE 1: Destinations ━━━━━━━━━━━━━━━━━━━
 • Users suggest destinations
 • Group members vote
 • Admin approves the winning destination
        ↓
━━━ PHASE 2: Availability Calendar ━━━━━━━━━
 • Users select dates they are unavailable
 • Availability is calculated for the group
 • Admin generates possible date ranges
        ↓
━━━ PHASE 3: Date Voting ━━━━━━━━━━━━━━━━━━━
 • Users vote for a preferred date range
 • Admin confirms the final travel date
        ↓
━━━ PHASE 4: Trip Planning  ━━━━━━━━━━━━━━
 • Final date is displayed
 • AI activity suggestions
 • Users add and share activities
```

---

##  Features

* User registration and login
* JWT authentication
* Create and join travel groups
* Invite system with group codes
* Destination suggestions and voting
* Availability calendar
* Travel date voting
* Real-time group chat
* Online users indicator
* Typing indicator
* Activity planning
* AI activity recommendations

## Project Structure

```
client/          React + TypeScript frontend (Vite, Tailwind), deployed on Vercel
server/          Express + Socket.IO backend (TypeScript, source in server/src), deployed on Render
shared/          types shared by the client and the server
```

The app as it was before the bachelor project is kept under the git tag `baseline-pre-bachelor`.

## Running Locally

Server:

```
cd server
cp .env.example .env   # then fill in MONGO_URI
npm install
npm run dev
```

The server (API only) runs on http://localhost:3000.

Client (in a second terminal):

```
cd client
npm install
npm run dev
```

Open http://localhost:5173. Requests to /api and /socket.io are forwarded to the server on port 3000.

Other scripts (run in `server/`):

```
npm run typecheck   # check types without building
npm run build       # compile TypeScript to dist/
npm start           # run the compiled server (used on Render)
```
