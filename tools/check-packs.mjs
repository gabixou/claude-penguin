const packs = ['dojo','dojoext','dock','beach','mine','shack','berg','forest','cove','light','ship','book','attic','shop','lounge','dance','stage','rink','forts','mtn','sport','pet','boiler','cave','cavemine','lake','eco','party1','town','village','plaza','coffee','pizza','lodge'];
for (const p of packs) {
    try {
        const r = await fetch(`https://gopenguin.lol/swf/${p}/timelines.json`, { method: 'HEAD' });
        console.log(p, r.status);
    } catch (e) { console.log(p, 'ERR', e.message); }
}
