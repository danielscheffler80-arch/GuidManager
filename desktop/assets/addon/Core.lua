-- Guild Manager Bridge Core
local f = CreateFrame("Frame")
f:RegisterEvent("PLAYER_LOGIN")
f:RegisterEvent("CHAT_MSG_GUILD")

local function CheckLogging()
    local logging = LoggingChat(1)
    if logging then
        print("|cff00aaff[GuildManager]|r Chat logging is now |cff00ff00ENABLED|r.")
    else
        -- Force it if it failed
        LoggingChat(1)
        print("|cff00aaff[GuildManager]|r Forced chat logging |cff00ff00ON|r.")
    end
end

f:SetScript("OnEvent", function(self, event, ...)
    if event == "PLAYER_LOGIN" then
        print("|cff00aaff[GuildManager]|r Bridge v1.2 active. Remote chat sync is currently |cffff4444DISABLED|r (Standalone App mode).")
    end
end)

-- Slash command for manual check
SLASH_GMBRIDGE1 = "/gmbridge"
SlashCmdList["GMBRIDGE"] = function(msg)
    print("|cff00aaff[GuildManager]|r Status Check:")
    CheckLogging()
    print("|cff00aaff[GuildManager]|r Log File: World of Warcraft/_retail_/Logs/WoWChatLog.txt")
end
