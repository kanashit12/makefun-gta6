// Story missions for Sunset Streets: a five-job arc across Solmar Bay.
// Each mission is a small state machine: objective text, a target point,
// a completion check, and a reward. Original story, original characters.
import { MISSION_REWARDS } from './config.js';
import { addWanted, setMessage } from './world.js';

export const MISSIONS = [
  {
    id: 'm1-first-ride',
    title: 'First Ride',
    giver: 'Mara Solis',
    brief:
      'Mara needs wheels. Steal any parked car on the Strip and bring it to the Sunset Garage.',
    objective: 'Steal a car, then drive to the Sunset Garage',
    target: 'garage',
    reward: MISSION_REWARDS[0],
    check(world) {
      const p = world.state.player;
      return !p.onFoot && p.car !== null;
    },
    arrive(world) {
      return !world.state.player.onFoot;
    },
  },
  {
    id: 'm2-club-pickup',
    title: 'Club Pickup',
    giver: 'Dante Cole',
    brief:
      'Dante left a package at Club Flamingo. Walk in range of the club, grab it, then deliver it to the Portside Docks. Cops patrol the docks — keep it clean.',
    objective: 'Collect the package at Club Flamingo, deliver to the Docks',
    target: 'club',
    target2: 'docks',
    reward: MISSION_REWARDS[1],
    stages: ['pickup', 'deliver'],
  },
  {
    id: 'm3-warehouse-heat',
    title: 'Warehouse Heat',
    giver: 'Mara Solis',
    brief:
      'Warehouse 9 is holding out on us. Drive there and lean on the crew — the job gets loud, so expect wanted stars. Lose the cops, then get back to the Old Plaza.',
    objective: 'Reach Warehouse 9, survive the heat, return to Old Plaza',
    target: 'warehouse',
    target2: 'plaza',
    reward: MISSION_REWARDS[2],
    stages: ['reach', 'heat', 'return'],
  },
  {
    id: 'm4-night-market',
    title: 'Night Market Run',
    giver: 'Dante Cole',
    brief:
      'The Night Market moves fast cash. Pick up the drop at the market and race it to Casino Sol before the rival crew does. Speed matters — the streets are yours.',
    objective: 'Grab the drop at the Night Market, race to Casino Sol',
    target: 'market',
    target2: 'casino',
    reward: MISSION_REWARDS[3],
    stages: ['pickup', 'deliver'],
    timeLimit: 150,
  },
  {
    id: 'm5-sunset-score',
    title: 'The Sunset Score',
    giver: 'Mara Solis',
    brief:
      'One last job: hit the docks vault, then shake a full five-star response and vanish at the Old Plaza. Pull this off and Solmar Bay is yours.',
    objective: 'Hit the Docks vault, survive 5 stars, escape to Old Plaza',
    target: 'docks',
    target2: 'plaza',
    reward: MISSION_REWARDS[4],
    stages: ['vault', 'escape'],
  },
];

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  world.state.mission = {
    def,
    index,
    stage: 0,
    timer: def.timeLimit ?? 0,
    done: false,
    startedAt: world.state.time,
  };
  setMessage(world, `Mission: ${def.title} — ${def.giver}`, 4);
  return true;
}

export function currentObjective(world) {
  const m = world.state.mission;
  if (!m) return 'Free roam — press M for a mission, E near a car to steal it.';
  const def = m.def;
  if (def.stages) {
    const stage = def.stages[m.stage];
    if (stage === 'pickup') return `Pick up at ${world.city.points[def.target].label}`;
    if (stage === 'deliver') return `Deliver to ${world.city.points[def.target2].label}`;
    if (stage === 'reach') return `Drive to ${world.city.points[def.target].label}`;
    if (stage === 'heat') return 'Lose the cops! Get your wanted level down.';
    if (stage === 'return' || stage === 'escape') return `Escape to ${world.city.points[def.target2].label}`;
    if (stage === 'vault') return `Reach the vault at ${world.city.points[def.target].label}`;
  }
  return def.objective;
}

export function missionTargetPoint(world) {
  const m = world.state.mission;
  if (!m) return null;
  const def = m.def;
  const stage = def.stages ? def.stages[m.stage] : null;
  if (stage === 'pickup' || stage === 'reach' || stage === 'vault') return world.city.points[def.target];
  if (stage === 'deliver' || stage === 'return' || stage === 'escape') return world.city.points[def.target2];
  if (stage === 'heat') return null;
  return world.city.points[def.target];
}

function nearPoint(world, key, radius = 90) {
  const p = world.city.points[key];
  const pl = world.state.player;
  return Math.hypot(pl.x - p.x, pl.y - p.y) < radius;
}

/** Advance mission logic one step. Returns true when a mission just completed. */
export function updateMission(world, dt) {
  const m = world.state.mission;
  if (!m || m.done) return false;
  const def = m.def;
  const st = world.state;

  if (def.id === 'm1-first-ride') {
    if (!st.player.onFoot && nearPoint(world, 'garage', 110)) {
      return completeMission(world);
    }
    return false;
  }

  if (def.id === 'm2-club-pickup' || def.id === 'm4-night-market') {
    if (m.stage === 0 && nearPoint(world, def.target, 90)) {
      m.stage = 1;
      setMessage(world, 'Package secured. Now deliver it!', 3);
    } else if (m.stage === 1 && nearPoint(world, def.target2, 100)) {
      return completeMission(world);
    }
    if (def.timeLimit) {
      m.timer -= dt;
      if (m.timer <= 0) {
        failMission(world, 'Too slow — the drop went cold.');
        return false;
      }
    }
    return false;
  }

  if (def.id === 'm3-warehouse-heat') {
    if (m.stage === 0 && nearPoint(world, 'warehouse', 100)) {
      m.stage = 1;
      addWanted(world, 3);
      setMessage(world, 'The crew called the cops! Lose them!', 3.5);
    } else if (m.stage === 1 && st.wanted === 0) {
      m.stage = 2;
      setMessage(world, 'Clean. Get back to the Old Plaza.', 3);
    } else if (m.stage === 2 && nearPoint(world, 'plaza', 110)) {
      return completeMission(world);
    }
    return false;
  }

  if (def.id === 'm5-sunset-score') {
    if (m.stage === 0 && nearPoint(world, 'docks', 100)) {
      m.stage = 1;
      addWanted(world, 5);
      st.money += 1000;
      setMessage(world, 'Vault cracked! +$1000. Now vanish — 5 stars!', 4);
    } else if (m.stage === 1 && nearPoint(world, 'plaza', 110) && st.wanted <= 2) {
      return completeMission(world);
    }
    return false;
  }
  return false;
}

function completeMission(world) {
  const m = world.state.mission;
  m.done = true;
  world.state.money += m.def.reward;
  world.state.missionsDone += 1;
  setMessage(world, `Mission complete: ${m.def.title}  +$${m.def.reward}`, 4);
  world.state.mission = null;
  const next = m.index + 1;
  if (next < MISSIONS.length) {
    world.state.missionIndex = next;
    setMessage(world, `Mission complete: ${m.def.title}  +$${m.def.reward}. Next: ${MISSIONS[next].title} (press M)`, 5);
  } else {
    setMessage(world, `All missions complete! You own Solmar Bay. +$${m.def.reward}`, 6);
  }
  return true;
}

export function failMission(world, reason) {
  const m = world.state.mission;
  if (!m) return;
  setMessage(world, `Mission failed: ${reason}`, 4);
  world.state.mission = null;
}

export function storyProgress(world) {
  return `${world.state.missionsDone} / ${MISSIONS.length} missions complete`;
}
