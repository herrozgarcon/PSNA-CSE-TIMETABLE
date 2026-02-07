export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isBlockSubject = (subject) => {
    if (!subject) return false;
    const type = String(subject.type || '').toUpperCase();
    const name = String(subject.name || '').toUpperCase();
    if (type.includes('THEORY') || type === 'LECTURE') return false;
    return (
        type.includes('LAB') ||
        type.includes('PRACTICAL') ||
        type.includes('INTEGRATED') ||
        name.includes('GRAPHICS') ||
        name.includes('LAB') ||
        name.includes('PRACTICAL') ||
        (type.includes('ELECTIVE') && (name.includes('LAB') || name.includes('PROJECT')))
    );
};
export const generateClassTimetable = (semester, section, rawSubjects, reservedSlots = {}, syncElectives = {}, relaxed = false, globalLabUsage = {}, slotsCount = 7) => {
    const SLOTS = slotsCount;
    const grid = Array(6).fill(null).map(() => Array(SLOTS).fill(null));
    const subjects = rawSubjects.map(s => ({ ...s }));
    const counts = subjects.map((s, idx) => {
        return { ...s, subIdx: idx, remWk: s.credit, remSat: s.satCount };
    });
    const isElective = (s) => (s.type && s.type.toUpperCase().includes('ELECTIVE')) || (s.name && s.name.toUpperCase().includes('ELECTIVE'));
    counts.forEach(sub => {
        let targets = (sub.fixedSlots && (Array.isArray(sub.fixedSlots) ? sub.fixedSlots : sub.fixedSlots[section] || sub.fixedSlots['_ALL'])) || [];
        targets.forEach(slot => {
            const d = slot.d, s = slot.s, duration = slot.duration || 1;
            for (let k = 0; k < duration; k++) {
                if (s + k < SLOTS && d < 6) {
                    const isIntegrated = String(sub.type || '').toUpperCase().includes('INTEGRATED') || String(sub.name || '').toUpperCase().includes('INTEGRATED');
                    const isLab = duration > 1;

                    if (grid[d][s + k]) {
                        // Collision detected
                        const existing = grid[d][s + k];
                        const bothLabs = isLab && (existing.isLab || existing.duration > 1);

                        if (bothLabs) {
                            // SHARED LABORATORY LOGIC
                            // Only merge if not already merged (check code inclusion)
                            if (!String(existing.code).includes(sub.code)) {
                                existing.code = `${existing.code} / ${sub.code}`;

                                // Merge Teacher Names
                                if (existing.teacherName && sub.teacherName) {
                                    // Avoid duplicates in name
                                    if (!String(existing.teacherName).includes(sub.teacherName)) {
                                        existing.teacherName = `${existing.teacherName} / ${sub.teacherName}`;
                                    }
                                } else if (sub.teacherName) {
                                    existing.teacherName = existing.teacherName ? `${existing.teacherName} / ${sub.teacherName}` : sub.teacherName;
                                }

                                // Style like Elective: Code / Code + (Lab)
                                const suffix = (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '');
                                existing.displayCode = existing.code + suffix;
                            }
                        } else {
                            // Non-lab collision (e.g. Theory replaces Theory, or Lab replaces Theory) -> OVERWRITE
                            // This ensures newest data from Word takes precedence if it's not a shared lab scenario
                            grid[d][s + k] = {
                                ...sub,
                                isFixedFromWord: true,
                                isStart: k === 0,
                                duration,
                                isLab: isLab,
                                displayCode: isLab ? sub.code + (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '') : sub.code
                            };
                        }
                    } else {
                        grid[d][s + k] = {
                            ...sub,
                            isFixedFromWord: true,
                            isStart: k === 0,
                            duration,
                            isLab: isLab,
                            displayCode: isLab ? sub.code + (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '') : sub.code
                        };
                    }
                    if (d === 5) sub.remSat--; else sub.remWk--;
                }
            }
        });
    });
    counts.filter(isElective).forEach(sub => {
        if (syncElectives[sub.code] && Array.isArray(syncElectives[sub.code])) {
            syncElectives[sub.code].forEach(slot => {
                const { d, s } = slot;
                if (d < 6 && s < SLOTS && !grid[d][s]) {
                    grid[d][s] = { ...sub, duration: 1, isStart: true, isSync: true };
                    if (d === 5) sub.remSat--; else sub.remWk--;
                }
            });
        }
    });
    const sectionChar = String(section).replace(/[^A-Za-z]/g, '').toUpperCase();
    const sectionOffset = (sectionChar.charCodeAt(0) || 65) - 65;
    const preferredFreeDay = sectionOffset % 5;
    const dayOrder = [0, 1, 2, 3, 4].filter(d => d !== preferredFreeDay);
    dayOrder.push(preferredFreeDay);
    counts.filter(isBlockSubject).forEach(lab => {
        const isIntegrated = String(lab.type || '').toUpperCase().includes('INTEGRATED') || String(lab.name || '').toUpperCase().includes('INTEGRATED');
        let blocksFound = 0;
        for (let d = 0; d < 5; d++) {
            if (grid[d].some(c => c && c.code === lab.code && (c.isLab || (c.duration && c.duration >= 2)))) blocksFound++;
        }

        let maxBlocks = isIntegrated ? (lab.credit >= 5 ? 2 : 1) : 10;
        let attempt = 0;

        while (lab.remWk >= 2 && blocksFound < maxBlocks && attempt < 40) {
            attempt++;
            let duration = isIntegrated ? (lab.remWk >= 3 ? 3 : 2) : (lab.remWk >= 4 ? 4 : (lab.remWk >= 3 ? 3 : 2));
            // Special override for GE2C81 -> Always 4 periods
            if (String(lab.code || '').toUpperCase().includes('GE2C81')) {
                duration = 4;
            }

            if (duration > lab.remWk) duration = lab.remWk;
            if (duration < 2) break;

            let found = false;
            // Pass 0: No other labs on day
            // Pass 1: Allow other labs
            // Pass 2: Relax restrictions
            // Pass 3: ...
            for (let pass = 0; pass < 4; pass++) {
                for (const d of dayOrder) {
                    if ((pass === 0 || pass === 2) && grid[d].some(c => c && (c.isLab || isBlockSubject(c)))) continue;
                    if (globalLabUsage[`${d}-${lab.code}`]) continue;
                    if (grid[d].some(c => c && c.code === lab.code)) continue;

                    // Constraint: Labs should NOT start from the first period (Index 0).
                    let validStarts = (pass < 2) ? [1, 4] : [1, 2, 3, 4, 5];

                    const isGE2C81 = String(lab.code || '').toUpperCase().includes('GE2C81');

                    // User Request: GE2C81 must start from 2nd period (Index 1)
                    if (isGE2C81) {
                        validStarts = [1];
                    }

                    // We remove the generic duration===4 checks pushing only to 0, 
                    // relying on the specific GE2C81 logic above or standard fallback.

                    validStarts.sort(() => Math.random() - 0.5);

                    for (let s of validStarts) {
                        if (s + duration > SLOTS) continue;

                        // Break Check (Lunch is usually after P4, i.e., between Index 3 and 4)
                        // If s=1 and duration=4 -> slots: 1, 2, 3, 4. Ends at 5.
                        // Grid indices: 1(P2), 2(BREAK?), 3(P3), 4(P4). 
                        // Wait, let's check slots definition in DataContext.
                        // P1(0), P2(1), B1(break), P3(2), P4(3), L1(Lunch), P5(4), P6(5), P7(6).
                        // If my grid array logic maps directly relative to "teaching slots":
                        // Grid Index 0 = P1
                        // Grid Index 1 = P2
                        // Grid Index 2 = P3
                        // Grid Index 3 = P4
                        // Grid Index 4 = P5
                        // ...
                        // The break is physical time, but in the array they are contiguous?
                        // Let's assume indices 3 and 4 are separated by lunch.
                        // Standard logic: `if (s <= 3 && s + duration > 4)` prevents crossing 3->4 boundary.

                        // For GE2C81 (Starts 1, Duration 4) -> It occupies 1, 2, 3, 4.
                        // It crosses the 3->4 boundary. We EXPLICITLY ALLOW this for GE2C81.
                        if (!isGE2C81 && s <= 3 && s + duration > 4) continue;

                        if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has('LAB_START')) continue;


                        let free = true;
                        for (let k = 0; k < duration; k++) if (grid[d][s + k]) free = false;

                        if (free) {
                            for (let k = 0; k < duration; k++) {
                                const suffix = isIntegrated ? ' (Int.)' : ' (Lab)';
                                grid[d][s + k] = {
                                    ...lab,
                                    isStart: k === 0,
                                    duration,
                                    isLab: true,
                                    displayCode: lab.code + (k === 0 ? suffix : '')
                                };
                            }
                            lab.remWk -= duration;
                            blocksFound++;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
            if (!found) duration--;
        }

        // SATURDAY LAB
        if (lab.remSat >= 2 && !grid[5].some(c => c && isBlockSubject(c))) {
            const d = 5;
            let duration = Math.min(lab.remSat, 4);
            let validStarts = [0, 1, 2, 3];
            for (let s of validStarts) {
                if (s + duration > SLOTS) continue;
                let free = true;
                for (let k = 0; k < duration; k++) if (grid[d][s + k]) free = false;
                if (free) {
                    for (let k = 0; k < duration; k++) grid[d][s + k] = { ...lab, isStart: k === 0, duration, isLab: true };
                    lab.remSat -= duration;
                    break;
                }
            }
        }
    });
    const theoryPoolWk = [];
    const theoryPoolSat = [];
    counts.forEach(sub => {
        for (let i = 0; i < Math.max(0, sub.remWk); i++) theoryPoolWk.push({ ...sub });
        for (let i = 0; i < Math.max(0, sub.remSat); i++) theoryPoolSat.push({ ...sub });
    });
    theoryPoolWk.sort(() => Math.random() - 0.5);
    for (let d = 0; d < 6; d++) {
        const pool = (d === 5) ? theoryPoolSat : theoryPoolWk;
        for (let s = 0; s < SLOTS; s++) {
            if (!grid[d][s] && pool.length > 0) {
                const getSlotConflicts = (subject) => {
                    return grid.filter((row, rIdx) => rIdx !== d && row[s] && row[s].code === subject.code).length;
                };
                let candidates = pool.filter(t => !grid[d].some(c => c && c.code === t.code));
                if (candidates.length === 0) candidates = pool;
                let bestSubject = null;
                let minConflicts = Infinity;
                for (const sub of candidates) {
                    let penalty = 0;

                    // 1. External Slot Conflicts (Same time other days)
                    const conflicts = getSlotConflicts(sub);
                    if (conflicts > 0) penalty += 1000;

                    // 2. Continuous Placement Check (Prevent back-to-back same subject/faculty)
                    // Check previous slot
                    if (s > 0 && grid[d][s - 1] && grid[d][s - 1].code === sub.code) {
                        penalty += 5000;
                    }
                    // Check next slot (if a fixed slot is already there)
                    if (s < SLOTS - 1 && grid[d][s + 1] && grid[d][s + 1].code === sub.code) {
                        penalty += 5000;
                    }

                    // 3. Daily Distribution (Prevent clumping in one day)
                    const placesToday = grid[d].filter(c => c && c.code === sub.code).length;
                    if (placesToday > 0) {
                        penalty += (placesToday * 2000); // Increased penalty to force spread
                    }

                    if (penalty === 0) {
                        minConflicts = 0;
                        bestSubject = sub;
                        break;
                    }

                    if (penalty < minConflicts) {
                        minConflicts = penalty;
                        bestSubject = sub;
                    }
                }
                if (!bestSubject && candidates.length > 0) bestSubject = candidates[0];
                if (bestSubject) {
                    const idx = pool.indexOf(bestSubject);
                    if (idx > -1) {
                        grid[d][s] = { ...pool.splice(idx, 1)[0], duration: 1, isStart: true };
                        if (isElective(bestSubject)) {
                            if (!syncElectives[bestSubject.code]) syncElectives[bestSubject.code] = [];
                            const alreadySynced = syncElectives[bestSubject.code].some(slot => slot.d === d && slot.s === s);
                            if (!alreadySynced) syncElectives[bestSubject.code].push({ d, s });
                        }
                    }
                }
            }
        }
    }
    for (let d = 0; d < 6; d++) {
        for (let s = 0; s < SLOTS; s++) {
            if (grid[d][s] === null) {
                for (let j = s + 1; j < SLOTS; j++) {
                    if (grid[d][j] && (!grid[d][j].duration || grid[d][j].duration === 1)) {
                        grid[d][s] = grid[d][j];
                        grid[d][j] = null;
                        break;
                    }
                    if (grid[d][j] && grid[d][j].duration > 1) break;
                }
            }
        }
    }
    return grid;
};