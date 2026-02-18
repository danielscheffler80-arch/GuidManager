-- Guild Manager Bridge Core
local f = CreateFrame("Frame")
f:RegisterEvent("PLAYER_LOGIN")
f:RegisterEvent("BAG_UPDATE")
f:RegisterEvent("CHALLENGE_MODE_COMPLETED")

local function ScanKeystone()
    local mapID = C_MythicPlus.GetOwnedKeystoneChallengeMapID()
    local level = C_MythicPlus.GetOwnedKeystoneLevel()
    
    if mapID and level then
        if not GuildManagerBridgeDB then GuildManagerBridgeDB = {} end
        if not GuildManagerBridgeDB.keys then GuildManagerBridgeDB.keys = {} end
        
        local charKey = UnitName("player") .. "-" .. GetRealmName()
        GuildManagerBridgeDB.keys[charKey] = {
            level = level,
            mapID = mapID,
            dungeonName = C_ChallengeMode.GetMapUIInfo(mapID),
            timestamp = time()
        }
    end
end

f:SetScript("OnEvent", function(self, event, ...)
    if event == "PLAYER_LOGIN" then
        if not GuildManagerBridgeDB then GuildManagerBridgeDB = {} end
        print("|cff00aaff[GuildManager]|r Bridge v1.3 active. Tracking keystones.")
        ScanKeystone()
    elseif event == "BAG_UPDATE" or event == "CHALLENGE_MODE_COMPLETED" then
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
        print("|cff00aaff[GuildManager]|r Aktueller Key: |cff00ff00+" .. key.level .. " " .. key.dungeonName .. "|r")
    else
        print("|cff00aaff[GuildManager]|r Kein Key im Inventar gefunden.")
    end
end
