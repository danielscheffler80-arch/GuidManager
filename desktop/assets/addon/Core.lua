-- Guild Manager Bridge Core (v1.3.2)
local f = CreateFrame("Frame")

-- Event-Liste für Keystones
f:RegisterEvent("PLAYER_LOGIN")
f:RegisterEvent("BAG_UPDATE_DELAYED")
f:RegisterEvent("CHALLENGE_MODE_COMPLETED")
f:RegisterEvent("CHALLENGE_MODE_START")
f:RegisterEvent("CHALLENGE_MODE_MAP_CHALLENGE_UPDATE")
f:RegisterEvent("ZONE_CHANGED_NEW_AREA")
f:RegisterEvent("PLAYER_ENTERING_WORLD")

local function ScanKeystone()
    if not GuildManagerBridgeDB then GuildManagerBridgeDB = {} end
    if not GuildManagerBridgeDB.keys then GuildManagerBridgeDB.keys = {} end
    
    local charKey = UnitName("player") .. "-" .. GetRealmName()
    local mapID = C_MythicPlus.GetOwnedKeystoneChallengeMapID()
    local level = C_MythicPlus.GetOwnedKeystoneLevel()
    
    if mapID and level then
        local dungeonName = C_ChallengeMode.GetMapUIInfo(mapID)
        
        -- Nur aktualisieren, wenn sich etwas geändert hat (vermeidet unnötige Schreibvorgänge)
        local existing = GuildManagerBridgeDB.keys[charKey]
        if not existing or existing.level ~= level or existing.mapID ~= mapID then
            GuildManagerBridgeDB.keys[charKey] = {
                level = level,
                mapID = mapID,
                dungeonName = dungeonName,
                timestamp = time()
            }
        end
    else
        -- Key wurde entfernt oder ist nicht vorhanden (z.B. nach Reset oder Benutzung)
        if GuildManagerBridgeDB.keys[charKey] then
            GuildManagerBridgeDB.keys[charKey] = nil
        end
    end
end

f:SetScript("OnEvent", function(self, event, ...)
    if event == "PLAYER_LOGIN" then
        if not GuildManagerBridgeDB then GuildManagerBridgeDB = {} end
        print("|cff00aaff[GuildManager]|r Bridge v1.3.2 active. Tracking keystones.")
        ScanKeystone()
    else
        ScanKeystone()
    end
end)

-- Slash command for manual check
SLASH_GMBRIDGE1 = "/gmbridge"
SlashCmdList["GMBRIDGE"] = function(msg)
    ScanKeystone()
    local charKey = UnitName("player") .. "-" .. GetRealmName()
    local key = GuildManagerBridgeDB and GuildManagerBridgeDB.keys and GuildManagerBridgeDB.keys[charKey]
    if key then
        print("|cff00aaff[GuildManager]|r Status: |cff00ff00+" .. key.level .. " " .. key.dungeonName .. "|r")
    else
        print("|cff00aaff[GuildManager]|r Status: Kein Key im Inventar gefunden.")
    end
end
