# Battle.net OAuth Integration & Gilden-Chat Konzept

## 🎯 Übersicht
Dokumentiert den Plan für Battle.net OAuth Login, Gilden-Auswahl und Chat-Integration

---

## 🔐 Phase 1: Battle.net OAuth Integration

### 1.1 Battle.net API Setup
```
Benötigte Schritte:
1. Blizzard Developer Account erstellen
2. OAuth Client registrieren unter:
   https://develop.battle.net/access/clients
3. Redirect URI setzen: http://localhost:3000/auth/callback
4. Client ID & Secret sichern
```

### 1.2 Backend OAuth Flow
**Neue Endpunkte:**
- `GET /auth/battlenet` → Leitet zu Battle.net Login weiter
- `GET /auth/callback` → Verarbeitet OAuth Response
- `GET /auth/user` → Liefert aktuellen Benutzer
- `POST /auth/logout` → Loggt Benutzer aus

**Datenbank Schema Erweiterung:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  battlenet_id VARCHAR(50) UNIQUE NOT NULL,
  battletag VARCHAR(50) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.3 Frontend Login Flow
**Neue Komponenten:**
- `LoginPage.tsx` → Battle.net Login Button
- `AuthProvider.tsx` → Auth Context & State Management
- `ProtectedRoute.tsx` → Route Guard für eingeloggte Benutzer

**Login Prozess:**
1. User klickt "Login mit Battle.net"
2. Weiterleitung zu Battle.net OAuth
3. Nach Callback: Token speichern & Gilden-Daten abrufen
4. Weiterleitung zur Gilden-Auswahl

---

## 🏰 Phase 2: Gilden-Auswahl Interface

### 2.1 Battle.net Gilden-API
**Endpunkte:**
- `GET /api/user/guilds` → Liste aller Benutzer-Gilden
- `GET /api/guild/:guildId` → Details zu einer Gilde
- `POST /api/guild/select` → Gilden-Auswahl speichern

**Datenbank Schema:**
```sql
CREATE TABLE guilds (
  id SERIAL PRIMARY KEY,
  battlenet_guild_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  realm VARCHAR(50) NOT NULL,
  faction VARCHAR(10) NOT NULL,
  region VARCHAR(10) NOT NULL,
  member_count INTEGER DEFAULT 0,
  last_sync TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_guilds (
  user_id INTEGER REFERENCES users(id),
  guild_id INTEGER REFERENCES guilds(id),
  rank INTEGER,
  selected_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);
```

### 2.2 Frontend Gilden-Auswahl
**Neue Komponenten:**
- `GuildSelection.tsx` → Grid/Liste der verfügbaren Gilden
- `GuildCard.tsx` → Einzelne Gilden-Anzeige mit Realm, Faction, Member-Count
- `GuildDashboard.tsx` → Haupt-Dashboard nach Gilden-Auswahl

**Features:**
- Gilden-Icons (wenn verfügbar)
- Faction-Indikator (Horde/Alliance)
- Realm-Information
- Member-Count
- Letzte Aktivität
- "Als aktiv setzen" Button

---

## 💬 Phase 3: Gilden-Chat Integration

### 3.1 Chat-Architektur
**Backend Komponenten:**
- WebSocket Server für Real-time Chat
- Chat-Middleware für Battle.net API Integration
- Nachrichten-Persistierung in Datenbank

**Datenbank Schema:**
```sql
CREATE TABLE chat_channels (
  id SERIAL PRIMARY KEY,
  guild_id INTEGER REFERENCES guilds(id),
  channel_name VARCHAR(50) NOT NULL,
  channel_type VARCHAR(20) DEFAULT 'guild',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES chat_channels(id),
  user_id INTEGER REFERENCES users(id),
  battletag VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### 3.2 Battle.net Chat API Integration
**Technischer Ansatz:**
1. **Polling-Methode:** Battle.net API regelmäßig abfragen
2. **Webhook-Simulation:** Änderungen über Backend-WebSocket propagieren
3. **Bidirektional:** Senden & Empfangen über unsere App

**Limitationen beachten:**
- Rate-Limiting (max. 100 Requests/Minute)
- Keine Echtzeit-Garantie
- Möglicherweise verzögerungen von 30-60 Sekunden

### 3.3 Frontend Chat Interface
**Neue Komponenten:**
- `ChatContainer.tsx` → Haupt-Chat-Bereich
- `ChatMessage.tsx` → Einzelne Nachricht mit Avatar, Timestamp
- `ChatInput.tsx` → Nachrichteneingabe mit Senden-Button
- `ChatChannelList.tsx` → Liste der verfügbaren Channels

**Features:**
- Auto-scroll zu neuen Nachrichten
- Emoji-Unterstützung
- Nachrichten bearbeiten/löschen (falls API erlaubt)
- Benutzer-Liste mit Online-Status
- Unread-Message Counter
- Sound-Benachrichtigungen

---

## 🚀 Implementierungs-Reihenfolge

### Sprint 1: Foundation (1-2 Wochen)
1. Battle.net OAuth Setup & Backend Integration
2. User-Authentifizierung sicher implementieren
3. Basis-Frontend mit Login/Logout

### Sprint 2: Gilden-Integration (1-2 Wochen)
1. Battle.net Gilden-API anbinden
2. Gilden-Auswahl-Interface implementieren
3. Gilden-Dashboard erstellen

### Sprint 3: Chat-Grundlagen (2-3 Wochen)
1. WebSocket Server aufsetzen
2. Basis-Chat-Interface bauen
3. Nachrichten-Persistierung

### Sprint 4: Chat-Features (2-3 Wochen)
1. Multi-Channel Support
2. Echtzeit-Updates
3. Benachrichtigungen & UI-Polish

---

## 🔧 Technische Überlegungen

### Sicherheit
- OAuth Tokens sicher speichern (verschlüsselt)
- CORS richtig konfigurieren
- Rate-Limiting implementieren
- Input-Validierung für Chat-Nachrichten

### Performance
- WebSocket-Verbindungen effizient halten
- Nachrichten-Paginierung (nicht alle Nachrichten laden)
- Lazy Loading für Gilden-Daten
- Cache für wiederkehrende API-Calls

### Skalierbarkeit
- Datenbank-Indizes für schnelle Queries
- Redis für Session-Management in Betracht ziehen
- Horizontal skalierbare WebSocket-Architektur

---

## 📋 Nächste Schritte

1. **Battle.net Developer Account erstellen**
2. **Backend OAuth Foundation implementieren**
3. **Login-Page im Frontend aufsetzen**
4. **Erste Gilden-API Calls testen**
5. **WebSocket-Architektur planen**

Möchtest du mit Phase 1 (Battle.net OAuth) beginnen?