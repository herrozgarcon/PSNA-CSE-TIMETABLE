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
export const generateClassTimetable = (semester, section, rawSubjects, reservedSlots = {}, syncElectives = {}, relaxed = false, globalLabUsage = {}, slotsCount = 7, globalFacultyLoad = {}) => {
    const SLOTS = slotsCount;
    const grid = Array(6).fill(null).map(() => Array(SLOTS).fill(null));
    const subjects = rawSubjects.map(s => ({ ...s }));
    const counts = subjects.map((s, idx) => {
        return { ...s, subIdx: idx, remWk: parseInt(s.credit) || 0, remSat: parseInt(s.satCount) || 0 };
    });
    const isElective = (s) => (s.type && s.type.toUpperCase().includes('ELECTIVE')) || (s.name && s.name.toUpperCase().includes('ELECTIVE'));
    counts.forEach(sub => {
        let targets = (sub.fixedSlots && (Array.isArray(sub.fixedSlots) ? sub.fixedSlots : sub.fixedSlots[section] || sub.fixedSlots['_ALL'])) || [];
        const isSubLab = isBlockSubject(sub);

        targets.forEach(slot => {
            const d = slot.d, s = slot.s, duration = slot.duration || 1;
            const isSlotLab = duration > 1;

            // CRITICAL FIX: Distinguish between Theory and Lab components sharing the same code
            // If this subject is Theory, ignore Lab slots (don't place, don't decrement)
            if (!isSubLab && isSlotLab) return;

            // Revert: Allow Labs to take single slots (Word might parse them as 1+1+1)
            // if (isSubLab && !isSlotLab) return;

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
                            if (!String(existing.code).includes(sub.code)) {
                                existing.code = `${existing.code} / ${sub.code}`;
                                if (existing.teacherName && sub.teacherName) {
                                    if (!String(existing.teacherName).includes(sub.teacherName)) {
                                        existing.teacherName = `${existing.teacherName} / ${sub.teacherName}`;
                                    }
                                } else if (sub.teacherName) {
                                    existing.teacherName = existing.teacherName ? `${existing.teacherName} / ${sub.teacherName}` : sub.teacherName;
                                }
                                const suffix = (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '');
                                existing.displayCode = existing.code + suffix;
                            }
                        } else {
                            // Non-lab collision: Only overwrite if we are NOT overwriting a Lab with a Theory
                            // Since we filtered !isSubLab && isSlotLab above, we are safer.
                            // But checked existing.isLab just in case.
                            if (!existing.isLab && !existing.duration > 1) {
                                grid[d][s + k] = {
                                    ...sub,
                                    isFixedFromWord: true,
                                    isStart: k === 0,
                                    duration,
                                    isLab: isLab,
                                    displayCode: isLab ? sub.code + (k === 0 ? (isIntegrated ? ' (Int.)' : ' (Lab)') : '') : sub.code
                                };
                            }
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

        // REVERTED: No longer trying decreasing durations. Strict duration only.
        while (lab.remWk >= 2 && blocksFound < maxBlocks && attempt < 40) {
            attempt++;
            let duration = isIntegrated ? (lab.remWk >= 3 ? 3 : 2) : (lab.remWk >= 4 ? 4 : (lab.remWk >= 3 ? 3 : 2));
            if (String(lab.code || '').toUpperCase().includes('GE2C81')) duration = 4;

            if (duration > lab.remWk) duration = lab.remWk;
            if (duration < 2) break;

            let placed = false;
            let found = false;

            for (let pass = 0; pass < 4; pass++) {
                for (const d of dayOrder) {
                    // STRICT: Only one lab per day allowed (Relaxed on Pass 3 if desperate)
                    if (pass < 3 && grid[d].some(c => c && (c.isLab || isBlockSubject(c)))) continue;

                    if (grid[d].some(c => c && c.code === lab.code)) continue;

                    // Relaxed Start Constraints
                    let validStarts = (pass < 2) ? [1, 4] : (pass < 3 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]);

                    if (String(lab.code || '').toUpperCase().includes('GE2C81')) {
                        validStarts = (pass < 2) ? [1] : (pass < 3 ? [1, 2, 3] : [0, 1, 2, 3, 4, 5]);
                    }

                    validStarts.sort(() => Math.random() - 0.5);

                    for (let s of validStarts) {
                        if (s + duration > SLOTS) continue;
                        const isGE2C81 = String(lab.code || '').toUpperCase().includes('GE2C81');
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
                            // globalLabUsage[`${d}-${lab.code}`] = true; // REMOVED
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
        }

        // SATURDAY LAB
        const satd = 5;
        // Removed globalLabUsage check
        if (lab.remSat >= 2 && !grid[satd].some(c => c && isBlockSubject(c))) {
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
                    // globalLabUsage[`${d}-${lab.code}`] = true; // REMOVED
                    break;
                }
            }
        }
    });

    const theoryPoolWk = [];
    const theoryPoolSat = [];
    counts.forEach(sub => {
        // PREVENTION: Do not add unassigned Lab hours to Theory Pool to avoid splitting
        if (isBlockSubject(sub)) return;

        for (let i = 0; i < Math.max(0, sub.remWk); i++) theoryPoolWk.push({ ...sub });
        for (let i = 0; i < Math.max(0, sub.remSat); i++) theoryPoolSat.push({ ...sub });
    });
    theoryPoolWk.sort(() => Math.random() - 0.5);

    // Robust Filling Strategy with Retries
    for (let retry = 0; retry < 10; retry++) {
        let filledSomething = false;
        // Clone pool for this attempt (since we splice)
        // Actually, we can just try to fill. If we fail to fill grid, we can just leave it as null for now
        // But the pool is spliced.
        // Let's iterate slots.
        for (let d = 0; d < 6; d++) {
            let pool = (d === 5) ? theoryPoolSat : theoryPoolWk;

            // Allow Weekday subjects on Saturday if saturated
            if (d === 5 && pool.length === 0 && retry > 2 && theoryPoolWk.length > 0) {
                pool = theoryPoolWk;
            }

            for (let s = 0; s < SLOTS; s++) {
                if (!grid[d][s]) {
                    if (pool.length === 0) continue;

                    const getSlotConflicts = (subject) => {
                        return grid.filter((row, rIdx) => rIdx !== d && row[s] && row[s].code === subject.code).length;
                    };

                    // RELAXATION: After retry 2, ignore "one per day" constraint
                    let candidates = [];
                    if (retry < 2) {
                        candidates = pool.filter(t => !grid[d].some(c => c && c.code === t.code));
                    }

                    // If all remaining candidates are already in this day, we MUST pick one (relaxed constraint)
                    if (candidates.length === 0) candidates = pool;

                    let bestSubject = null;
                    let minPenalty = Infinity;

                    for (const sub of candidates) {
                        let penalty = 0;

                        // 1. External Slot Conflicts (Same time other days)
                        // If conflict exists, very high penalty but not impossible if forced
                        const conflicts = getSlotConflicts(sub);
                        if (conflicts > 0) penalty += 5000;

                        // 2. Continuous Placement Check (Prevent back-to-back same subject/faculty)
                        if (s > 0 && grid[d][s - 1] && grid[d][s - 1].code === sub.code) penalty += (retry < 5 ? 2000 : 0);
                        if (s < SLOTS - 1 && grid[d][s + 1] && grid[d][s + 1].code === sub.code) penalty += (retry < 5 ? 2000 : 0);

                        // 3. Daily Distribution (Prevent clumping in one day)
                        const placesToday = grid[d].filter(c => c && c.code === sub.code).length;
                        if (placesToday > 0) penalty += (placesToday * 2000);

                        // 4. Global Faculty Check
                        if (sub.teacherName && sub.teacherName !== 'TBA') {
                            const tName = sub.teacherName.toUpperCase();
                            // Conflict Check
                            if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has(tName)) {
                                penalty += 50000; // Hard Conflict
                            }

                            // Workload Check
                            const currentDaily = (globalFacultyLoad[tName] && globalFacultyLoad[tName][d]) || 0;
                            const currentTotal = (globalFacultyLoad[tName] && globalFacultyLoad[tName].total) || 0;

                            // Limit: Max 4 hours per day (Soft), 5 hours (Hard)
                            if (currentDaily >= 4) penalty += 10000;
                            if (currentDaily >= 3) penalty += 2000;

                            // Limit: Max 16-18 hours per week
                            if (currentTotal >= 16) penalty += 5000;
                        }

                        // 4. Global Lab Conflict (If this subject is a lab elsewhere at same time?)
                        // (Already handled by grid check essentially)

                        if (penalty < minPenalty) {
                            minPenalty = penalty;
                            bestSubject = sub;
                        }
                    }

                    if (bestSubject) {
                        const idx = pool.indexOf(bestSubject);
                        if (idx > -1) {
                            grid[d][s] = { ...pool.splice(idx, 1)[0], duration: 1, isStart: true };
                            // Sync Electives Logic
                            if (isElective(bestSubject)) {
                                if (!syncElectives[bestSubject.code]) syncElectives[bestSubject.code] = [];
                                const textKey = `${d}-${s}`;
                                // We store simply d,s. 
                                // Caution: Sync logic generally requires global knowledge which is hard here.
                                // We'll just push.
                                syncElectives[bestSubject.code].push({ d, s });
                            }
                        }
                    }
                }
            }
        }
        if (theoryPoolWk.length === 0 && theoryPoolSat.length === 0) break;
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