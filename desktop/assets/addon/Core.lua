-- Guild Manager Bridge Core (v1.4.0)
-- Tracks Mythic+ keystones with AlterEgo cross-character support
local f = CreateFrame("Frame")

-- Event-Liste für Keystones
f:RegisterEvent("PLAYER_LOGIN")
f:RegisterEvent("BAG_UPDATE_DELAYED")
f:RegisterEvent("CHALLENGE_MODE_COMPLETED")
f:RegisterEvent("CHALLENGE_MODE_START")
f:RegisterEvent("CHALLENGE_MODE_MAP_CHALLENGE_UPDATE")
f:RegisterEvent("ZONE_CHANGED_NEW_AREA")
f:RegisterEvent("PLAYER_ENTERING_WORLD")

-- Dungeon Name Cache (mapID -> name)
local dungeonNameCache = {}

local function GetDungeonName(mapID)
    if not mapID then return nil end
    if dungeonNameCache[mapID] then return dungeonNameCache[mapID] end
    local name = C_ChallengeMode.GetMapUIInfo(mapID)
    if name then
        dungeonNameCache[mapID] = name
    end
    return name
end

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
        local dungeonName = GetDungeonName(mapID)
        
        local existing = GuildManagerBridgeDB.keys[charKey]
        if not existing or existing.level ~= level or existing.mapID ~= mapID then
            GuildManagerBridgeDB.keys[charKey] = {
                level = level,
                mapID = mapID,
                dungeonName = dungeonName,
                timestamp = time(),
                source = "native"
            }
            print("|cff00aaff[GuildManager]|r Keystone updated: |cff00ff00+" .. level .. " " .. (dungeonName or "Unknown") .. "|r")
        end
    else
        -- Only clear if it was there before
        if GuildManagerBridgeDB.keys[charKey] then
            GuildManagerBridgeDB.keys[charKey] = nil
            print("|cff00aaff[GuildManager]|r Keystone removed or not found.")
        end
    end
end

-- AlterEgo Integration: Read keystone data from AlterEgo for all tracked characters
local function ScanAlterEgo()
    if not AlterEgoDB then return 0 end
    
    -- Find characters table in AlterEgo's DB structure
    local characters = nil
    
    if AlterEgoDB.db and AlterEgoDB.db.global and AlterEgoDB.db.global.characters then
        characters = AlterEgoDB.db.global.characters
    elseif AlterEgoDB.global and AlterEgoDB.global.characters then
        characters = AlterEgoDB.global.characters
    end
    
    -- Fallback: iterate top-level keys that look like Player GUIDs
    if not characters then
        characters = {}
        for key, val in pairs(AlterEgoDB) do
            if type(key) == "string" and key:find("^Player%-") and type(val) == "table" then
                characters[key] = val
            end
        end
        if next(characters) == nil then return 0 end
    end
    
    local currentChar = UnitName("player") .. "-" .. GetRealmName()
    local count = 0
    
    for guid, charData in pairs(characters) do
        if charData and charData.mythicplus and charData.mythicplus.keystone then
            local ks = charData.mythicplus.keystone
            
            if ks.level and ks.level > 0 and (ks.mapId or ks.challengeModeID) then
                local charName = charData.info and charData.info.name
                local charRealm = charData.info and charData.info.realm
                
                if charName and charRealm then
                    local charKey = charName .. "-" .. charRealm
                    
                    -- Don't overwrite native scan for the currently logged-in character
                    if charKey ~= currentChar then
                        local existing = GuildManagerBridgeDB.keys[charKey]
                        -- Don't overwrite native source with alterego source
                        if not existing or existing.source ~= "native" then
                            local mapID = ks.mapId or ks.challengeModeID
                            local dungeonName = GetDungeonName(mapID)
                            
                            if not existing or existing.level ~= ks.level or existing.mapID ~= mapID then
                                GuildManagerBridgeDB.keys[charKey] = {
                                    level = ks.level,
                                    mapID = mapID,
                                    dungeonName = dungeonName or "Unknown",
                                    timestamp = time(),
                                    source = "alterego"
                                }
                                count = count + 1
                            end
                        end
                    end
                end
            end
        end
    end
    
    return count
end

-- BigWigs Integration: Read keystone data from BigWigs3DB.myKeystones
local function ScanBigWigs()
    if not BigWigs3DB or not BigWigs3DB.myKeystones then return 0 end
    
    local currentChar = UnitName("player") .. "-" .. GetRealmName()
    local count = 0
    
    for guid, data in pairs(BigWigs3DB.myKeystones) do
        if data.name and data.realm and data.keyLevel and data.keyMap then
            local charKey = data.name .. "-" .. data.realm
            
            -- Don't overwrite native scan for the currently logged-in character
            if charKey ~= currentChar then
                -- Skip entries with level 0 (no key)
                if data.keyLevel > 0 and data.keyMap > 0 then
                    local existing = GuildManagerBridgeDB.keys[charKey]
                    -- Don't overwrite native source with bigwigs source
                    if not existing or existing.source ~= "native" then
                        local dungeonName = GetDungeonName(data.keyMap)
                        
                        if not existing or existing.level ~= data.keyLevel or existing.mapID ~= data.keyMap then
                            GuildManagerBridgeDB.keys[charKey] = {
                                level = data.keyLevel,
                                mapID = data.keyMap,
                                dungeonName = dungeonName or "Unknown",
                                timestamp = time(),
                                source = "bigwigs"
                            }
                            count = count + 1
                        end
                    end
                end
            end
        end
    end
    
    return count
end

-- Unified external addon scanner
local function ScanExternalAddons()
    if not GuildManagerBridgeDB then GuildManagerBridgeDB = {} end
    if not GuildManagerBridgeDB.keys then GuildManagerBridgeDB.keys = {} end
    
    local totalImported = 0
    totalImported = totalImported + ScanAlterEgo()
    totalImported = totalImported + ScanBigWigs()
    
    if totalImported > 0 then
        print("|cff00aaff[GuildManager]|r Imported |cff00ff00" .. totalImported .. " keystones|r from external addons (AlterEgo, BigWigs).")
    end
end

f:SetScript("OnEvent", function(self, event, ...)
    if event == "PLAYER_LOGIN" then
        if not GuildManagerBridgeDB then GuildManagerBridgeDB = {} end
        print("|cff00aaff[GuildManager]|r Bridge v1.4.0 active. Tracking keystones.")
        ScanKeystone()
        -- Delay external addon scan to ensure their SavedVariables are loaded
        C_Timer.After(3, ScanExternalAddons)
    else
        ScanKeystone()
    end
end)

-- Slash command for manual check
SLASH_GMBRIDGE1 = "/gmbridge"
SlashCmdList["GMBRIDGE"] = function(msg)
    if msg == "scan" then
        ScanExternalAddons()
        return
    end
    
    ScanKeystone()
    
    local charKey = UnitName("player") .. "-" .. GetRealmName()
    local key = GuildManagerBridgeDB and GuildManagerBridgeDB.keys and GuildManagerBridgeDB.keys[charKey]
    if key then
        print("|cff00aaff[GuildManager]|r Status: |cff00ff00+" .. key.level .. " " .. (key.dungeonName or "Unknown") .. "|r (Source: " .. (key.source or "native") .. ")")
    else
        print("|cff00aaff[GuildManager]|r Status: Kein Key im Inventar gefunden.")
    end
    
    -- Show all tracked keys
    if GuildManagerBridgeDB and GuildManagerBridgeDB.keys then
        local total = 0
        for k, v in pairs(GuildManagerBridgeDB.keys) do
            total = total + 1
        end
        print("|cff00aaff[GuildManager]|r Tracking |cff00ff00" .. total .. "|r keystones total. Use |cff00ff00/gmbridge scan|r to refresh AlterEgo data.")
    end
end
