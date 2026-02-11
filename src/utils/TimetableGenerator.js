export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const isBlockSubject = (subject) => {
    if (!subject) return false;
    const name = String(subject.name || '').toUpperCase();
    const type = String(subject.type || '').toUpperCase();
    const isLabName = name.includes('LAB') || name.includes('PRACTICAL') || name.includes('PROJECT');
    if ((type === 'THEORY' || type === 'LECTURE') && !isLabName) return false;
    return isLabName ||
        type.includes('LAB') ||
        type.includes('PRACTICAL') ||
        name.includes('INTEGRATED') ||
        name.includes('GRAPHICS');
};
export const generateClassTimetable = (semester, section, rawSubjects, reservedSlots = {}, syncElectives = {}, relaxed = false, globalLabUsage = {}, slotsCount = 7, globalFacultyLoad = {}, semesterLabSlots = {}) => {
    const SLOTS = slotsCount;
    const grid = Array(6).fill(null).map(() => Array(SLOTS).fill(null));
    const counts = rawSubjects.map((s, idx) => {
        const wk = parseInt(s.credit) || 0;
        const sat = parseInt(s.satCount) || 0;
        const isLab = isBlockSubject(s);
        return {
            ...s,
            subIdx: idx,
            remWk: wk,
            remSat: sat,
            totalReq: wk + sat,
            labPart: isLab ? (wk + sat) : 0
        };
    });
    const isElective = (s) => (s.type && s.type.toUpperCase().includes('ELECTIVE')) || (s.name && s.name.toUpperCase().includes('ELECTIVE'));
    counts.forEach(sub => {
        if (!isBlockSubject(sub)) return;
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
    counts.filter(s => isElective(s) && isBlockSubject(s)).forEach(sub => {
        if (syncElectives[sub.code] && Array.isArray(syncElectives[sub.code])) {
            syncElectives[sub.code].forEach(slot => {
                const { d, s } = slot;
                const currentSub = counts.find(c => c.code === sub.code);
                if (currentSub && (d === 5 ? currentSub.remSat > 0 : currentSub.remWk > 0)) {
                    if (d < 6 && s < SLOTS && !grid[d][s]) {
                        grid[d][s] = { ...currentSub, duration: 1, isStart: true, isSync: true };
                        if (d === 5) currentSub.remSat--; else currentSub.remWk--;
                    }
                }
            });
        }
    });
    const sectionChar = String(section).replace(/[^A-Za-z]/g, '').toUpperCase();
    const sectionIndex = (sectionChar.charCodeAt(0) || 65) - 65;
    const baseDays = [0, 1, 2, 3, 4];
    const rotatedDays = [...baseDays.slice(sectionIndex % 5), ...baseDays.slice(0, sectionIndex % 5)];
    const preferredFreeDay = (sectionIndex + 2) % 5;
    const dayOrder = rotatedDays.filter(d => d !== preferredFreeDay);
    dayOrder.push(preferredFreeDay);
    counts.filter(isBlockSubject).forEach(lab => {
        const isIntegrated = String(lab.type || '').toUpperCase().includes('INTEGRATED') || String(lab.name || '').toUpperCase().includes('INTEGRATED');
        let blocksFound = 0;
        for (let d = 0; d < 5; d++) {
            if (grid[d].some(c => c && String(c.code).includes(lab.code) && (c.isLab || (c.duration && c.duration >= 2)))) blocksFound++;
        }
        let maxBlocks = isIntegrated ? 1 : 10;
        let attempt = 0;
        while (lab.remWk >= 2 && blocksFound < maxBlocks && attempt < 800) {
            const theoryPart = lab.totalReq - (lab.labPart || 0);
            if (lab.remWk <= theoryPart) break;
            attempt++;
            let duration = isIntegrated ? (lab.remWk >= 3 ? 3 : 2) : (lab.remWk >= 4 ? 4 : (lab.remWk >= 3 ? 3 : 2));
            if (String(lab.code || '').toUpperCase().includes('GE2C81')) duration = 4;
            if (duration > lab.remWk) duration = lab.remWk;
            if (duration < 2) break;
            let found = false;
            const maxPass = relaxed ? 4 : 2;
            for (let pass = 0; pass < maxPass; pass++) {
                for (const d of dayOrder) {
                    if (globalLabUsage[`${d}-${lab.code}`]) continue;
                    if (pass < 2 && grid[d].some(c => c && (c.isLab || isBlockSubject(c)))) continue;
                    if (grid[d].some(c => c && c.code === lab.code)) continue;
                    let validStarts = [1, 4];
                    if (pass >= 1) validStarts = [1, 2, 4, 5];
                    if (duration === 4) validStarts = [1];
                    validStarts.sort(() => Math.random() - 0.5);
                    for (let s of validStarts) {
                        if (s + duration > SLOTS) continue;
                        if (pass === 0 && semesterLabSlots[`${d}-${s}`]) continue;
                        if (reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has('LAB_START') && pass < 2) continue;
                        if (duration < 4 && s <= 3 && s + duration > 4) continue;
                        let free = true;

                        // Check Teacher Conflict for ALL slots of the lab
                        for (let k = 0; k < duration; k++) {
                            const slotKey = `${d}-${s + k}`;
                            if (reservedSlots[slotKey]) {
                                const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
                                if (teachers.some(t => reservedSlots[slotKey].has(String(t).trim().toUpperCase()))) {
                                    free = false;
                                    break;
                                }
                            }
                        }
                        if (!free) continue;

                        let subjectsToDisplace = [];
                        for (let k = 0; k < duration; k++) {
                            const existing = grid[d][s + k];
                            if (existing) {
                                if (existing.isLab || existing.duration > 1 || existing.isSync) {
                                    free = false;
                                    break;
                                }
                                if (pass === 0) {
                                    free = false;
                                    break;
                                }
                                subjectsToDisplace.push({ subject: existing, slot: s + k });
                            }
                        }
                        if (free) {
                            subjectsToDisplace.forEach(item => {
                                const isItemLab = item.subject.isLab || item.subject.duration > 1;
                                const original = counts.find(c =>
                                    (item.subject.subIdx !== undefined ? c.subIdx === item.subject.subIdx : c.code === item.subject.code) &&
                                    isBlockSubject(c) === isItemLab
                                );
                                if (original) {
                                    const currentAllocated = grid.flat().filter(cell => {
                                        if (!cell || !cell.code) return false;
                                        const codes = String(cell.code).split('/').map(c => c.trim());
                                        const isCellLab = cell.isLab || cell.duration > 1;
                                        return codes.includes(original.code) && isCellLab === isBlockSubject(original);
                                    }).length;

                                    if (currentAllocated <= original.totalReq) {
                                        if (d === 5) original.remSat++; else original.remWk++;
                                    }
                                }
                                grid[d][item.slot] = null;
                            });
                            for (let k = 0; k < duration; k++) {
                                const suffix = isIntegrated ? ' (Int.)' : ' (Lab)';
                                grid[d][s + k] = {
                                    ...lab,
                                    isStart: k === 0,
                                    duration,
                                    isLab: true,
                                    displayCode: lab.code + (k === 0 ? suffix : '')
                                };
                                if (semesterLabSlots) {
                                    semesterLabSlots[`${d}-${s + k}`] = true;
                                }
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
    });
    const unplacedLabs = counts.filter(lab => {
        if (!isBlockSubject(lab)) return false;
        const theoryPart = lab.totalReq - (lab.labPart || 0);
        return lab.remWk > theoryPart && lab.remWk >= 2;
    });
    if (unplacedLabs.length > 0) {
        return null;
    }
    let theoryPoolWk = [];
    let theoryPoolSat = [];
    counts.forEach(sub => {
        const placedAlreadyTotal = grid.flat().filter(cell => {
            if (!cell || !cell.code) return false;
            const codes = String(cell.code).split('/').map(c => c.trim());
            const isCellLab = cell.isLab || (cell.duration && cell.duration > 1);
            return codes.includes(sub.code) && isCellLab === isBlockSubject(sub);
        }).length;

        const missingTotal = sub.totalReq - placedAlreadyTotal;

        if (missingTotal > 0) {
            let toSat = Math.min(missingTotal, sub.remSat);
            let toWk = missingTotal - toSat;
            for (let i = 0; i < toWk; i++) theoryPoolWk.push({ ...sub, isLab: false });
            for (let i = 0; i < toSat; i++) theoryPoolSat.push({ ...sub, isLab: false });
        }
    });
    const usedSlotsBySubject = {};
    const totalReqByCode = {};
    counts.forEach(s => {
        usedSlotsBySubject[s.code] = new Set();
        totalReqByCode[s.code] = (totalReqByCode[s.code] || 0) + s.totalReq;
    });
    grid.forEach((day, d) => {
        day.forEach((cell, s) => {
            if (cell && cell.code) {
                const codes = String(cell.code).split('/').map(c => c.trim());
                codes.forEach(c => {
                    if (usedSlotsBySubject[c]) usedSlotsBySubject[c].add(s);
                });
            }
        });
    });
    let pool = [...theoryPoolWk];
    pool.sort((a, b) => {
        const aEl = isElective(a);
        const bEl = isElective(b);
        if (!aEl && bEl) return -1;
        if (aEl && !bEl) return 1;
        return 0;
    });
    theoryPoolWk = [];
    const labSlotsArray = Object.keys(semesterLabSlots).map(k => {
        const [d, s] = k.split('-').map(Number);
        return { d, s };
    }).sort(() => Math.random() - 0.5);
    labSlotsArray.forEach(({ d, s }) => {
        if (d >= 5 || s >= SLOTS || grid[d][s]) return;
        const bestIdx = pool.findIndex(sub => {
            if (isElective(sub)) return false;
            if (grid[d].some(c => {
                if (!c || !c.code) return false;
                return String(c.code).split('/').map(code => code.trim()).includes(sub.code);
            })) return false;

            const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
            if (teachers.some(t => reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has(String(t).trim().toUpperCase()))) return false;

            return true;
        });
        if (bestIdx > -1) {
            const sub = pool.splice(bestIdx, 1)[0];
            grid[d][s] = { ...sub, duration: 1, isStart: true };
            if (usedSlotsBySubject[sub.code]) usedSlotsBySubject[sub.code].add(s);
        }
    });
    while (pool.length > 0) {
        const sub = pool.shift();
        let placed = false;
        const dOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        const sOrder = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
        const overallTotal = totalReqByCode[sub.code] || 0;
        for (const d of dOrder) {
            const isSubElective = isElective(sub);
            const existingInDay = grid[d].map((c, i) => {
                if (!c || !c.code) return -1;
                const codes = String(c.code).split('/').map(code => code.trim());
                return codes.includes(sub.code) ? i : -1;
            }).filter(idx => idx !== -1);
            if (overallTotal <= 6) {
                if (existingInDay.length > 0) continue;
            } else {
                if (existingInDay.length >= 2) continue;
            }
            for (const s of sOrder) {
                if (grid[d][s]) continue;
                if (isSubElective && semesterLabSlots[`${d}-${s}`]) continue;
                if (usedSlotsBySubject[sub.code]?.has(s)) continue;
                if (overallTotal > 6 && existingInDay.length === 1) {
                    const firstWasBeforeLunch = existingInDay[0] < 4;
                    const currentIsBeforeLunch = s < 4;
                    if (firstWasBeforeLunch === currentIsBeforeLunch) continue;
                }

                const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
                if (teachers.some(t => reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has(String(t).trim().toUpperCase()))) continue;

                grid[d][s] = { ...sub, duration: 1, isStart: true };
                if (usedSlotsBySubject[sub.code]) usedSlotsBySubject[sub.code].add(s);
                placed = true;
                break;
            }
            if (placed) break;
        }
        if (!placed) theoryPoolWk.push(sub);
    }
    let theoryAttempt = 0;
    while (theoryPoolWk.length > 0 && theoryAttempt < 500) {
        theoryAttempt++;
        const sub = theoryPoolWk[0];
        let placed = false;
        const overallTotal = totalReqByCode[sub.code] || 0;
        const dOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
        for (const d of dOrder) {
            const existingInDay = grid[d].filter(c => {
                if (!c || !c.code) return false;
                return String(c.code).split('/').map(code => code.trim()).includes(sub.code);
            }).length;
            if (overallTotal <= 6 && existingInDay > 0) continue;
            if (overallTotal > 6 && existingInDay >= 2) continue;
            const sOrder = Array.from({ length: SLOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (const s of sOrder) {
                if (grid[d][s]) continue;
                if (isElective(sub) && semesterLabSlots[`${d}-${s}`]) continue;

                const teachers = sub.allTeachers || (sub.teacherName !== 'TBA' ? String(sub.teacherName).split('/') : []);
                if (teachers.some(t => reservedSlots[`${d}-${s}`] && reservedSlots[`${d}-${s}`].has(String(t).trim().toUpperCase()))) continue;

                grid[d][s] = { ...theoryPoolWk.shift(), duration: 1, isStart: true };
                placed = true;
                break;
            }
            if (placed) break;
        }
        if (!placed) theoryPoolWk.push(theoryPoolWk.shift());
    }
    if (theoryPoolSat.length > 0) {
        const d = 5;
        for (let s = 0; s < SLOTS; s++) {
            if (!grid[d][s] && theoryPoolSat.length > 0) {
                let bestIdx = theoryPoolSat.findIndex(sub => !grid[d].some(c => c && c.code === sub.code));
                if (bestIdx === -1) bestIdx = 0;
                const sub = theoryPoolSat.splice(bestIdx, 1)[0];
                grid[d][s] = { ...sub, duration: 1, isStart: true };
            }
        }
    }
    if (theoryPoolWk.length > 0) {
        let dayIndices = [0, 1, 2, 3, 4];
        for (const d of dayIndices) {
            for (let s = 0; s < SLOTS; s++) {
                if (!grid[d][s] && theoryPoolWk.length > 0) {
                    const sub = theoryPoolWk.shift();
                    grid[d][s] = { ...sub, duration: 1, isStart: true };
                }
            }
        }
    }
    return grid;
};