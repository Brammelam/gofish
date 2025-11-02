### 🐟 Go Fish

A simple 2-player online **Go Fish card game** built with **Angular** (frontend) and **Node.js + Socket.IO** (backend),
utilizing the [Deck of Cards API](https://deckofcardsapi.com/) 

---

## Project structure

```
/backend     → Node.js + Express + Socket.IO server
/go-fish     → Angular frontend (standalone client)
```

---

## Features

* Create or join games using an invite link
* Real-time gameplay via WebSockets
* Full deck API integration (Deck of Cards API)
* Set completion detection and celebration
* Leave/rejoin game support with saved sessions

---

## Setup

### Clone the repo

```bash
git clone https://github.com/Brammelam/gofish.git
cd go-fish
```

### Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../go-fish
npm install
```

---

## Run the app locally

### Start backend server

```bash
cd backend
npm start
```

Runs at [http://localhost:4000](http://localhost:4000)

### Start Angular frontend

```bash
cd ../go-fish
ng serve
```

Runs at [http://localhost:4200](http://localhost:4200)

---

## Notes

* Game state is persisted in `backend/games.json`
* If you refresh the browser, you can rejoin your existing session
* `.gitignore` excludes build and cache folders (`node_modules`, `.angular`, etc.)

---

## Tech stack

| Layer    | Tech                                             |
| -------- | ------------------------------------------------ |
| Frontend | Angular 18 + Tailwind CSS                        |
| Backend  | Node.js + Express + Socket.IO                    |
| Data     | In-memory JSON file (`games.json`)               |
| API      | [Deck of Cards API](https://deckofcardsapi.com/) |

---

## 📜 License

MIT © 2025 Brammelam
