export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isBlockSubject = (subject) => {
    if (!subject) return false;
    const type = String(subject.type || '').toUpperCase();
    const name = String(subject.name || '').toUpperCase();
    if (type.includes('THEORY') || type === 'LECTURE') return false;
    return (
        type.includes('LAB') ||
        type.includes('PRACTICAL') ||
        (type.includes('ELECTIVE') && (name.includes('LAB') || name.includes('PROJECT'))) ||
        (!subject.type && (name.includes('LAB') || name.includes('PRACTICAL')))
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
            if (!isSubLab && isSlotLab) return;
            for (let k = 0; k < duration; k++) {
                if (s + k < SLOTS && d < 6) {
                    const isIntegrated = String(sub.type || '').toUpperCase().includes('INTEGRATED') || String(sub.name || '').toUpperCase().includes('INTEGRATED');
                    const isLab = duration > 1;

                    if (grid[d][s + k]) {
                        const existing = grid[d][s + k];
                        const bothLabs = isLab && (existing.isLab || existing.duration > 1);
                        if (bothLabs) {
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
                    if (isElective(sub)) {
                        if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                        syncElectives[sub.code].push({ d, s: s + k });
                    }
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
        let maxBlocks = isIntegrated ? (lab.credit >= 7 ? 2 : 1) : 10;
        let attempt = 0;
        // Increased attempts to 500 to find better fits
        while (lab.remWk >= 2 && blocksFound < maxBlocks && attempt < 500) {
            attempt++;
            let duration = isIntegrated ? (lab.remWk >= 3 ? 3 : 2) : (lab.remWk >= 4 ? 4 : (lab.remWk >= 3 ? 3 : 2));
            if (String(lab.code || '').toUpperCase().includes('GE2C81')) duration = 4;

            // Delay fallback: Only reduce duration after 150 failed attempts
            if (attempt > 150 && duration > 2) {
                // Prevent reducing 3 to 2 if it leaves 1 hour orphan (unless we allow 1 hour labs, which we don't prefer)
                // But if strict constraints make 3 impossible, 2 is better than 0. 
                // However, user complained about counts. 2/3 is bad.
                // Let's try to stick to native duration as much as possible.
                if (lab.remWk !== 3) {
                    duration = duration - 1;
                }
            }
            if (duration > lab.remWk) duration = lab.remWk;
            if (duration < 2) break;
            let placed = false;
            let found = false;
            for (let pass = 0; pass < 4; pass++) {
                for (const d of dayOrder) {
                    // Check Global Lab Usage: Enforce one section per lab per day
                    if (globalLabUsage[`${d}-${lab.code}`]) continue;

                    if (pass < 3 && grid[d].some(c => c && (c.isLab || isBlockSubject(c)))) continue;
                    if (grid[d].some(c => c && c.code === lab.code)) continue;
                    // Start from P2 (index 1) or P5 (index 4) to avoid P1 start
                    let validStarts = (pass < 1) ? [1, 4] : (pass < 2 ? [1, 3, 4] : [1, 2, 3, 4, 5]);

                    if (String(lab.code || '').toUpperCase().includes('GE2C81')) {
                        validStarts = (pass < 2) ? [1] : (pass < 3 ? [1, 2, 3] : [1, 2, 3, 4, 5]);
                    }
                    validStarts.sort(() => Math.random() - 0.5);
                    for (let s of validStarts) {
                        if (s + duration > SLOTS) continue;
                        if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has('LAB_START')) continue;

                        // Lunch Constraint: Labs < 4 periods cannot span across Lunch (between P4/idx 3 and P5/idx 4)
                        if (duration < 4 && s <= 3 && s + duration > 4) continue;

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
        }
        const satd = 5;
        // Check Global Lab Usage for Saturday
        if (lab.remSat >= 2 && !grid[satd].some(c => c && isBlockSubject(c)) && !globalLabUsage[`5-${lab.code}`]) {
            const d = 5;
            let duration = Math.min(lab.remSat, 4);
            let validStarts = [1, 2, 3];
            for (let s of validStarts) {
                if (s + duration > SLOTS) continue;
                // Lunch Constraint: Labs < 4 periods cannot span across Lunch (between P4/idx 3 and P5/idx 4)
                if (duration < 4 && s <= 3 && s + duration > 4) continue;

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
        const typeUpper = String(sub.type || '').toUpperCase();
        if (typeUpper.includes('LAB') || typeUpper.includes('PRACTICAL')) {
            return;
        }
        if (isBlockSubject(sub) && !typeUpper.includes('LECTURE') && !typeUpper.includes('THEORY')) {
            return;
        }
        if (sub.remWk > 0) console.log(`[TimerGen] Adding to Pool: ${sub.code} (${sub.remWk} hrs)`);
        for (let i = 0; i < Math.max(0, sub.remWk); i++) theoryPoolWk.push({ ...sub });
        for (let i = 0; i < Math.max(0, sub.remSat); i++) theoryPoolSat.push({ ...sub });
    });
    theoryPoolWk.sort(() => Math.random() - 0.5);
    theoryPoolWk.sort(() => Math.random() - 0.5);
    for (let retry = 0; retry < 15; retry++) {
        if (theoryPoolWk.length === 0) break;
        let dayIndices = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        for (const d of dayIndices) {
            for (let s = 0; s < SLOTS; s++) {
                if (!grid[d][s]) {
                    if (theoryPoolWk.length === 0) break;
                    let bestIdx = -1;
                    for (let i = 0; i < theoryPoolWk.length; i++) {
                        const sub = theoryPoolWk[i];
                        let isBlocked = false;
                        if (sub.teacherName && sub.teacherName !== 'TBA') {
                            const tName = sub.teacherName.toUpperCase();
                            if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has(tName)) isBlocked = true;
                        }
                        if (!isBlocked) {
                            const placesToday = grid[d].filter(c => c && c.code === sub.code).length;
                            if (placesToday > 0) isBlocked = true;
                        }
                        if (!isBlocked) { bestIdx = i; break; }
                    }
                    if (bestIdx > -1) {
                        const bestSubject = theoryPoolWk[bestIdx];
                        grid[d][s] = { ...bestSubject, duration: 1, isStart: true };
                        theoryPoolWk.splice(bestIdx, 1);
                        if (isElective(bestSubject)) {
                            if (!syncElectives[bestSubject.code]) syncElectives[bestSubject.code] = [];
                            syncElectives[bestSubject.code].push({ d, s });
                        }
                    }
                }
            }
        }
    }
    if (theoryPoolWk.length > 0) {
        for (let retry = 0; retry < 5; retry++) {
            let dayIndices = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
            for (const d of dayIndices) {
                for (let s = 0; s < SLOTS; s++) {
                    if (!grid[d][s] && theoryPoolWk.length > 0) {
                        let bestIdx = -1;
                        for (let i = 0; i < theoryPoolWk.length; i++) {
                            const sub = theoryPoolWk[i];
                            let isBlocked = false;
                            if (sub.teacherName && sub.teacherName !== 'TBA') {
                                const tName = sub.teacherName.toUpperCase();
                                if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has(tName)) isBlocked = true;
                            }
                            if (!isBlocked) { bestIdx = i; break; }
                        }
                        if (bestIdx > -1) {
                            const bestSubject = theoryPoolWk[bestIdx];
                            grid[d][s] = { ...bestSubject, duration: 1, isStart: true };
                            theoryPoolWk.splice(bestIdx, 1);
                            if (isElective(bestSubject)) {
                                if (!syncElectives[bestSubject.code]) syncElectives[bestSubject.code] = [];
                                syncElectives[bestSubject.code].push({ d, s });
                            }
                        }
                    }
                }
            }
        }
    }
    if (theoryPoolWk.length > 0) {
        console.log('[TimerGen] Forcing placement for remaining subjects:', theoryPoolWk.length);
        let dayIndices = [0, 1, 2, 3, 4];
        for (const d of dayIndices) {
            for (let s = 0; s < SLOTS; s++) {
                if (!grid[d][s] && theoryPoolWk.length > 0) {
                    const bestSubject = theoryPoolWk.shift();
                    grid[d][s] = { ...bestSubject, duration: 1, isStart: true, isForced: true };
                    if (isElective(bestSubject)) {
                        if (!syncElectives[bestSubject.code]) syncElectives[bestSubject.code] = [];
                        syncElectives[bestSubject.code].push({ d, s });
                    }
                }
            }
        }
    }
    const satD = 5;
    theoryPoolSat.sort(() => Math.random() - 0.5);
    for (let s = 0; s < SLOTS; s++) {
        if (!grid[satD][s] && theoryPoolSat.length > 0) {
            const sub = theoryPoolSat.shift();
            grid[satD][s] = { ...sub, duration: 1, isStart: true };
            if (isElective(sub)) {
                if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                syncElectives[sub.code].push({ d: satD, s });
            }
        }
    }
    for (let s = 0; s < SLOTS; s++) {
        if (!grid[satD][s] && theoryPoolWk.length > 0) {
            const sub = theoryPoolWk.shift();
            grid[satD][s] = { ...sub, duration: 1, isStart: true };
            if (isElective(sub)) {
                if (!syncElectives[sub.code]) syncElectives[sub.code] = [];
                syncElectives[sub.code].push({ d: satD, s });
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