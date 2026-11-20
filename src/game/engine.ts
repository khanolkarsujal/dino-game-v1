  // Enforce required dragon level to attack cave
  const requiredLevel = cave.index; // Cave 1 needs level 1+, Cave 2 level 2+, Cave 3 level 3+, Cave 4 level 4+
  const maxDragonLevel = state.dragons.reduce((max, d) => Math.max(max, d.level), 0);
  if (state.dragons.length === 0 || maxDragonLevel < requiredLevel) {
    if (cave.hitFlash <= 0) {
      cave.hitFlash = 0.65;
      state.events.push({
        type: 'damage_num',
        x: cave.x,
        z: cave.z,
        amount: 0,
        label: `NEED LEVEL ${requiredLevel}+`,
        color: '#ff6b57',
        crit: true,
      });
      state.events.push({
        type: 'banner',
        title: `Dragons Too Weak for ${cave.name}`,
        subtitle: `Your dragons are level ${maxDragonLevel} (Need Level ${requiredLevel}+). Train and level up your dragons before attacking!`,
        color: '#ff6b57',
      });
    }
    return;
  }