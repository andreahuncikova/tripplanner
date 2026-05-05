# ✈️ TripPlanner v3

**Node.js + Socket.IO + MongoDB Atlas + JWT Auth**

---

## ⚡ Spustenie (5 minút)

### 1. Nainštaluj Node.js
https://nodejs.org  (verzia 18+)

### 2. MongoDB Atlas (ZADARMO)
1. Registruj sa na https://cloud.mongodb.com
2. **Create a cluster** (Free tier M0)
3. **Database Access** → Add user → meno + heslo
4. **Network Access** → Add IP → `0.0.0.0/0` (všetky)
5. **Connect** → Drivers → Node.js → skopíruj connection string

### 3. Nastav connection string
Otvor `config.js` a nahraď riadok MONGO_URI:
```js
MONGO_URI: 'mongodb+srv://TVOJE_MENO:TVOJE_HESLO@cluster0.xxxxx.mongodb.net/tripplanner?retryWrites=true&w=majority',
```

### 4. Spusti
```bash
npm install
node server.js
```

### 5. Otvor http://localhost:3000

---

## 🎮 Ako to funguje

### Flow skupiny (fázy):

```
Registrácia / Login
        ↓
Dashboard — vytvor skupinu ALEBO zadaj invite kód
        ↓
[Invite screen] — zdieľaj kód / link s kamarátmi
        ↓
━━━ FÁZA 1: Destinácie ━━━━━━━━━━━━━━━━━━━━━━━━━
  • Každý navrhuje destinácie
  • Všetci hlasujú (♡/♥)
  • Admin klikne "Schváliť" na víťaza
        ↓
━━━ FÁZA 2: Kalendár ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Každý klikne na dni kedy NEMôže ísť (červené)
  • Body = dostupnosť ostatných členov
  • Admin klikne "Vypočítať termíny"
        ↓
━━━ FÁZA 3: Hlasovanie o termíne ━━━━━━━━━━━━━━━
  • Zobrazia sa 3-5 spoločných okien (napr. 1.-9. apríla)
  • Každý hlasuje za jeden termín
  • Admin potvrdí víťazný termín
        ↓
━━━ FÁZA 4: Done 🎉 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Kalendár so zeleným vyznačeným dátumom
  • AI návrhy aktivít (podľa destinácie)
  • Každý pridáva aktivity, zdieľa ich do chatu
```

---

## 📡 WebSocket udalosti

### Client → Server
| Event | Popis |
|---|---|
| `join` | Pripojenie do skupiny |
| `msg` | Odoslanie chat správy |
| `dest:suggest` | Navrhnutie destinácie |
| `dest:vote` | Hlasovanie za destináciu |
| `dest:approve` | **Admin** schváli destináciu |
| `avail:set` | Nastavenie nedostupných dní |
| `avail:compute` | **Admin** vypočíta termíny |
| `range:vote` | Hlasovanie za termín |
| `range:confirm` | **Admin** potvrdí termín |
| `activity:add` | Pridanie aktivity |
| `activity:share` | Zdieľanie aktivity do chatu |
| `activity:suggest` | Žiadosť o AI návrhy aktivít |
| `typing` | Indikátor písania |

### Server → Client
| Event | Popis |
|---|---|
| `joined` | Celkový stav + história správ |
| `state` | Broadcast nového stavu skupiny |
| `online` | Zoznam online členov |
| `msg` | Nová chat správa |
| `dest:new` | Nová destinácia pridaná |
| `dest:votes` | Aktualizácia hlasov destinácie |
| `avail:update` | Aktualizácia dostupnosti člena |
| `range:votes` | Aktualizácia hlasov termínov |
| `activity:new` | Nová aktivita |
| `activity:suggestions` | AI návrhy aktivít |
| `typing` | Niekto píše |

---

## 🏗️ Štruktúra projektu
```
tripplanner_v3/
├── server.js              ← Express + Socket.IO backend
├── config.js              ← MongoDB URI, JWT secret, konštanty
├── utils.js               ← Výpočet dostupných termínov
├── middleware/
│   └── auth.js            ← JWT middleware (HTTP + Socket)
├── models/
│   ├── User.js            ← Mongoose User model
│   └── Group.js           ← Mongoose Group model (fázy, destinácie, availabilita...)
├── routes/
│   ├── auth.js            ← POST /api/auth/register, /login, /logout, GET /me
│   └── groups.js          ← POST /api/groups, GET /api/groups/:code
└── public/
    ├── index.html         ← Single-page app (auth / dash / invite / app)
    ├── css/app.css        ← Kompletné štýly
    └── js/app.js          ← Socket.IO klient + celá frontend logika
```
