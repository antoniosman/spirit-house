export const key = (a, b) => [a, b].sort().join('|');

export function createSeason(players, relations, alliances, couples = {}, permanentCouples = {}) {
  return {
    players: structuredClone(players).map(p => ({ ...p, wins: 0, out: false })),
    relations: { ...relations }, alliances: structuredClone(alliances), couples: { ...couples }, permanentCouples: { ...permanentCouples },
    week: 1, stage: 'hoh', previous: null, hoh: null, nominees: [],
    history: [], order: [], winner: null, twist: null, immune: null, romances: {},
    doubleRemaining: false, returnUsed: false, abilityUsed: {}, playerHohId: null, thirdNomineeId: null, returnChoiceId: null
  };
}

export function advance(s, rng = Math.random) {
  s.couples = s.couples || {}; s.permanentCouples = s.permanentCouples || {}; s.abilityUsed = s.abilityUsed || {};
  let alive = s.players.filter(p => !p.out);
  const get = id => s.players.find(p => p.id === id);
  const name = id => get(id).name;
  const bond = (a, b) => (s.relations[key(a, b)] || 0) + (s.romances[key(a, b)] || 0) + (s.couples[key(a, b)] ? 12 : 0) + (s.permanentCouples[key(a, b)] ? 8 : 0) + s.alliances
    .filter(g => g.members.includes(a) && g.members.includes(b))
    .reduce((n, g) => n + g.loyalty / 2, 0);
  const choose = (ps, score) => ps.map(p => ({ p, v: score(p) + rng() * 12 }))
    .sort((a, b) => b.v - a.v)[0].p;
  const event = (title, text, ids = [], extra = {}) => {
    const e = { week: s.week, stage: s.stage, title, text, ids, ...extra };
    s.history.push(e); return e;
  };
  const abilityFor = p => ({ tony: 'Μάγος', luna: 'Ξωτικό', rino: 'Λυκάνθρωπος', billy: 'Kitsune', elisa: 'Γοργόνα', evelyn: 'Νεράιδα του νερού' }[p.name.toLowerCase()] || null);
  const triggerAbility = () => {
    const pool = alive.filter(p => abilityFor(p) && !s.abilityUsed[p.id]);
    if (!pool.length || rng() > .34) return null;
    const actor = pool[Math.floor(rng() * pool.length)]; const ability = abilityFor(actor);
    s.abilityUsed[actor.id] = true;
    let text = `${actor.name} αποκαλύπτει την ικανότητά του: ${ability}.`;
    if (actor.name.toLowerCase() === 'tony' || actor.name.toLowerCase() === 'evelyn') { s.immune = actor.id; text += ` Η ασπίδα προστατεύει τον ${actor.name} για αυτή την εβδομάδα.`; }
    else if (actor.name.toLowerCase() === 'rino') { actor.wins += 2; text += ' Η αγριότητα του δίνει δύο νίκες δύναμης.'; }
    else if (actor.name.toLowerCase() === 'luna' || actor.name.toLowerCase() === 'elisa') {
      const target = alive.find(p => p.id !== actor.id); if (target) { s.relations[key(actor.id, target.id)] = Math.min(10, (s.relations[key(actor.id, target.id)] || 0) + 4); text += ` Η μαγεία ενώνει τον ${actor.name} με τον ${target.name}.`; }
    } else if (actor.name.toLowerCase() === 'billy' && s.nominees.length) {
      const candidates = alive.filter(p => p.id !== s.hoh && !s.nominees.includes(p.id)); const target = candidates[0];
      if (target) { const changed = s.nominees[0]; s.nominees[0] = target.id; text += ` Ο καθρέφτης του Kitsune αλλάζει ${name(changed)} με ${target.name}.`; }
    }
    return event(`Ability unleashed: ${ability}`, text, [actor.id, ...(s.immune === actor.id ? [actor.id] : [])], { ability, dialogue: [{ speaker: actor.name, text }] });
  };

  const scheduledTwist = () => {
    if (alive.length <= 10 && s.order.length >= 2 && !s.returnUsed) return 'return';
    if (alive.length <= 5) return null;
    if (s.week === 2) return 'triple';
    if (s.week === 3) return 'eclipse';
    if (s.week === 4) return 'immunity';
    if (s.week === 5) return 'sacrifice';
    if (s.week === 6 && alive.length > 6) return 'double';
    if (s.week > 7 && rng() < .22) return ['triple', 'eclipse', 'noVeto'][Math.floor(rng() * 3)];
    return null;
  };

  if (s.winner) return null;
  if (alive.length === 2) {
    const jury = s.players.filter(p => p.out);
    const votes = jury.map(j => ({ voter: j.id, target: choose(alive, p => bond(j.id, p.id) + p.wins * 1.8 + p.strategy * .6 + p.social * .4).id }));
    const tally = alive.map(p => ({ p, n: votes.filter(v => v.target === p.id).length })).sort((a, b) => b.n - a.n);
    const win = tally[0].n === tally[1].n ? choose(alive, p => p.wins + p.social) : tally[0].p;
    s.winner = win.id; s.stage = 'final';
    return event('Ο μεγάλος τελικός', `${win.name} κερδίζει τη σεζόν! Όλοι όσοι αποχώρησαν ψήφισαν στον τελικό.`, alive.map(p => p.id), { votes, tie: tally[0].n === tally[1].n });
  }

  if (s.stage === 'hoh') {
    s.immune = null;
    if (!s.doubleRemaining) s.twist = scheduledTwist();
    if (s.twist === 'return' && s.order.length >= 2) {
      const pool = s.order.map(get).filter(Boolean);
      const random = pool[Math.floor(rng() * pool.length)];
      const chosen = pool.find(p => p.id === s.returnChoiceId && p.id !== random.id) || pool.find(p => p.id !== random.id);
      const returned = [random, chosen].filter(Boolean); returned.forEach(p => { p.out = false; s.order = s.order.filter(id => id !== p.id); });
      s.twist = null; s.returnUsed = true; s.returnChoiceId = null;
      return event('Ανατροπή: Η Πύλη ανοίγει', `${returned.map(p => p.name).join(' και ')} επιστρέφουν από τη Σκιά. Ο ένας επιλέχθηκε από το κοινό και ο άλλος από την τύχη.`, returned.map(p => p.id), { twist: 'return', returned: returned.map(p => p.id) });
    }
    const eligible = alive.filter(p => p.id !== s.previous || alive.length === 3);
    const selectedHoh = eligible.find(x => x.id === s.playerHohId);
    const p = selectedHoh || choose(eligible, x => x.competition * .9 + x.strategy * .35);
    s.playerHohId = null;
    s.hoh = p.id; p.wins++;
    if (s.twist === 'immunity') {
      const pool = alive.filter(x => x.id !== p.id);
      s.immune = pool[Math.floor(rng() * pool.length)].id;
    }
    const twistText = s.doubleRemaining ? ' Η νύχτα συνεχίζεται με έναν αστραπιαίο δεύτερο κύκλο.'
      : s.twist === 'triple' ? ' Απόψε θα υπάρξουν τρεις υποψήφιοι.'
      : s.twist === 'eclipse' ? ' Η Έκλειψη μπορεί να αλλάξει έναν υποψήφιο.'
      : s.twist === 'immunity' ? ` ${name(s.immune)} προστατεύεται από τη Φωτεινή Ασπίδα.`
      : s.twist === 'sacrifice' ? ' Πριν την ψηφοφορία, κάποιος μπορεί να κάνει την απόλυτη Θυσία.'
      : s.twist === 'double' ? ' Απόψε οι πόρτες θα ανοίξουν δύο φορές.'
      : s.twist === 'noVeto' ? ' Η δύναμη του veto σφραγίζεται για αυτή την εβδομάδα.' : '';
    const twistName = s.doubleRemaining ? 'double' : s.twist;
    const twistTitles = { triple: 'Ανατροπή: Τριπλή απειλή', eclipse: 'Μαγική ανατροπή: Η Έκλειψη', immunity: 'Ανατροπή: Η Φωτεινή Ασπίδα', sacrifice: 'Μαγική ανατροπή: Ο Κύκλος της Θυσίας', double: s.doubleRemaining ? 'Ανατροπή: Η νύχτα δεν τελείωσε' : 'Ανατροπή: Διπλή αποχώρηση', noVeto: 'Ανατροπή: Σφραγισμένο Veto' };
    const e = event(twistName ? twistTitles[twistName] : alive.length === 3 ? 'Τελικός αρχηγός' : 'Αγώνας αρχηγού', `${p.name} κερδίζει την εξουσία και την ασυλία της εβδομάδας.${twistText}`, [p.id, ...(s.immune ? [s.immune] : [])], twistName ? { twist: twistName } : {});
    s.stage = alive.length === 3 ? 'finalcut' : 'nominate'; return e;
  }

  if (s.stage === 'finalcut') {
    const others = alive.filter(p => p.id !== s.hoh);
    const out = choose(others, p => -bond(s.hoh, p.id) + p.strategy * .5 + p.wins);
    out.out = true; s.order.push(out.id);
    const e = event('Μία θέση πριν τον τελικό', `${name(s.hoh)} επιλέγει να αποχωρήσει ${out.name}. Οι δύο φιναλίστ αντιμετωπίζουν την κριτική επιτροπή.`, [out.id], { evicted: out.id });
    s.stage = 'jury'; return e;
  }

  if (s.stage === 'nominate') {
    const count = s.twist === 'triple' ? 3 : 2;
    const candidates = alive.filter(p => p.id !== s.hoh && p.id !== s.immune);
    s.nominees = candidates.map(p => ({ p, v: -bond(s.hoh, p.id) + p.strategy * get(s.hoh).strategy / 16 + p.wins + rng() * 8 }))
      .sort((a, b) => b.v - a.v).slice(0, count).map(x => x.p.id);
    if (count === 3 && s.thirdNomineeId && candidates.some(p => p.id === s.thirdNomineeId)) {
      s.nominees[2] = s.thirdNomineeId;
    }
    s.thirdNomineeId = null;
    let title = count === 3 ? 'Ανατροπή: Τριπλή απειλή' : 'Τελετή υποψηφιοτήτων';
    let text = `${name(s.hoh)} θέτει σε κίνδυνο τους ${s.nominees.map(name).join(', ')}.`;
    if (s.twist === 'eclipse') {
      const original = s.nominees[Math.floor(rng() * s.nominees.length)];
      const pool = candidates.filter(p => !s.nominees.includes(p.id));
      if (pool.length) {
        const replacement = pool[Math.floor(rng() * pool.length)].id;
        s.nominees = s.nominees.map(id => id === original ? replacement : id);
        title = 'Μαγική ανατροπή: Η Έκλειψη';
        text = `Η Έκλειψη σώζει ${name(original)} και στέλνει τον ${name(replacement)} στη θέση του. Κανείς δεν το περίμενε.`;
      }
    }
    const e = event(title, text, s.nominees, s.twist ? { twist: s.twist } : {});
    s.stage = s.twist === 'noVeto' ? 'house' : 'veto'; return e;
  }

  if (s.stage === 'veto') {
    const fixed = alive.filter(p => p.id === s.hoh || s.nominees.includes(p.id));
    const rest = alive.filter(p => !fixed.includes(p)).sort(() => rng() - .5).slice(0, Math.max(0, 6 - fixed.length));
    const winner = choose([...fixed, ...rest], p => p.competition + p.strategy * .25);
    winner.wins++;
    let saved = s.nominees.includes(winner.id) ? winner.id : s.nominees.find(id => bond(winner.id, id) > 5);
    let replacement = null;
    if (saved) {
      const candidates = alive.filter(p => p.id !== s.hoh && p.id !== s.immune && p.id !== winner.id && !s.nominees.includes(p.id));
      if (candidates.length) { replacement = choose(candidates, p => -bond(s.hoh, p.id) + p.strategy * .4).id; s.nominees = s.nominees.map(id => id === saved ? replacement : id); }
      else saved = null;
    }
    const e = event('Power of Veto', `${winner.name} κερδίζει το veto. ${saved ? `${name(saved)} σώζεται και ${name(replacement)} παίρνει τη θέση του.` : 'Οι υποψηφιότητες παραμένουν ίδιες.'}`, [winner.id, ...s.nominees]);
    s.stage = 'house'; return e;
  }

  if (s.stage === 'house') {
    const abilityEvent = triggerAbility();
    if (abilityEvent) { s.stage = 'evict'; return abilityEvent; }
    const coupleKeys = Object.keys(s.couples);
    const activeCouples = coupleKeys.map(k => k.split('|').map(get)).filter(pair => pair.every(Boolean) && pair.every(p => !p.out));
    if (activeCouples.length && rng() < .18) {
      const pair = activeCouples[Math.floor(rng() * activeCouples.length)], k = key(pair[0].id, pair[1].id);
      if (!s.permanentCouples[k]) { delete s.couples[k]; s.relations[k] = -4; return event('Δράμα στο Moon Room', `${pair[0].name} και ${pair[1].name} τσακώνονται και χωρίζουν. Η σχέση τους δεν ήταν permanent.`, pair.map(p => p.id), { dialogue: [{ speaker: pair[0].name, text: 'Δεν σε εμπιστεύομαι πια.' }, { speaker: pair[1].name, text: 'Τότε τελειώσαμε.' }], breakup: k }); }
    }
    if (s.twist === 'sacrifice') {
      const volunteers = alive.filter(p => p.id !== s.hoh && !s.nominees.includes(p.id));
      if (volunteers.length) {
        const volunteer = choose(volunteers, p => p.social + p.strategy * .25);
        volunteer.out = true; s.order.push(volunteer.id);
        const savedNames = s.nominees.map(name).join(', ');
        const e = event('Μαγική ανατροπή: Η Θυσία', `${volunteer.name} μπαίνει στον Κύκλο και λέει «Θέλω να φύγω εγώ». Η Θυσία γίνεται δεκτή και οι ${savedNames} σώζονται.`, [volunteer.id, ...s.nominees], { twist: 'sacrifice', evicted: volunteer.id, sacrifice: true });
        s.previous = s.hoh; s.hoh = null; s.nominees = []; s.twist = null; s.week++; s.stage = 'hoh'; return e;
      }
    }
    const possibleRomance = alive.filter(p => p.id !== s.hoh);
    if (possibleRomance.length > 1 && rng() < .22) {
      const a = possibleRomance[Math.floor(rng() * possibleRomance.length)];
      const b = possibleRomance.filter(p => p.id !== a.id)[Math.floor(rng() * (possibleRomance.length - 1))];
      const romanceKey = key(a.id, b.id); if (!s.permanentCouples[romanceKey]) s.couples[romanceKey] = true; s.romances[romanceKey] = Math.min(10, (s.romances[romanceKey] || 0) + 4);
      const e = event('Σπίθες στο Moon Room', `${a.name} και ${b.name} έρχονται πιο κοντά. Η νέα τους σχέση μπορεί να αλλάξει συμμαχίες, ψήφους και αποφάσεις.`, [a.id, b.id], { romance: romanceKey, dialogue: [{ speaker: a.name, text: 'Νιώθω ότι μπορώ να σου μιλήσω.' }, { speaker: b.name, text: 'Κράτα το μυστικό μας.' }] });
      s.stage = 'evict'; return e;
    }
    const a = alive[Math.floor(rng() * alive.length)];
    const b = alive.filter(p => p !== a)[Math.floor(rng() * (alive.length - 1))];
    const delta = rng() > .45 ? 2 : -2; const k = key(a.id, b.id);
    s.relations[k] = Math.max(-10, Math.min(10, (s.relations[k] || 0) + delta));
    const e = event('Δωμάτιο των μυστικών', delta > 0 ? `${a.name} και ${b.name} έρχονται πιο κοντά μετά από μία ειλικρινή εξομολόγηση.` : `Η εξομολόγηση του ${a.name} φέρνει ένταση με ${b.name}. Η εμπιστοσύνη τους κλονίζεται.`, [a.id, b.id], { dialogue: [{ speaker: a.name, text: delta > 0 ? 'Χαίρομαι που το είπαμε.' : 'Με πλήγωσες.' }, { speaker: b.name, text: delta > 0 ? 'Είμαστε μαζί σε αυτό.' : 'Δεν ήταν αυτό που εννοούσα.' }] });
    s.stage = 'evict'; return e;
  }

  if (s.stage === 'evict') {
    const nominees = s.nominees.map(get);
    const votes = alive.filter(p => p.id !== s.hoh && !s.nominees.includes(p.id))
      .map(p => ({ voter: p.id, target: choose(nominees, n => -bond(p.id, n.id) + n.strategy * p.strategy / 20 - n.social * .3).id }));
    const counts = s.nominees.map(id => ({ id, n: votes.filter(v => v.target === id).length })).sort((a, b) => b.n - a.n);
    const tie = counts[0].n === counts[1].n;
    const out = tie ? choose(nominees, p => -bond(s.hoh, p.id) + p.strategy * .3).id : counts[0].id;
    get(out).out = true; s.order.push(out);
    const continues = s.twist === 'double' && !s.doubleRemaining;
    const survivors = alive.length - 1; const milestone = survivors === 10 ? 'TOP 10' : survivors === 5 ? 'TOP 5' : survivors === 2 ? 'TOP 2' : `TOP ${survivors}`;
    const text = `${name(out)}, η παραμονή σου στο Spirit House ολοκληρώνεται εδώ. Ψήφοι: ${counts.map(c => `${name(c.id)} ${c.n}`).join(' · ')}. Απομένουν ${survivors} παίκτες — ${milestone}.${tie ? ` Ο αρχηγός ${name(s.hoh)} έλυσε την ισοψηφία.` : ''}${continues ? ' Οι πόρτες κλείνουν ξανά: ακολουθεί δεύτερος, αστραπιαίος κύκλος.' : ''}`;
    const e = event(continues ? 'Πρώτη αποχώρηση — η νύχτα συνεχίζεται' : 'Η ώρα της αποχώρησης', text, [out], { votes, evicted: out, ...(continues ? { twist: 'double' } : {}) });
    s.previous = s.hoh; s.hoh = null; s.nominees = []; s.immune = null;
    if (continues) { s.doubleRemaining = true; s.stage = 'hoh'; }
    else { s.doubleRemaining = false; s.twist = null; s.week++; s.stage = 'hoh'; }
    return e;
  }
  throw new Error('Unknown stage ' + s.stage);
}
