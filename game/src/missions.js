// Sunset Streets — the five-mission story arc.
// Each mission has its stages, its target points on the map, its reward,
// and the logic that advances it as the player moves through Solmar Bay.

import { MISSION_REWARDS } from './config.js';
import { dist } from './random.js';
import { landmarkById } from './city.js';

export const MISSIONS = [
  {
    id: 'first-ride',
    title: 'First Ride',
    giver: 'Mara Solis',
    brief: 'Mara needs wheels. Steal any parked car on the Strip and bring it to the Sunset Garage.',
    reward: MISSION_REWARDS[0],
    stages: [
      { objective: 'Steal any parked car', target: null },
      { objective: 'Bring the car to the Sunset Garage', target: 'garage', radius: 90 },
    ],
  },
  {
    id: 'club-pickup',
    title: 'Club Pickup',
    giver: 'Dante Cole',
    brief: 'Dante left a package at Club Flamingo. Walk in range of the club, grab it, then deliver it to the Portside Docks. Cops patrol the docks — keep it clean.',
    reward: MISSION_REWARDS[1],
    stages: [
      { objective: 'Pick up the package at Club Flamingo', target: 'flamingo', radius: 90 },
      { objective: 'Deliver the package to the Portside Docks', target: 'docks', radius: 90 },
    ],
  },
  {
    id: 'warehouse-heat',
    title: 'Warehouse Heat',
    giver: 'Mara Solis',
    brief: 'Warehouse 9 is holding out on us. Drive there and lean on the crew — the job gets loud, so expect wanted stars. Lose the cops, then get back to the Old Plaza.',
    reward: MISSION_REWARDS[2],
    stages: [
      { objective: 'Reach Warehouse 9', target: 'warehouse9', radius: 90, onEnter: 'heat' },
      { objective: 'Lose the cops — get wanted back to 0', target: null },
      { objective: 'Get back to the Old Plaza', target: 'plaza', radius: 90 },
    ],
  },
  {
    id: 'night-market-run',
    title: 'Night Market Run',
    giver: 'Dante Cole',
    brief: 'The Night Market moves fast cash. Pick up the drop at the market and race it to Casino Sol before the rival crew does.',
    reward: MISSION_REWARDS[3],
    timeLimit: 150,
    stages: [
      { objective: 'Pick up the drop at the Night Market', target: 'market', radius: 90 },
      { objective: 'Race the drop to Casino Sol', target: 'casino', radius: 90 },
    ],
  },
  {
    id: 'sunset-score',
    title: 'The Sunset Score',
    giver: 'Mara Solis',
    brief: 'One last job: hit the docks vault, then shake a full five-star response and vanish at the Old Plaza. Pull this off and Solmar Bay is yours.',
    reward: MISSION_REWARDS[4],
    stages: [
      { objective: 'Hit the docks vault', target: 'docks', radius: 90, onEnter: 'vault' },
      { objective: 'Escape to the Old Plaza with 2 stars or less', target: 'plaza', radius: 90, maxWanted: 2 },
    ],
  },
];

export function nextMissionIndex(world) {
  return world.mission.done.findIndex((d) => !d);
}

export function currentMission(world) {
  if (!world.mission.active) return null;
  return MISSIONS[world.mission.index];
}

export function missionTargetPoint(world) {
  const m = currentMission(world);
  if (!m) return null;
  const stage = m.stages[world.mission.stage];
  if (!stage || !stage.target) return null;
  const lm = landmarkById(stage.target);
  return lm ? { x: lm.x, y: lm.y, name: lm.name } : null;
}

export function missionObjectiveText(world) {
  const m = currentMission(world);
  if (!m) {
    const next = nextMissionIndex(world);
    if (next === -1) return 'Solmar Bay is yours. Free roam — enjoy the sunset.';
    return `Press M — next job: ${MISSIONS[next].title}`;
  }
  const stage = m.stages[world.mission.stage];
  return `${m.title}: ${stage.objective}`;
}

export function startNextMission(world) {
  const idx = nextMissionIndex(world);
  if (idx === -1) return false;
  const m = MISSIONS[idx];
  world.mission.active = true;
  world.mission.index = idx;
  world.mission.stage = 0;
  world.mission.failed = false;
  world.mission.timer = m.timeLimit ?? 0;
  return true;
}

function completeMission(world) {
  const m = MISSIONS[world.mission.index];
  world.player.cash += m.reward;
  world.mission.done[world.mission.index] = true;
  world.mission.active = false;
  world.stats.missionsDone++;
}

function failMission(world, reason) {
  world.mission.active = false;
  world.mission.failed = true;
  return reason;
}

// Called once per fixed step while a mission is active.
export function advanceMission(world, dt) {
  const m = currentMission(world);
  if (!m) return;
  const st = world.mission;
  const p = world.player;

  if (m.timeLimit) {
    st.timer -= dt;
    if (st.timer <= 0) {
      const reason = failMission(world, 'Out of time — the rival crew got there first.');
      world.messages.push({ text: `Mission failed: ${reason}`, t: 0, ttl: 5 });
      return;
    }
  }

  const stage = m.stages[st.stage];
  if (!stage) return;

  // Stage 0 of First Ride completes the moment Mara is driving.
  if (m.id === 'first-ride' && st.stage === 0) {
    if (p.inCar) {
      st.stage = 1;
      world.messages.push({ text: 'Nice wheels. Now bring it to the Sunset Garage.', t: 0, ttl: 4 });
    }
    return;
  }

  // Warehouse Heat stage 1: lose the cops.
  if (m.id === 'warehouse-heat' && st.stage === 1) {
    if (world.wanted.stars === 0) {
      st.stage = 2;
      world.messages.push({ text: 'Clean. Now get back to the Old Plaza.', t: 0, ttl: 4 });
    }
    return;
  }

  // Location stages: arrive at the target point.
  if (stage.target) {
    const lm = landmarkById(stage.target);
    const radius = stage.radius ?? 90;
    const d = dist(p.x, p.y, lm.x, lm.y);
    const wantedOk = stage.maxWanted === undefined || world.wanted.stars <= stage.maxWanted;
    if (d < radius && wantedOk) {
      if (stage.onEnter === 'heat') {
        world.wanted.stars = Math.max(world.wanted.stars, 3);
        world.wanted.heat = 0;
        world.messages.push({ text: 'The crew called the cops! +3 stars — lose them!', t: 0, ttl: 5 });
        st.stage++;
        return;
      }
      if (stage.onEnter === 'vault') {
        p.cash += 1000;
        world.wanted.stars = 5;
        world.wanted.heat = 0;
        world.messages.push({ text: 'Vault cracked: +$1,000. Five stars incoming — run!', t: 0, ttl: 5 });
        st.stage++;
        return;
      }
      if (st.stage < m.stages.length - 1) {
        st.stage++;
        const next = m.stages[st.stage];
        world.messages.push({ text: next.objective, t: 0, ttl: 4 });
      } else {
        completeMission(world);
        world.messages.push({ text: `${m.title} complete! +$${m.reward}`, t: 0, ttl: 5 });
      }
    }
  }
}
