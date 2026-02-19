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
    
    -- Fallback: If Blizzard API returns nil, check bags for ItemID 180653
    if not mapID or not level then
        for bag = 0, 4 do
            for slot = 1, C_Container.GetContainerNumSlots(bag) do
                local itemID = C_Container.GetContainerItemID(bag, slot)
                if itemID == 180653 then
                    local itemLink = C_Container.GetContainerItemLink(bag, slot)
                    if itemLink then
                        -- Keystones look like: ITEM_LINK:mapID:level:affix1:affix2:affix3:affix4
                        local _, _, mID, lvl = string.find(itemLink, "keystone:(%d+):(%d+)")
                        if mID and lvl then
                            mapID = tonumber(mID)
                            level = tonumber(lvl)
                        end
                    end
                end
            end
        end
    end

    if mapID and level then
        local dungeonName = C_ChallengeMode.GetMapUIInfo(mapID)
        
        local existing = GuildManagerBridgeDB.keys[charKey]
        if not existing or existing.level ~= level or existing.mapID ~= mapID then
            GuildManagerBridgeDB.keys[charKey] = {
                level = level,
                mapID = mapID,
                dungeonName = dungeonName,
                timestamp = time()
            }
            print("|cff00aaff[GuildManager]|r Keystone updated: |cff00ff00+" .. level .. " " .. dungeonName .. "|r")
        end
    else
        -- Only clear if it was there before
        if GuildManagerBridgeDB.keys[charKey] then
            GuildManagerBridgeDB.keys[charKey] = nil
            print("|cff00aaff[GuildManager]|r Keystone removed or not found.")
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
