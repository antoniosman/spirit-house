export const key = (a, b) => [a, b].sort().join('|');

export function createSeason(players, relations, alliances) {
  return {
    players: structuredClone(players).map(p => ({ ...p, wins: 0, out: false })),
    relations: { ...relations }, alliances: structuredClone(alliances),
    week: 1, stage: 'hoh', previous: null, hoh: null, nominees: [],
    history: [], order: [], winner: null, twist: null, immune: null,
    doubleRemaining: false, returnUsed: false
  };
}

export function advance(s, rng = Math.random) {
  let alive = s.players.filter(p => !p.out);
  const get = id => s.players.find(p => p.id === id);
  const name = id => get(id).name;
  const bond = (a, b) => (s.relations[key(a, b)] || 0) + s.alliances
    .filter(g => g.members.includes(a) && g.members.includes(b))
    .reduce((n, g) => n + g.loyalty / 2, 0);
  const choose = (ps, score) => ps.map(p => ({ p, v: score(p) + rng() * 12 }))
    .sort((a, b) => b.v - a.v)[0].p;
  const event = (title, text, ids = [], extra = {}) => {
    const e = { week: s.week, stage: s.stage, title, text, ids, ...extra };
    s.history.push(e); return e;
  };
  const scheduledTwist = () => {
    if (s.week === 7 && s.order.length && !s.returnUsed) return 'return';
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
    const jury = s.order.slice(-Math.min(7, s.order.length)).map(get);
    const votes = jury.map(j => ({ voter: j.id, target: choose(alive, p => bond(j.id, p.id) + p.wins * 1.8 + p.strategy * .6 + p.social * .4).id }));
    const tally = alive.map(p => ({ p, n: votes.filter(v => v.target === p.id).length })).sort((a, b) => b.n - a.n);
    const win = tally[0].n === tally[1].n ? choose(alive, p => p.wins + p.social) : tally[0].p;
    s.winner = win.id; s.stage = 'final';
    return event('Ο μεγάλος τελικός', `${win.name} κερδίζει τη σεζόν! Η κριτική επιτροπή ψήφισε με βάση σχέσεις, νίκες και στρατηγική.`, alive.map(p => p.id), { votes, tie: tally[0].n === tally[1].n });
  }

  if (s.stage === 'hoh') {
    s.immune = null;
    if (!s.doubleRemaining) s.twist = scheduledTwist();
    if (s.twist === 'return' && s.order.length) {
      const returnedId = s.order.pop(); const returned = get(returnedId); returned.out = false;
      s.twist = null; s.returnUsed = true;
      return event('Ανατροπή: Η Πύλη ανοίγει', `${returned.name} επιστρέφει από τη Σκιά στο Spirit House. Μία δεύτερη ευκαιρία μπορεί να αλλάξει τα πάντα.`, [returned.id], { twist: 'return', returned: returned.id });
    }
    const eligible = alive.filter(p => p.id !== s.previous || alive.length === 3);
    const p = choose(eligible, p => p.competition * .9 + p.strategy * .35);
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
    const a = alive[Math.floor(rng() * alive.length)];
    const b = alive.filter(p => p !== a)[Math.floor(rng() * (alive.length - 1))];
    const delta = rng() > .45 ? 2 : -2; const k = key(a.id, b.id);
    s.relations[k] = Math.max(-10, Math.min(10, (s.relations[k] || 0) + delta));
    const e = event('Δωμάτιο των μυστικών', delta > 0 ? `${a.name} και ${b.name} έρχονται πιο κοντά μετά από μία ειλικρινή εξομολόγηση.` : `Η εξομολόγηση του ${a.name} φέρνει ένταση με ${b.name}. Η εμπιστοσύνη τους κλονίζεται.`, [a.id, b.id]);
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
    const text = `${name(out)}, η παραμονή σου στο Spirit House ολοκληρώνεται εδώ. Ψήφοι: ${counts.map(c => `${name(c.id)} ${c.n}`).join(' · ')}.${tie ? ` Ο αρχηγός ${name(s.hoh)} έλυσε την ισοψηφία.` : ''}${continues ? ' Οι πόρτες κλείνουν ξανά: ακολουθεί δεύτερος, αστραπιαίος κύκλος.' : ''}`;
    const e = event(continues ? 'Πρώτη αποχώρηση — η νύχτα συνεχίζεται' : 'Η ώρα της αποχώρησης', text, [out], { votes, evicted: out, ...(continues ? { twist: 'double' } : {}) });
    s.previous = s.hoh; s.hoh = null; s.nominees = []; s.immune = null;
    if (continues) { s.doubleRemaining = true; s.stage = 'hoh'; }
    else { s.doubleRemaining = false; s.twist = null; s.week++; s.stage = 'hoh'; }
    return e;
  }
  throw new Error('Unknown stage ' + s.stage);
}
