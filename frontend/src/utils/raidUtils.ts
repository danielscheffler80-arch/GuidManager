export interface RaidAttendee {
    id: number;
    characterId: number;
    status: string;
    isConfirmed: boolean;
    character: {
        name: string;
        class: string;
        classId: number | null;
        role: string | null;
        rank: number | null;
    };
}

export const CLASS_BUFFS = [
    { name: '5% Intellect', classes: ['Mage'], icon: 'spell_holy_magicalsentry' },
    { name: '5% Attack Power', classes: ['Warrior'], icon: 'spell_nature_intrudersign' },
    { name: '5% Stamina', classes: ['Priest'], icon: 'spell_holy_wordfortitude' },
    { name: '5% Physical Damage', classes: ['Monk'], icon: 'ability_monk_pridetransmogrification' },
    { name: '5% Magic Damage', classes: ['Demon Hunter'], icon: 'ability_demonhunter_chaosbrand' },
    { name: 'Devotion Aura', classes: ['Paladin'], icon: 'spell_holy_devotionaura' },
    { name: '3% Versatility', classes: ['Druid'], icon: 'spell_nature_regeneration' },
    { name: '3.6% Damage Reduction', classes: ['Evoker'], icon: 'ability_evoker_blessingofbronze' }, // Blessing of Bronze is actually Haste/CD, but screenshot says DR? 
    { name: 'Hunter\'s Mark', classes: ['Hunter'], icon: 'ability_hunter_snipershot' },
    { name: 'Skyfury', classes: ['Shaman'], icon: 'spell_shaman_skyfurytotem' },
];

export const RAID_UTILITY = [
    { name: 'Bloodlust', classes: ['Shaman', 'Mage', 'Evoker'], icon: 'spell_nature_bloodlust' },
    { name: 'Combat Resurrection', classes: ['Druid', 'Death Knight', 'Warlock', 'Paladin'], icon: 'ability_deathknight_deadlyresurrection' },
    { name: 'Movement Speed', classes: ['Druid', 'Shaman'], icon: 'ability_druid_stampedingroar' },
    { name: 'Healthstone', classes: ['Warlock'], icon: 'inv_stone_04' },
    { name: 'Gateway', classes: ['Warlock'], icon: 'inv_misc_shadowgram' },
    { name: 'Innervate', classes: ['Druid'], icon: 'spell_nature_lightning' },
    { name: 'Anti Magic Zone', classes: ['Death Knight'], icon: 'spell_deathknight_antimagiczone' },
    { name: 'Blessing of Protection', classes: ['Paladin'], icon: 'spell_holy_sealofprotection' },
    { name: 'Rallying Cry', classes: ['Warrior'], icon: 'ability_warrior_rallyingcry' },
];

export const CLASS_LIST = [
    'Priest', 'Mage', 'Warlock', 'Druid', 'Rogue', 'Monk', 'Demon Hunter',
    'Hunter', 'Shaman', 'Evoker', 'Death Knight', 'Paladin', 'Warrior'
];

export const getCompositionStats = (attendees: RaidAttendee[]) => {
    const activeAttendees = attendees.filter(a => a.isConfirmed);

    const classCount: Record<string, number> = {};
    CLASS_LIST.forEach(c => classCount[c] = 0);

    activeAttendees.forEach(a => {
        const charClass = a.character.class;
        if (classCount.hasOwnProperty(charClass)) {
            classCount[charClass]++;
        }
    });

    const buffs = CLASS_BUFFS.map(buff => ({
        ...buff,
        present: buff.classes.some(c => classCount[c] > 0)
    }));

    const utility = RAID_UTILITY.map(u => ({
        ...u,
        present: u.classes.some(c => classCount[c] > 0)
    }));

    return { classCount, buffs, utility };
};
