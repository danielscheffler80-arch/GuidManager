# 🏰 GUILD MANAGER MASTER PLAN
## Komplettes WoW Gilden-System - Stand der Dinge

---

## ✅ BEREITS ERLEDIGT (Abgehakt)

### 🔧 **Core Infrastructure** 
- [x] **Backend Setup** (Express.js + Prisma + SQLite)
- [x] **Frontend Setup** (React + TypeScript + Vite)
- [x] **Electron Desktop App** mit Menü-Integration
- [x] **Single-Instance Protection** (keine endlosen Fenster mehr!)
- [x] **Build System** für Standalone-EXE
- [x] **Icon Integration** (PNG → ICO Konvertierung)
- [x] **Settings Page** für Backend-Konfiguration

### 🎨 **Design & UI Foundation**
- [x] **Sidebar Navigation** (links)
- [x] **Main Frame** mit Sub-Tabs (rechts)
- [x] **Dark Theme** (Background: #252525, Accent: #A330C9, Text: #D1D9E0)
- [x] **Responsive Layout** (1280x800 Standard)

---

## 🎯 NOCH ZU IMPLEMENTIEREN (Geplant)

### 🔐 **Phase 1: Battle.net Integration** (Aktuell - Option A)
- [ ] **Battle.net OAuth Login**
- [ ] **Gilden-Import** über Battle.net API
- [ ] **Charakter-Sync** mit Battle.net Daten

### 👥 **Phase 2: Roster Management**
- [ ] **Gildenrang-Import** (GM, Officer, Member, etc.)
- [ ] **Charakter-Verwaltung** (Main + 3 Twinks)
- [ ] **Rollen-Zuweisung** (Tank, Healer, DPS) pro Charakter

### ⚔️ **Phase 3: Raid-System**
- [ ] **Raid-Team Erstellung** (wie Twinkraid)
- [ ] **Wöchentliche Raid-Termine** (immer gleicher Wochentag/Uhrzeit)
- [ ] **Einzelne Raid-Erstellung** (für spezielle Events)
- [ ] **Anmelde-System**: 
  - Charakter-Auswahl (Main/Twink1/Twink2/Twink3)
  - Status: Anwesend / Nicht da / Später / Ungewiss
  - Kommentar-Funktion mit Tooltip

### 📅 **Phase 4: Kalender-System**
- [ ] **Raid-Kalender** mit Monats-/Wochen-Ansicht
- [ ] **Drag & Drop** für Raid-Bearbeitung
- [ ] **Tooltips** für Kommentare und Details
- [ ] **Export-Funktion** (iCal, Google Calendar)

### 💬 **Phase 5: Gilden-Chat Integration**
- [ ] **Battle.net Chat API** Integration
- [ ] **Echtzeit-Nachrichten** über WebSocket
- [ ] **Multi-Channel**: Gilden-Chat, Officer-Chat
- [ ] **Nachrichten-History** mit Pagination

### 🗝️ **Phase 6: Mythic+ System**
- [ ] **Key-Tracking** für alle Charaktere
- [ ] **Übersicht**: Main + Twinks mit Key-Stufen
- [ ] **Beispiel-Format**: "Xava DH Tank Ecodome +18"
- [ ] **Key-Aktualisierung** automatisch via Battle.net API

### 📺 **Phase 7: Gilden-Streams**
- [ ] **Stream-Integration** (OBS, etc.)
- [ ] **Sichtbarkeits-Optionen**:
  - Public mit Code
  - Privat für Gilde
  - Privat mit Code
- [ ] **Stream-Liste** für aktive Streams
- [ ] **Viewer-Count** und Interaktion

### 🌓 **Phase 8: Theme System**
- [ ] **Light Mode** als Alternative zu Dark Mode
- [ ] **Theme-Switcher** in Settings
- [ ] **Farb-Anpassung** für Akzente

---

## 🚀 **NÄCHSTE SCHRITTE (Option A)**

### **Sprint 1: Battle.net OAuth Foundation** (1-2 Wochen)
1. **Battle.net Developer Account** erstellen
2. **OAuth Backend** implementieren
3. **Login-Page** im Frontend
4. **Erste Gilden-API Calls** testen

### **Sprint 2: Gilden-Daten Import** (1-2 Wochen)
1. **Gilden-Liste** abrufen
2. **Charakter-Sync** implementieren
3. **Roster-Import** mit Rängen
4. **Gilden-Auswahl** Interface

---

## 📊 **Technische Anforderungen**

### **Battle.net API**
- OAuth 2.0 Flow
- Guild Profile API
- Character Profile API
- Rate Limiting: 100 Requests/Minute

### **Datenbank Schema** (Erweiterungen)
```sql
-- Users (Battle.net Integration)
-- Guilds (Gilden-Import)
-- Characters (Main + Twinks)
-- Raids (Termine & Anmeldungen)
-- Chat Messages (Gilden-Chat)
-- MythicKeys (Key-Tracking)
-- Streams (Gilden-Streams)
```

---

## 🎯 **Fokus für die nächste Woche**

**Primär:** Battle.net OAuth Integration starten
**Sekundär:** Gilden-Import & Roster-Management
**Optional:** Erste Raid-Kalender-Tests

---

*Letztes Update: [Aktuelles Datum]*
*Nächstes Review: Nach Battle.net OAuth Fertigstellung*